// src/utils/FeatureFlags.ts
import React from 'react';

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage?: number;
  conditions?: FeatureCondition[];
  metadata?: { [key: string]: any };
}

export interface FeatureCondition {
  type: 'user_id' | 'device_type' | 'browser' | 'custom';
  operator: 'equals' | 'contains' | 'in' | 'greater_than' | 'less_than';
  value: any;
}

export interface FeatureFlagConfig {
  flags: { [key: string]: FeatureFlag };
  userId?: string;
  deviceInfo?: {
    type: 'mobile' | 'tablet' | 'desktop';
    browser: string;
    version: string;
  };
  customAttributes?: { [key: string]: any };
}

/**
 * Feature flag manager for A/B testing and gradual rollouts
 */
export class FeatureFlagManager {
  private flags: Map<string, FeatureFlag> = new Map();
  private userId: string;
  private deviceInfo: any;
  private customAttributes: { [key: string]: any } = {};
  private overrides: Map<string, boolean> = new Map();
  private listeners: Map<string, ((enabled: boolean) => void)[]> = new Map();

  constructor(config?: Partial<FeatureFlagConfig>) {
    this.userId = config?.userId || this.generateUserId();
    this.deviceInfo = config?.deviceInfo || this.detectDeviceInfo();
    this.customAttributes = config?.customAttributes || {};

    // Load default flags
    this.initializeDefaultFlags();

    // Load overrides from localStorage
    this.loadOverrides();

    // Load remote config if available
    this.loadRemoteConfig();
  }

  /**
   * Initialize default feature flags
   */
  private initializeDefaultFlags(): void {
    const defaultFlags: FeatureFlag[] = [
      {
        key: 'power_ups',
        name: 'Power-up System',
        description: 'Enable power-ups in the game',
        enabled: true,
        rolloutPercentage: 100
      },
      {
        key: 'wave_system',
        name: 'Wave Progression',
        description: 'Enable progressive wave system in Arena mode',
        enabled: true,
        rolloutPercentage: 100
      },
      {
        key: 'boss_snakes',
        name: 'Boss Snakes',
        description: 'Enable boss snakes in wave system',
        enabled: true,
        rolloutPercentage: 90,
        conditions: [
          {
            type: 'device_type',
            operator: 'in',
            value: ['desktop', 'tablet']
          }
        ]
      },
      {
        key: 'particle_effects',
        name: 'Particle Effects',
        description: 'Enable particle effects and visual polish',
        enabled: true,
        rolloutPercentage: 80,
        conditions: [
          {
            type: 'device_type',
            operator: 'equals',
            value: 'desktop'
          }
        ]
      },
      {
        key: 'smooth_movement',
        name: 'Smooth Movement',
        description: 'Enable smooth movement interpolation',
        enabled: true,
        rolloutPercentage: 70
      },
      {
        key: 'sound_effects',
        name: 'Sound Effects',
        description: 'Enable sound effects',
        enabled: true,
        rolloutPercentage: 85
      },
      {
        key: 'webgl_rendering',
        name: 'WebGL Rendering',
        description: 'Enable WebGL-based rendering for better performance',
        enabled: false,
        rolloutPercentage: 30,
        conditions: [
          {
            type: 'device_type',
            operator: 'equals',
            value: 'desktop'
          }
        ]
      },
      {
        key: 'combo_system',
        name: 'Combo System',
        description: 'Enable combo scoring system',
        enabled: true,
        rolloutPercentage: 95
      },
      {
        key: 'death_animations',
        name: 'Death Animations',
        description: 'Enable death animations instead of instant disappearance',
        enabled: true,
        rolloutPercentage: 75
      },
      {
        key: 'mobile_optimizations',
        name: 'Mobile Optimizations',
        description: 'Enable mobile-specific performance optimizations',
        enabled: true,
        rolloutPercentage: 100,
        conditions: [
          {
            type: 'device_type',
            operator: 'in',
            value: ['mobile', 'tablet']
          }
        ]
      }
    ];

    defaultFlags.forEach(flag => {
      this.flags.set(flag.key, flag);
    });
  }

  /**
   * Check if a feature is enabled
   */
  public isEnabled(flagKey: string): boolean {
    // Check for override first
    if (this.overrides.has(flagKey)) {
      return this.overrides.get(flagKey)!;
    }

    const flag = this.flags.get(flagKey);
    if (!flag) {
      console.warn(`Feature flag '${flagKey}' not found`);
      return false;
    }

    // Check base enabled state
    if (!flag.enabled) {
      return false;
    }

    // Check conditions
    if (flag.conditions && !this.evaluateConditions(flag.conditions)) {
      return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      const hash = this.hashString(this.userId + flagKey);
      const userPercentile = hash % 100;
      return userPercentile < flag.rolloutPercentage;
    }

    return true;
  }

  /**
   * Get feature flag details
   */
  public getFlag(flagKey: string): FeatureFlag | null {
    return this.flags.get(flagKey) || null;
  }

  /**
   * Get all feature flags
   */
  public getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Override a feature flag (for testing/debugging)
   */
  public override(flagKey: string, enabled: boolean): void {
    this.overrides.set(flagKey, enabled);
    this.saveOverrides();
    this.notifyListeners(flagKey, enabled);
  }

  /**
   * Remove override for a feature flag
   */
  public removeOverride(flagKey: string): void {
    this.overrides.delete(flagKey);
    this.saveOverrides();
    this.notifyListeners(flagKey, this.isEnabled(flagKey));
  }

  /**
   * Clear all overrides
   */
  public clearOverrides(): void {
    const keys = Array.from(this.overrides.keys());
    this.overrides.clear();
    this.saveOverrides();
    
    keys.forEach(key => {
      this.notifyListeners(key, this.isEnabled(key));
    });
  }

