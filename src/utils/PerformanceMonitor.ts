// src/utils/PerformanceMonitor.ts

export interface PerformanceMetrics {
  frameTime: number;
  aiCalculationTime: number;
  collisionDetectionTime: number;
  renderTime: number;
  totalGameLoopTime: number;
  timestamp: number;
}

export interface PerformanceThresholds {
  maxFrameTime: number; // 16.67ms for 60 FPS
  maxAITime: number; // 5ms max for AI calculations
  maxCollisionTime: number; // 2ms max for collision detection
  maxRenderTime: number; // 8ms max for rendering
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxHistorySize: number = 60; // Keep last 60 measurements (1 second at 60 FPS)
  private thresholds: PerformanceThresholds;
  private performanceLevel: 'high' | 'medium' | 'low' = 'high';
  private lastAdjustmentTime: number = 0;
  private adjustmentCooldown: number = 2000; // 2 seconds between adjustments

  constructor(thresholds: PerformanceThresholds = {
    maxFrameTime: 16.67,
    maxAITime: 5,
    maxCollisionTime: 2,
    maxRenderTime: 8
  }) {
    this.thresholds = thresholds;
  }

  /**
   * Record performance metrics for current frame
   */
  public recordMetrics(metrics: Omit<PerformanceMetrics, 'timestamp'>): void {
    const fullMetrics: PerformanceMetrics = {
      ...metrics,
      timestamp: performance.now()
    };

    this.metrics.push(fullMetrics);

    // Limit history size
    if (this.metrics.length > this.maxHistorySize) {
      this.metrics.shift();
    }

    // Check if performance adjustment is needed
    this.checkPerformanceAdjustment();
  }

  /**
   * Get current performance statistics
   */
  public getPerformanceStats() {
    if (this.metrics.length === 0) {
      return {
        averageFrameTime: 0,
        averageAITime: 0,
        averageCollisionTime: 0,
        averageRenderTime: 0,
        currentFPS: 0,
        performanceLevel: this.performanceLevel,
        isPerformanceGood: true,
        recommendations: []
      };
    }

    const recent = this.metrics.slice(-30); // Last 30 frames (0.5 seconds)
    
    const avgFrameTime = recent.reduce((sum, m) => sum + m.frameTime, 0) / recent.length;
    const avgAITime = recent.reduce((sum, m) => sum + m.aiCalculationTime, 0) / recent.length;
    const avgCollisionTime = recent.reduce((sum, m) => sum + m.collisionDetectionTime, 0) / recent.length;
    const avgRenderTime = recent.reduce((sum, m) => sum + m.renderTime, 0) / recent.length;
    
    const currentFPS = 1000 / avgFrameTime;
    const isPerformanceGood = avgFrameTime <= this.thresholds.maxFrameTime;
    
    const recommendations = this.generateRecommendations(avgFrameTime, avgAITime, avgCollisionTime, avgRenderTime);

    return {
      averageFrameTime: avgFrameTime,
      averageAITime: avgAITime,
      averageCollisionTime: avgCollisionTime,
      averageRenderTime: avgRenderTime,
      currentFPS: currentFPS,
      performanceLevel: this.performanceLevel,
      isPerformanceGood: isPerformanceGood,
      recommendations: recommendations
    };
  }

  /**
   * Get performance level for adaptive systems
   */
  public getPerformanceLevel(): 'high' | 'medium' | 'low' {
    return this.performanceLevel;
  }

  /**
   * Check if specific performance aspect is within threshold
   */
  public isWithinThreshold(aspect: keyof PerformanceThresholds, value: number): boolean {
    return value <= this.thresholds[aspect];
  }

  /**
   * Get performance recommendations
   */
  private generateRecommendations(avgFrameTime: number, avgAITime: number, avgCollisionTime: number, avgRenderTime: number): string[] {
    const recommendations: string[] = [];

    if (avgFrameTime > this.thresholds.maxFrameTime) {
      recommendations.push('Frame time exceeds 60 FPS target');
    }

    if (avgAITime > this.thresholds.maxAITime) {
      recommendations.push('AI calculations taking too long - consider throttling');
    }

    if (avgCollisionTime > this.thresholds.maxCollisionTime) {
      recommendations.push('Collision detection is slow - consider spatial partitioning');
    }

    if (avgRenderTime > this.thresholds.maxRenderTime) {
      recommendations.push('Rendering is slow - consider reducing visual effects');
    }

    // Overall performance recommendations
    if (avgFrameTime > 25) { // Below 40 FPS
      recommendations.push('Consider reducing game complexity or visual quality');
    } else if (avgFrameTime > 20) { // Below 50 FPS
      recommendations.push('Performance is marginal - monitor closely');
    }

    return recommendations;
  }

