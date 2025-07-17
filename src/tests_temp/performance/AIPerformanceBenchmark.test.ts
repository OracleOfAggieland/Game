// src/tests/performance/AIPerformanceBenchmark.test.ts
import { ThrottledAIProcessor, DEFAULT_AI_CONFIG } from '../../utils/ThrottledAIProcessor';
import { OptimizedAIPathfinding } from '../../utils/OptimizedAIPathfinding';
import { AIPersonality } from '../../types/GameEnhancements';

describe('AI Performance Benchmarks', () => {
  const createMockSnakes = (count: number) => {
    const snakes = [];
    const mockPersonality: AIPersonality = {
      aggression: 0.7,
      intelligence: 0.8,
      patience: 0.5,
      name: 'BenchmarkAI',
      description: 'AI for benchmarking'
    };

    for (let i = 0; i < count; i++) {
      snakes.push({
        id: `snake-${i}`,
        name: `Snake ${i}`,
        positions: [{ x: Math.floor(Math.random() * 20) + 2, y: Math.floor(Math.random() * 20) + 2 }],
        direction: 'RIGHT' as const,
        score: 0,
        color: '#00ff00',
        isAlive: true,
        isAI: true,
        aiPersonality: mockPersonality,
        lastDirectionChange: 0
      });
    }
    return snakes;
  };

  const createMockGameState = (snakeCount: number) => {
    const snakes = createMockSnakes(snakeCount);
    return {
      snakes,
      food: [
        { x: 10, y: 10 },
        { x: 15, y: 5 },
        { x: 8, y: 12 },
        { x: 18, y: 18 }
      ],
      powerUps: [],
      boardWidth: 25,
      boardHeight: 25,
      currentTime: performance.now()
    };
  };

  describe('ThrottledAIProcessor Performance', () => {
    it('should process multiple AI snakes efficiently', () => {
      const processor = new ThrottledAIProcessor(DEFAULT_AI_CONFIG);
      const gameState = createMockGameState(6); // 6 AI snakes
      
      const startTime = performance.now();
      
      // Schedule all AI calculations
      gameState.snakes.forEach(snake => {
        processor.scheduleAICalculation(snake, gameState);
      });
      
      // Process all AI calculations
      let processedCount = 0;
      for (let i = 0; i < 100; i++) { // Process for multiple ticks
        const result = processor.processNextAI();
        if (result) processedCount++;
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerCalculation = processedCount > 0 ? totalTime / processedCount : 0;
      
      console.log(`Processed ${processedCount} AI calculations in ${totalTime.toFixed(2)}ms`);
      console.log(`Average time per calculation: ${avgTimePerCalculation.toFixed(2)}ms`);
      
      // Performance assertions
      expect(avgTimePerCalculation).toBeLessThan(5); // Should be under 5ms per calculation
      expect(processedCount).toBeGreaterThan(0);
      
      const metrics = processor.getPerformanceMetrics();
      expect(metrics.averageCalculationTime).toBeLessThan(5);
    });

    it('should handle AI throttling effectively', () => {
      const config = { ...DEFAULT_AI_CONFIG, throttleInterval: 3 };
      const processor = new ThrottledAIProcessor(config);
      const gameState = createMockGameState(4);
      
      // Schedule calculations
      gameState.snakes.forEach(snake => {
        processor.scheduleAICalculation(snake, gameState);
      });
      
      let processedInFirstTicks = 0;
      let processedInLaterTicks = 0;
      
      // First few ticks should be throttled
      for (let i = 0; i < 6; i++) {
        const result = processor.processNextAI();
        if (result && i < 3) processedInFirstTicks++;
        if (result && i >= 3) processedInLaterTicks++;
      }
      
      // Should respect throttling
      expect(processedInFirstTicks).toBeLessThan(processedInLaterTicks);
    });

    it('should scale well with increasing snake count', () => {
      const processor = new ThrottledAIProcessor(DEFAULT_AI_CONFIG);
      const results = [];
      
      for (const snakeCount of [2, 4, 6, 8]) {
        const gameState = createMockGameState(snakeCount);
        
        const startTime = performance.now();
        
        // Schedule and process AI for all snakes
        gameState.snakes.forEach(snake => {
          processor.scheduleAICalculation(snake, gameState);
        });
        
        let processed = 0;
        for (let i = 0; i < 50; i++) {
          const result = processor.processNextAI();
          if (result) processed++;
        }
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        
        results.push({
          snakeCount,
          totalTime,
          processed,
          avgTime: processed > 0 ? totalTime / processed : 0
        });
        
        processor.clear(); // Clear for next test
      }
      
      console.log('Scaling results:', results);
      
      // Performance should not degrade exponentially
      const firstResult = results[0];
      const lastResult = results[results.length - 1];
      
      // Time per snake should not increase dramatically
      const firstTimePerSnake = firstResult.avgTime / firstResult.snakeCount;
      const lastTimePerSnake = lastResult.avgTime / lastResult.snakeCount;
      
      expect(lastTimePerSnake).toBeLessThan(firstTimePerSnake * 2); // Should not double
    });
  });

  describe('OptimizedAIPathfinding Performance', () => {
    it('should benefit from caching', () => {
      const pathfinding = new OptimizedAIPathfinding();
      const snakes = createMockSnakes(1);
      const snake = snakes[0];
      const personality = snake.aiPersonality!;
      
      const context = {
        snakes,
        food: [{ x: 10, y: 10 }],
        boardWidth: 25,
        boardHeight: 25,
        currentTick: 1
      };
      
      // First calculation (cache miss)
      const startTime1 = performance.now();
      pathfinding.calculateDirection(snake, personality, context);
      const firstTime = performance.now() - startTime1;
      
      // Second calculation (cache hit)
      const startTime2 = performance.now();
      pathfinding.calculateDirection(snake, personality, context);
      const secondTime = performance.now() - startTime2;
      
      console.log(`First calculation: ${firstTime.toFixed(3)}ms, Second: ${secondTime.toFixed(3)}ms`);
      
      // Cache should improve performance
      expect(secondTime).toBeLessThan(firstTime);
      expect(secondTime).toBeLessThan(1); // Should be very fast with cache
    });

    it('should handle complex scenarios efficiently', () => {
      const pathfinding = new OptimizedAIPathfinding();
      const snakes = createMockSnakes(8); // Complex scenario with many snakes
      const testSnake = snakes[0];
      const personality = testSnake.aiPersonality!;
      
      const context = {
        snakes,
        food: Array.from({ length: 10 }, (_, i) => ({ 
          x: Math.floor(Math.random() * 25), 
          y: Math.floor(Math.random() * 25) 
        })),
        boardWidth: 25,
        boardHeight: 25,
        currentTick: 1
      };
      
      const startTime = performance.now();
      
      // Calculate directions for multiple scenarios
      for (let i = 0; i < 50; i++) {
        pathfinding.calculateDirection(testSnake, personality, context);
        context.currentTick++; // Simulate game progression
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / 50;
      
      console.log(`Complex scenario: ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(3)}ms average`);
      
      expect(avgTime).toBeLessThan(2); // Should be under 2ms per calculation
      
      const stats = pathfinding.getPerformanceStats();
      expect(stats.directionCacheSize).toBeGreaterThan(0);
    });

    it('should maintain performance with cache cleanup', () => {
      const pathfinding = new OptimizedAIPathfinding();
      const snakes = createMockSnakes(3);
      
      const times = [];
      
      // Run many calculations to trigger cache cleanup
      for (let i = 0; i < 100; i++) {
        const snake = snakes[i % snakes.length];
        const personality = snake.aiPersonality!;
        
        const context = {
          snakes,
          food: [{ x: Math.floor(Math.random() * 25), y: Math.floor(Math.random() * 25) }],
          boardWidth: 25,
          boardHeight: 25,
          currentTick: i
        };
        
        const startTime = performance.now();
        pathfinding.calculateDirection(snake, personality, context);
        const calculationTime = performance.now() - startTime;
        
        times.push(calculationTime);
      }
      
      // Performance should remain consistent
      const firstHalf = times.slice(0, 50);
      const secondHalf = times.slice(50);
      
      const firstAvg = firstHalf.reduce((sum, time) => sum + time, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, time) => sum + time, 0) / secondHalf.length;
      
      console.log(`First half average: ${firstAvg.toFixed(3)}ms, Second half: ${secondAvg.toFixed(3)}ms`);
      
      // Performance should not degrade significantly
      expect(secondAvg).toBeLessThan(firstAvg * 1.5); // Allow some variance
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory with repeated calculations', () => {
      const processor = new ThrottledAIProcessor(DEFAULT_AI_CONFIG);
      const pathfinding = new OptimizedAIPathfinding();
      
      // Simulate extended gameplay
      for (let round = 0; round < 10; round++) {
        const gameState = createMockGameState(6);
        
        // Process AI for this round
        gameState.snakes.forEach(snake => {
          processor.scheduleAICalculation(snake, gameState);
          
          const context = {
            snakes: gameState.snakes,
            food: gameState.food,
            boardWidth: gameState.boardWidth,
            boardHeight: gameState.boardHeight,
            currentTick: round
          };
          
          pathfinding.calculateDirection(snake, snake.aiPersonality!, context);
        });
        
        // Process queued calculations
        for (let i = 0; i < 20; i++) {
          processor.processNextAI();
        }
        
        // Clear periodically to simulate game resets
        if (round % 3 === 0) {
          processor.clear();
          pathfinding.clearCaches();
        }
      }
      
      // Check final state
      const processorMetrics = processor.getPerformanceMetrics();
      const pathfindingStats = pathfinding.getPerformanceStats();
      
      expect(processorMetrics.totalCalculations).toBeGreaterThan(0);
      expect(pathfindingStats.directionCacheSize).toBeLessThan(100); // Should not grow unbounded
    });
  });
});