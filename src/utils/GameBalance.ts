// src/utils/GameBalance.ts

export interface GameBalanceConfig {
  powerUps: {
    spawnInterval: number; // milliseconds
    maxActive: number;
    effectDurations: {
      speedBoost: number;
      shield: number; // uses, not time
      ghostMode: number;
      freeze: number;
      scoreMultiplier: number;
    };
    spawnRates: {
      speedBoost: number;
      shield: number;
      ghostMode: number;
      freeze: number;
      scoreMultiplier: number;
    };
  };
  waves: {
    progressionTiming: number[]; // minutes for each wave
    aiCountProgression: number[];
    speedMultipliers: number[];
    bossWaveInterval: number; // every N waves
    bonusPointsBase: number;
  };
  scoring: {
    foodBasePoints: number;
    powerUpPoints: {
      speedBoost: number;
      shield: number;
      ghostMode: number;
      freeze: number;
      scoreMultiplier: number;
    };
    comboThreshold: number;
    comboTimeWindow: number; // milliseconds
    maxComboMultiplier: number;
    waveCompletionBonus: number;
  };
  difficulty: {
    aiIntelligenceProgression: number[];
    aiAggressionProgression: number[];
    foodSpawnRate: number;
    boardSize: number;
    gameSpeed: number; // milliseconds per move
  };
}

/**
 * Game balance and tuning system
 */
export class GameBalancer {
  private config: GameBalanceConfig;
  private playtestData: PlaytestData[] = [];

  constructor() {
    this.config = this.getDefaultConfig();
    this.loadSavedConfig();
  }

  /**
   * Get default balanced configuration
   */
  private getDefaultConfig(): GameBalanceConfig {
    return {
      powerUps: {
        spawnInterval: 25000, // 25 seconds
        maxActive: 4,
        effectDurations: {
          speedBoost: 5000, // 5 seconds
          shield: 1, // 1 use
          ghostMode: 3000, // 3 seconds
          freeze: 2000, // 2 seconds
          scoreMultiplier: 10000 // 10 seconds
        },
        spawnRates: {
          speedBoost: 0.3, // 30% chance
          shield: 0.25, // 25% chance
          ghostMode: 0.2, // 20% chance
          freeze: 0.15, // 15% chance
          scoreMultiplier: 0.1 // 10% chance
        }
      },
      waves: {
        progressionTiming: [0, 1, 2, 3.5, 5, 7, 9, 12, 15, 20], // minutes
        aiCountProgression: [3, 4, 4, 5, 5, 6, 6, 6, 6, 6],
        speedMultipliers: [1.0, 1.0, 1.15, 1.15, 1.3, 1.3, 1.45, 1.45, 1.6, 1.75],
        bossWaveInterval: 3, // Every 3rd wave
        bonusPointsBase: 100
      },
      scoring: {
        foodBasePoints: 10,
        powerUpPoints: {
          speedBoost: 25,
          shield: 30,
          ghostMode: 35,
          freeze: 40,
          scoreMultiplier: 50
        },
        comboThreshold: 2, // 2+ foods for combo
        comboTimeWindow: 2000, // 2 seconds
        maxComboMultiplier: 5.0,
        waveCompletionBonus: 200
      },
      difficulty: {
        aiIntelligenceProgression: [0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0, 1.0],
        aiAggressionProgression: [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95],
        foodSpawnRate: 6, // number of food items
        boardSize: 25,
        gameSpeed: 120 // milliseconds per move
      }
    };
  }

