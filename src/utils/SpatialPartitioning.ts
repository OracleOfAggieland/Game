// src/utils/SpatialPartitioning.ts

export interface Position {
  x: number;
  y: number;
}

export interface GameObject {
  id: string;
  position: Position;
  radius?: number;
  type?: string;
}

/**
 * Spatial partitioning grid for efficient collision detection
 * Divides the game world into cells to quickly find nearby objects
 */
export class SpatialPartitioning {
  private grid: Map<string, Set<GameObject>> = new Map();
  private cellSize: number;
  private worldWidth: number;
  private worldHeight: number;
  private cols: number;
  private rows: number;

  constructor(worldWidth: number, worldHeight: number, cellSize: number = 50) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldWidth / cellSize);
    this.rows = Math.ceil(worldHeight / cellSize);
  }

  /**
   * Get the grid cell key for a position
   */
  private getCellKey(x: number, y: number): string {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    return `${col},${row}`;
  }

  /**
   * Get all cell keys that a circle with given position and radius overlaps
   */
  private getCellKeysForRadius(x: number, y: number, radius: number): string[] {
    const keys: string[] = [];
    const minCol = Math.max(0, Math.floor((x - radius) / this.cellSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((x + radius) / this.cellSize));
    const minRow = Math.max(0, Math.floor((y - radius) / this.cellSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((y + radius) / this.cellSize));

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        keys.push(`${col},${row}`);
      }
    }

    return keys;
  }

  /**
   * Add an object to the spatial grid
   */
  public addObject(obj: GameObject): void {
    const radius = obj.radius || 0;
    const cellKeys = this.getCellKeysForRadius(obj.position.x, obj.position.y, radius);

    for (const key of cellKeys) {
      if (!this.grid.has(key)) {
        this.grid.set(key, new Set());
      }
      this.grid.get(key)!.add(obj);
    }
  }

  /**
   * Remove an object from the spatial grid
   */
  public removeObject(obj: GameObject): void {
    const radius = obj.radius || 0;
    const cellKeys = this.getCellKeysForRadius(obj.position.x, obj.position.y, radius);

    for (const key of cellKeys) {
      const cell = this.grid.get(key);
      if (cell) {
        cell.delete(obj);
        if (cell.size === 0) {
          this.grid.delete(key);
        }
      }
    }
  }

  /**
   * Update an object's position in the grid
   */
  public updateObject(obj: GameObject, oldPosition: Position): void {
    // Remove from old position
    const oldRadius = obj.radius || 0;
    const oldCellKeys = this.getCellKeysForRadius(oldPosition.x, oldPosition.y, oldRadius);
    
    for (const key of oldCellKeys) {
      const cell = this.grid.get(key);
      if (cell) {
        cell.delete(obj);
        if (cell.size === 0) {
          this.grid.delete(key);
        }
      }
    }

    // Add to new position
    this.addObject(obj);
  }

  /**
   * Get all objects within a certain radius of a position
   */
  public getObjectsInRadius(x: number, y: number, radius: number): GameObject[] {
    const cellKeys = this.getCellKeysForRadius(x, y, radius);
    const candidates = new Set<GameObject>();

    for (const key of cellKeys) {
      const cell = this.grid.get(key);
      if (cell) {
        cell.forEach(obj => candidates.add(obj));
      }
    }

    // Filter candidates by actual distance
    const results: GameObject[] = [];
    const radiusSquared = radius * radius;

    candidates.forEach(obj => {
      const dx = obj.position.x - x;
      const dy = obj.position.y - y;
      const distanceSquared = dx * dx + dy * dy;
      
      if (distanceSquared <= radiusSquared) {
        results.push(obj);
      }
    });

    return results;
  }

  /**
   * Get all objects in the same cell as the given position
   */
  public getObjectsInCell(x: number, y: number): GameObject[] {
    const key = this.getCellKey(x, y);
    const cell = this.grid.get(key);
    return cell ? Array.from(cell) : [];
  }

  /**
   * Get potential collision candidates for an object
   */
  public getCollisionCandidates(obj: GameObject, checkRadius: number = 0): GameObject[] {
    const radius = Math.max(obj.radius || 0, checkRadius);
    return this.getObjectsInRadius(obj.position.x, obj.position.y, radius)
      .filter(candidate => candidate.id !== obj.id);
  }

  /**
   * Clear the entire grid
   */
  public clear(): void {
    this.grid.clear();
  }

  /**
   * Get grid statistics for debugging
   */
  public getStats(): {
    totalCells: number;
    occupiedCells: number;
    totalObjects: number;
    averageObjectsPerCell: number;
  } {
    const occupiedCells = this.grid.size;
    let totalObjects = 0;

    this.grid.forEach(cell => {
      totalObjects += cell.size;
    });

    return {
      totalCells: this.cols * this.rows,
      occupiedCells,
      totalObjects,
      averageObjectsPerCell: occupiedCells > 0 ? totalObjects / occupiedCells : 0
    };
  }

  /**
   * Resize the grid (useful for dynamic world sizes)
   */
  public resize(newWidth: number, newHeight: number, newCellSize?: number): void {
    // Store all current objects
    const allObjects: GameObject[] = [];
    this.grid.forEach(cell => {
      cell.forEach(obj => allObjects.push(obj));
    });

    // Clear and reconfigure
    this.clear();
    this.worldWidth = newWidth;
    this.worldHeight = newHeight;
    if (newCellSize) {
      this.cellSize = newCellSize;
    }
    this.cols = Math.ceil(this.worldWidth / this.cellSize);
    this.rows = Math.ceil(this.worldHeight / this.cellSize);

    // Re-add all objects
    const uniqueObjects = new Set(allObjects);
    uniqueObjects.forEach(obj => this.addObject(obj));
  }

  /**
   * Check if two objects are potentially colliding (broad phase)
   */
  public static checkBroadPhaseCollision(obj1: GameObject, obj2: GameObject): boolean {
    const dx = obj1.position.x - obj2.position.x;
    const dy = obj1.position.y - obj2.position.y;
    const minDistance = (obj1.radius || 0) + (obj2.radius || 0);
    const distanceSquared = dx * dx + dy * dy;
    
    return distanceSquared <= minDistance * minDistance;
  }

  /**
   * Perform broad phase collision detection for all objects
   */
  public broadPhaseCollisionDetection(): Array<[GameObject, GameObject]> {
    const collisionPairs: Array<[GameObject, GameObject]> = [];
    const checkedPairs = new Set<string>();

    this.grid.forEach(cell => {
      const objects = Array.from(cell);
      
      for (let i = 0; i < objects.length; i++) {
        for (let j = i + 1; j < objects.length; j++) {
          const obj1 = objects[i];
          const obj2 = objects[j];
          const pairKey = obj1.id < obj2.id ? `${obj1.id}-${obj2.id}` : `${obj2.id}-${obj1.id}`;
          
          if (!checkedPairs.has(pairKey)) {
            checkedPairs.add(pairKey);
            
            if (SpatialPartitioning.checkBroadPhaseCollision(obj1, obj2)) {
              collisionPairs.push([obj1, obj2]);
            }
          }
        }
      }
    });

    return collisionPairs;
  }
}