  /**
   * Automatically adjust performance level based on metrics
   */
  private checkPerformanceAdjustment(): void {
    const now = performance.now();
    if (now - this.lastAdjustmentTime < this.adjustmentCooldown) {
      return; // Too soon to adjust again
    }

    if (this.metrics.length < 30) {
      return; // Not enough data
    }

    const stats = this.getPerformanceStats();
    const currentLevel = this.performanceLevel;
    let newLevel = currentLevel;

    // Determine if we need to adjust performance level
    if (stats.averageFrameTime > 25) { // Below 40 FPS
      newLevel = 'low';
    } else if (stats.averageFrameTime > 20) { // Below 50 FPS
      newLevel = 'medium';
    } else if (stats.averageFrameTime < 16 && currentLevel !== 'high') { // Good performance, can increase quality
      newLevel = 'high';
    }

    // Only adjust if level actually changed
    if (newLevel !== currentLevel) {
      this.performanceLevel = newLevel;
      this.lastAdjustmentTime = now;
      console.log(`Performance level adjusted to: ${newLevel} (avg frame time: ${stats.averageFrameTime.toFixed(2)}ms)`);
    }
  }

  /**
   * Reset performance history
   */
  public reset(): void {
    this.metrics = [];
    this.performanceLevel = 'high';
    this.lastAdjustmentTime = 0;
  }

  /**
   * Get detailed performance breakdown
   */
  public getDetailedBreakdown() {
    if (this.metrics.length === 0) return null;

    const recent = this.metrics.slice(-10); // Last 10 frames
    
    return {
      frameTimeBreakdown: {
        min: Math.min(...recent.map(m => m.frameTime)),
        max: Math.max(...recent.map(m => m.frameTime)),
        avg: recent.reduce((sum, m) => sum + m.frameTime, 0) / recent.length
      },
      aiTimeBreakdown: {
        min: Math.min(...recent.map(m => m.aiCalculationTime)),
        max: Math.max(...recent.map(m => m.aiCalculationTime)),
        avg: recent.reduce((sum, m) => sum + m.aiCalculationTime, 0) / recent.length
      },
      collisionTimeBreakdown: {
        min: Math.min(...recent.map(m => m.collisionDetectionTime)),
        max: Math.max(...recent.map(m => m.collisionDetectionTime)),
        avg: recent.reduce((sum, m) => sum + m.collisionDetectionTime, 0) / recent.length
      },
      renderTimeBreakdown: {
        min: Math.min(...recent.map(m => m.renderTime)),
        max: Math.max(...recent.map(m => m.renderTime)),
        avg: recent.reduce((sum, m) => sum + m.renderTime, 0) / recent.length
      }
    };
  }

  /**
   * Check if performance is consistently poor
   */
  public isPerformanceConsistentlyPoor(): boolean {
    if (this.metrics.length < 30) return false;

    const recent = this.metrics.slice(-30);
    const poorFrames = recent.filter(m => m.frameTime > this.thresholds.maxFrameTime).length;
    
    return poorFrames / recent.length > 0.7; // More than 70% of frames are poor
  }

  /**
   * Get performance trend (improving, stable, degrading)
   */
  public getPerformanceTrend(): 'improving' | 'stable' | 'degrading' {
    if (this.metrics.length < 20) return 'stable';

    const firstHalf = this.metrics.slice(-20, -10);
    const secondHalf = this.metrics.slice(-10);

    const firstAvg = firstHalf.reduce((sum, m) => sum + m.frameTime, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, m) => sum + m.frameTime, 0) / secondHalf.length;

    const difference = secondAvg - firstAvg;

    if (difference > 2) return 'degrading';
    if (difference < -2) return 'improving';
    return 'stable';
  }
}