  /**
   * Get current configuration
   */
  public getConfig(): GameBalanceConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<GameBalanceConfig>): void {
    this.config = this.deepMerge(this.config, updates);
    this.saveConfig();
  }

  /**
   * Get power-up spawn interval based on game state
   */
  public getPowerUpSpawnInterval(waveNumber: number, playerCount: number): number {
    const baseInterval = this.config.powerUps.spawnInterval;
    
    // Reduce interval for higher waves (more frequent spawns)
    const waveMultiplier = Math.max(0.6, 1 - (waveNumber - 1) * 0.05);
    
    // Adjust for player count
    const playerMultiplier = Math.max(0.8, 1 - (playerCount - 1) * 0.1);
    
    return Math.floor(baseInterval * waveMultiplier * playerMultiplier);
  }

  /**
   * Get maximum active power-ups based on game state
   */
  public getMaxActivePowerUps(waveNumber: number, playerCount: number): number {
    const baseMax = this.config.powerUps.maxActive;
    
    // Increase max for higher waves
    const waveBonus = Math.floor((waveNumber - 1) / 2);
    
    // Adjust for player count
    const playerBonus = Math.floor((playerCount - 1) / 2);
    
    return Math.min(8, baseMax + waveBonus + playerBonus);
  }

  /**
   * Get AI difficulty for a specific wave
   */
  public getAIDifficulty(waveNumber: number): {
    intelligence: number;
    aggression: number;
    count: number;
    speedMultiplier: number;
  } {
    const index = Math.min(waveNumber - 1, this.config.waves.aiCountProgression.length - 1);
    
    return {
      intelligence: this.config.difficulty.aiIntelligenceProgression[index] || 1.0,
      aggression: this.config.difficulty.aiAggressionProgression[index] || 1.0,
      count: this.config.waves.aiCountProgression[index] || 6,
      speedMultiplier: this.config.waves.speedMultipliers[index] || 1.0
    };
  }

  /**
   * Calculate combo multiplier
   */
  public getComboMultiplier(comboCount: number): number {
    if (comboCount < this.config.scoring.comboThreshold) {
      return 1.0;
    }
    
    const multiplier = 1 + (comboCount - this.config.scoring.comboThreshold) * 0.5;
    return Math.min(this.config.scoring.maxComboMultiplier, multiplier);
  }

  /**
   * Calculate wave completion bonus
   */
  public getWaveCompletionBonus(waveNumber: number, survivalTime: number): number {
    const baseBonus = this.config.scoring.waveCompletionBonus;
    const waveMultiplier = waveNumber;
    const timeBonus = Math.floor(survivalTime / 1000) * 5; // 5 points per second
    
    return baseBonus * waveMultiplier + timeBonus;
  }

  /**
   * Get boss wave configuration
   */
  public getBossWaveConfig(waveNumber: number): {
    isBossWave: boolean;
    bossCount: number;
    bossHealth: number;
    specialAbilities: string[];
  } {
    const isBossWave = waveNumber % this.config.waves.bossWaveInterval === 0;
    
    if (!isBossWave) {
      return {
        isBossWave: false,
        bossCount: 0,
        bossHealth: 0,
        specialAbilities: []
      };
    }
    
    const bossLevel = Math.floor(waveNumber / this.config.waves.bossWaveInterval);
    
    return {
      isBossWave: true,
      bossCount: Math.min(2, Math.floor(bossLevel / 2) + 1),
      bossHealth: 2 + Math.floor(bossLevel / 2),
      specialAbilities: this.getBossAbilities(bossLevel)
    };
  }

  /**
   * Get boss abilities based on level
   */
  private getBossAbilities(level: number): string[] {
    const allAbilities = [
      'speed_burst',
      'wall_phase',
      'food_steal',
      'snake_stun',
      'size_growth',
      'teleport',
      'shield_break',
      'time_slow'
    ];
    
    const abilityCount = Math.min(3, Math.floor(level / 2) + 1);
    return allAbilities.slice(0, abilityCount);
  }

  /**
   * Record playtest data for balance analysis
   */
  public recordPlaytestData(data: PlaytestData): void {
    this.playtestData.push(data);
    
    // Keep only recent data (last 100 sessions)
    if (this.playtestData.length > 100) {
      this.playtestData.shift();
    }
    
    this.savePlaytestData();
  }

  /**
   * Analyze playtest data and suggest balance changes
   */
  public analyzeBalance(): BalanceAnalysis {
    if (this.playtestData.length < 10) {
      return {
        suggestions: ['Need more playtest data for analysis'],
        metrics: {},
        confidence: 0
      };
    }
    
    const analysis: BalanceAnalysis = {
      suggestions: [],
      metrics: this.calculateMetrics(),
      confidence: Math.min(1, this.playtestData.length / 50)
    };
    
    // Analyze survival times
    const avgSurvivalTime = analysis.metrics.averageSurvivalTime || 0;
    if (avgSurvivalTime < 120000) { // Less than 2 minutes
      analysis.suggestions.push('Game may be too difficult - consider reducing AI aggression or increasing power-up spawn rate');
    } else if (avgSurvivalTime > 600000) { // More than 10 minutes
      analysis.suggestions.push('Game may be too easy - consider increasing AI intelligence or reducing power-up effectiveness');
    }
    
    // Analyze power-up usage
    const powerUpUsage = analysis.metrics.powerUpUsageRate || 0;
    if (powerUpUsage < 0.3) {
      analysis.suggestions.push('Power-ups may be too rare or ineffective - consider increasing spawn rate or effect duration');
    } else if (powerUpUsage > 0.8) {
      analysis.suggestions.push('Power-ups may be too common or overpowered - consider reducing spawn rate or effect strength');
    }
    
    // Analyze wave progression
    const avgWaveReached = analysis.metrics.averageWaveReached || 0;
    if (avgWaveReached < 3) {
      analysis.suggestions.push('Wave progression may be too fast - consider increasing wave intervals');
    } else if (avgWaveReached > 8) {
      analysis.suggestions.push('Wave progression may be too slow - consider decreasing wave intervals or increasing difficulty');
    }
    
    return analysis;
  }

  /**
   * Calculate metrics from playtest data
   */
  private calculateMetrics(): { [key: string]: number } {
    if (this.playtestData.length === 0) return {};
    
    const metrics: { [key: string]: number } = {};
    
    // Survival time metrics
    const survivalTimes = this.playtestData.map(d => d.survivalTime);
    metrics.averageSurvivalTime = survivalTimes.reduce((a, b) => a + b, 0) / survivalTimes.length;
    metrics.medianSurvivalTime = this.median(survivalTimes);
    
    // Score metrics
    const scores = this.playtestData.map(d => d.finalScore);
    metrics.averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    metrics.medianScore = this.median(scores);
    
    // Wave metrics
    const wavesReached = this.playtestData.map(d => d.maxWaveReached);
    metrics.averageWaveReached = wavesReached.reduce((a, b) => a + b, 0) / wavesReached.length;
    
    // Power-up metrics
    const powerUpCollections = this.playtestData.map(d => d.powerUpsCollected);
    const totalPowerUps = powerUpCollections.reduce((a, b) => a + b, 0);
    const totalSpawned = this.playtestData.map(d => d.powerUpsSpawned).reduce((a, b) => a + b, 0);
    metrics.powerUpUsageRate = totalSpawned > 0 ? totalPowerUps / totalSpawned : 0;
    
    return metrics;
  }

  /**
   * Calculate median value
   */
  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  /**
   * Apply automatic balance adjustments based on analysis
   */
  public applyAutoBalance(): void {
    const analysis = this.analyzeBalance();
    
    if (analysis.confidence < 0.5) {
      console.log('Not enough data for auto-balance');
      return;
    }
    
    const updates: Partial<GameBalanceConfig> = {};
    
    // Adjust based on survival time
    const avgSurvivalTime = analysis.metrics.averageSurvivalTime || 0;
    if (avgSurvivalTime < 120000) {
      // Make game easier
      updates.powerUps = {
        ...this.config.powerUps,
        spawnInterval: Math.floor(this.config.powerUps.spawnInterval * 0.9)
      };
    } else if (avgSurvivalTime > 600000) {
      // Make game harder
      updates.powerUps = {
        ...this.config.powerUps,
        spawnInterval: Math.floor(this.config.powerUps.spawnInterval * 1.1)
      };
    }
    
    if (Object.keys(updates).length > 0) {
      this.updateConfig(updates);
      console.log('Auto-balance applied:', updates);
    }
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Save configuration to localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem('snakeGame_balance', JSON.stringify(this.config));
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Load configuration from localStorage
   */
  private loadSavedConfig(): void {
    try {
      const saved = localStorage.getItem('snakeGame_balance');
      if (saved) {
        const savedConfig = JSON.parse(saved);
        this.config = this.deepMerge(this.config, savedConfig);
      }
    } catch {
      // Use default configuration
    }
  }

  /**
   * Save playtest data to localStorage
   */
  private savePlaytestData(): void {
    try {
      localStorage.setItem('snakeGame_playtestData', JSON.stringify(this.playtestData));
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Reset to default configuration
   */
  public resetToDefaults(): void {
    this.config = this.getDefaultConfig();
    this.saveConfig();
  }

  /**
   * Export configuration for sharing
   */
  public exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  public importConfig(configJson: string): boolean {
    try {
      const imported = JSON.parse(configJson);
      this.config = this.deepMerge(this.getDefaultConfig(), imported);
      this.saveConfig();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Playtest data interface
 */
export interface PlaytestData {
  sessionId: string;
  timestamp: number;
  survivalTime: number;
  finalScore: number;
  maxWaveReached: number;
  powerUpsCollected: number;
  powerUpsSpawned: number;
  comboCount: number;
  maxCombo: number;
  deathCause: 'wall' | 'snake' | 'self' | 'boss';
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

/**
 * Balance analysis interface
 */
export interface BalanceAnalysis {
  suggestions: string[];
  metrics: { [key: string]: number };
  confidence: number;
}

// Global game balancer instance
export const gameBalancer = new GameBalancer();