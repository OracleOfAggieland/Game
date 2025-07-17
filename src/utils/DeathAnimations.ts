// src/utils/DeathAnimations.ts

export interface Position {
  x: number;
  y: number;
}

export interface DeathAnimationState {
  id: string;
  type: 'fade' | 'explosion' | 'dissolve' | 'shrink';
  startTime: number;
  duration: number;
  progress: number;
  positions: Position[];
  color: string;
  isComplete: boolean;
  collisionType?: 'wall' | 'snake' | 'self';
}

/**
 * Death animation manager for snake game
 */
export class DeathAnimationManager {
  private activeAnimations: Map<string, DeathAnimationState> = new Map();
  private animationCallbacks: Map<string, (state: DeathAnimationState) => void> = new Map();

  /**
   * Start a death animation for a snake
   */
  public startDeathAnimation(
    snakeId: string,
    positions: Position[],
    color: string,
    collisionType: 'wall' | 'snake' | 'self' = 'wall'
  ): void {
    // Choose animation type based on collision type
    let animationType: DeathAnimationState['type'];
    let duration: number;

    switch (collisionType) {
      case 'wall':
        animationType = 'shrink';
        duration = 800;
        break;
      case 'snake':
        animationType = 'explosion';
        duration = 1000;
        break;
      case 'self':
        animationType = 'dissolve';
        duration = 1200;
        break;
      default:
        animationType = 'fade';
        duration = 600;
    }

    const animation: DeathAnimationState = {
      id: snakeId,
      type: animationType,
      startTime: performance.now(),
      duration,
      progress: 0,
      positions: [...positions],
      color,
      isComplete: false,
      collisionType
    };

    this.activeAnimations.set(snakeId, animation);
  }

  /**
   * Update all active death animations
   */
  public updateAnimations(deltaTime: number): void {
    const currentTime = performance.now();

    this.activeAnimations.forEach((animation, snakeId) => {
      const elapsed = currentTime - animation.startTime;
      animation.progress = Math.min(1, elapsed / animation.duration);

      // Update animation based on type
      this.updateAnimationByType(animation, deltaTime);

      // Check if animation is complete
      if (animation.progress >= 1) {
        animation.isComplete = true;
        
        // Call completion callback if registered
        const callback = this.animationCallbacks.get(snakeId);
        if (callback) {
          callback(animation);
        }

        // Remove completed animation
        this.activeAnimations.delete(snakeId);
        this.animationCallbacks.delete(snakeId);
      }
    });
  }

  /**
   * Update animation based on its type
   */
  private updateAnimationByType(animation: DeathAnimationState, deltaTime: number): void {
    switch (animation.type) {
      case 'explosion':
        this.updateExplosionAnimation(animation, deltaTime);
        break;
      case 'dissolve':
        this.updateDissolveAnimation(animation, deltaTime);
        break;
      case 'shrink':
        this.updateShrinkAnimation(animation, deltaTime);
        break;
      case 'fade':
      default:
        this.updateFadeAnimation(animation, deltaTime);
        break;
    }
  }

  /**
   * Update fade animation
   */
  private updateFadeAnimation(_animation: DeathAnimationState, _deltaTime: number): void {
    // Simple fade out - no position changes needed
    // Opacity will be calculated in render function based on progress
  }

  /**
   * Update explosion animation
   */
  private updateExplosionAnimation(animation: DeathAnimationState, deltaTime: number): void {
    // Segments spread out from their original positions
    const explosionForce = 20;
    const centerX = animation.positions.reduce((sum, pos) => sum + pos.x, 0) / animation.positions.length;
    const centerY = animation.positions.reduce((sum, pos) => sum + pos.y, 0) / animation.positions.length;

    animation.positions.forEach((pos, index) => {
      const dx = pos.x - centerX;
      const dy = pos.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const normalizedDx = dx / distance;
      const normalizedDy = dy / distance;

      // Move segments away from center
      const force = explosionForce * animation.progress * (1 + index * 0.1);
      pos.x += normalizedDx * force * deltaTime * 0.01;
      pos.y += normalizedDy * force * deltaTime * 0.01;
    });
  }

  /**
   * Update dissolve animation
   */
  private updateDissolveAnimation(animation: DeathAnimationState, deltaTime: number): void {
    // Segments randomly disappear from tail to head
    const segmentsToHide = Math.floor(animation.progress * animation.positions.length);
    
    // Add some randomness to the dissolve pattern
    animation.positions.forEach((pos, index) => {
      const dissolveThreshold = (index / animation.positions.length) + Math.sin(performance.now() * 0.01 + index) * 0.1;
      if (animation.progress > dissolveThreshold) {
        // Mark segment as dissolved (will be handled in render)
        (pos as any).dissolved = true;
      }
    });
  }

  /**
   * Update shrink animation
   */
  private updateShrinkAnimation(animation: DeathAnimationState, deltaTime: number): void {
    // Segments shrink towards the head
    const headPos = animation.positions[0];
    
    animation.positions.forEach((pos, index) => {
      if (index === 0) return; // Don't move the head
      
      const dx = headPos.x - pos.x;
      const dy = headPos.y - pos.y;
      const shrinkSpeed = 2 * animation.progress;
      
      pos.x += dx * shrinkSpeed * deltaTime * 0.01;
      pos.y += dy * shrinkSpeed * deltaTime * 0.01;
    });
  }

