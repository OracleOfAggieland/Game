// src/utils/ThrottledAIProcessor.ts
import { Position, Direction, AIPersonality } from '../types/GameEnhancements';
import { OptimizedAIPathfinding, PathfindingContext } from './OptimizedAIPathfinding';

export interface AICalculation {
  snakeId: string;
  snake: Snake;
  gameState: AIGameState;
  priority: number;
  scheduledTime: number;
  lastCalculationTime?: number;
}

export interface AIResult {
  snakeId: string;
  direction: Direction;
  calculationTime: number;
  fallbackUsed: boolean;
}

export interface AIGameState {
  snakes: Snake[];
  food: Position[];
  powerUps: Position[];
  boardWidth: number;
  boardHeight: number;
  currentTime: number;
}

export interface Snake {
  id: string;
  name: string;
  positions: Position[];
  direction: Direction;
  score: number;
  color: string;
  isAlive: boolean;
  isAI: boolean;
  aiPersonality?: AIPersonality;
  lastDirectionChange?: number;
}

export interface ThrottledAIConfig {
  throttleInterval: number; // Process AI every N ticks
  maxCalculationTime: number; // Max ms per AI calculation
  fallbackDirection: Direction; // Fallback when calculation times out
  maxQueueSize: number; // Maximum AI calculations to queue
}

export class ThrottledAIProcessor {
  private aiQueue: Map<string, AICalculation> = new Map();
  private aiResults: Map<string, AIResult> = new Map();
  private currentIndex: number = 0;
  private config: ThrottledAIConfig;
  private tickCounter: number = 0;
  private optimizedPathfinding: OptimizedAIPathfinding;
  private frameLoadTracker: {
    currentFrameTime: number;
    maxFrameTime: number;
    calculationsThisFrame: number;
    maxCalculationsPerFrame: number;
  } = {
    currentFrameTime: 0,
    maxFrameTime: 16.67, // 60 FPS target
    calculationsThisFrame: 0,
    maxCalculationsPerFrame: 2 // Start conservative
  };
  private performanceMetrics: {
    totalCalculations: number;
    totalTime: number;
    timeouts: number;
    fallbacks: number;
    frameOverruns: number;
    adaptiveAdjustments: number;
  } = {
    totalCalculations: 0,
    totalTime: 0,
    timeouts: 0,
    fallbacks: 0,
    frameOverruns: 0,
    adaptiveAdjustments: 0
  };

  constructor(config: ThrottledAIConfig) {
    this.config = config;
    this.optimizedPathfinding = new OptimizedAIPathfinding();
  }

  /**
   * Schedule an AI calculation for processing
   */
  public scheduleAICalculation(snake: Snake, gameState: AIGameState): void {
    if (!snake.isAI || !snake.isAlive) return;

    // Calculate priority based on snake state and personality
    const priority = this.calculatePriority(snake, gameState);
    
    const calculation: AICalculation = {
      snakeId: snake.id,
      snake: { ...snake },
      gameState: { ...gameState },
      priority,
      scheduledTime: performance.now(),
      lastCalculationTime: this.aiResults.get(snake.id)?.calculationTime
    };

    // Add to queue, replacing existing calculation for same snake
    this.aiQueue.set(snake.id, calculation);

    // Limit queue size to prevent memory issues
    if (this.aiQueue.size > this.config.maxQueueSize) {
      this.pruneQueue();
    }
  }

  /**
   * Process the next AI calculation in the queue with frame-based load balancing
   */
  public processNextAI(): AIResult | null {
    this.tickCounter++;

    // Reset frame tracking at start of new frame
    if (this.tickCounter % this.config.throttleInterval === 1) {
      this.frameLoadTracker.calculationsThisFrame = 0;
      this.frameLoadTracker.currentFrameTime = performance.now();
    }

    // Only process AI every N ticks based on throttle interval
    if (this.tickCounter % this.config.throttleInterval !== 0) {
      return null;
    }

    if (this.aiQueue.size === 0) return null;

    // Check if we've exceeded frame budget
    if (this.frameLoadTracker.calculationsThisFrame >= this.frameLoadTracker.maxCalculationsPerFrame) {
      return null; // Defer to next frame
    }

    // Check if we're running out of frame time
    const currentTime = performance.now();
    const frameTimeUsed = currentTime - this.frameLoadTracker.currentFrameTime;
    if (frameTimeUsed > this.frameLoadTracker.maxFrameTime * 0.8) {
      // Used 80% of frame budget, stop processing
      this.performanceMetrics.frameOverruns++;
      return null;
    }

    // Get next calculation to process (round-robin with priority)
    const calculation = this.getNextCalculation();
    if (!calculation) return null;

    // Remove from queue
    this.aiQueue.delete(calculation.snakeId);

    // Process the calculation with timeout
    const startTime = performance.now();
    let result: AIResult;

    try {
      const direction = this.calculateAIDirectionOptimized(calculation.snake, calculation.gameState);
      const calculationTime = performance.now() - startTime;

      result = {
        snakeId: calculation.snakeId,
        direction,
        calculationTime,
        fallbackUsed: false
      };

      // Check if calculation took too long
      if (calculationTime > this.config.maxCalculationTime) {
        this.performanceMetrics.timeouts++;
        console.warn(`AI calculation timeout for ${calculation.snakeId}: ${calculationTime}ms`);
      }

    } catch (error) {
      // Use fallback direction on error
      console.warn(`AI calculation error for ${calculation.snakeId}:`, error);
      result = {
        snakeId: calculation.snakeId,
        direction: this.config.fallbackDirection,
        calculationTime: performance.now() - startTime,
        fallbackUsed: true
      };
      this.performanceMetrics.fallbacks++;
    }

    // Update metrics and frame tracking
    this.performanceMetrics.totalCalculations++;
    this.performanceMetrics.totalTime += result.calculationTime;
    this.frameLoadTracker.calculationsThisFrame++;

    // Adaptive frame budget adjustment
    this.adjustFrameBudget(result.calculationTime);

    // Store result
    this.aiResults.set(calculation.snakeId, result);

    return result;
  }

