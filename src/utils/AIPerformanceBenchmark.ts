import { Direction, Position, Snake } from '../types/GameEnhancements';
import { SnakeAI } from '../services/SnakeAI';
import { OptimizedAIPathfinding, GameState } from './OptimizedAIPathfinding';

export interface BenchmarkResult {
  oldAI: {
    averageTime: number;
    totalTime: number;
    iterations: number;
  };
  newAI: {
    averageTime: number;
    totalTime: number;
    iterations: number;
  };
  improvement: {
    speedupFactor: number;
    timeReduction: number;
    percentageImprovement: number;
  };
}

export interface BenchmarkConfig {
  iterations: number;
  snakeCount: number;
  boardSize: number;
  foodCount: number;
}

/**
 * Performance benchmark utility to compare old vs new AI pathfinding
 */
export class AIPerformanceBenchmark {
  private static readonly DEFAULT_CONFIG: BenchmarkConfig = {
    iterations: 100,
    snakeCount: 6,
    boardSize: 25,
    foodCount: 5
  };

  public static async runBenchmark(config: BenchmarkConfig = this.DEFAULT_CONFIG): Promise<BenchmarkResult> {
    console.log('Starting AI Performance Benchmark...');
    console.log(`Config: ${config.iterations} iterations, ${config.snakeCount} snakes, ${config.foodCount} food`);

    // Generate test data
    const testCases = this.generateTestCases(config);
    
    // Benchmark old AI
    console.log('Benchmarking original AI...');
    const oldAIResults = await this.benchmarkOriginalAI(testCases);
    
    // Benchmark new AI
    console.log('Benchmarking optimized AI...');
    const newAIResults = await this.benchmarkOptimizedAI(testCases);
    
    // Calculate improvements
    const improvement = this.calculateImprovement(oldAIResults, newAIResults);
    
    const result: BenchmarkResult = {
      oldAI: oldAIResults,
      newAI: newAIResults,
      improvement
    };

    this.logResults(result);
    return result;
  }

  private static generateTestCases(config: BenchmarkConfig): Array<{ snake: Snake; gameState: GameState }> {
    const testCases: Array<{ snake: Snake; gameState: GameState }> = [];

    for (let i = 0; i < config.iterations; i++) {
      const snakes = this.generateRandomSnakes(config.snakeCount, config.boardSize);
      const food = this.generateRandomFood(config.foodCount, config.boardSize);
      
      const gameState: GameState = {
        snakes,
        food,
        bossSnakes: [],
        powerUps: []
      };

      // Test with the first snake (AI snake)
      const testSnake = snakes[0];
      testCases.push({ snake: testSnake, gameState });
    }

    return testCases;
  }

  private static generateRandomSnakes(count: number, boardSize: number): Snake[] {
    const snakes: Snake[] = [];
    
    for (let i = 0; i < count; i++) {
      const x = Math.floor(Math.random() * (boardSize - 4)) + 2;
      const y = Math.floor(Math.random() * (boardSize - 4)) + 2;
      
      const snake: Snake = {
        id: `snake-${i}`,
        positions: [
          { x, y },
          { x: x - 1, y },
          { x: x - 2, y }
        ],
        direction: 'RIGHT' as Direction,
        isAlive: true,
        score: 0,
        isAI: i > 0, // First snake is player, rest are AI
        aiPersonality: i % 2 === 0 ? 'aggressive' : 'defensive',
        color: `hsl(${i * 60}, 70%, 50%)`
      };
      
      snakes.push(snake);
    }
    
    return snakes;
  }

  private static generateRandomFood(count: number, boardSize: number): Position[] {
    const food: Position[] = [];
    
    for (let i = 0; i < count; i++) {
      food.push({
        x: Math.floor(Math.random() * boardSize),
        y: Math.floor(Math.random() * boardSize)
      });
    }
    
    return food;
  }

  private static async benchmarkOriginalAI(
    testCases: Array<{ snake: Snake; gameState: GameState }>
  ): Promise<{ averageTime: number; totalTime: number; iterations: number }> {
    let totalTime = 0;
    const iterations = testCases.length;

    for (const testCase of testCases) {
      const startTime = performance.now();
      
      // Run original AI
      SnakeAI.getNextDirection(testCase.snake, testCase.gameState);
      
      const endTime = performance.now();
      totalTime += (endTime - startTime);
    }

    return {
      averageTime: totalTime / iterations,
      totalTime,
      iterations
    };
  }

  private static async benchmarkOptimizedAI(
    testCases: Array<{ snake: Snake; gameState: GameState }>
  ): Promise<{ averageTime: number; totalTime: number; iterations: number }> {
    let totalTime = 0;
    const iterations = testCases.length;

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const startTime = performance.now();
      
      // Run optimized AI
      OptimizedAIPathfinding.getOptimizedDirection(testCase.snake, testCase.gameState, i);
      
      const endTime = performance.now();
      totalTime += (endTime - startTime);
    }

    return {
      averageTime: totalTime / iterations,
      totalTime,
      iterations
    };
  }

  private static calculateImprovement(
    oldResults: { averageTime: number; totalTime: number; iterations: number },
    newResults: { averageTime: number; totalTime: number; iterations: number }
  ) {
    const speedupFactor = oldResults.averageTime / newResults.averageTime;
    const timeReduction = oldResults.averageTime - newResults.averageTime;
    const percentageImprovement = ((oldResults.averageTime - newResults.averageTime) / oldResults.averageTime) * 100;

    return {
      speedupFactor,
      timeReduction,
      percentageImprovement
    };
  }

  private static logResults(result: BenchmarkResult): void {
    console.log('\n=== AI Performance Benchmark Results ===');
    console.log(`Original AI - Average: ${result.oldAI.averageTime.toFixed(3)}ms, Total: ${result.oldAI.totalTime.toFixed(2)}ms`);
    console.log(`Optimized AI - Average: ${result.newAI.averageTime.toFixed(3)}ms, Total: ${result.newAI.totalTime.toFixed(2)}ms`);
    console.log(`\nImprovement:`);
    console.log(`- Speedup Factor: ${result.improvement.speedupFactor.toFixed(2)}x`);
    console.log(`- Time Reduction: ${result.improvement.timeReduction.toFixed(3)}ms per calculation`);
    console.log(`- Percentage Improvement: ${result.improvement.percentageImprovement.toFixed(1)}%`);
    
    if (result.improvement.percentageImprovement > 0) {
      console.log(`✅ Optimized AI is ${result.improvement.percentageImprovement.toFixed(1)}% faster!`);
    } else {
      console.log(`❌ Optimized AI is slower by ${Math.abs(result.improvement.percentageImprovement).toFixed(1)}%`);
    }
  }

  /**
   * Run a quick benchmark with default settings
   */
  public static async quickBenchmark(): Promise<void> {
    const result = await this.runBenchmark({
      iterations: 50,
      snakeCount: 6,
      boardSize: 25,
      foodCount: 3
    });

    // Additional analysis
    console.log('\n=== Quick Analysis ===');
    if (result.improvement.speedupFactor > 1.5) {
      console.log('🚀 Significant performance improvement detected!');
    } else if (result.improvement.speedupFactor > 1.1) {
      console.log('✅ Moderate performance improvement detected.');
    } else {
      console.log('⚠️  Minimal or no performance improvement.');
    }

    const metrics = OptimizedAIPathfinding.getPerformanceMetrics();
    console.log(`Current AI Complexity Level: ${metrics.averageComplexity}`);
    console.log(`Last Calculation Time: ${metrics.calculationTime.toFixed(3)}ms`);
  }
}

// Export for testing purposes
export { OptimizedAIPathfinding };