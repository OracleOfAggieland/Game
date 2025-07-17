// src/utils/OptimizedAIPathfinding.ts
import { Position, Direction, AIPersonality } from '../types/GameEnhancements';
import { StateCache, CacheableSnake } from './StateCache';

export interface PathfindingConfig {
  maxSearchDepth: number;
  safetyMargin: number;
  foodSearchRadius: number;
  dangerAvoidanceWeight: number;
  foodAttractionWeight: number;
}

export interface PathfindingContext {
  snakes: CacheableSnake[];
  food: Position[];
  boardWidth: number;
  boardHeight: number;
  currentTick: number;
}

export class OptimizedAIPathfinding {
  private stateCache: StateCache;
  private config: PathfindingConfig;
  private directionCache: Map<string, { direction: Direction; timestamp: number }> = new Map();
  private cacheTTL: number = 200; // 200ms cache for direction decisions

  constructor(config: PathfindingConfig = {
    maxSearchDepth: 3,
    safetyMargin: 2,
    foodSearchRadius: 8,
    dangerAvoidanceWeight: 2.0,
    foodAttractionWeight: 1.0
  }) {
    this.stateCache = new StateCache();
    this.config = config;
  }

  /**
   * Calculate optimal direction for AI snake with caching
   */
  public calculateDirection(
    snake: CacheableSnake,
    personality: AIPersonality,
    context: PathfindingContext
  ): Direction {
    // Check direction cache first
    const cacheKey = this.getDirectionCacheKey(snake, context);
    const cached = this.directionCache.get(cacheKey);
    const now = performance.now();

    if (cached && now - cached.timestamp < this.cacheTTL) {
      return cached.direction;
    }

    // Calculate new direction
    const direction = this.calculateDirectionInternal(snake, personality, context);

    // Cache the result
    this.directionCache.set(cacheKey, {
      direction,
      timestamp: now
    });

    // Clean old cache entries
    this.cleanDirectionCache(now);

    return direction;
  }

  /**
   * Internal direction calculation with optimizations
   */
  private calculateDirectionInternal(
    snake: CacheableSnake,
    personality: AIPersonality,
    context: PathfindingContext
  ): Direction {
    if (!snake.isAlive || snake.positions.length === 0) {
      return 'RIGHT'; // Fallback
    }

    const head = snake.positions[0];
    const currentDirection = this.getCurrentDirection(snake);

    // Get safe directions using cached collision data
    const safeDirections = this.getSafeDirections(head, currentDirection, context);

    if (safeDirections.length === 0) {
      return currentDirection; // No safe moves, continue current direction
    }

    if (safeDirections.length === 1) {
      return safeDirections[0]; // Only one safe option
    }

    // Find best direction based on multiple factors
    return this.selectBestDirection(head, safeDirections, personality, context);
  }

  /**
   * Get safe directions using cached collision detection
   */
  private getSafeDirections(
    head: Position,
    currentDirection: Direction,
    context: PathfindingContext
  ): Direction[] {
    const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const oppositeDirection = this.getOppositeDirection(currentDirection);
    
    return directions
      .filter(dir => dir !== oppositeDirection) // Can't reverse
      .filter(dir => this.isDirectionSafe(head, dir, context));
  }

  /**
   * Check if a direction is safe using cached data
   */
  private isDirectionSafe(
    head: Position,
    direction: Direction,
    context: PathfindingContext
  ): boolean {
    const nextPos = this.getNextPosition(head, direction);

    // Check bounds
    if (!this.isWithinBounds(nextPos, context.boardWidth, context.boardHeight)) {
      return false;
    }

    // Check collision using cached occupied positions
    if (this.stateCache.isPositionOccupied(nextPos, context.snakes, context.currentTick)) {
      return false;
    }

    // Additional safety check - look ahead one more step for intelligent AIs
    if (this.config.maxSearchDepth > 1) {
      const safetyMargin = this.config.safetyMargin;
      const neighbors = this.stateCache.getOccupiedNeighbors(
        nextPos, 
        context.snakes, 
        context.currentTick, 
        safetyMargin
      );

      // If too many occupied neighbors, consider unsafe
      if (neighbors.length > safetyMargin) {
        return false;
      }
    }

    return true;
  }

