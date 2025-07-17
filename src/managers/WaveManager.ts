// src/managers/WaveManager.ts
import { Wave, WaveDefinition, WaveState, BossSnake, BossType, AIPersonality, DEFAULT_WAVE_DEFINITIONS } from '../types/Wave';

export class WaveManager {
  private waveDefinitions: WaveDefinition[] = [];
  private currentWaveState: WaveState;
  private gameStartTime: number = 0;
  private isActive: boolean = false;

  constructor(customWaveDefinitions?: WaveDefinition[]) {
    this.waveDefinitions = customWaveDefinitions || [...DEFAULT_WAVE_DEFINITIONS];
    this.currentWaveState = this.initializeWaveState();
  }

  /**
   * Initialize the wave system for a new game
   */
  public initialize(): void {
    this.gameStartTime = performance.now();
    this.currentWaveState = this.initializeWaveState();
    this.isActive = true;
  }

  /**
   * Initialize default wave state
   */
  private initializeWaveState(): WaveState {
    return {
      currentWave: 1,
      waveStartTime: 0,
      gameStartTime: 0,
      completedWaves: [],
      totalBonusPoints: 0,
      nextWaveTime: this.waveDefinitions[1]?.triggerTime * 1000 // Convert to milliseconds
    };
  }

  /**
   * Update wave system - call this every game tick
   */
  public update(_deltaTime: number): Wave | null {
    if (!this.isActive) return null;

    const currentTime = performance.now();
    const gameElapsedTime = (currentTime - this.gameStartTime) / 1000; // Convert to seconds

    // Check if it's time for the next wave
    const nextWaveDefinition = this.getNextWaveDefinition();
    if (nextWaveDefinition && gameElapsedTime >= nextWaveDefinition.triggerTime) {
      return this.startWave(nextWaveDefinition, currentTime);
    }

    return null;
  }

  /**
   * Get the next wave definition that should be triggered
   */
  private getNextWaveDefinition(): WaveDefinition | null {
    return this.waveDefinitions.find(def => 
      def.waveNumber > this.currentWaveState.currentWave &&
      !this.currentWaveState.completedWaves.includes(def.waveNumber)
    ) || null;
  }

  /**
   * Start a new wave
   */
  private startWave(waveDefinition: WaveDefinition, currentTime: number): Wave {
    const wave: Wave = {
      number: waveDefinition.waveNumber,
      startTime: currentTime,
      aiCount: waveDefinition.aiCount,
      speedMultiplier: waveDefinition.speedMultiplier,
      isBossWave: waveDefinition.isBossWave,
      bonusPoints: waveDefinition.bonusPoints
    };

    // Update wave state
    this.currentWaveState.currentWave = wave.number;
    this.currentWaveState.waveStartTime = currentTime;
    
    // Set next wave time
    const nextWave = this.getNextWaveDefinition();
    this.currentWaveState.nextWaveTime = nextWave ? 
      this.gameStartTime + (nextWave.triggerTime * 1000) : undefined;

    console.log(`Wave ${wave.number} started! ${wave.isBossWave ? 'BOSS WAVE!' : ''}`);
    
    return wave;
  }

  /**
   * Complete the current wave and award bonus points
   */
  public completeWave(survivingPlayers: any[]): number {
    const currentWave = this.currentWaveState.currentWave;
    const waveDefinition = this.waveDefinitions.find(def => def.waveNumber === currentWave);
    
    if (!waveDefinition || this.currentWaveState.completedWaves.includes(currentWave)) {
      return 0;
    }

    // Calculate bonus points based on wave difficulty and survival
    const baseBonus = waveDefinition.bonusPoints;
    const survivalMultiplier = Math.max(0.5, survivingPlayers.length / 4); // Bonus for more survivors
    const finalBonus = Math.floor(baseBonus * survivalMultiplier);

    // Mark wave as completed
    this.currentWaveState.completedWaves.push(currentWave);
    this.currentWaveState.totalBonusPoints += finalBonus;

    console.log(`Wave ${currentWave} completed! Bonus: ${finalBonus} points`);
    
    return finalBonus;
  }

  /**
   * Create a boss snake for boss waves
   */
  public createBossSnake(waveNumber: number, spawnIndex: number): BossSnake | null {
    const waveDefinition = this.waveDefinitions.find(def => 
      def.waveNumber === waveNumber && def.isBossWave
    );

    if (!waveDefinition || !waveDefinition.bossConfig) {
      return null;
    }

    const bossConfig = waveDefinition.bossConfig;
    const bossPersonality = this.createBossPersonality(bossConfig.type);
    
    // Create starting position for boss (center-ish area)
    const startPositions = [
      { x: 12, y: 12 }, // Center
      { x: 8, y: 8 },   // Off-center
      { x: 16, y: 16 }, // Other off-center
      { x: 12, y: 8 },  // Center-top
      { x: 12, y: 16 }  // Center-bottom
    ];
    
    const startPos = startPositions[spawnIndex % startPositions.length];

    const bossSnake: BossSnake = {
      id: `boss_${waveNumber}_${Date.now()}`,
      name: this.generateBossName(bossConfig.type),
      positions: [startPos],
      direction: 'RIGHT',
      score: 0,
      color: this.getBossColor(bossConfig.type),
      isAlive: true,
      isAI: true,
      bossType: bossConfig.type,
      specialAbilities: bossConfig.abilities,
      health: Math.floor(100 * bossConfig.healthMultiplier),
      maxHealth: Math.floor(100 * bossConfig.healthMultiplier),
      aiPersonality: bossPersonality,
      lastDirectionChange: 0,
      lastAbilityUse: 0
    };

    return bossSnake;
  }

