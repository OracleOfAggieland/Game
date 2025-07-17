// src/managers/PowerUpManager.ts
import { PowerUp, PowerUpType, ActivePowerUp, POWER_UP_CONFIG, DEFAULT_POWERUP_SPAWN_CONFIG, Position } from '../types/PowerUp';

export class PowerUpManager {
  private powerUps: Map<string, PowerUp> = new Map();
  private activePowerUps: Map<string, ActivePowerUp[]> = new Map();
  private lastSpawnTime: number = 0;
  private spawnConfig = DEFAULT_POWERUP_SPAWN_CONFIG;
  private nextPowerUpId: number = 1;

  /**
   * Initialize the power-up manager
   */
  public initialize(): void {
    this.powerUps.clear();
    this.activePowerUps.clear();
    this.lastSpawnTime = performance.now();
    this.nextPowerUpId = 1;
  }

  /**
   * Update power-up system - call this every game tick
   */
  public update(deltaTime: number, occupiedPositions: Set<string>, boardSize: number): void {
    this.updateActivePowerUps(deltaTime);
    this.trySpawnPowerUp(occupiedPositions, boardSize);
  }

  /**
   * Try to spawn a new power-up if conditions are met
   */
  private trySpawnPowerUp(occupiedPositions: Set<string>, boardSize: number): void {
    const now = performance.now();
    const timeSinceLastSpawn = now - this.lastSpawnTime;
    
    // Check if we should spawn a power-up
    if (this.shouldSpawnPowerUp(timeSinceLastSpawn)) {
      const powerUp = this.spawnPowerUp(occupiedPositions, boardSize);
      if (powerUp) {
        this.lastSpawnTime = now;
      }
    }
  }

  /**
   * Determine if a power-up should be spawned
   */
  private shouldSpawnPowerUp(timeSinceLastSpawn: number): boolean {
    // Don't spawn if we have too many active power-ups
    if (this.powerUps.size >= this.spawnConfig.maxActive) {
      return false;
    }

    // Check minimum interval
    if (timeSinceLastSpawn < this.spawnConfig.minInterval) {
      return false;
    }

    // Calculate spawn probability based on time elapsed
    const timeProgress = Math.min(1, (timeSinceLastSpawn - this.spawnConfig.minInterval) / 
                                    (this.spawnConfig.maxInterval - this.spawnConfig.minInterval));
    
    return Math.random() < (this.spawnConfig.spawnChance * timeProgress);
  }

  /**
   * Spawn a new power-up at a random valid location
   */
  public spawnPowerUp(occupiedPositions: Set<string>, boardSize: number): PowerUp | null {
    // Find a valid spawn position
    const position = this.findValidSpawnPosition(occupiedPositions, boardSize);
    if (!position) {
      return null;
    }

    // Select power-up type based on rarity
    const powerUpType = this.selectPowerUpType();
    
    const powerUp: PowerUp = {
      id: `powerup_${this.nextPowerUpId++}`,
      type: powerUpType,
      position,
      spawnTime: performance.now(),
      isActive: true
    };

    this.powerUps.set(powerUp.id, powerUp);
    return powerUp;
  }

  /**
   * Find a valid position to spawn a power-up
   */
  private findValidSpawnPosition(occupiedPositions: Set<string>, boardSize: number): Position | null {
    const maxAttempts = 100;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const position: Position = {
        x: Math.floor(Math.random() * boardSize),
        y: Math.floor(Math.random() * boardSize)
      };
      
      const posKey = `${position.x},${position.y}`;
      if (!occupiedPositions.has(posKey)) {
        return position;
      }
    }
    
