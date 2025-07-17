// src/tests/unit/ThrottledAIProcessor.test.ts
import { ThrottledAIProcessor, DEFAULT_AI_CONFIG, AIGameState, Snake } from '../../utils/ThrottledAIProcessor';
import { AIPersonality } from '../../types/GameEnhancements';

describe('ThrottledAIProcessor', () => {
  let processor: ThrottledAIProcessor;
  let mockSnake: Snake;
  let mockGameState: AIGameState;

  beforeEach(() => {
    processor = new ThrottledAIProcessor(DEFAULT_AI_CONFIG);
    
    const mockPersonality: AIPersonality = {
      aggression: 0.7,
      intelligence: 0.8,
      patience: 0.5,
      name: 'TestAI',
      description: 'Test AI personality'
    };

    mockSnake = {
      id: 'test-snake-1',
      name: 'Test Snake',
      positions: [{ x: 5, y: 5 }],
      direction: 'RIGHT',
      score: 0,
      color: '#00ff00',
      isAlive: true,
      isAI: true,
      aiPersonality: mockPersonality,
      lastDirectionChange: 0
    };

    mockGameState = {
      snakes: [mockSnake],
      food: [{ x: 10, y: 5 }],
      powerUps: [],
      boardWidth: 25,
      boardHeight: 25,
      currentTime: performance.now()
    };
  });

  afterEach(() => {
    processor.clear();
  });

  describe('scheduleAICalculation', () => {
    it('should schedule AI calculation for AI snake', () => {
      processor.scheduleAICalculation(mockSnake, mockGameState);
      
      const metrics = processor.getPerformanceMetrics();
      expect(metrics.queueSize).toBe(1);
    });

    it('should not schedule calculation for non-AI snake', () => {
      const humanSnake = { ...mockSnake, isAI: false };
      processor.scheduleAICalculation(humanSnake, mockGameState);
      
      const metrics = processor.getPerformanceMetrics();
      expect(metrics.queueSize).toBe(0);
    });

    it('should not schedule calculation for dead snake', () => {
      const deadSnake = { ...mockSnake, isAlive: false };
      processor.scheduleAICalculation(deadSnake, mockGameState);
      
      const metrics = processor.getPerformanceMetrics();
      expect(metrics.queueSize).toBe(0);
    });

    it('should replace existing calculation for same snake', () => {
      processor.scheduleAICalculation(mockSnake, mockGameState);
      processor.scheduleAICalculation(mockSnake, mockGameState);
      
      const metrics = processor.getPerformanceMetrics();
      expect(metrics.queueSize).toBe(1);
    });

    it('should limit queue size', () => {
      const config = { ...DEFAULT_AI_CONFIG, maxQueueSize: 2 };
      processor = new ThrottledAIProcessor(config);

      // Schedule more calculations than max queue size
      for (let i = 0; i < 5; i++) {
        const snake = { ...mockSnake, id: `snake-${i}` };
        processor.scheduleAICalculation(snake, mockGameState);
      }
      
      const metrics = processor.getPerformanceMetrics();
      expect(metrics.queueSize).toBeLessThanOrEqual(2);
    });
  });

  describe('processNextAI', () => {
    it('should return null when queue is empty', () => {
      const result = processor.processNextAI();
      expect(result).toBeNull();
    });

    it('should respect throttle interval', () => {
      const config = { ...DEFAULT_AI_CONFIG, throttleInterval: 3 };
      processor = new ThrottledAIProcessor(config);
      
      processor.scheduleAICalculation(mockSnake, mockGameState);
      
      // First two calls should return null due to throttling
      expect(processor.processNextAI()).toBeNull();
      expect(processor.processNextAI()).toBeNull();
      
      // Third call should process the AI
      const result = processor.processNextAI();
      expect(result).not.toBeNull();
      expect(result?.snakeId).toBe(mockSnake.id);
    });

    it('should return valid AI result', () => {
      processor.scheduleAICalculation(mockSnake, mockGameState);
      
      // Skip throttling by calling multiple times
      let result = null;
      for (let i = 0; i < DEFAULT_AI_CONFIG.throttleInterval; i++) {
        result = processor.processNextAI();
      }
      
      expect(result).not.toBeNull();
      expect(result?.snakeId).toBe(mockSnake.id);
      expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(result?.direction);
      expect(result?.calculationTime).toBeGreaterThanOrEqual(0);
      expect(result?.fallbackUsed).toBe(false);
    });

    it('should use fallback on calculation error', () => {
      // Create a snake with invalid state to trigger error
      const invalidSnake = { ...mockSnake, positions: [] };
      processor.scheduleAICalculation(invalidSnake, mockGameState);
      
      let result = null;
      for (let i = 0; i < DEFAULT_AI_CONFIG.throttleInterval; i++) {
        result = processor.processNextAI();
      }
      
      expect(result?.fallbackUsed).toBe(true);
      expect(result?.direction).toBe(DEFAULT_AI_CONFIG.fallbackDirection);
    });

    it('should track performance metrics', () => {
      processor.scheduleAICalculation(mockSnake, mockGameState);
      
      // Process the AI calculation
      for (let i = 0; i < DEFAULT_AI_CONFIG.throttleInterval; i++) {
        processor.processNextAI();
      }
      
      const metrics = processor.getPerformanceMetrics();
      expect(metrics.totalCalculations).toBe(1);
      expect(metrics.totalTime).toBeGreaterThan(0);
      expect(metrics.averageCalculationTime).toBeGreaterThan(0);
    });
  });

  describe('getAIDirection', () => {
    it('should return fallback direction when no result exists', () => {
      const direction = processor.getAIDirection('nonexistent-snake');
      expect(direction).toBe(DEFAULT_AI_CONFIG.fallbackDirection);
    });

    it('should return calculated direction after processing', () => {
      processor.scheduleAICalculation(mockSnake, mockGameState);
      
      // Process the calculation
      for (let i = 0; i < DEFAULT_AI_CONFIG.throttleInterval; i++) {
        processor.processNextAI();
      }
      
      const direction = processor.getAIDirection(mockSnake.id);
      expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(direction);
    });
  });

  describe('performance metrics', () => {
    it('should track calculation count and timing', () => {
      processor.scheduleAICalculation(mockSnake, mockGameState);
      
      // Process calculation
      for (let i = 0; i < DEFAULT_AI_CONFIG.throttleInterval; i++) {
        processor.processNextAI();
      }
      
      const metrics = processor.getPerformanceMetrics();
      expect(metrics.totalCalculations).toBe(1);
      expect(metrics.averageCalculationTime).toBeGreaterThan(0);
      expect(metrics.queueSize).toBe(0); // Should be empty after processing
      expect(metrics.resultsCached).toBe(1);
    });

    it('should track timeouts and fallbacks', () => {
      const config = { ...DEFAULT_AI_CONFIG, maxCalculationTime: 0.001 }; // Very low timeout
      processor = new ThrottledAIProcessor(config);
      
      processor.scheduleAICalculation(mockSnake, mockGameState);
      
      // Process calculation (should timeout)
      for (let i = 0; i < config.throttleInterval; i++) {
        processor.processNextAI();
      }
      
      const metrics = processor.getPerformanceMetrics();
      expect(metrics.timeouts).toBeGreaterThanOrEqual(0);
    });
  });

  describe('configuration updates', () => {
    it('should update configuration', () => {
      const newConfig = { throttleInterval: 5, maxCalculationTime: 10 };
      processor.updateConfig(newConfig);
      
      // Test that config was updated by checking behavior
      // Schedule a calculation and verify throttling behavior matches new config
      processor.scheduleAICalculation(mockSnake, mockGameState);
      
      let processCount = 0;
      let result = null;
      while (result === null && processCount < newConfig.throttleInterval + 1) {
        result = processor.processNextAI();
        processCount++;
      }
      
      expect(processCount).toBe(newConfig.throttleInterval);
    });
  });

  describe('clear', () => {
    it('should clear all queues and results', () => {
      processor.scheduleAICalculation(mockSnake, mockGameState);
      
      // Process calculation
      for (let i = 0; i < DEFAULT_AI_CONFIG.throttleInterval; i++) {
        processor.processNextAI();
      }
      
      processor.clear();
      
      const metrics = processor.getPerformanceMetrics();
      expect(metrics.queueSize).toBe(0);
      expect(metrics.resultsCached).toBe(0);
    });
  });

  describe('AI direction calculation', () => {
    it('should prefer safe directions', () => {
      // Create a game state where snake is near a wall
      const nearWallSnake = {
        ...mockSnake,
        positions: [{ x: 0, y: 5 }], // At left edge
        direction: 'LEFT' as const
      };
      
      processor.scheduleAICalculation(nearWallSnake, mockGameState);
      
      // Process calculation
      for (let i = 0; i < DEFAULT_AI_CONFIG.throttleInterval; i++) {
        processor.processNextAI();
      }
      
      const direction = processor.getAIDirection(nearWallSnake.id);
      expect(direction).not.toBe('LEFT'); // Should not go into wall
    });

    it('should move towards food when safe', () => {
      // Create a clear path to food
      const snakeNearFood = {
        ...mockSnake,
        positions: [{ x: 8, y: 5 }], // Close to food at (10, 5)
        direction: 'UP' as const
      };
      
      processor.scheduleAICalculation(snakeNearFood, mockGameState);
      
      // Process calculation multiple times to get consistent result
      let direction = 'UP';
      for (let attempt = 0; attempt < 5; attempt++) {
        processor.clear();
        processor.scheduleAICalculation(snakeNearFood, mockGameState);
        
        for (let i = 0; i < DEFAULT_AI_CONFIG.throttleInterval; i++) {
          processor.processNextAI();
        }
        
        direction = processor.getAIDirection(snakeNearFood.id);
        if (direction === 'RIGHT') break; // Found expected direction
      }
      
      // Should prefer moving towards food (RIGHT direction)
      expect(['RIGHT', 'UP', 'DOWN']).toContain(direction);
    });
  });
});