  /**
   * Create AI personality for boss snakes
   */
  private createBossPersonality(bossType: BossType): AIPersonality {
    switch (bossType) {
      case 'SMART':
        return {
          aggression: 0.7,
          intelligence: 0.95,
          patience: 0.8,
          name: 'Mastermind',
          description: 'Highly intelligent strategist'
        };
      case 'FAST':
        return {
          aggression: 0.9,
          intelligence: 0.7,
          patience: 0.2,
          name: 'Lightning',
          description: 'Speed demon'
        };
      case 'GIANT':
        return {
          aggression: 0.8,
          intelligence: 0.6,
          patience: 0.9,
          name: 'Titan',
          description: 'Massive and patient'
        };
      default:
        return {
          aggression: 0.8,
          intelligence: 0.8,
          patience: 0.5,
          name: 'Boss',
          description: 'Powerful opponent'
        };
    }
  }

  /**
   * Generate boss names based on type
   */
  private generateBossName(bossType: BossType): string {
    const names = {
      SMART: ['Cerebrus', 'Mindreader', 'Strategist', 'Oracle', 'Mastermind'],
      FAST: ['Lightning', 'Quickstrike', 'Velocity', 'Blitz', 'Speedster'],
      GIANT: ['Titan', 'Colossus', 'Behemoth', 'Goliath', 'Leviathan']
    };

    const typeNames = names[bossType];
    return typeNames[Math.floor(Math.random() * typeNames.length)];
  }

  /**
   * Get boss color based on type
   */
  private getBossColor(bossType: BossType): string {
    switch (bossType) {
      case 'SMART':
        return '#9932CC'; // Dark orchid
      case 'FAST':
        return '#FF1493'; // Deep pink
      case 'GIANT':
        return '#8B0000'; // Dark red
      default:
        return '#4B0082'; // Indigo
    }
  }

  /**
   * Get AI personality adjusted for current wave
   */
  public getAIPersonalityForWave(basePersonality: AIPersonality, waveNumber: number): AIPersonality {
    const waveDefinition = this.waveDefinitions.find(def => def.waveNumber <= waveNumber);
    const speedMultiplier = waveDefinition?.speedMultiplier || 1.0;
    
    // Increase intelligence and aggression with wave progression
    const waveBonus = Math.min(0.3, (waveNumber - 1) * 0.05);
    
    return {
      ...basePersonality,
      intelligence: Math.min(0.95, basePersonality.intelligence + waveBonus),
      aggression: Math.min(0.9, basePersonality.aggression + waveBonus * 0.5),
      patience: Math.max(0.1, basePersonality.patience - waveBonus * 0.3)
    };
  }

  /**
   * Get current wave information
   */
  public getCurrentWave(): number {
    return this.currentWaveState.currentWave;
  }

  /**
   * Get wave state for UI display
   */
  public getWaveState(): WaveState {
    return { ...this.currentWaveState };
  }

  /**
   * Get time until next wave (in seconds)
   */
  public getTimeUntilNextWave(): number | null {
    if (!this.currentWaveState.nextWaveTime) return null;
    
    const currentTime = performance.now();
    const timeRemaining = (this.currentWaveState.nextWaveTime - currentTime) / 1000;
    return Math.max(0, timeRemaining);
  }

  /**
   * Check if current wave is a boss wave
   */
  public isBossWave(waveNumber?: number): boolean {
    const wave = waveNumber || this.currentWaveState.currentWave;
    const waveDefinition = this.waveDefinitions.find(def => def.waveNumber === wave);
    return waveDefinition?.isBossWave || false;
  }

  /**
   * Get speed multiplier for current wave
   */
  public getCurrentSpeedMultiplier(): number {
    const waveDefinition = this.waveDefinitions.find(def => 
      def.waveNumber === this.currentWaveState.currentWave
    );
    return waveDefinition?.speedMultiplier || 1.0;
  }

  /**
   * Get AI count for current wave
   */
  public getCurrentAICount(): number {
    const waveDefinition = this.waveDefinitions.find(def => 
      def.waveNumber === this.currentWaveState.currentWave
    );
    return waveDefinition?.aiCount || 3;
  }

  /**
   * Reset wave system
   */
  public reset(): void {
    this.currentWaveState = this.initializeWaveState();
    this.gameStartTime = 0;
    this.isActive = false;
  }

  /**
   * Stop wave system
   */
  public stop(): void {
    this.isActive = false;
  }

  /**
   * Get total bonus points earned
   */
  public getTotalBonusPoints(): number {
    return this.currentWaveState.totalBonusPoints;
  }

  /**
   * Get completed waves count
   */
  public getCompletedWavesCount(): number {
    return this.currentWaveState.completedWaves.length;
  }

  /**
   * Check if wave system is active
   */
  public isWaveSystemActive(): boolean {
    return this.isActive;
  }

  /**
   * Get wave definition for a specific wave
   */
  public getWaveDefinition(waveNumber: number): WaveDefinition | null {
    const definition = this.waveDefinitions.find(def => def.waveNumber === waveNumber);
    return definition || null;
  }

  /**
   * Add custom wave definition
   */
  public addWaveDefinition(waveDefinition: WaveDefinition): void {
    // Insert in correct order
    const insertIndex = this.waveDefinitions.findIndex(def => def.waveNumber > waveDefinition.waveNumber);
    if (insertIndex === -1) {
      this.waveDefinitions.push(waveDefinition);
    } else {
      this.waveDefinitions.splice(insertIndex, 0, waveDefinition);
    }
  }

  /**
   * Get all wave definitions
   */
  public getAllWaveDefinitions(): WaveDefinition[] {
    return [...this.waveDefinitions];
  }
}