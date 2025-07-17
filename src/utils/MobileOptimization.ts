// src/utils/MobileOptimization.ts

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isLowEnd: boolean;
  hasHighDPI: boolean;
  supportsWebGL: boolean;
  batteryLevel?: number;
  connectionType?: string;
  memoryLimit?: number;
}

export interface PerformanceSettings {
  enableParticles: boolean;
  enableSmoothMovement: boolean;
  enableSoundEffects: boolean;
  enableWebGL: boolean;
  maxPowerUps: number;
  particleCount: number;
  animationQuality: 'low' | 'medium' | 'high';
  frameRateTarget: number;
}

/**
 * Mobile performance optimization manager
 */
export class MobileOptimizer {
  private deviceInfo: DeviceInfo;
  private performanceSettings: PerformanceSettings;
  private frameRateMonitor: FrameRateMonitor;
  private batteryMonitor: BatteryMonitor;
  private isOptimizationActive: boolean = false;

  constructor() {
    this.deviceInfo = this.detectDeviceCapabilities();
    this.performanceSettings = this.getOptimalSettings();
    this.frameRateMonitor = new FrameRateMonitor();
    this.batteryMonitor = new BatteryMonitor();
    
    this.initializeOptimizations();
  }

  /**
   * Detect device capabilities
   */
  private detectDeviceCapabilities(): DeviceInfo {
    const userAgent = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isTablet = /iPad|Android(?=.*Tablet)|Tablet/i.test(userAgent);
    const hasHighDPI = window.devicePixelRatio > 1.5;
    
    // Detect low-end devices
    const isLowEnd = this.detectLowEndDevice();
    
    // Check WebGL support
    const supportsWebGL = this.checkWebGLSupport();
    
    // Get connection info
    const connectionType = this.getConnectionType();
    
    // Get memory info (if available)
    const memoryLimit = this.getMemoryLimit();

    return {
      isMobile,
      isTablet,
      isLowEnd,
      hasHighDPI,
      supportsWebGL,
      connectionType,
      memoryLimit
    };
  }

  /**
   * Detect low-end devices
   */
  private detectLowEndDevice(): boolean {
    // Check various indicators of low-end devices
    const hardwareConcurrency = navigator.hardwareConcurrency || 1;
    const deviceMemory = (navigator as any).deviceMemory || 1;
    const userAgent = navigator.userAgent;
    
    // Low core count
    if (hardwareConcurrency <= 2) return true;
    
    // Low memory
    if (deviceMemory <= 2) return true;
    
    // Known low-end device patterns
    const lowEndPatterns = [
      /Android.*(?:Go|Lite)/i,
      /iPhone.*(?:5|6)(?!.*Plus)/i,
      /iPad.*(?:2|3|4)(?!.*Pro)/i
    ];
    
    return lowEndPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Check WebGL support
   */
  private checkWebGLSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch {
      return false;
    }
  }

  /**
   * Get connection type
   */
  private getConnectionType(): string {
    const connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection;
    
    return connection?.effectiveType || 'unknown';
  }

  /**
   * Get memory limit
   */
  private getMemoryLimit(): number | undefined {
    return (navigator as any).deviceMemory;
  }

  /**
   * Get optimal performance settings based on device
   */
  private getOptimalSettings(): PerformanceSettings {
    const { isMobile, isLowEnd, hasHighDPI, supportsWebGL } = this.deviceInfo;

    if (isLowEnd) {
      return {
        enableParticles: false,
        enableSmoothMovement: false,
        enableSoundEffects: false,
        enableWebGL: false,
        maxPowerUps: 2,
        particleCount: 0,
        animationQuality: 'low',
        frameRateTarget: 30
      };
    } else if (isMobile && !hasHighDPI) {
      return {
        enableParticles: true,
        enableSmoothMovement: false,
        enableSoundEffects: true,
        enableWebGL: supportsWebGL,
        maxPowerUps: 3,
        particleCount: 20,
        animationQuality: 'medium',
        frameRateTarget: 45
      };
    } else if (isMobile && hasHighDPI) {
      return {
        enableParticles: true,
        enableSmoothMovement: true,
        enableSoundEffects: true,
        enableWebGL: supportsWebGL,
        maxPowerUps: 4,
        particleCount: 50,
        animationQuality: 'medium',
        frameRateTarget: 60
      };
    } else {
      // Desktop
      return {
        enableParticles: true,
        enableSmoothMovement: true,
        enableSoundEffects: true,
        enableWebGL: supportsWebGL,
        maxPowerUps: 5,
        particleCount: 100,
        animationQuality: 'high',
        frameRateTarget: 60
      };
    }
  }

