// src/utils/PerformanceValidator.ts

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  renderTime: number;
  updateTime: number;
  totalObjects: number;
  activeFeatures: string[];
}

export interface PerformanceThresholds {
  minFPS: number;
  maxFrameTime: number;
  maxMemoryUsage: number;
  maxRenderTime: number;
  maxUpdateTime: number;
}

export interface PerformanceReport {
  timestamp: number;
  metrics: PerformanceMetrics;
  thresholds: PerformanceThresholds;
  passed: boolean;
  issues: string[];
  recommendations: string[];
}

/**
 * Performance validation and monitoring system
 */
export class PerformanceValidator {
  private metrics: PerformanceMetrics[] = [];
  private thresholds: PerformanceThresholds;
  private isMonitoring: boolean = false;
  private monitoringInterval: number | null = null;
  private frameTimeHistory: number[] = [];
  private lastFrameTime: number = 0;
  private renderStartTime: number = 0;
  private updateStartTime: number = 0;

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = {
      minFPS: 45, // Minimum acceptable FPS
      maxFrameTime: 22, // Maximum frame time in ms (45 FPS)
      maxMemoryUsage: 100, // Maximum memory usage in MB
      maxRenderTime: 10, // Maximum render time in ms
      maxUpdateTime: 8, // Maximum update time in ms
      ...thresholds
    };
  }

  /**
   * Start performance monitoring
   */
  public startMonitoring(intervalMs: number = 1000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.lastFrameTime = performance.now();
    
    // Monitor frame rate
    this.monitorFrameRate();
    
    // Periodic metrics collection
    this.monitoringInterval = window.setInterval(() => {
      this.collectMetrics();
    }, intervalMs);
  }

  /**
   * Stop performance monitoring
   */
  public stopMonitoring(): void {
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Monitor frame rate using requestAnimationFrame
   */
  private monitorFrameRate(): void {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();
    const frameTime = currentTime - this.lastFrameTime;
    
    this.frameTimeHistory.push(frameTime);
    
    // Keep only recent frame times (last 60 frames)
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift();
    }
    
    this.lastFrameTime = currentTime;
    
    requestAnimationFrame(() => this.monitorFrameRate());
  }

  /**
   * Mark the start of render phase
   */
  public markRenderStart(): void {
    this.renderStartTime = performance.now();
  }

  /**
   * Mark the end of render phase
   */
  public markRenderEnd(): number {
    const renderTime = performance.now() - this.renderStartTime;
    return renderTime;
  }

  /**
   * Mark the start of update phase
   */
  public markUpdateStart(): void {
    this.updateStartTime = performance.now();
  }

  /**
   * Mark the end of update phase
   */
  public markUpdateEnd(): number {
    const updateTime = performance.now() - this.updateStartTime;
    return updateTime;
  }

  /**
   * Collect current performance metrics
   */
  public collectMetrics(): PerformanceMetrics {
    const averageFrameTime = this.getAverageFrameTime();
    const fps = averageFrameTime > 0 ? 1000 / averageFrameTime : 0;
    
    const metrics: PerformanceMetrics = {
      fps: Math.round(fps),
      frameTime: Math.round(averageFrameTime * 100) / 100,
      memoryUsage: this.getMemoryUsage(),
      renderTime: this.markRenderEnd(),
      updateTime: this.markUpdateEnd(),
      totalObjects: this.getTotalObjectCount(),
      activeFeatures: this.getActiveFeatures()
    };

    this.metrics.push(metrics);
    
    // Keep only recent metrics (last 100 samples)
    if (this.metrics.length > 100) {
      this.metrics.shift();
    }

    return metrics;
  }

  /**
   * Get average frame time from recent history
   */
  private getAverageFrameTime(): number {
    if (this.frameTimeHistory.length === 0) return 0;
    
    const sum = this.frameTimeHistory.reduce((a, b) => a + b, 0);
    return sum / this.frameTimeHistory.length;
  }

  /**
   * Get memory usage (if available)
   */
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return Math.round(memory.usedJSHeapSize / 1024 / 1024); // Convert to MB
    }
    return 0;
  }

  /**
   * Get total object count (estimate)
   */
  private getTotalObjectCount(): number {
    // This would be implemented to count game objects
    // For now, return an estimate based on DOM elements
    return document.querySelectorAll('.cell, .powerup, .snake-head, .snake-body').length;
  }

  /**
   * Get list of active features
   */
  private getActiveFeatures(): string[] {
    const features: string[] = [];
    
    // Check for various game features
    if (document.querySelector('.powerup')) features.push('power-ups');
    if (document.querySelector('.boss-head')) features.push('boss-snakes');
    if (document.querySelector('.wave-progress')) features.push('wave-system');
    if (document.querySelector('.particle-system')) features.push('particles');
    
    return features;
  }

  /**
   * Validate current performance against thresholds
   */
  public validatePerformance(): PerformanceReport {
    const metrics = this.collectMetrics();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check FPS
    if (metrics.fps < this.thresholds.minFPS) {
      issues.push(`Low FPS: ${metrics.fps} (minimum: ${this.thresholds.minFPS})`);
      recommendations.push('Consider reducing visual effects or power-up count');
    }

    // Check frame time
    if (metrics.frameTime > this.thresholds.maxFrameTime) {
      issues.push(`High frame time: ${metrics.frameTime}ms (maximum: ${this.thresholds.maxFrameTime}ms)`);
      recommendations.push('Optimize game loop or enable performance mode');
    }

    // Check memory usage
    if (metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
      issues.push(`High memory usage: ${metrics.memoryUsage}MB (maximum: ${this.thresholds.maxMemoryUsage}MB)`);
      recommendations.push('Enable object pooling or reduce particle count');
    }

    // Check render time
    if (metrics.renderTime > this.thresholds.maxRenderTime) {
      issues.push(`High render time: ${metrics.renderTime}ms (maximum: ${this.thresholds.maxRenderTime}ms)`);
      recommendations.push('Consider WebGL rendering or reduce visual complexity');
    }

    // Check update time
    if (metrics.updateTime > this.thresholds.maxUpdateTime) {
      issues.push(`High update time: ${metrics.updateTime}ms (maximum: ${this.thresholds.maxUpdateTime}ms)`);
      recommendations.push('Optimize collision detection or AI calculations');
    }

    return {
      timestamp: Date.now(),
      metrics,
      thresholds: this.thresholds,
      passed: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Run comprehensive performance test
   */
  public async runPerformanceTest(durationMs: number = 10000): Promise<PerformanceReport[]> {
    const reports: PerformanceReport[] = [];
    const startTime = Date.now();
    
    console.log('Starting performance test...');
    
    // Start monitoring
    this.startMonitoring(500); // Collect metrics every 500ms
    
    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, durationMs));
    
    // Collect final reports
    const endTime = Date.now();
    const testDuration = endTime - startTime;
    
    // Generate reports for different scenarios
    reports.push(this.validatePerformance());
    
    // Stop monitoring
    this.stopMonitoring();
    
    console.log(`Performance test completed in ${testDuration}ms`);
    
    return reports;
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    averageFPS: number;
    minFPS: number;
    maxFPS: number;
    averageFrameTime: number;
    averageMemoryUsage: number;
    sampleCount: number;
  } {
    if (this.metrics.length === 0) {
      return {
        averageFPS: 0,
        minFPS: 0,
        maxFPS: 0,
        averageFrameTime: 0,
        averageMemoryUsage: 0,
        sampleCount: 0
      };
    }

    const fpsList = this.metrics.map(m => m.fps);
    const frameTimeList = this.metrics.map(m => m.frameTime);
    const memoryList = this.metrics.map(m => m.memoryUsage);

    return {
      averageFPS: Math.round(fpsList.reduce((a, b) => a + b, 0) / fpsList.length),
      minFPS: Math.min(...fpsList),
      maxFPS: Math.max(...fpsList),
      averageFrameTime: Math.round((frameTimeList.reduce((a, b) => a + b, 0) / frameTimeList.length) * 100) / 100,
      averageMemoryUsage: Math.round(memoryList.reduce((a, b) => a + b, 0) / memoryList.length),
      sampleCount: this.metrics.length
    };
  }

  /**
   * Export performance data for analysis
   */
  public exportData(): {
    metrics: PerformanceMetrics[];
    thresholds: PerformanceThresholds;
    stats: any;
  } {
    return {
      metrics: [...this.metrics],
      thresholds: { ...this.thresholds },
      stats: this.getPerformanceStats()
    };
  }

  /**
   * Clear collected metrics
   */
  public clearMetrics(): void {
    this.metrics = [];
    this.frameTimeHistory = [];
  }

  /**
   * Update performance thresholds
   */
  public updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }
}

