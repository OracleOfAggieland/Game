// src/utils/SpatialGrid.ts
import { Position } from '../types/GameEnhancements';

export interface SpatialObject {
  id: string;
  position: Position;
  type: 'snake-head' | 'snake-body' | 'food' | 'powerup';
  data?: any; // Additional data for the object
}

export interface GridCell {
  objects: Set<SpatialObject>;
  lastUpdate: number;
}

export class SpatialGrid {
  private grid: Map<string, GridCell> = new Map();
  private cellSize: number;
  private gridWidth: number;
  private gridHeight: number;
  private boardWidth: number;
  private boardHeight: number;

  // Performance tracking
  private stats = {
    totalQueries: 0,
    totalUpdates: 0,
    averageObjectsPerCell: 0,
    maxObjectsPerCell: 0,
    gridUtilization: 0
  };

  constructor(boardWidth: number, boardHeight: number, cellSize: number = 5) {
    this.boardWidth = boardWidth;
    this.boardHeight = boardHeight;
    this.cellSize = cellSize;
    this.gridWidth = Math.ceil(boardWidth / cellSize);
    this.gridHeight = Math.ceil(boardHeight / cellSize);
  }

  /**
   * Add or update an object in the spatial grid
   */
  public updateObject(obj: SpatialObject, oldPosition?: Position): void {
    const currentTime = performance.now();
    
    // Remove from old position if provided
    if (oldPosition) {
      const oldKey = this.getGridKey(oldPosition.x, oldPosition.y);
      const oldCell = this.grid.get(oldKey);
      if (oldCell) {
        oldCell.objects.delete(obj);
        if (oldCell.objects.size === 0) {
          this.grid.delete(oldKey);
        }
      }
    }

    // Add to new position
    const newKey = this.getGridKey(obj.position.x, obj.position.y);
    let cell = this.grid.get(newKey);
    
    if (!cell) {
      cell = {
        objects: new Set(),
        lastUpdate: currentTime
      };
      this.grid.set(newKey, cell);
    }

    cell.objects.add(obj);
    cell.lastUpdate = currentTime;
    
    this.stats.totalUpdates++;
    this.updateStats();
  }

  /**
   * Remove an object from the spatial grid
   */
  public removeObject(obj: SpatialObject): void {
    const key = this.getGridKey(obj.position.x, obj.position.y);
    const cell = this.grid.get(key);
    
    if (cell) {
      cell.objects.delete(obj);
      if (cell.objects.size === 0) {
        this.grid.delete(key);
      }
    }
  }

