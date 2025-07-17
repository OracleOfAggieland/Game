// src/utils/MovementInterpolation.ts

export interface Position {
  x: number;
  y: number;
}

export interface InterpolatedPosition extends Position {
  targetX: number;
  targetY: number;
  interpolationProgress: number;
}

/**
 * Easing functions for smooth animations
 */
export class EasingFunctions {
  static linear(t: number): number {
    return t;
  }

  static easeInQuad(t: number): number {
    return t * t;
  }

  static easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  static easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  static easeOutCubic(t: number): number {
    return (--t) * t * t + 1;
  }

  static easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  }

  static easeOutElastic(t: number): number {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
}

/**
 * Movement interpolation system for smooth snake movement
 */
export class MovementInterpolator {
  private interpolationSpeed: number;
  private easingFunction: (t: number) => number;
  private isEnabled: boolean;

  constructor(
    interpolationSpeed: number = 0.15,
    easingFunction: (t: number) => number = EasingFunctions.easeOutQuad,
    isEnabled: boolean = true
  ) {
    this.interpolationSpeed = interpolationSpeed;
    this.easingFunction = easingFunction;
    this.isEnabled = isEnabled;
  }

  /**
   * Initialize interpolated position from current position
   */
  public initializePosition(x: number, y: number): InterpolatedPosition {
    return {
      x,
      y,
      targetX: x,
      targetY: y,
      interpolationProgress: 1
    };
  }

  /**
   * Set new target position for interpolation
   */
  public setTarget(position: InterpolatedPosition, targetX: number, targetY: number): void {
    if (!this.isEnabled) {
      position.x = targetX;
      position.y = targetY;
      position.targetX = targetX;
      position.targetY = targetY;
      position.interpolationProgress = 1;
      return;
    }

    // Only start new interpolation if target has changed
    if (position.targetX !== targetX || position.targetY !== targetY) {
      position.targetX = targetX;
      position.targetY = targetY;
      position.interpolationProgress = 0;
    }
  }

  /**
   * Update interpolated position
   */
  public updatePosition(position: InterpolatedPosition, _deltaTime: number): void {
    if (!this.isEnabled || position.interpolationProgress >= 1) {
      return;
    }

    // Update interpolation progress
    position.interpolationProgress = Math.min(1, position.interpolationProgress + this.interpolationSpeed);

    // Apply easing function
    const easedProgress = this.easingFunction(position.interpolationProgress);

    // Calculate interpolated position
    const startX = position.x - (position.targetX - position.x) * (easedProgress / (1 - easedProgress + 0.001));
    const startY = position.y - (position.targetY - position.y) * (easedProgress / (1 - easedProgress + 0.001));

    position.x = startX + (position.targetX - startX) * easedProgress;
    position.y = startY + (position.targetY - startY) * easedProgress;

    // Snap to target when very close
    if (position.interpolationProgress >= 0.95) {
      position.x = position.targetX;
      position.y = position.targetY;
      position.interpolationProgress = 1;
    }
  }

  /**
   * Get current interpolated position
   */
  public getCurrentPosition(position: InterpolatedPosition): Position {
    return { x: position.x, y: position.y };
  }

  /**
   * Check if interpolation is complete
   */
  public isInterpolationComplete(position: InterpolatedPosition): boolean {
    return position.interpolationProgress >= 1;
  }

  /**
   * Enable or disable interpolation
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Set interpolation speed
   */
  public setSpeed(speed: number): void {
    this.interpolationSpeed = Math.max(0.01, Math.min(1, speed));
  }

  /**
   * Set easing function
   */
  public setEasingFunction(easingFunction: (t: number) => number): void {
    this.easingFunction = easingFunction;
  }

  /**
   * Get interpolation settings
   */
  public getSettings(): {
    speed: number;
    enabled: boolean;
    easingFunction: string;
  } {
    return {
      speed: this.interpolationSpeed,
      enabled: this.isEnabled,
      easingFunction: this.easingFunction.name || 'custom'
    };
  }
}