  /**
   * Initialize optimizations
   */
  private initializeOptimizations(): void {
    // Set up frame rate monitoring
    this.frameRateMonitor.onFrameRateChange((fps) => {
      this.handleFrameRateChange(fps);
    });

    // Set up battery monitoring
    this.batteryMonitor.onBatteryLevelChange((level) => {
      this.handleBatteryLevelChange(level);
    });

    // Apply initial optimizations
    this.applyOptimizations();
  }

  /**
   * Handle frame rate changes
   */
  private handleFrameRateChange(fps: number): void {
    const target = this.performanceSettings.frameRateTarget;
    
    if (fps < target * 0.8) {
      // Performance is poor, reduce quality
      this.reduceQuality();
    } else if (fps > target * 1.1 && this.canIncreaseQuality()) {
      // Performance is good, can increase quality
      this.increaseQuality();
    }
  }

  /**
   * Handle battery level changes
   */
  private handleBatteryLevelChange(level: number): void {
    if (level < 0.2) {
      // Low battery, enable power saving mode
      this.enablePowerSavingMode();
    } else if (level > 0.5 && this.isOptimizationActive) {
      // Battery recovered, can restore normal mode
      this.disablePowerSavingMode();
    }
  }

  /**
   * Reduce quality settings
   */
  private reduceQuality(): void {
    const settings = this.performanceSettings;
    
    if (settings.animationQuality === 'high') {
      settings.animationQuality = 'medium';
    } else if (settings.animationQuality === 'medium') {
      settings.animationQuality = 'low';
    }
    
    if (settings.particleCount > 10) {
      settings.particleCount = Math.floor(settings.particleCount * 0.7);
    }
    
    if (settings.maxPowerUps > 2) {
      settings.maxPowerUps = Math.max(2, settings.maxPowerUps - 1);
    }
    
    if (settings.enableSmoothMovement) {
      settings.enableSmoothMovement = false;
    }
    
    this.applyOptimizations();
  }

  /**
   * Increase quality settings
   */
  private increaseQuality(): void {
    const settings = this.performanceSettings;
    const optimal = this.getOptimalSettings();
    
    if (settings.animationQuality === 'low' && optimal.animationQuality !== 'low') {
      settings.animationQuality = 'medium';
    } else if (settings.animationQuality === 'medium' && optimal.animationQuality === 'high') {
      settings.animationQuality = 'high';
    }
    
    if (settings.particleCount < optimal.particleCount) {
      settings.particleCount = Math.min(optimal.particleCount, settings.particleCount + 10);
    }
    
    if (settings.maxPowerUps < optimal.maxPowerUps) {
      settings.maxPowerUps = Math.min(optimal.maxPowerUps, settings.maxPowerUps + 1);
    }
    
    if (!settings.enableSmoothMovement && optimal.enableSmoothMovement) {
      settings.enableSmoothMovement = true;
    }
    
    this.applyOptimizations();
  }

  /**
   * Check if quality can be increased
   */
  private canIncreaseQuality(): boolean {
    const settings = this.performanceSettings;
    const optimal = this.getOptimalSettings();
    
    return settings.animationQuality !== optimal.animationQuality ||
           settings.particleCount < optimal.particleCount ||
           settings.maxPowerUps < optimal.maxPowerUps ||
           (!settings.enableSmoothMovement && optimal.enableSmoothMovement);
  }

  /**
   * Enable power saving mode
   */
  private enablePowerSavingMode(): void {
    this.isOptimizationActive = true;
    
    const settings = this.performanceSettings;
    settings.enableParticles = false;
    settings.enableSmoothMovement = false;
    settings.enableWebGL = false;
    settings.particleCount = 0;
    settings.animationQuality = 'low';
    settings.frameRateTarget = 30;
    
    this.applyOptimizations();
  }

  /**
   * Disable power saving mode
   */
  private disablePowerSavingMode(): void {
    this.isOptimizationActive = false;
    this.performanceSettings = this.getOptimalSettings();
    this.applyOptimizations();
  }