    return null; // Couldn't find a valid position
  }

  /**
   * Select a power-up type based on rarity weights
   */
  private selectPowerUpType(): PowerUpType {
    const types = Object.keys(POWER_UP_CONFIG) as PowerUpType[];
    const weights = types.map(type => POWER_UP_CONFIG[type].rarity);
    
    // Weighted random selection
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < types.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return types[i];
      }
    }
    
    return types[0]; // Fallback
  }

  /**
   * Attempt to collect a power-up
   */
  public collectPowerUp(powerUpId: string, playerId: string): boolean {
    const powerUp = this.powerUps.get(powerUpId);
    if (!powerUp || !powerUp.isActive) {
      return false;
    }

    // Apply the power-up effect
    this.applyPowerUpEffect(powerUp, playerId);
    
    // Remove the power-up from the board
    this.powerUps.delete(powerUpId);
    
    return true;
  }

  /**
   * Apply a power-up effect to a player
   */
  private applyPowerUpEffect(powerUp: PowerUp, playerId: string): void {
    const config = POWER_UP_CONFIG[powerUp.type];
    
    // Create active power-up
    const activePowerUp: ActivePowerUp = {
      type: powerUp.type,
      startTime: performance.now(),
      duration: config.duration,
      playerId
    };

    // Add to player's active power-ups
    if (!this.activePowerUps.has(playerId)) {
      this.activePowerUps.set(playerId, []);
    }
    
    const playerPowerUps = this.activePowerUps.get(playerId)!;
    
    // Handle stacking rules
    if (powerUp.type === 'SHIELD') {
      // Shields don't stack - just add one more
      const existingShield = playerPowerUps.find(p => p.type === 'SHIELD');
      if (!existingShield) {
        playerPowerUps.push(activePowerUp);
      }
    } else {
      // Other power-ups can stack or refresh duration
      const existingPowerUp = playerPowerUps.find(p => p.type === powerUp.type);
      if (existingPowerUp) {
        // Refresh duration
        existingPowerUp.startTime = activePowerUp.startTime;
        existingPowerUp.duration = activePowerUp.duration;
      } else {
        playerPowerUps.push(activePowerUp);
      }
    }
  }

  /**
   * Update all active power-ups and remove expired ones
   */
  private updateActivePowerUps(_deltaTime: number): void {
    const now = performance.now();
    
    this.activePowerUps.forEach((powerUps, playerId) => {
      // Filter out expired power-ups
      const activePowerUps = powerUps.filter(powerUp => {
        if (powerUp.duration === -1) {
          return true; // Permanent until used (like shield)
        }
        return (now - powerUp.startTime) < powerUp.duration;
      });
      
      if (activePowerUps.length === 0) {
        this.activePowerUps.delete(playerId);
      } else {
        this.activePowerUps.set(playerId, activePowerUps);
      }
    });
  }

  /**
   * Get all active power-ups on the board
   */
  public getActivePowerUps(): PowerUp[] {
    return Array.from(this.powerUps.values()).filter(p => p.isActive);
  }

  /**
   * Get active power-ups for a specific player
   */
  public getPlayerPowerUps(playerId: string): ActivePowerUp[] {
    return this.activePowerUps.get(playerId) || [];
  }

  /**
   * Check if a player has a specific power-up active
   */
  public hasActivePowerUp(playerId: string, type: PowerUpType): boolean {
    const playerPowerUps = this.activePowerUps.get(playerId) || [];
    return playerPowerUps.some(p => p.type === type);
  }

  /**
   * Use a shield (remove one shield power-up)
   */
  public useShield(playerId: string): boolean {
    const playerPowerUps = this.activePowerUps.get(playerId);
    if (!playerPowerUps) return false;
    
    const shieldIndex = playerPowerUps.findIndex(p => p.type === 'SHIELD');
    if (shieldIndex === -1) return false;
    
    playerPowerUps.splice(shieldIndex, 1);
    
    if (playerPowerUps.length === 0) {
      this.activePowerUps.delete(playerId);
    }
    
    return true;
  }

  /**
   * Get the current speed multiplier for a player
   */
  public getSpeedMultiplier(playerId: string): number {
    const playerPowerUps = this.activePowerUps.get(playerId) || [];
    const speedBoost = playerPowerUps.find(p => p.type === 'SPEED_BOOST');
    return speedBoost ? POWER_UP_CONFIG.SPEED_BOOST.effect : 1.0;
  }

  /**
   * Get the current score multiplier for a player
   */
  public getScoreMultiplier(playerId: string): number {
    const playerPowerUps = this.activePowerUps.get(playerId) || [];
    const scoreMultiplier = playerPowerUps.find(p => p.type === 'SCORE_MULTIPLIER');
    return scoreMultiplier ? POWER_UP_CONFIG.SCORE_MULTIPLIER.effect : 1.0;
  }

  /**
   * Check if a player is in ghost mode
   */
  public isGhostMode(playerId: string): boolean {
    return this.hasActivePowerUp(playerId, 'GHOST_MODE');
  }

  /**
   * Check if freeze effect is active (affects all AI)
   */
  public isFreezeActive(): boolean {
    let freezeActive = false;
    this.activePowerUps.forEach(powerUps => {
      if (powerUps.some(p => p.type === 'FREEZE')) {
        freezeActive = true;
      }
    });
    return freezeActive;
  }

  /**
   * Clear all power-ups (useful for game reset)
   */
  public clear(): void {
    this.powerUps.clear();
    this.activePowerUps.clear();
  }

  /**
   * Get power-up configuration for UI display
   */
  public getPowerUpConfig(type: PowerUpType) {
    return POWER_UP_CONFIG[type];
  }

  /**
   * Configure spawn settings
   */
  public configureSpawning(config: Partial<typeof DEFAULT_POWERUP_SPAWN_CONFIG>): void {
    this.spawnConfig = { ...this.spawnConfig, ...config };
  }
}