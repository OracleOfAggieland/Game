// src/utils/PowerUpEffects.ts
import { PowerUpType, POWER_UP_CONFIG } from '../types/PowerUp';
import { EnhancedSnake, SnakeEffectsState } from '../types/GameEnhancements';

export class PowerUpEffects {
  /**
   * Apply speed boost effect to a snake
   * Increases movement speed by 2x for 5 seconds
   */
  public static applySpeedBoost(snake: EnhancedSnake): void {
    const config = POWER_UP_CONFIG.SPEED_BOOST;
    snake.effectsState.speedMultiplier = config.effect;
    snake.effectsState.lastEffectUpdate = performance.now();
  }

  /**
   * Apply shield effect to a snake
   * Provides immunity to one collision
   */
  public static applyShield(snake: EnhancedSnake): void {
    snake.shieldCount = Math.max(snake.shieldCount + 1, 1);
    snake.effectsState.shieldActive = true;
    snake.effectsState.lastEffectUpdate = performance.now();
  }

  /**
   * Apply ghost mode effect to a snake
   * Allows passing through other snakes for 3 seconds
   */
  public static applyGhostMode(snake: EnhancedSnake): void {
    snake.effectsState.isGhost = true;
    snake.effectsState.lastEffectUpdate = performance.now();
  }

  /**
   * Apply freeze effect (affects all AI snakes)
   * Freezes all AI opponents for 2 seconds
   */
  public static applyFreeze(allSnakes: EnhancedSnake[]): void {
    const now = performance.now();
    allSnakes.forEach(snake => {
      if (snake.isAI && snake.isAlive) {
        snake.effectsState.isFrozen = true;
        snake.effectsState.lastEffectUpdate = now;
      }
    });
  }

  /**
   * Apply score multiplier effect to a snake
   * Doubles points earned for 10 seconds
   */
  public static applyScoreMultiplier(snake: EnhancedSnake): void {
    const config = POWER_UP_CONFIG.SCORE_MULTIPLIER;
    snake.effectsState.scoreMultiplier = config.effect;
    snake.effectsState.lastEffectUpdate = performance.now();
  }

  /**
   * Update all active effects for a snake
   * Removes expired effects and updates timers
   */
  public static updateSnakeEffects(snake: EnhancedSnake, _deltaTime: number): void {
    const now = performance.now();
    let effectsChanged = false;

    // Update speed boost
    if (snake.effectsState.speedMultiplier > 1) {
      const elapsed = now - snake.effectsState.lastEffectUpdate;
      if (elapsed >= POWER_UP_CONFIG.SPEED_BOOST.duration) {
        snake.effectsState.speedMultiplier = 1.0;
        effectsChanged = true;
      }
    }

    // Update ghost mode
    if (snake.effectsState.isGhost) {
      const elapsed = now - snake.effectsState.lastEffectUpdate;
      if (elapsed >= POWER_UP_CONFIG.GHOST_MODE.duration) {
        snake.effectsState.isGhost = false;
        effectsChanged = true;
      }
    }

    // Update freeze effect
    if (snake.effectsState.isFrozen) {
      const elapsed = now - snake.effectsState.lastEffectUpdate;
      if (elapsed >= POWER_UP_CONFIG.FREEZE.duration) {
        snake.effectsState.isFrozen = false;
        effectsChanged = true;
      }
    }

    // Update score multiplier
    if (snake.effectsState.scoreMultiplier > 1) {
      const elapsed = now - snake.effectsState.lastEffectUpdate;
      if (elapsed >= POWER_UP_CONFIG.SCORE_MULTIPLIER.duration) {
        snake.effectsState.scoreMultiplier = 1.0;
        effectsChanged = true;
      }
    }

    // Update shield status
    if (snake.shieldCount <= 0) {
      snake.effectsState.shieldActive = false;
    }

    if (effectsChanged) {
      snake.effectsState.lastEffectUpdate = now;
    }
  }

  /**
   * Use a shield (consume one shield charge)
   * Returns true if shield was used, false if no shield available
   */
  public static useShield(snake: EnhancedSnake): boolean {
    if (snake.shieldCount > 0) {
      snake.shieldCount--;
      if (snake.shieldCount <= 0) {
        snake.effectsState.shieldActive = false;
      }
      return true;
    }
    return false;
  }

  /**
   * Check if a snake can pass through another snake (ghost mode)
   */
  public static canPassThrough(snake: EnhancedSnake, otherSnake: EnhancedSnake): boolean {
    return snake.effectsState.isGhost && snake.isAlive && otherSnake.isAlive;
  }

  /**
   * Check if a snake should be frozen (AI only)
   */
  public static isFrozen(snake: EnhancedSnake): boolean {
    return snake.isAI && snake.effectsState.isFrozen;
  }