/**
 * Snake-specific movement interpolation
 */
export class SnakeMovementInterpolator extends MovementInterpolator {
  private segmentPositions: Map<string, InterpolatedPosition[]> = new Map();

  constructor() {
    super(0.2, EasingFunctions.easeOutCubic, true);
  }

  /**
   * Initialize snake positions for interpolation
   */
  public initializeSnake(snakeId: string, positions: Position[]): void {
    const interpolatedPositions = positions.map(pos => 
      this.initializePosition(pos.x, pos.y)
    );
    this.segmentPositions.set(snakeId, interpolatedPositions);
  }

  /**
   * Update snake target positions
   */
  public updateSnakeTargets(snakeId: string, newPositions: Position[]): void {
    const interpolatedPositions = this.segmentPositions.get(snakeId);
    if (!interpolatedPositions) {
      this.initializeSnake(snakeId, newPositions);
      return;
    }

    // Ensure we have the right number of segments
    while (interpolatedPositions.length < newPositions.length) {
      const lastPos = interpolatedPositions[interpolatedPositions.length - 1];
      interpolatedPositions.push(this.initializePosition(lastPos.x, lastPos.y));
    }
    while (interpolatedPositions.length > newPositions.length) {
      interpolatedPositions.pop();
    }

    // Update targets for each segment
    newPositions.forEach((pos, index) => {
      this.setTarget(interpolatedPositions[index], pos.x, pos.y);
    });
  }

  /**
   * Update all snake interpolations
   */
  public updateSnakePositions(deltaTime: number): void {
    this.segmentPositions.forEach(positions => {
      positions.forEach(pos => {
        this.updatePosition(pos, deltaTime);
      });
    });
  }

  /**
   * Get current interpolated positions for a snake
   */
  public getSnakePositions(snakeId: string): Position[] {
    const interpolatedPositions = this.segmentPositions.get(snakeId);
    if (!interpolatedPositions) return [];

    return interpolatedPositions.map(pos => this.getCurrentPosition(pos));
  }

  /**
   * Remove snake from interpolation
   */
  public removeSnake(snakeId: string): void {
    this.segmentPositions.delete(snakeId);
  }

  /**
   * Clear all snakes
   */
  public clearAllSnakes(): void {
    this.segmentPositions.clear();
  }

  /**
   * Get interpolation progress for debugging
   */
  public getSnakeInterpolationProgress(snakeId: string): number[] {
    const positions = this.segmentPositions.get(snakeId);
    if (!positions) return [];
    
    return positions.map(pos => pos.interpolationProgress);
  }
}

/**
 * Device-based interpolation settings
 */
export class InterpolationSettings {
  /**
   * Get recommended interpolation settings based on device performance
   */
  public static getRecommendedSettings(): {
    enabled: boolean;
    speed: number;
    easingFunction: (t: number) => number;
  } {
    // Detect device performance
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hasHighDPI = window.devicePixelRatio > 1.5;
    const isLowEnd = isMobile && !hasHighDPI;

    if (isLowEnd) {
      return {
        enabled: false, // Disable on low-end devices
        speed: 0.3,
        easingFunction: EasingFunctions.linear
      };
    } else if (isMobile) {
      return {
        enabled: true,
        speed: 0.25, // Slightly faster on mobile
        easingFunction: EasingFunctions.easeOutQuad
      };
    } else {
      return {
        enabled: true,
        speed: 0.15, // Smooth on desktop
        easingFunction: EasingFunctions.easeOutCubic
      };
    }
  }

  /**
   * Apply recommended settings to an interpolator
   */
  public static applyRecommendedSettings(interpolator: MovementInterpolator): void {
    const settings = this.getRecommendedSettings();
    interpolator.setEnabled(settings.enabled);
    interpolator.setSpeed(settings.speed);
    interpolator.setEasingFunction(settings.easingFunction);
  }
}