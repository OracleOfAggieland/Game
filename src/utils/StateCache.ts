// src/utils/StateCache.ts
import { Position } from '../types/GameEnhancements';

export interface CacheableSnake {
  id: string;
  positions: Position[];
  isAlive: boolean;
}

export interface CachedGameState {
  occupiedPositions: Set<string>;
  snakeHeads: Map<string, Position>;
  snakeBodies: Map<string, Position[]>;
  lastUpdateTick: number;
  lastUpdateTime: number;
}

export class StateCache {
  private cachedState: CachedGameState | null = null;
  private lastSnakeStates: Map<string, string> = new Map(); // Snake ID -> position hash
  private isDirty: boolean = true;
  private maxCacheAge: number = 100; // Max 100ms cache age

  /**
   * Get cached occupied positions, rebuilding if necessary
   */
  public getOccupiedPositions(snakes: CacheableSnake[], currentTick: number): Set<string> {
    if (this.shouldRebuildCache(snakes, currentTick)) {
      this.rebuildCache(snakes, currentTick);
    }
    
    return this.cachedState?.occupiedPositions || new Set();
  }

  /**
   * Get cached snake heads
   */
  public getSnakeHeads(snakes: CacheableSnake[], currentTick: number): Map<string, Position> {
    if (this.shouldRebuildCache(snakes, currentTick)) {
      this.rebuildCache(snakes, currentTick);
    }
    
    return this.cachedState?.snakeHeads || new Map();
  }

  /**
   * Get cached snake bodies
   */
  public getSnakeBodies(snakes: CacheableSnake[], currentTick: number): Map<string, Position[]> {
    if (this.shouldRebuildCache(snakes, currentTick)) {
      this.rebuildCache(snakes, currentTick);
    }
    
    return this.cachedState?.snakeBodies || new Map();
  }

  /**
   * Invalidate the cache manually
   */
  public invalidate(): void {
    this.isDirty = true;
    this.lastSnakeStates.clear();
  }

  /**
   * Clear all cached data
   */
  public clear(): void {
    this.cachedState = null;
    this.lastSnakeStates.clear();
    this.isDirty = true;
  }

  /**
   * Get cache statistics
   */
  public getCacheStats() {
    return {
      isCached: this.cachedState !== null,
      cacheAge: this.cachedState ? performance.now() - this.cachedState.lastUpdateTime : 0,
      cachedSnakeCount: this.lastSnakeStates.size,
      occupiedPositionsCount: this.cachedState?.occupiedPositions.size || 0,
      isDirty: this.isDirty
    };
  }

  /**
   * Check if cache should be rebuilt
   */
  private shouldRebuildCache(snakes: CacheableSnake[], currentTick: number): boolean {
    // Always rebuild if dirty
    if (this.isDirty) return true;

    // Rebuild if no cached state
    if (!this.cachedState) return true;

    // Rebuild if cache is too old
    const cacheAge = performance.now() - this.cachedState.lastUpdateTime;
    if (cacheAge > this.maxCacheAge) return true;

    // Rebuild if tick has changed significantly
    if (Math.abs(currentTick - this.cachedState.lastUpdateTick) > 1) return true;

    // Check if any snake state has changed
    for (const snake of snakes) {
      const currentHash = this.getSnakeStateHash(snake);
      const lastHash = this.lastSnakeStates.get(snake.id);
      
      if (currentHash !== lastHash) {
        return true;
      }
    }

    // Check if snake count changed
    if (snakes.length !== this.lastSnakeStates.size) return true;

    return false;
  }

  /**
   * Rebuild the cache with current snake states
   */
  private rebuildCache(snakes: CacheableSnake[], currentTick: number): void {
    const occupiedPositions = new Set<string>();
    const snakeHeads = new Map<string, Position>();
    const snakeBodies = new Map<string, Position[]>();

    // Process each snake
    for (const snake of snakes) {
      if (!snake.isAlive || snake.positions.length === 0) continue;

      // Cache head position
      const head = snake.positions[0];
      snakeHeads.set(snake.id, head);

      // Cache body positions (excluding head)
      const body = snake.positions.slice(1);
      if (body.length > 0) {
        snakeBodies.set(snake.id, body);
      }

      // Add all positions to occupied set
      for (const pos of snake.positions) {
        occupiedPositions.add(`${pos.x},${pos.y}`);
      }

      // Update snake state hash
      this.lastSnakeStates.set(snake.id, this.getSnakeStateHash(snake));
    }

    // Remove states for snakes that no longer exist
    const currentSnakeIds = new Set(snakes.map(s => s.id));
    const snakeIdsToRemove: string[] = [];
    this.lastSnakeStates.forEach((_, snakeId) => {
      if (!currentSnakeIds.has(snakeId)) {
        snakeIdsToRemove.push(snakeId);
      }
    });
    snakeIdsToRemove.forEach(snakeId => {
      this.lastSnakeStates.delete(snakeId);
    });

    // Update cached state
    this.cachedState = {
      occupiedPositions,
      snakeHeads,
      snakeBodies,
      lastUpdateTick: currentTick,
      lastUpdateTime: performance.now()
    };

    this.isDirty = false;
  }

  /**
   * Generate a hash of snake state for change detection
   */
  private getSnakeStateHash(snake: CacheableSnake): string {
    if (!snake.isAlive || snake.positions.length === 0) {
      return `dead-${snake.id}`;
    }

    // Create hash from positions and alive state
    const positionsStr = snake.positions
      .map(pos => `${pos.x},${pos.y}`)
      .join('|');
    
    return `${snake.id}-${snake.isAlive}-${positionsStr}`;
  }

  /**
   * Check if a position is occupied (optimized lookup)
   */
  public isPositionOccupied(position: Position, snakes: CacheableSnake[], currentTick: number): boolean {
    const occupiedPositions = this.getOccupiedPositions(snakes, currentTick);
    return occupiedPositions.has(`${position.x},${position.y}`);
  }

  /**
   * Get positions around a given position that are occupied
   */
  public getOccupiedNeighbors(position: Position, snakes: CacheableSnake[], currentTick: number, radius: number = 1): Position[] {
    const occupiedPositions = this.getOccupiedPositions(snakes, currentTick);
    const neighbors: Position[] = [];

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx === 0 && dy === 0) continue; // Skip center position
        
        const neighborPos = {
          x: position.x + dx,
          y: position.y + dy
        };

        if (occupiedPositions.has(`${neighborPos.x},${neighborPos.y}`)) {
          neighbors.push(neighborPos);
        }
      }
    }

    return neighbors;
  }

  /**
   * Update cache configuration
   */
  public updateConfig(maxCacheAge: number): void {
    this.maxCacheAge = maxCacheAge;
  }

  /**
   * Force cache update with new data
   */
  public forceUpdate(snakes: CacheableSnake[], currentTick: number): void {
    this.isDirty = true;
    this.rebuildCache(snakes, currentTick);
  }
}