  /**
   * Get all objects within a radius of a position
   */
  public getNeighbors(position: Position, radius: number = 1): SpatialObject[] {
    this.stats.totalQueries++;
    
    const neighbors: SpatialObject[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    
    const centerGridX = Math.floor(position.x / this.cellSize);
    const centerGridY = Math.floor(position.y / this.cellSize);

    // Check all cells within the radius
    for (let gx = centerGridX - cellRadius; gx <= centerGridX + cellRadius; gx++) {
      for (let gy = centerGridY - cellRadius; gy <= centerGridY + cellRadius; gy++) {
        if (gx < 0 || gx >= this.gridWidth || gy < 0 || gy >= this.gridHeight) {
          continue;
        }

        const key = `${gx},${gy}`;
        const cell = this.grid.get(key);
        
        if (cell) {
          cell.objects.forEach(obj => {
            const distance = this.getDistance(position, obj.position);
            if (distance <= radius) {
              neighbors.push(obj);
            }
          });
        }
      }
    }

    return neighbors;
  }

  /**
   * Get objects at a specific position
   */
  public getObjectsAt(position: Position): SpatialObject[] {
    const key = this.getGridKey(position.x, position.y);
    const cell = this.grid.get(key);
    
    if (!cell) return [];
    
    return Array.from(cell.objects).filter(obj => 
      obj.position.x === position.x && obj.position.y === position.y
    );
  }

  /**
   * Check if a position is occupied by any object
   */
  public isPositionOccupied(position: Position, excludeTypes?: string[]): boolean {
    const objects = this.getObjectsAt(position);
    
    if (excludeTypes) {
      return objects.some(obj => !excludeTypes.includes(obj.type));
    }
    
    return objects.length > 0;
  }

  /**
   * Get all objects of a specific type within a radius
   */
  public getObjectsByType(position: Position, type: string, radius: number = 1): SpatialObject[] {
    return this.getNeighbors(position, radius).filter(obj => obj.type === type);
  }

  /**
   * Clear all objects from the grid
   */
  public clear(): void {
    this.grid.clear();
    this.resetStats();
  }

  /**
   * Get collision candidates for an object (optimized collision detection)
   */
  public getCollisionCandidates(obj: SpatialObject, radius: number = 1): SpatialObject[] {
    return this.getNeighbors(obj.position, radius).filter(candidate => 
      candidate.id !== obj.id
    );
  }

  /**
   * Bulk update multiple objects efficiently
   */
  public bulkUpdate(objects: SpatialObject[], oldPositions?: Map<string, Position>): void {
    const currentTime = performance.now();
    
    // Clear old positions if provided
    if (oldPositions) {
      oldPositions.forEach((oldPos, objId) => {
        const oldKey = this.getGridKey(oldPos.x, oldPos.y);
        const oldCell = this.grid.get(oldKey);
        if (oldCell) {
          oldCell.objects.forEach(obj => {
            if (obj.id === objId) {
              oldCell.objects.delete(obj);
            }
          });
          if (oldCell.objects.size === 0) {
            this.grid.delete(oldKey);
          }
        }
      });
    }

    // Add objects to new positions
    objects.forEach(obj => {
      const key = this.getGridKey(obj.position.x, obj.position.y);
      let cell = this.grid.get(key);
      
      if (!cell) {
        cell = {
          objects: new Set(),
          lastUpdate: currentTime
        };
        this.grid.set(key, cell);
      }

      cell.objects.add(obj);
      cell.lastUpdate = currentTime;
    });

    this.stats.totalUpdates += objects.length;
    this.updateStats();
  }

  /**
   * Get performance statistics
   */
  public getStats() {
    return {
      ...this.stats,
      totalCells: this.grid.size,
      maxPossibleCells: this.gridWidth * this.gridHeight,
      cellSize: this.cellSize,
      gridDimensions: {
        width: this.gridWidth,
        height: this.gridHeight
      }
    };
  }

  /**
   * Optimize grid by removing empty cells and defragmenting
   */
  public optimize(): void {
    const currentTime = performance.now();
    const maxAge = 1000; // Remove cells not updated in 1 second

    // Remove stale empty cells
    this.grid.forEach((cell, key) => {
      if (cell.objects.size === 0 || currentTime - cell.lastUpdate > maxAge) {
        this.grid.delete(key);
      }
    });

    this.updateStats();
  }

  // Private helper methods

  private getGridKey(x: number, y: number): string {
    const gridX = Math.floor(x / this.cellSize);
    const gridY = Math.floor(y / this.cellSize);
    return `${gridX},${gridY}`;
  }

  private getDistance(pos1: Position, pos2: Position): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private updateStats(): void {
    if (this.grid.size === 0) {
      this.stats.averageObjectsPerCell = 0;
      this.stats.maxObjectsPerCell = 0;
      this.stats.gridUtilization = 0;
      return;
    }

    let totalObjects = 0;
    let maxObjects = 0;

    this.grid.forEach(cell => {
      const objectCount = cell.objects.size;
      totalObjects += objectCount;
      maxObjects = Math.max(maxObjects, objectCount);
    });

    this.stats.averageObjectsPerCell = totalObjects / this.grid.size;
    this.stats.maxObjectsPerCell = maxObjects;
    this.stats.gridUtilization = this.grid.size / (this.gridWidth * this.gridHeight);
  }

  private resetStats(): void {
    this.stats = {
      totalQueries: 0,
      totalUpdates: 0,
      averageObjectsPerCell: 0,
      maxObjectsPerCell: 0,
      gridUtilization: 0
    };
  }

  /**
   * Debug method to visualize grid state
   */
  public getDebugInfo(): any {
    const debugInfo: any = {};
    
    this.grid.forEach((cell, key) => {
      debugInfo[key] = {
        objectCount: cell.objects.size,
        objects: Array.from(cell.objects).map(obj => ({
          id: obj.id,
          type: obj.type,
          position: obj.position
        })),
        lastUpdate: cell.lastUpdate
      };
    });

    return debugInfo;
  }
}