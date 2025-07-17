// src/utils/ComboSystem.ts

export interface ComboState {
  count: number;
  multiplier: number;
  lastFoodTime: number;
  isActive: boolean;
  totalScore: number;
  bestCombo: number;
}

export interface ScoreEvent {
  id: string;
  points: number;
  multiplier: number;
  position: { x: number; y: number };
  timestamp: number;
  type: 'food' | 'combo' | 'powerup' | 'wave_bonus';
  comboCount?: number;
}

/**
 * Combo system for tracking rapid food consumption
 */
export class ComboSystem {
  private comboStates: Map<string, ComboState> = new Map();
  private scoreEvents: ScoreEvent[] = [];
  private comboTimeWindow: number = 2000; // 2 seconds to maintain combo
  private comboThreshold: number = 2; // Minimum foods for combo
  private maxComboMultiplier: number = 5; // Maximum combo multiplier

  /**
   * Initialize combo state for a player
   */
  public initializePlayer(playerId: string): void {
    this.comboStates.set(playerId, {
      count: 0,
      multiplier: 1,
      lastFoodTime: 0,
      isActive: false,
      totalScore: 0,
      bestCombo: 0
    });
  }

  /**
   * Register food consumption
   */
  public registerFoodConsumption(
    playerId: string,
    basePoints: number,
    position: { x: number; y: number },
    currentTime: number = performance.now()
  ): ScoreEvent {
    let comboState = this.comboStates.get(playerId);
    if (!comboState) {
      this.initializePlayer(playerId);
      comboState = this.comboStates.get(playerId)!;
    }

    // Check if combo should continue
    const timeSinceLastFood = currentTime - comboState.lastFoodTime;
    const shouldContinueCombo = timeSinceLastFood <= this.comboTimeWindow && comboState.count > 0;

    if (shouldContinueCombo) {
      // Continue combo
      comboState.count++;
    } else {
      // Start new combo or reset
      comboState.count = 1;
      comboState.isActive = false;
    }

    // Update combo state
    comboState.lastFoodTime = currentTime;

    // Calculate multiplier
    if (comboState.count >= this.comboThreshold) {
      comboState.isActive = true;
      comboState.multiplier = Math.min(
        this.maxComboMultiplier,
        1 + (comboState.count - this.comboThreshold) * 0.5
      );
    } else {
      comboState.multiplier = 1;
    }

    // Update best combo
    if (comboState.count > comboState.bestCombo) {
      comboState.bestCombo = comboState.count;
    }

    // Calculate final score
    const finalPoints = Math.floor(basePoints * comboState.multiplier);
    comboState.totalScore += finalPoints;

    // Create score event
    const scoreEvent: ScoreEvent = {
      id: `score-${playerId}-${currentTime}`,
      points: finalPoints,
      multiplier: comboState.multiplier,
      position,
      timestamp: currentTime,
      type: comboState.isActive ? 'combo' : 'food',
      comboCount: comboState.isActive ? comboState.count : undefined
    };

    this.scoreEvents.push(scoreEvent);
    this.cleanupOldEvents(currentTime);

    return scoreEvent;
  }

  /**
   * Register power-up collection
   */
  public registerPowerUpCollection(
    playerId: string,
    powerUpType: string,
    position: { x: number; y: number },
    currentTime: number = performance.now()
  ): ScoreEvent {
    const basePoints = this.getPowerUpPoints(powerUpType);
    const comboState = this.comboStates.get(playerId);
    const multiplier = comboState?.isActive ? comboState.multiplier : 1;
    const finalPoints = Math.floor(basePoints * multiplier);

    if (comboState) {
      comboState.totalScore += finalPoints;
    }

    const scoreEvent: ScoreEvent = {
      id: `powerup-${playerId}-${currentTime}`,
      points: finalPoints,
      multiplier,
      position,
      timestamp: currentTime,
      type: 'powerup'
    };

    this.scoreEvents.push(scoreEvent);
    this.cleanupOldEvents(currentTime);

    return scoreEvent;
  }

  /**
   * Register wave bonus
   */
  public registerWaveBonus(
    playerId: string,
    waveNumber: number,
    survivalTime: number,
    position: { x: number; y: number },
    currentTime: number = performance.now()
  ): ScoreEvent {
    const basePoints = this.calculateWaveBonus(waveNumber, survivalTime);
    const comboState = this.comboStates.get(playerId);
    
    if (comboState) {
      comboState.totalScore += basePoints;
    }

    const scoreEvent: ScoreEvent = {
      id: `wave-${playerId}-${currentTime}`,
      points: basePoints,
      multiplier: 1,
      position,
      timestamp: currentTime,
      type: 'wave_bonus'
    };

    this.scoreEvents.push(scoreEvent);
    this.cleanupOldEvents(currentTime);

    return scoreEvent;
  }

  /**
   * Update combo states (call this regularly to handle timeouts)
   */
  public updateCombos(currentTime: number = performance.now()): void {
    this.comboStates.forEach((comboState, playerId) => {
      const timeSinceLastFood = currentTime - comboState.lastFoodTime;
      
      if (timeSinceLastFood > this.comboTimeWindow && comboState.isActive) {
        // Combo expired
        comboState.isActive = false;
        comboState.count = 0;
        comboState.multiplier = 1;
      }
    });

    this.cleanupOldEvents(currentTime);
  }

  /**
   * Get current combo state for a player
   */
  public getComboState(playerId: string): ComboState | null {
    return this.comboStates.get(playerId) || null;
  }