  /**
   * Get the effective speed for a snake considering all effects
   */
  public static getEffectiveSpeed(snake: EnhancedSnake, baseSpeed: number): number {
    if (this.isFrozen(snake)) {
      return 0; // Frozen snakes don't move
    }
    return baseSpeed * snake.effectsState.speedMultiplier;
  }

  /**
   * Calculate score with multiplier effects
   */
  public static calculateScore(snake: EnhancedSnake, baseScore: number): number {
    return Math.floor(baseScore * snake.effectsState.scoreMultiplier);
  }

  /**
   * Get visual effect indicators for UI display
   */
  public static getActiveEffectIndicators(snake: EnhancedSnake): Array<{
    type: PowerUpType;
    color: string;
    timeRemaining?: number;
    isActive: boolean;
  }> {
    const indicators = [];
    const now = performance.now();

    // Speed boost indicator
    if (snake.effectsState.speedMultiplier > 1) {
      const elapsed = now - snake.effectsState.lastEffectUpdate;
      const remaining = POWER_UP_CONFIG.SPEED_BOOST.duration - elapsed;
      indicators.push({
        type: 'SPEED_BOOST' as PowerUpType,
        color: POWER_UP_CONFIG.SPEED_BOOST.color,
        timeRemaining: Math.max(0, remaining),
        isActive: remaining > 0
      });
    }

    // Shield indicator
    if (snake.effectsState.shieldActive) {
      indicators.push({
        type: 'SHIELD' as PowerUpType,
        color: POWER_UP_CONFIG.SHIELD.color,
        isActive: true
      });
    }

    // Ghost mode indicator
    if (snake.effectsState.isGhost) {
      const elapsed = now - snake.effectsState.lastEffectUpdate;
      const remaining = POWER_UP_CONFIG.GHOST_MODE.duration - elapsed;
      indicators.push({
        type: 'GHOST_MODE' as PowerUpType,
        color: POWER_UP_CONFIG.GHOST_MODE.color,
        timeRemaining: Math.max(0, remaining),
        isActive: remaining > 0
      });
    }

    // Score multiplier indicator
    if (snake.effectsState.scoreMultiplier > 1) {
      const elapsed = now - snake.effectsState.lastEffectUpdate;
      const remaining = POWER_UP_CONFIG.SCORE_MULTIPLIER.duration - elapsed;
      indicators.push({
        type: 'SCORE_MULTIPLIER' as PowerUpType,
        color: POWER_UP_CONFIG.SCORE_MULTIPLIER.color,
        timeRemaining: Math.max(0, remaining),
        isActive: remaining > 0
      });
    }

    // Freeze indicator (for AI snakes)
    if (snake.effectsState.isFrozen) {
      const elapsed = now - snake.effectsState.lastEffectUpdate;
      const remaining = POWER_UP_CONFIG.FREEZE.duration - elapsed;
      indicators.push({
        type: 'FREEZE' as PowerUpType,
        color: POWER_UP_CONFIG.FREEZE.color,
        timeRemaining: Math.max(0, remaining),
        isActive: remaining > 0
      });
    }

    return indicators;
  }

  /**
   * Initialize default effects state for a new snake
   */
  public static initializeEffectsState(): SnakeEffectsState {
    return {
      isGhost: false,
      isFrozen: false,
      speedMultiplier: 1.0,
      scoreMultiplier: 1.0,
      shieldActive: false,
      lastEffectUpdate: performance.now()
    };
  }

  /**
   * Reset all effects for a snake (useful for game restart)
   */
  public static resetAllEffects(snake: EnhancedSnake): void {
    snake.effectsState = this.initializeEffectsState();
    snake.shieldCount = 0;
    snake.activePowerUps = [];
  }

  /**
   * Check if any effects are currently active on a snake
   */
  public static hasActiveEffects(snake: EnhancedSnake): boolean {
    return snake.effectsState.speedMultiplier > 1 ||
           snake.effectsState.scoreMultiplier > 1 ||
           snake.effectsState.isGhost ||
           snake.effectsState.isFrozen ||
           snake.effectsState.shieldActive;
  }

  /**
   * Get a summary of all active effects for debugging
   */
  public static getEffectsSummary(snake: EnhancedSnake): string {
    const effects = [];
    
    if (snake.effectsState.speedMultiplier > 1) {
      effects.push(`Speed: ${snake.effectsState.speedMultiplier}x`);
    }
    if (snake.effectsState.scoreMultiplier > 1) {
      effects.push(`Score: ${snake.effectsState.scoreMultiplier}x`);
    }
    if (snake.effectsState.isGhost) {
      effects.push('Ghost');
    }
    if (snake.effectsState.isFrozen) {
      effects.push('Frozen');
    }
    if (snake.effectsState.shieldActive) {
      effects.push(`Shield (${snake.shieldCount})`);
    }
    
    return effects.length > 0 ? effects.join(', ') : 'None';
  }
}