  /**
   * Apply current optimizations
   */
  private applyOptimizations(): void {
    // This method would be called by the game to apply settings
    // The actual implementation would depend on how the game systems are structured
    
    // Dispatch custom event with optimization settings
    const event = new CustomEvent('mobileOptimizationUpdate', {
      detail: {
        deviceInfo: this.deviceInfo,
        settings: this.performanceSettings
      }
    });
    
    window.dispatchEvent(event);
  }

  /**
   * Get current device info
   */
  public getDeviceInfo(): DeviceInfo {
    return { ...this.deviceInfo };
  }

  /**
   * Get current performance settings
   */
  public getPerformanceSettings(): PerformanceSettings {
    return { ...this.performanceSettings };
  }

  /**
   * Override performance settings
   */
  public setPerformanceSettings(settings: Partial<PerformanceSettings>): void {
    this.performanceSettings = { ...this.performanceSettings, ...settings };
    this.applyOptimizations();
  }

  /**
   * Start monitoring
   */
  public startMonitoring(): void {
    this.frameRateMonitor.start();
    this.batteryMonitor.start();
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    this.frameRateMonitor.stop();
    this.batteryMonitor.stop();
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    averageFPS: number;
    batteryLevel: number;
    isOptimized: boolean;
    qualityLevel: string;
  } {
    return {
      averageFPS: this.frameRateMonitor.getAverageFPS(),
      batteryLevel: this.batteryMonitor.getBatteryLevel(),
      isOptimized: this.isOptimizationActive,
      qualityLevel: this.performanceSettings.animationQuality
    };
  }
}

/**
 * Frame rate monitor
 */
class FrameRateMonitor {
  private frameRates: number[] = [];
  private lastFrameTime: number = 0;
  private isMonitoring: boolean = false;
  private animationFrame: number | null = null;
  private callback: ((fps: number) => void) | null = null;

  public start(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.lastFrameTime = performance.now();
    this.monitor();
  }

  public stop(): void {
    this.isMonitoring = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  public onFrameRateChange(callback: (fps: number) => void): void {
    this.callback = callback;
  }

  public getAverageFPS(): number {
    if (this.frameRates.length === 0) return 0;
    return this.frameRates.reduce((sum, fps) => sum + fps, 0) / this.frameRates.length;
  }

  private monitor(): void {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    const fps = 1000 / deltaTime;

    this.frameRates.push(fps);
    
    // Keep only recent frame rates
    if (this.frameRates.length > 60) {
      this.frameRates.shift();
    }

    // Call callback every 30 frames
    if (this.frameRates.length % 30 === 0 && this.callback) {
      this.callback(this.getAverageFPS());
    }

    this.lastFrameTime = currentTime;
    this.animationFrame = requestAnimationFrame(() => this.monitor());
  }
}

/**
 * Battery monitor
 */
class BatteryMonitor {
  private batteryLevel: number = 1;
  private isCharging: boolean = false;
  private callback: ((level: number) => void) | null = null;
  private battery: any = null;

  public async start(): Promise<void> {
    try {
      // @ts-ignore - Battery API is experimental
      this.battery = await navigator.getBattery?.();
      
      if (this.battery) {
        this.batteryLevel = this.battery.level;
        this.isCharging = this.battery.charging;
        
        this.battery.addEventListener('levelchange', this.handleBatteryChange.bind(this));
        this.battery.addEventListener('chargingchange', this.handleChargingChange.bind(this));
      }
    } catch {
      // Battery API not supported
    }
  }

  public stop(): void {
    if (this.battery) {
      this.battery.removeEventListener('levelchange', this.handleBatteryChange.bind(this));
      this.battery.removeEventListener('chargingchange', this.handleChargingChange.bind(this));
    }
  }

  public onBatteryLevelChange(callback: (level: number) => void): void {
    this.callback = callback;
  }

  public getBatteryLevel(): number {
    return this.batteryLevel;
  }

  public isChargingState(): boolean {
    return this.isCharging;
  }

  private handleBatteryChange(): void {
    if (this.battery) {
      this.batteryLevel = this.battery.level;
      if (this.callback) {
        this.callback(this.batteryLevel);
      }
    }
  }

  private handleChargingChange(): void {
    if (this.battery) {
      this.isCharging = this.battery.charging;
    }
  }
}

// Global mobile optimizer instance
export const mobileOptimizer = new MobileOptimizer();