  /**
   * Get recent score events for rendering
   */
  public getRecentScoreEvents(maxAge: number = 3000): ScoreEvent[] {
    const currentTime = performance.now();
    return this.scoreEvents.filter(event => 
      currentTime - event.timestamp <= maxAge
    );
  }

  /**
   * Get score events for a specific player
   */
  public getPlayerScoreEvents(playerId: string, maxAge: number = 3000): ScoreEvent[] {
    return this.getRecentScoreEvents(maxAge).filter(event => 
      event.id.includes(playerId)
    );
  }

  /**
   * Reset combo for a player
   */
  public resetCombo(playerId: string): void {
    const comboState = this.comboStates.get(playerId);
    if (comboState) {
      comboState.count = 0;
      comboState.multiplier = 1;
      comboState.isActive = false;
      comboState.lastFoodTime = 0;
    }
  }

  /**
   * Get combo statistics for all players
   */
  public getComboStats(): {
    [playerId: string]: {
      currentCombo: number;
      bestCombo: number;
      totalScore: number;
      isActive: boolean;
      multiplier: number;
    };
  } {
    const stats: any = {};
    
    this.comboStates.forEach((state, playerId) => {
      stats[playerId] = {
        currentCombo: state.count,
        bestCombo: state.bestCombo,
        totalScore: state.totalScore,
        isActive: state.isActive,
        multiplier: state.multiplier
      };
    });

    return stats;
  }

  /**
   * Configure combo system settings
   */
  public configure(settings: {
    timeWindow?: number;
    threshold?: number;
    maxMultiplier?: number;
  }): void {
    if (settings.timeWindow !== undefined) {
      this.comboTimeWindow = settings.timeWindow;
    }
    if (settings.threshold !== undefined) {
      this.comboThreshold = settings.threshold;
    }
    if (settings.maxMultiplier !== undefined) {
      this.maxComboMultiplier = settings.maxMultiplier;
    }
  }

  /**
   * Get power-up points based on type
   */
  private getPowerUpPoints(powerUpType: string): number {
    const pointsMap: { [key: string]: number } = {
      'SPEED_BOOST': 25,
      'SHIELD': 30,
      'GHOST_MODE': 35,
      'FREEZE': 40,
      'SCORE_MULTIPLIER': 50
    };
    return pointsMap[powerUpType] || 20;
  }

  /**
   * Calculate wave bonus points
   */
  private calculateWaveBonus(waveNumber: number, survivalTime: number): number {
    const baseBonus = waveNumber * 100;
    const timeBonus = Math.floor(survivalTime / 1000) * 5;
    return baseBonus + timeBonus;
  }

  /**
   * Clean up old score events
   */
  private cleanupOldEvents(currentTime: number): void {
    const maxAge = 10000; // Keep events for 10 seconds
    this.scoreEvents = this.scoreEvents.filter(event => 
      currentTime - event.timestamp <= maxAge
    );
  }

  /**
   * Clear all data
   */
  public clear(): void {
    this.comboStates.clear();
    this.scoreEvents = [];
  }
}

/**
 * Score popup animation manager
 */
export class ScorePopupManager {
  private activePopups: Map<string, {
    event: ScoreEvent;
    startTime: number;
    duration: number;
    animationProgress: number;
  }> = new Map();

  /**
   * Create a score popup
   */
  public createPopup(scoreEvent: ScoreEvent, duration: number = 2000): void {
    this.activePopups.set(scoreEvent.id, {
      event: scoreEvent,
      startTime: performance.now(),
      duration,
      animationProgress: 0
    });
  }

  /**
   * Update all active popups
   */
  public updatePopups(currentTime: number = performance.now()): void {
    this.activePopups.forEach((popup, id) => {
      const elapsed = currentTime - popup.startTime;
      popup.animationProgress = Math.min(1, elapsed / popup.duration);

      if (popup.animationProgress >= 1) {
        this.activePopups.delete(id);
      }
    });
  }

  /**
   * Get render data for all active popups
   */
  public getPopupRenderData(): Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    opacity: number;
    scale: number;
    color: string;
    type: string;
  }> {
    const renderData: any[] = [];

    this.activePopups.forEach((popup) => {
      const progress = popup.animationProgress;
      const event = popup.event;

      // Calculate animation values
      const opacity = 1 - Math.pow(progress, 2); // Fade out with easing
      const scale = 1 + progress * 0.5; // Grow slightly
      const yOffset = -progress * 50; // Float upward

      // Generate text based on event type
      let text = `+${event.points}`;
      let color = '#00ff88';

      if (event.type === 'combo' && event.comboCount) {
        text = `+${event.points} (${event.comboCount}x COMBO!)`;
        color = '#ffaa00';
      } else if (event.type === 'powerup') {
        text = `+${event.points} POWER!`;
        color = '#ff44ff';
      } else if (event.type === 'wave_bonus') {
        text = `+${event.points} WAVE BONUS!`;
        color = '#44ffff';
      } else if (event.multiplier > 1) {
        text = `+${event.points} (${event.multiplier.toFixed(1)}x)`;
        color = '#ffaa00';
      }

      renderData.push({
        id: event.id,
        text,
        x: event.position.x,
        y: event.position.y + yOffset,
        opacity,
        scale,
        color,
        type: event.type
      });
    });

    return renderData;
  }

  /**
   * Clear all popups
   */
  public clearAll(): void {
    this.activePopups.clear();
  }

  /**
   * Get number of active popups
   */
  public getActiveCount(): number {
    return this.activePopups.size;
  }
}