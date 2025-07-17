// src/utils/InputThrottler.ts
import { Direction } from '../types/GameEnhancements';

export interface InputThrottlerConfig {
  minInterval: number; // Minimum ms between direction changes
  maxQueueSize: number; // Maximum queued inputs
  touchThreshold: number; // Minimum swipe distance in pixels
  maxProcessingTime: number; // Maximum time to spend processing inputs per frame
}

export const DEFAULT_INPUT_CONFIG: InputThrottlerConfig = {
  minInterval: 40, // 40ms between direction changes
  maxQueueSize: 2, // Max 2 queued inputs
  touchThreshold: 25, // 25px minimum swipe
  maxProcessingTime: 16 // 16ms max processing time per frame
};

export class InputThrottler {
  private inputQueue: Direction[] = [];
  private lastProcessedTime: number = 0;
  private lastDirection: Direction = 'RIGHT';
  private config: InputThrottlerConfig;

  // Performance tracking
  private stats = {
    totalInputs: 0,
    processedInputs: 0,
    droppedInputs: 0,
    averageProcessingTime: 0,
    totalProcessingTime: 0
  };

  constructor(config: Partial<InputThrottlerConfig> = {}) {
    this.config = { ...DEFAULT_INPUT_CONFIG, ...config };
  }

  /**
   * Queue a direction input
   */
  public queueInput(direction: Direction): boolean {
    const now = performance.now();
    this.stats.totalInputs++;

    // Check if input is valid (not opposite direction)
    if (!this.isValidDirectionChange(this.lastDirection, direction)) {
      this.stats.droppedInputs++;
      return false;
    }

    // Check if queue is full
    if (this.inputQueue.length >= this.config.maxQueueSize) {
      // Remove oldest input to make room
      this.inputQueue.shift();
      this.stats.droppedInputs++;
    }

    // Add to queue if different from last queued direction
    if (this.inputQueue.length === 0 || 
        this.inputQueue[this.inputQueue.length - 1] !== direction) {
      this.inputQueue.push(direction);
      return true;
    }

    return false;
  }

  /**
   * Process queued inputs and return next direction if ready
   */
  public processQueue(currentDirection: Direction): Direction | null {
    const startTime = performance.now();
    
    if (this.inputQueue.length === 0) {
      return null;
    }

    // Check if enough time has passed since last direction change
    const now = performance.now();
    if (now - this.lastProcessedTime < this.config.minInterval) {
      return null;
    }

    // Process inputs within time budget
    let processedDirection: Direction | null = null;
    
    while (this.inputQueue.length > 0 && 
           performance.now() - startTime < this.config.maxProcessingTime) {
      
      const nextDirection = this.inputQueue.shift()!;
      
      if (this.isValidDirectionChange(currentDirection, nextDirection)) {
        processedDirection = nextDirection;
        this.lastDirection = nextDirection;
        this.lastProcessedTime = now;
        this.stats.processedInputs++;
        break;
      } else {
        this.stats.droppedInputs++;
      }
    }

    // Update performance stats
    const processingTime = performance.now() - startTime;
    this.stats.totalProcessingTime += processingTime;
    this.stats.averageProcessingTime = 
      this.stats.totalProcessingTime / Math.max(1, this.stats.processedInputs);

    return processedDirection;
  }

  /**
   * Clear the input queue
   */
  public clearQueue(): void {
    this.inputQueue.length = 0;
  }

  /**
   * Check if direction change is valid (not opposite)
   */
  private isValidDirectionChange(currentDir: Direction, newDir: Direction): boolean {
    const opposites: { [key in Direction]: Direction } = {
      'UP': 'DOWN',
      'DOWN': 'UP',
      'LEFT': 'RIGHT',
      'RIGHT': 'LEFT'
    };
    return opposites[currentDir] !== newDir;
  }

  /**
   * Get input processing statistics
   */
  public getStats() {
    return {
      ...this.stats,
      queueSize: this.inputQueue.length,
      dropRate: this.stats.totalInputs > 0 ? 
        this.stats.droppedInputs / this.stats.totalInputs : 0,
      processRate: this.stats.totalInputs > 0 ? 
        this.stats.processedInputs / this.stats.totalInputs : 0
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<InputThrottlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      totalInputs: 0,
      processedInputs: 0,
      droppedInputs: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0
    };
  }

  /**
   * Get current configuration
   */
  public getConfig(): InputThrottlerConfig {
    return { ...this.config };
  }
}

// Touch input helper for mobile optimization
export class TouchInputProcessor {
  private startPosition: { x: number; y: number } | null = null;
  private minSwipeDistance: number;
  private maxSwipeTime: number = 500; // Max time for a swipe gesture
  private startTime: number = 0;

  constructor(minSwipeDistance: number = 25) {
    this.minSwipeDistance = minSwipeDistance;
  }

  /**
   * Process touch start event
   */
  public onTouchStart(e: TouchEvent | React.TouchEvent): void {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this.startPosition = { x: touch.clientX, y: touch.clientY };
      this.startTime = performance.now();
    }
  }

  /**
   * Process touch end event and return direction if valid swipe
   */
  public onTouchEnd(e: TouchEvent | React.TouchEvent): Direction | null {
    if (!this.startPosition || e.changedTouches.length === 0) {
      return null;
    }

    const touch = e.changedTouches[0];
    const endPosition = { x: touch.clientX, y: touch.clientY };
    const swipeTime = performance.now() - this.startTime;

    // Check if swipe was too slow
    if (swipeTime > this.maxSwipeTime) {
      this.startPosition = null;
      return null;
    }

    const deltaX = endPosition.x - this.startPosition.x;
    const deltaY = endPosition.y - this.startPosition.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    this.startPosition = null;

    // Check if swipe distance meets threshold
    if (distance < this.minSwipeDistance) {
      return null;
    }

    // Determine direction based on largest component
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 'RIGHT' : 'LEFT';
    } else {
      return deltaY > 0 ? 'DOWN' : 'UP';
    }
  }

  /**
   * Update minimum swipe distance
   */
  public setMinSwipeDistance(distance: number): void {
    this.minSwipeDistance = distance;
  }

  /**
   * Get current swipe distance threshold
   */
  public getMinSwipeDistance(): number {
    return this.minSwipeDistance;
  }
}