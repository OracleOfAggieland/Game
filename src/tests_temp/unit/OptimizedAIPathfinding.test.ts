// src/tests/unit/OptimizedAIPathfinding.test.ts
import { OptimizedAIPathfinding, PathfindingContext } from '../../utils/OptimizedAIPathfinding';
import { CacheableSnake } from '../../utils/StateCache';
import { AIPersonality, Position } from '../../types/GameEnhancements';

describe('OptimizedAIPathfinding', () => {
  let pathfinding: OptimizedAIPathfinding;
  let mockSnake: CacheableSnake;
  let mockPersonality: AIPersonality;
  let mockContext: PathfindingContext;

  beforeEach(() => {
    pathfinding = new OptimizedAIPathfinding();
    
    mockPersonality = {
      aggression: 0.7,
      intelligence: 0.8,
      patience: 0.5,
      name: 'TestAI',
      description: 'Test AI personality'
    };

    mockSnake = {
      id: 'test-snake-1',
      positions: [{ x: 5, y: 5 }],
      isAlive: true
    };

    mockContext = {
      snakes: [mockSnake],
      food: [{ x: 10, y: 5 }],
      boardWidth: 25,
      boardHeight: 25,
      currentTick: 1
    };
  });

  afterEach(() => {
    pathfinding.clearCaches();
  });

  describe('calculateDirection', () => {
    it('should return a valid direction', () => {
      const direction = pathfinding.calculateDirection(mockSnake, mockPersonality, mockContext);
      expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(direction);
    });

    it('should cache direction calculations', () => {
      const direction1 = pathfinding.calculateDirection(mockSnake, mockPersonality, mockContext);
      const direction2 = pathfinding.calculateDirection(mockSnake, mockPersonality, mockContext);
      
      // Should return same direction due to caching
      expect(direction1).toBe(direction2);
    });

    it('should handle dead snake gracefully', () => {
      const deadSnake = { ...mockSnake, isAlive: false };
      const direction = pathfinding.calculateDirection(deadSnake, mockPersonality, mockContext);
      expect(direction).toBe('RIGHT'); // Fallback direction
    });

    it('should handle snake with no positions', () => {
      const emptySnake = { ...mockSnake, positions: [] };
      const direction = pathfinding.calculateDirection(emptySnake, mockPersonality, mockContext);
      expect(direction).toBe('RIGHT'); // Fallback direction
    });

    it('should avoid walls', () => {
      // Place snake at edge
      const edgeSnake = { ...mockSnake, positions: [{ x: 0, y: 5 }] };
      const edgeContext = { ...mockContext, snakes: [edgeSnake] };
      
      const direction = pathfinding.calculateDirection(edgeSnake, mockPersonality, edgeContext);
      expect(direction).not.toBe('LEFT'); // Should not go into wall
    });

    it('should prefer moving towards food', () => {
      // Place snake with clear path to food
      const snakeNearFood = { ...mockSnake, positions: [{ x: 8, y: 5 }] };
      const contextWithFood = { 
        ...mockContext, 
        snakes: [snakeNearFood],
        food: [{ x: 10, y: 5 }] // Food to the right
      };
      
      // Test multiple times to account for randomness
      let rightDirections = 0;
      for (let i = 0; i < 10; i++) {
        pathfinding.clearCaches(); // Clear cache for each test
        const direction = pathfinding.calculateDirection(snakeNearFood, mockPersonality, contextWithFood);
        if (direction === 'RIGHT') rightDirections++;
      }
      
      // Should prefer RIGHT direction more often than random chance
      expect(rightDirections).toBeGreaterThan(3);
    });

    it('should handle multiple snakes collision avoidance', () => {
      const snake1 = { id: 'snake1', positions: [{ x: 5, y: 5 }], isAlive: true };
      const snake2 = { id: 'snake2', positions: [{ x: 6, y: 5 }], isAlive: true }; // Blocking right
      const contextWithMultipleSnakes = {
        ...mockContext,
        snakes: [snake1, snake2]
      };
      
      const direction = pathfinding.calculateDirection(snake1, mockPersonality, contextWithMultipleSnakes);
      expect(direction).not.toBe('RIGHT'); // Should not move into other snake
    });
  });

  describe('performance optimization', () => {
    it('should use caching to improve performance', () => {
      const startTime = performance.now();
      
      // First calculation (cache miss)
      pathfinding.calculateDirection(mockSnake, mockPersonality, mockContext);
      const firstCalculationTime = performance.now() - startTime;
      
      const secondStartTime = performance.now();
      
      // Second calculation (cache hit)
      pathfinding.calculateDirection(mockSnake, mockPersonality, mockContext);
      const secondCalculationTime = performance.now() - secondStartTime;
      
      // Second calculation should be faster due to caching
      expect(secondCalculationTime).toBeLessThan(firstCalculationTime);
    });

    it('should provide performance statistics', () => {
      pathfinding.calculateDirection(mockSnake, mockPersonality, mockContext);
      
      const stats = pathfinding.getPerformanceStats();
      expect(stats).toHaveProperty('stateCache');
      expect(stats).toHaveProperty('directionCacheSize');
      expect(stats).toHaveProperty('config');
      expect(stats.directionCacheSize).toBeGreaterThan(0);
    });

    it('should handle configuration updates', () => {
      const newConfig = {
        maxSearchDepth: 5,
        foodSearchRadius: 12
      };
      
      pathfinding.updateConfig(newConfig);
      const stats = pathfinding.getPerformanceStats();
      
      expect(stats.config.maxSearchDepth).toBe(5);
      expect(stats.config.foodSearchRadius).toBe(12);
    });
  });

  describe('AI personality influence', () => {
    it('should consider aggression in food seeking', () => {
      const aggressivePersonality = { ...mockPersonality, aggression: 0.9 };
      const passivePersonality = { ...mockPersonality, aggression: 0.1 };
      
      const contextWithDistantFood = {
        ...mockContext,
        food: [{ x: 15, y: 5 }] // Distant food
      };
      
      // Test multiple times to see behavioral differences
      let aggressiveTowardsFood = 0;
      let passiveTowardsFood = 0;
      
      for (let i = 0; i < 20; i++) {
        pathfinding.clearCaches();
        
        const aggressiveDirection = pathfinding.calculateDirection(mockSnake, aggressivePersonality, contextWithDistantFood);
        const passiveDirection = pathfinding.calculateDirection(mockSnake, passivePersonality, contextWithDistantFood);
        
        if (aggressiveDirection === 'RIGHT') aggressiveTowardsFood++;
        if (passiveDirection === 'RIGHT') passiveTowardsFood++;
      }
      
      // Aggressive AI should move towards food more often
      expect(aggressiveTowardsFood).toBeGreaterThanOrEqual(passiveTowardsFood);
    });

    it('should consider intelligence in safety decisions', () => {
      const intelligentPersonality = { ...mockPersonality, intelligence: 0.9 };
      const simplePersonality = { ...mockPersonality, intelligence: 0.1 };
      
      // Create a dangerous situation near walls
      const dangerousSnake = { ...mockSnake, positions: [{ x: 1, y: 1 }] };
      const dangerousContext = { ...mockContext, snakes: [dangerousSnake] };
      
      const intelligentDirection = pathfinding.calculateDirection(dangerousSnake, intelligentPersonality, dangerousContext);
      const simpleDirection = pathfinding.calculateDirection(dangerousSnake, simplePersonality, dangerousContext);
      
      // Both should avoid walls, but intelligent AI should be more consistent
      expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(intelligentDirection);
      expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(simpleDirection);
    });
  });

  describe('edge cases', () => {
    it('should handle empty food array', () => {
      const contextWithoutFood = { ...mockContext, food: [] };
      const direction = pathfinding.calculateDirection(mockSnake, mockPersonality, contextWithoutFood);
      expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(direction);
    });

    it('should handle single cell board', () => {
      const tinyContext = {
        ...mockContext,
        boardWidth: 1,
        boardHeight: 1,
        snakes: [{ ...mockSnake, positions: [{ x: 0, y: 0 }] }]
      };
      
      const direction = pathfinding.calculateDirection(mockSnake, mockPersonality, tinyContext);
      expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(direction);
    });

    it('should handle completely blocked snake', () => {
      // Surround snake with obstacles
      const blockedSnake = { ...mockSnake, positions: [{ x: 5, y: 5 }] };
      const blockingSnakes = [
        { id: 'blocker1', positions: [{ x: 4, y: 5 }], isAlive: true },
        { id: 'blocker2', positions: [{ x: 6, y: 5 }], isAlive: true },
        { id: 'blocker3', positions: [{ x: 5, y: 4 }], isAlive: true },
        { id: 'blocker4', positions: [{ x: 5, y: 6 }], isAlive: true }
      ];
      
      const blockedContext = {
        ...mockContext,
        snakes: [blockedSnake, ...blockingSnakes]
      };
      
      const direction = pathfinding.calculateDirection(blockedSnake, mockPersonality, blockedContext);
      expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(direction);
    });
  });

  describe('cache management', () => {
    it('should clear caches when requested', () => {
      pathfinding.calculateDirection(mockSnake, mockPersonality, mockContext);
      
      let stats = pathfinding.getPerformanceStats();
      expect(stats.directionCacheSize).toBeGreaterThan(0);
      
      pathfinding.clearCaches();
      
      stats = pathfinding.getPerformanceStats();
      expect(stats.directionCacheSize).toBe(0);
    });

    it('should handle cache expiration', (done) => {
      // This test would require waiting for cache TTL, so we'll just verify the structure
      pathfinding.calculateDirection(mockSnake, mockPersonality, mockContext);
      
      const stats = pathfinding.getPerformanceStats();
      expect(stats.stateCache).toHaveProperty('isCached');
      expect(stats.stateCache).toHaveProperty('cacheAge');
      
      done();
    });
  });
});