/**
 * Load testing utilities
 */
export class LoadTester {
  private validator: PerformanceValidator;

  constructor(validator: PerformanceValidator) {
    this.validator = validator;
  }

  /**
   * Test performance with maximum game objects
   */
  public async testMaxLoad(): Promise<PerformanceReport> {
    console.log('Testing maximum load scenario...');
    
    // Simulate maximum game state
    const testScenario = {
      snakes: 6,
      powerUps: 5,
      bossSnakes: 2,
      particles: 100,
      waveNumber: 10
    };

    // Run test for 5 seconds
    const reports = await this.validator.runPerformanceTest(5000);
    
    return reports[0];
  }

  /**
   * Test performance on different device types
   */
  public async testDeviceCompatibility(): Promise<{
    desktop: PerformanceReport;
    mobile: PerformanceReport;
    lowEnd: PerformanceReport;
  }> {
    const results = {
      desktop: await this.testDesktopPerformance(),
      mobile: await this.testMobilePerformance(),
      lowEnd: await this.testLowEndPerformance()
    };

    return results;
  }

  /**
   * Test desktop performance (high settings)
   */
  private async testDesktopPerformance(): Promise<PerformanceReport> {
    // Set high-performance thresholds
    this.validator.updateThresholds({
      minFPS: 60,
      maxFrameTime: 16.67,
      maxMemoryUsage: 200,
      maxRenderTime: 8,
      maxUpdateTime: 6
    });

    const reports = await this.validator.runPerformanceTest(3000);
    return reports[0];
  }