  /**
   * Get render data for a death animation
   */
  public getAnimationRenderData(snakeId: string): {
    positions: Position[];
    opacity: number;
    scale: number;
    color: string;
    type: string;
  } | null {
    const animation = this.activeAnimations.get(snakeId);
    if (!animation) return null;

    let opacity = 1;
    let scale = 1;

    switch (animation.type) {
      case 'fade':
        opacity = 1 - animation.progress;
        break;
      case 'explosion':
        opacity = 1 - animation.progress * 0.8;
        scale = 1 + animation.progress * 0.5;
        break;
      case 'dissolve':
        opacity = 1 - animation.progress * 0.6;
        break;
      case 'shrink':
        opacity = 1 - animation.progress * 0.9;
        scale = 1 - animation.progress * 0.8;
        break;
    }

    return {
      positions: animation.positions,
      opacity: Math.max(0, opacity),
      scale: Math.max(0.1, scale),
      color: animation.color,
      type: animation.type
    };
  }

  /**
   * Check if a snake has an active death animation
   */
  public hasActiveAnimation(snakeId: string): boolean {
    return this.activeAnimations.has(snakeId);
  }

  /**
   * Register a callback for when an animation completes
   */
  public onAnimationComplete(snakeId: string, callback: (state: DeathAnimationState) => void): void {
    this.animationCallbacks.set(snakeId, callback);
  }

  /**
   * Force complete an animation
   */
  public completeAnimation(snakeId: string): void {
    const animation = this.activeAnimations.get(snakeId);
    if (animation) {
      animation.progress = 1;
      animation.isComplete = true;
    }
  }

  /**
   * Cancel an animation
   */
  public cancelAnimation(snakeId: string): void {
    this.activeAnimations.delete(snakeId);
    this.animationCallbacks.delete(snakeId);
  }

  /**
   * Get all active animation IDs
   */
  public getActiveAnimationIds(): string[] {
    return Array.from(this.activeAnimations.keys());
  }

  /**
   * Clear all animations
   */
  public clearAllAnimations(): void {
    this.activeAnimations.clear();
    this.animationCallbacks.clear();
  }

  /**
   * Get animation statistics
   */
  public getStats(): {
    activeAnimations: number;
    animationTypes: { [key: string]: number };
  } {
    const stats = {
      activeAnimations: this.activeAnimations.size,
      animationTypes: {} as { [key: string]: number }
    };

    this.activeAnimations.forEach(animation => {
      stats.animationTypes[animation.type] = (stats.animationTypes[animation.type] || 0) + 1;
    });

    return stats;
  }
}

/**
 * CSS-based death animation helper for DOM elements
 */
export class CSSDeathAnimations {
  /**
   * Apply death animation CSS class to an element
   */
  public static applyDeathAnimation(
    element: HTMLElement,
    animationType: 'fade' | 'explosion' | 'dissolve' | 'shrink',
    duration: number = 800
  ): Promise<void> {
    return new Promise((resolve) => {
      element.style.animationDuration = `${duration}ms`;
      element.classList.add(`death-animation-${animationType}`);

      const handleAnimationEnd = () => {
        element.removeEventListener('animationend', handleAnimationEnd);
        resolve();
      };

      element.addEventListener('animationend', handleAnimationEnd);

      // Fallback timeout in case animation event doesn't fire
      setTimeout(() => {
        element.removeEventListener('animationend', handleAnimationEnd);
        resolve();
      }, duration + 100);
    });
  }

  /**
   * Get CSS keyframes for death animations
   */
  public static getAnimationCSS(): string {
    return `
      @keyframes death-animation-fade {
        0% { opacity: 1; }
        100% { opacity: 0; }
      }

      @keyframes death-animation-explosion {
        0% { 
          opacity: 1; 
          transform: scale(1); 
        }
        50% { 
          opacity: 0.8; 
          transform: scale(1.2); 
        }
        100% { 
          opacity: 0; 
          transform: scale(1.5); 
        }
      }

      @keyframes death-animation-dissolve {
        0% { 
          opacity: 1; 
          filter: blur(0px); 
        }
        50% { 
          opacity: 0.6; 
          filter: blur(1px); 
        }
        100% { 
          opacity: 0; 
          filter: blur(3px); 
        }
      }

      @keyframes death-animation-shrink {
        0% { 
          opacity: 1; 
          transform: scale(1); 
        }
        100% { 
          opacity: 0; 
          transform: scale(0.1); 
        }
      }

      .death-animation-fade {
        animation: death-animation-fade ease-out forwards;
      }

      .death-animation-explosion {
        animation: death-animation-explosion ease-out forwards;
      }

      .death-animation-dissolve {
        animation: death-animation-dissolve ease-out forwards;
      }

      .death-animation-shrink {
        animation: death-animation-shrink ease-in forwards;
      }
    `;
  }
}