  /**
   * Select best direction from safe options
   */
  private selectBestDirection(
    head: Position,
    safeDirections: Direction[],
    personality: AIPersonality,
    context: PathfindingContext
  ): Direction {
    let bestDirection = safeDirections[0];
    let bestScore = -Infinity;

    // Find closest food within search radius
    const targetFood = this.findOptimalFood(head, context.food, personality);

    for (const direction of safeDirections) {
      const nextPos = this.getNextPosition(head, direction);
      let score = 0;

      // Food attraction score
      if (targetFood) {
        const foodDistance = this.getManhattanDistance(nextPos, targetFood);
        score += (this.config.foodSearchRadius - foodDistance) * 
                 this.config.foodAttractionWeight * 
                 personality.aggression;
      }

      // Safety score - avoid dangerous areas
      const dangerScore = this.calculateDangerScore(nextPos, context);
      score -= dangerScore * this.config.dangerAvoidanceWeight * personality.intelligence;

      // Stability bonus - prefer continuing in same direction
      const currentDirection = this.getCurrentDirection(context.snakes.find(s => s.id === head.toString()) || context.snakes[0]);
      if (direction === currentDirection) {
        score += 2 * personality.patience;
      }

      // Edge avoidance for intelligent AIs
      if (personality.intelligence > 0.6) {
        const edgeDistance = this.getDistanceToEdge(nextPos, context.boardWidth, context.boardHeight);
        if (edgeDistance < 3) {
          score -= (3 - edgeDistance) * personality.intelligence;
        }
      }

      // Add controlled randomness
      score += Math.random() * (1 - personality.intelligence) * 0.5;

      if (score > bestScore) {
        bestScore = score;
        bestDirection = direction;
      }
    }

    return bestDirection;
  }

  /**
   * Find optimal food target based on distance and safety
   */
  private findOptimalFood(head: Position, food: Position[], personality: AIPersonality): Position | null {
    if (food.length === 0) return null;

    // Filter food within search radius
    const nearbyFood = food.filter(f => 
      this.getManhattanDistance(head, f) <= this.config.foodSearchRadius
    );

    if (nearbyFood.length === 0) {
      // If no nearby food, target closest food
      return food.reduce((closest, current) => {
        const currentDist = this.getManhattanDistance(head, current);
        const closestDist = this.getManhattanDistance(head, closest);
        return currentDist < closestDist ? current : closest;
      });
    }

    // Score food based on distance and safety
    let bestFood = nearbyFood[0];
    let bestScore = -Infinity;

    for (const foodItem of nearbyFood) {
      const distance = this.getManhattanDistance(head, foodItem);
      let score = this.config.foodSearchRadius - distance; // Closer is better

      // Aggressive AIs prefer closer food more strongly
      score *= (1 + personality.aggression);

      // Intelligent AIs consider safety around food
      if (personality.intelligence > 0.5) {
        // This would require more complex pathfinding, simplified for performance
        const pathClearance = this.estimatePathClearance(head, foodItem);
        score += pathClearance * personality.intelligence;
      }

      if (score > bestScore) {
        bestScore = score;
        bestFood = foodItem;
      }
    }

    return bestFood;
  }

  /**
   * Calculate danger score for a position
   */
  private calculateDangerScore(position: Position, context: PathfindingContext): number {
    let dangerScore = 0;

    // Check proximity to other snakes
    const occupiedNeighbors = this.stateCache.getOccupiedNeighbors(
      position, 
      context.snakes, 
      context.currentTick, 
      2
    );

    dangerScore += occupiedNeighbors.length;

    // Check proximity to walls
    const edgeDistance = this.getDistanceToEdge(position, context.boardWidth, context.boardHeight);
    if (edgeDistance < 2) {
      dangerScore += (2 - edgeDistance) * 2;
    }

    return dangerScore;
  }

  /**
   * Estimate path clearance to target (simplified)
   */
  private estimatePathClearance(from: Position, to: Position): number {
    // Simplified clearance estimation
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const pathLength = dx + dy;

    // Longer paths are generally less clear
    return Math.max(0, 10 - pathLength);
  }

  /**
   * Utility functions
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

  private getOppositeDirection(direction: Direction): Direction {
    const opposites = {
      'UP': 'DOWN' as Direction,
      'DOWN': 'UP' as Direction,
      'LEFT': 'RIGHT' as Direction,
      'RIGHT': 'LEFT' as Direction
    };
    return opposites[direction];
  }

  private getCurrentDirection(snake: CacheableSnake): Direction {
    // Simplified - in real implementation, this would track direction
    return 'RIGHT';
  }

  private isWithinBounds(pos: Position, width: number, height: number): boolean {
    return pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height;
  }

  private getManhattanDistance(pos1: Position, pos2: Position): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  private getDistanceToEdge(pos: Position, width: number, height: number): number {
    return Math.min(pos.x, width - 1 - pos.x, pos.y, height - 1 - pos.y);
  }

  private getDirectionCacheKey(snake: CacheableSnake, context: PathfindingContext): string {
    const head = snake.positions[0];
    const nearbyFood = context.food
      .filter(f => this.getManhattanDistance(head, f) <= 3)
      .map(f => `${f.x},${f.y}`)
      .sort()
      .join('|');
    
    return `${snake.id}-${head.x},${head.y}-${nearbyFood}`;
  }

  private cleanDirectionCache(currentTime: number): void {
    for (const [key, cached] of this.directionCache) {
      if (currentTime - cached.timestamp > this.cacheTTL * 2) {
        this.directionCache.delete(key);
      }
    }
  }

  /**
   * Clear all caches
   */
  public clearCaches(): void {
    this.stateCache.clear();
    this.directionCache.clear();
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats() {
    return {
      stateCache: this.stateCache.getCacheStats(),
      directionCacheSize: this.directionCache.size,
      config: this.config
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<PathfindingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}