  /**
   * Test mobile performance (medium settings)
   */
  private async testMobilePerformance(): Promise<PerformanceReport> {
    // Set mobile-friendly thresholds
    this.validator.updateThresholds({
      minFPS: 45,
      maxFrameTime: 22,
      maxMemoryUsage: 100,
      maxRenderTime: 12,
      maxUpdateTime: 10
    });

    const reports = await this.validator.runPerformanceTest(3000);
    return reports[0];
  }

  /**
   * Test low-end device performance (low settings)
   */
  private async testLowEndPerformance(): Promise<PerformanceReport> {
    // Set low-end device thresholds
    this.validator.updateThresholds({
      minFPS: 30,
      maxFrameTime: 33,
      maxMemoryUsage: 50,
      maxRenderTime: 20,
      maxUpdateTime: 15
    });

    const reports = await this.validator.runPerformanceTest(3000);
    return reports[0];
  }
}

/**
 * Firebase cost monitoring
 */
export class FirebaseCostMonitor {
  private readCount: number = 0;
  private writeCount: number = 0;
  private startTime: number = Date.now();

  /**
   * Track a Firebase read operation
   */
  public trackRead(): void {
    this.readCount++;
  }

  /**
   * Track a Firebase write operation
   */
  public trackWrite(): void {
    this.writeCount++;
  }

  /**
   * Get cost statistics
   */
  public getCostStats(): {
    reads: number;
    writes: number;
    duration: number;
    readsPerMinute: number;
    writesPerMinute: number;
    estimatedCost: number;
  } {
    const duration = Date.now() - this.startTime;
    const minutes = duration / 60000;

    return {
      reads: this.readCount,
      writes: this.writeCount,
      duration,
      readsPerMinute: minutes > 0 ? this.readCount / minutes : 0,
      writesPerMinute: minutes > 0 ? this.writeCount / minutes : 0,
      estimatedCost: this.calculateEstimatedCost()
    };
  }

  /**
   * Calculate estimated Firebase cost
   */
  private calculateEstimatedCost(): number {
    // Firestore pricing (approximate)
    const readCost = 0.00000036; // per read
    const writeCost = 0.00000108; // per write
    
    return (this.readCount * readCost) + (this.writeCount * writeCost);
  }

  /**
   * Reset counters
   */
  public reset(): void {
    this.readCount = 0;
    this.writeCount = 0;
    this.startTime = Date.now();
  }
}

// Global performance validator instance
export const performanceValidator = new PerformanceValidator();
export const loadTester = new LoadTester(performanceValidator);
export const firebaseCostMonitor = new FirebaseCostMonitor();