  /**
   * Get the current AI direction for a snake
   */
  public getAIDirection(snakeId: string): Direction {
    const result = this.aiResults.get(snakeId);
    return result?.direction || this.config.fallbackDirection;
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics() {
    const avgTime = this.performanceMetrics.totalCalculations > 0 
      ? this.performanceMetrics.totalTime / this.performanceMetrics.totalCalculations 
      : 0;

    return {
      ...this.performanceMetrics,
      averageCalculationTime: avgTime,
      queueSize: this.aiQueue.size,
      resultsCached: this.aiResults.size
    };
  }

  /**
   * Clear all AI calculations and results
   */
  public clear(): void {
    this.aiQueue.clear();
    this.aiResults.clear();
    this.tickCounter = 0;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ThrottledAIConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Calculate priority for AI calculation
   */
  private calculatePriority(snake: Snake, gameState: AIGameState): number {
    let priority = 1;

    // Higher priority for snakes closer to food
    const head = snake.positions[0];
    const closestFood = gameState.food.reduce((closest, food) => {
      const distance = Math.abs(head.x - food.x) + Math.abs(head.y - food.y);
      return distance < closest.distance ? { food, distance } : closest;
    }, { food: gameState.food[0], distance: Infinity });

    if (closestFood.distance < 5) priority += 2;

    // Higher priority for aggressive AI personalities
    if (snake.aiPersonality?.aggression && snake.aiPersonality.aggression > 0.7) {
      priority += 1;
    }

    // Higher priority for snakes that haven't been calculated recently
    const timeSinceLastCalculation = performance.now() - (snake.lastDirectionChange || 0);
    if (timeSinceLastCalculation > 500) priority += 1;

    return priority;
  }

  /**
   * Get the next calculation to process based on priority and round-robin with load balancing
   */
  private getNextCalculation(): AICalculation | null {
    if (this.aiQueue.size === 0) return null;

    // Convert to array and sort by priority and age
    const calculations = Array.from(this.aiQueue.values())
      .sort((a, b) => {
        // Primary sort by priority
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        // Secondary sort by age (older calculations first)
        return a.scheduledTime - b.scheduledTime;
      });

    // Group by priority levels
    const priorityGroups = new Map<number, AICalculation[]>();
    calculations.forEach(calc => {
      if (!priorityGroups.has(calc.priority)) {
        priorityGroups.set(calc.priority, []);
      }
      priorityGroups.get(calc.priority)!.push(calc);
    });

    // Select from highest priority group using round-robin
    let highestPriority = -Infinity;
    priorityGroups.forEach((_, p) => {
      if (p > highestPriority) highestPriority = p;
    });
    const highPriorityCalculations = priorityGroups.get(highestPriority)!;
    
    // Use round-robin within same priority level
    const selectedIndex = this.currentIndex % highPriorityCalculations.length;
    this.currentIndex++;

    return highPriorityCalculations[selectedIndex];
  }

  /**
   * Remove oldest/lowest priority calculations when queue is full
   */
  private pruneQueue(): void {
    const calculations = Array.from(this.aiQueue.values())
      .sort((a, b) => a.priority - b.priority || a.scheduledTime - b.scheduledTime);

    // Remove the oldest, lowest priority calculation
    if (calculations.length > 0) {
      this.aiQueue.delete(calculations[0].snakeId);
    }
  }

  /**
   * Optimized AI direction calculation using cached pathfinding
   */
  private calculateAIDirectionOptimized(snake: Snake, gameState: AIGameState): Direction {
    if (!snake.aiPersonality) return snake.direction;

    // Convert to pathfinding context
    const context: PathfindingContext = {
      snakes: gameState.snakes,
      food: gameState.food,
      boardWidth: gameState.boardWidth,
      boardHeight: gameState.boardHeight,
      currentTick: this.tickCounter
    };

    // Use optimized pathfinding with caching
    return this.optimizedPathfinding.calculateDirection(snake, snake.aiPersonality, context);
  }

  /**
   * Get next position based on current position and direction
   */
  private getNextPosition(pos: Position, direction: Direction): Position {
    const newPos = { ...pos };
    switch (direction) {
      case 'UP': newPos.y -= 1; break;
      case 'DOWN': newPos.y += 1; break;
      case 'LEFT': newPos.x -= 1; break;
      case 'RIGHT': newPos.x += 1; break;
    }
    return newPos;
  }

  /**
   * Check if a position is safe (no collision)
   */
  private isPositionSafe(pos: Position, gameState: AIGameState, excludeSnakeId: string): boolean {
    // Check bounds
    if (pos.x < 0 || pos.x >= gameState.boardWidth || pos.y < 0 || pos.y >= gameState.boardHeight) {
      return false;
    }

    // Check collision with other snakes
    for (const snake of gameState.snakes) {
      if (!snake.isAlive || snake.id === excludeSnakeId) continue;
      
      for (const segment of snake.positions) {
        if (segment.x === pos.x && segment.y === pos.y) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get all safe directions from current position
   */
  private getSafeDirections(head: Position, currentDirection: Direction, gameState: AIGameState, snakeId: string): Direction[] {
    const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const oppositeDirection = this.getOppositeDirection(currentDirection);
    
    return directions
      .filter(dir => dir !== oppositeDirection) // Can't go backwards
      .filter(dir => {
        const nextPos = this.getNextPosition(head, dir);
        return this.isPositionSafe(nextPos, gameState, snakeId);
      });
  }

  /**
   * Get opposite direction
   */
  private getOppositeDirection(direction: Direction): Direction {
    const opposites = {
      'UP': 'DOWN' as Direction,
      'DOWN': 'UP' as Direction,
      'LEFT': 'RIGHT' as Direction,
      'RIGHT': 'LEFT' as Direction
    };
    return opposites[direction];
  }

  /**
   * Find closest food to given position
   */
  private findClosestFood(pos: Position, food: Position[]): Position | null {
    if (food.length === 0) return null;

    return food.reduce((closest, current) => {
      const currentDistance = Math.abs(pos.x - current.x) + Math.abs(pos.y - current.y);
      const closestDistance = Math.abs(pos.x - closest.x) + Math.abs(pos.y - closest.y);
      return currentDistance < closestDistance ? current : closest;
    });
  }

  /**
   * Adaptively adjust frame budget based on calculation performance
   */
  private adjustFrameBudget(calculationTime: number): void {
    const avgCalculationTime = this.performanceMetrics.totalCalculations > 0 
      ? this.performanceMetrics.totalTime / this.performanceMetrics.totalCalculations 
      : calculationTime;

    // Estimate how many calculations we can fit in frame budget
    const estimatedCalculationsPerFrame = Math.floor(
      (this.frameLoadTracker.maxFrameTime * 0.6) / Math.max(avgCalculationTime, 1)
    );

    // Adjust max calculations per frame with bounds
    const newMax = Math.max(1, Math.min(4, estimatedCalculationsPerFrame));
    
    if (newMax !== this.frameLoadTracker.maxCalculationsPerFrame) {
      this.frameLoadTracker.maxCalculationsPerFrame = newMax;
      this.performanceMetrics.adaptiveAdjustments++;
    }

    // If we're consistently overrunning, reduce frame budget
    if (this.performanceMetrics.frameOverruns > 10) {
      this.frameLoadTracker.maxCalculationsPerFrame = Math.max(1, 
        this.frameLoadTracker.maxCalculationsPerFrame - 1
      );
      this.performanceMetrics.frameOverruns = 0; // Reset counter
      this.performanceMetrics.adaptiveAdjustments++;
    }
  }

  /**
   * Get frame load statistics
   */
  public getFrameLoadStats() {
    return {
      maxCalculationsPerFrame: this.frameLoadTracker.maxCalculationsPerFrame,
      calculationsThisFrame: this.frameLoadTracker.calculationsThisFrame,
      maxFrameTime: this.frameLoadTracker.maxFrameTime,
      frameOverruns: this.performanceMetrics.frameOverruns,
      adaptiveAdjustments: this.performanceMetrics.adaptiveAdjustments
    };
  }

  /**
   * Check if AI processing is distributed effectively
   */
  public isDistributionEffective(): boolean {
    const metrics = this.getPerformanceMetrics();
    const frameStats = this.getFrameLoadStats();
    
    // Good distribution if:
    // 1. Low frame overruns
    // 2. Reasonable average calculation time
    // 3. Queue is being processed regularly
    return (
      frameStats.frameOverruns < 5 &&
      metrics.averageCalculationTime < this.config.maxCalculationTime &&
      metrics.queueSize < this.config.maxQueueSize * 0.8
    );
  }
}

// Default configuration
export const DEFAULT_AI_CONFIG: ThrottledAIConfig = {
  throttleInterval: 2, // Process AI every 2 ticks
  maxCalculationTime: 5, // 5ms max per calculation
  fallbackDirection: 'RIGHT',
  maxQueueSize: 10
};