  /**
   * Listen for feature flag changes
   */
  public onChange(flagKey: string, callback: (enabled: boolean) => void): () => void {
    if (!this.listeners.has(flagKey)) {
      this.listeners.set(flagKey, []);
    }
    
    this.listeners.get(flagKey)!.push(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(flagKey);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Update feature flag configuration
   */
  public updateFlag(flagKey: string, updates: Partial<FeatureFlag>): void {
    const flag = this.flags.get(flagKey);
    if (flag) {
      const updatedFlag = { ...flag, ...updates };
      this.flags.set(flagKey, updatedFlag);
      this.notifyListeners(flagKey, this.isEnabled(flagKey));
    }
  }

  /**
   * Add a new feature flag
   */
  public addFlag(flag: FeatureFlag): void {
    this.flags.set(flag.key, flag);
  }

  /**
   * Get feature flag statistics
   */
  public getStats(): {
    totalFlags: number;
    enabledFlags: number;
    overriddenFlags: number;
    flagsByCategory: { [category: string]: number };
  } {
    const totalFlags = this.flags.size;
    const enabledFlags = Array.from(this.flags.keys()).filter(key => this.isEnabled(key)).length;
    const overriddenFlags = this.overrides.size;

    return {
      totalFlags,
      enabledFlags,
      overriddenFlags,
      flagsByCategory: {} // Could categorize flags if needed
    };
  }

  /**
   * Export configuration for debugging
   */
  public exportConfig(): {
    flags: FeatureFlag[];
    overrides: { [key: string]: boolean };
    userId: string;
    deviceInfo: any;
  } {
    return {
      flags: Array.from(this.flags.values()),
      overrides: Object.fromEntries(this.overrides),
      userId: this.userId,
      deviceInfo: this.deviceInfo
    };
  }

  /**
   * Evaluate feature flag conditions
   */
  private evaluateConditions(conditions: FeatureCondition[]): boolean {
    return conditions.every(condition => this.evaluateCondition(condition));
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: FeatureCondition): boolean {
    let actualValue: any;

    switch (condition.type) {
      case 'user_id':
        actualValue = this.userId;
        break;
      case 'device_type':
        actualValue = this.deviceInfo.type;
        break;
      case 'browser':
        actualValue = this.deviceInfo.browser;
        break;
      case 'custom':
        actualValue = this.customAttributes[condition.value];
        break;
      default:
        return false;
    }

    switch (condition.operator) {
      case 'equals':
        return actualValue === condition.value;
      case 'contains':
        return String(actualValue).includes(String(condition.value));
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(actualValue);
      case 'greater_than':
        return Number(actualValue) > Number(condition.value);
      case 'less_than':
        return Number(actualValue) < Number(condition.value);
      default:
        return false;
    }
  }

  /**
   * Generate a user ID for consistent rollout
   */
  private generateUserId(): string {
    let userId = localStorage.getItem('snakeGame_userId');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('snakeGame_userId', userId);
    }
    return userId;
  }

  /**
   * Detect device information
   */
  private detectDeviceInfo(): any {
    const userAgent = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isTablet = /iPad|Android(?=.*Tablet)|Tablet/i.test(userAgent);
    
    let deviceType = 'desktop';
    if (isMobile && !isTablet) deviceType = 'mobile';
    else if (isTablet) deviceType = 'tablet';

    let browser = 'unknown';
    if (userAgent.includes('Chrome')) browser = 'chrome';
    else if (userAgent.includes('Firefox')) browser = 'firefox';
    else if (userAgent.includes('Safari')) browser = 'safari';
    else if (userAgent.includes('Edge')) browser = 'edge';

    return {
      type: deviceType,
      browser,
      version: navigator.userAgent,
      userAgent
    };
  }

  /**
   * Hash string for consistent percentage rollouts
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Load overrides from localStorage
   */
  private loadOverrides(): void {
    try {
      const stored = localStorage.getItem('snakeGame_featureOverrides');
      if (stored) {
        const overrides = JSON.parse(stored);
        Object.entries(overrides).forEach(([key, value]) => {
          this.overrides.set(key, value as boolean);
        });
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Save overrides to localStorage
   */
  private saveOverrides(): void {
    try {
      const overrides = Object.fromEntries(this.overrides);
      localStorage.setItem('snakeGame_featureOverrides', JSON.stringify(overrides));
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Load remote configuration (placeholder for future implementation)
   */
  private async loadRemoteConfig(): Promise<void> {
    // This would fetch feature flag configuration from a remote service
    // For now, it's a placeholder
    try {
      // const response = await fetch('/api/feature-flags');
      // const config = await response.json();
      // this.updateFromRemoteConfig(config);
    } catch {
      // Use default configuration
    }
  }

  /**
   * Notify listeners of flag changes
   */
  private notifyListeners(flagKey: string, enabled: boolean): void {
    const callbacks = this.listeners.get(flagKey);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(enabled);
        } catch (error) {
          console.error(`Error in feature flag listener for '${flagKey}':`, error);
        }
      });
    }
  }
}

/**
 * React hook for using feature flags
 */
export function useFeatureFlag(flagKey: string): boolean {
  const [enabled, setEnabled] = React.useState(() => featureFlagManager.isEnabled(flagKey));

  React.useEffect(() => {
    const unsubscribe = featureFlagManager.onChange(flagKey, setEnabled);
    return unsubscribe;
  }, [flagKey]);

  return enabled;
}

/**
 * React hook for feature flag manager
 */
export function useFeatureFlagManager(): FeatureFlagManager {
  return featureFlagManager;
}

// Global feature flag manager instance
export const featureFlagManager = new FeatureFlagManager();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).featureFlags = featureFlagManager;
}