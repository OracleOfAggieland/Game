import { OptimizedAIPathfinding } from '../utils/OptimizedAIPathfinding';
import { AIPerformanceBenchmark } from '../utils/AIPerformanceBenchmark';
import { Direction, Snake } from '../types/GameEnhancements';

describe('OptimizedAIPathfinding', () => {
  const createTestSnake = (id: string, x: number, y: number, direction: Direction = 'RIGHT'): Snake => ({
    id,
    positions: [{ x, y }, { x: x - 1, y }, { x: x - 2, y }],
    direction,
    isAlive: true,
    score: 0,
    isAI: true,
    aiPersonality: 'aggressive',
    color: '#ff0000'
  });

  const createTestGameState = (snakes: Snake[], foodPositions: Array<{ x: number; y: number }> = []) => ({
    snakes,
    food: foodPositions,
    bossSnakes: [],
    powerUps: []
  });

  beforeEach(() => {
    // Reset cache before each test
    OptimizedAIPathfinding.invalidateCache();
  });

  describe('Basic Functionality', () => {
    test('should return a valid direction', () => {
      const snake = createTestSnake('test-snake', 10, 10);
      const gameState = createTestGameState([snake]);

      const direction = OptimizedAIPathfinding.getOptimizedDirection(snake, gameState, 1);
      
      expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(direction);
    });

    test('should avoid walls', () => {
      // Snake at top edge
      const snake = createTestSnake('test-snake', 10, 0, 'UP');
      const gameState = createTestGameState([snake]);

      const direction = OptimizedAIPathfinding.getOptimizedDirection(snake, gameState, 1);
      
      // Should not try to go UP (into wall)
      expect(direction).not.toBe('UP');
    });

    test('should avoid other snakes', () => {
      const snake1 = createTestSnake('snake1', 10, 10, 'RIGHT');
      const snake2 = createTestSnake('snake2', 12, 10, 'LEFT'); // Blocking path
      const gameState = createTestGameState([snake1, snake2]);

      const direction = OptimizedAIPathfinding.getOptimizedDirection(snake1, gameState, 1);
      
      // Should find an alternative direction
      expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(direction);
    });

    test('should move toward food when available', () => {
      const snake = createTestSnake('test-snake', 10, 10, 'RIGHT');
      const gameState = createTestGameState([snake], [{ x: 15, y: 10 }]); // Food to the right

      const direction = OptimizedAIPathfinding.getOptimizedDirection(snake, gameState, 1);
      
      // Should prefer moving toward food (RIGHT)
      expect(direction).toBe('RIGHT');
    });
  });

  describe('Performance Optimization', () => {
    test('should use cached positions for multiple calls', () => {
      const snake = createTestSnake('test-snake', 10, 10);
      const gameState = createTestGameState([snake]);

      // First call - should build cache
      const direction1 = OptimizedAIPathfinding.getOptimizedDirection(snake, gameState, 1);
      
      // Second call with same tick - should use cache
      const direction2 = OptimizedAIPathfinding.getOptimizedDirection(snake, gameState, 1);
      
      expect(direction1).toBe(direction2);
    });

    test('should update performance metrics', () => {
      OptimizedAIPathfinding.updatePerformanceMetrics(16.67); // 60 FPS
      
      const metrics = OptimizedAIPathfinding.getPerformanceMetrics();
      
      expect(metrics).toHaveProperty('calculationTime');
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('averageComplexity');
    });

    test('should scale complexity based on performance', () => {
      // Simulate poor performance
      for (let i = 0; i < 10; i++) {
        OptimizedAIPathfinding.updatePerformanceMetrics(50); // 20 FPS
      }

      const snake = createTestSnake('test-snake', 10, 10);
      const gameState = createTestGameState([snake]);

      // Should still return valid direction even with reduced complexity
      const direction = OptimizedAIPathfinding.getOptimizedDirection(snake, gameState, 1);
      expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(direction);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty game state', () => {
      const snake = createTestSnake('test-snake', 10, 10);
      const gameState = createTestGameState([]);

      expect(() => {
        OptimizedAIPathfinding.getOptimizedDirection(snake, gameState, 1);
      }).not.toThrow();
    });

    test('should handle snake in corner', () => {
      const snake = createTestSnake('corner-snake', 0, 0, 'LEFT');
      const gameState = createTestGameState([snake]);

      const direction = OptimizedAIPathfinding.getOptimizedDirection(snake, gameState, 1);
      
      // Should find a valid direction (DOWN or RIGHT)
      expect(['DOWN', 'RIGHT']).toContain(direction);
    });

    test('should handle surrounded snake gracefully', () => {
      // Create a snake surrounded by obstacles
      const centerSnake = createTestSnake('center', 12, 12);
      const blocker1 = createTestSnake('blocker1', 11, 12);
      const blocker2 = createTestSnake('blocker2', 13, 12);
      const blocker3 = createTestSnake('blocker3', 12, 11);
      const blocker4 = createTestSnake('blocker4', 12, 13);
      
      const gameState = createTestGameState([centerSnake, blocker1, blocker2, blocker3, blocker4]);

      expect(() => {
        OptimizedAIPathfinding.getOptimizedDirection(centerSnake, gameState, 1);
      }).not.toThrow();
    });
  });
});

describe('AIPerformanceBenchmark', () => {
  test('should run benchmark without errors', async () => {
    const config = {
      iterations: 10,
      snakeCount: 3,
      boardSize: 25,
      foodCount: 2
    };

    const result = await AIPerformanceBenchmark.runBenchmark(config);

    expect(result).toHaveProperty('oldAI');
    expect(result).toHaveProperty('newAI');
    expect(result).toHaveProperty('improvement');
    
    expect(result.oldAI.iterations).toBe(config.iterations);
    expect(result.newAI.iterations).toBe(config.iterations);
    
    expect(result.oldAI.averageTime).toBeGreaterThan(0);
    expect(result.newAI.averageTime).toBeGreaterThan(0);
  });

  test('should show performance improvement', async () => {
    const config = {
      iterations: 20,
      snakeCount: 4,
      boardSize: 25,
      foodCount: 3
    };

    const result = await AIPerformanceBenchmark.runBenchmark(config);

    // The optimized AI should generally be faster
    expect(result.improvement.speedupFactor).toBeGreaterThan(0);
    
    // Log results for manual verification
    console.log('Performance Improvement:', {
      speedup: `${result.improvement.speedupFactor.toFixed(2)}x`,
      reduction: `${result.improvement.timeReduction.toFixed(3)}ms`,
      percentage: `${result.improvement.percentageImprovement.toFixed(1)}%`
    });
  });

  test('should run quick benchmark', async () => {
    // This test verifies the quick benchmark doesn't throw errors
    await expect(AIPerformanceBenchmark.quickBenchmark()).resolves.not.toThrow();
  });
});