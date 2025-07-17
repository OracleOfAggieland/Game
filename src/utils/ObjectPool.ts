// src/utils/ObjectPool.ts

/**
 * Generic object pool for performance optimization
 * Reduces garbage collection by reusing objects
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  private maxSize: number;
  private currentSize: number = 0;

  constructor(
    createFn: () => T,
    resetFn: (obj: T) => void,
    initialSize: number = 10,
    maxSize: number = 100
  ) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;

    // Pre-populate the pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
      this.currentSize++;
    }
  }

  /**
   * Get an object from the pool
   */
  public get(): T {
    if (this.pool.length > 0) {
      const obj = this.pool.pop()!;
      this.resetFn(obj);
      return obj;
    }

    // Pool is empty, create new object
    return this.createFn();
  }

  /**
   * Return an object to the pool
   */
  public release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
    // If pool is full, let the object be garbage collected
  }

  /**
   * Get current pool size
   */
  public getPoolSize(): number {
    return this.pool.length;
  }

  /**
   * Get maximum pool size
   */
  public getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * Clear the entire pool
   */
  public clear(): void {
    this.pool.length = 0;
    this.currentSize = 0;
  }

  /**
   * Resize the pool (useful for dynamic optimization)
   */
  public resize(newMaxSize: number): void {
    this.maxSize = newMaxSize;
    
    // If new size is smaller, trim the pool
    if (this.pool.length > newMaxSize) {
      this.pool.length = newMaxSize;
    }
  }
}

/**
 * Specialized object pool for game cells
 */
export interface GameCell {
  id: string;
  x: number;
  y: number;
  type: 'empty' | 'snake-head' | 'snake-body' | 'food' | 'powerup';
  color?: string;
  isActive: boolean;
}

export class GameCellPool extends ObjectPool<GameCell> {
  constructor(initialSize: number = 50, maxSize: number = 500) {
    super(
      () => ({
        id: '',
        x: 0,
        y: 0,
        type: 'empty',
        color: undefined,
        isActive: false
      }),
      (cell) => {
        cell.id = '';
        cell.x = 0;
        cell.y = 0;
        cell.type = 'empty';
        cell.color = undefined;
        cell.isActive = false;
      },
      initialSize,
      maxSize
    );
  }
}

/**
 * Specialized object pool for particles
 */
export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'explosion' | 'sparkle' | 'trail' | 'score';
}

export class ParticlePool extends ObjectPool<Particle> {
  constructor(initialSize: number = 100, maxSize: number = 1000) {
    super(
      () => ({
        id: '',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 1,
        maxLife: 1,
        color: '#ffffff',
        size: 1,
        type: 'sparkle'
      }),
      (particle) => {
        particle.id = '';
        particle.x = 0;
        particle.y = 0;
        particle.vx = 0;
        particle.vy = 0;
        particle.life = 1;
        particle.maxLife = 1;
        particle.color = '#ffffff';
        particle.size = 1;
        particle.type = 'sparkle';
      },
      initialSize,
      maxSize
    );
  }
}

/**
 * Pool manager to handle multiple object pools
 */
export class PoolManager {
  private pools = new Map<string, ObjectPool<any>>();

  /**
   * Register a new pool
   */
  public registerPool<T>(name: string, pool: ObjectPool<T>): void {
    this.pools.set(name, pool);
  }

  /**
   * Get an object from a specific pool
   */
  public get<T>(poolName: string): T | null {
    const pool = this.pools.get(poolName);
    return pool ? pool.get() : null;
  }

  /**
   * Return an object to a specific pool
   */
  public release<T>(poolName: string, obj: T): void {
    const pool = this.pools.get(poolName);
    if (pool) {
      pool.release(obj);
    }
  }

  /**
   * Get pool statistics
   */
  public getPoolStats(poolName: string): { size: number; maxSize: number } | null {
    const pool = this.pools.get(poolName);
    return pool ? { size: pool.getPoolSize(), maxSize: pool.getMaxSize() } : null;
  }

  /**
   * Clear all pools
   */
  public clearAll(): void {
    this.pools.forEach(pool => pool.clear());
  }

  /**
   * Get all pool names
   */
  public getPoolNames(): string[] {
    return Array.from(this.pools.keys());
  }
}

// Global pool manager instance
export const globalPoolManager = new PoolManager();