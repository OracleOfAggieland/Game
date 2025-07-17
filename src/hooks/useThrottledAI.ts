// src/hooks/useThrottledAI.ts
import { useRef, useCallback, useMemo } from 'react';
import { ThrottledAIProcessor, DEFAULT_AI_CONFIG, ThrottledAIConfig, AIGameState, Snake } from '../utils/ThrottledAIProcessor';
import { Direction } from '../types/GameEnhancements';

interface UseThrottledAIOptions {
  config?: Partial<ThrottledAIConfig>;
  performanceMode?: 'high' | 'medium' | 'low';
}

export const useThrottledAI = (options: UseThrottledAIOptions = {}) => {
  // Create AI processor with configuration
  const aiProcessor = useRef<ThrottledAIProcessor | null>(null);

  // Initialize processor with performance-based config
  const config = useMemo(() => {
    const baseConfig = { ...DEFAULT_AI_CONFIG, ...options.config };
    
    // Adjust config based on performance mode
    switch (options.performanceMode) {
      case 'low':
        return {
          ...baseConfig,
          throttleInterval: 4, // Process every 4 ticks
          maxCalculationTime: 3, // Reduce max time
          maxQueueSize: 6
        };
      case 'medium':
        return {
          ...baseConfig,
          throttleInterval: 3, // Process every 3 ticks
          maxCalculationTime: 4,
          maxQueueSize: 8
        };
      case 'high':
      default:
        return baseConfig;
    }
  }, [options.config, options.performanceMode]);

  // Initialize processor
  if (!aiProcessor.current) {
    aiProcessor.current = new ThrottledAIProcessor(config);
  }

  // Update config when it changes
  if (aiProcessor.current) {
    aiProcessor.current.updateConfig(config);
  }

  /**
   * Schedule AI calculations for all AI snakes
   */
  const scheduleAICalculations = useCallback((snakes: Snake[], gameState: Omit<AIGameState, 'snakes'>) => {
    if (!aiProcessor.current) return;

    const aiSnakes = snakes.filter(snake => snake.isAI && snake.isAlive);
    const fullGameState: AIGameState = {
      ...gameState,
      snakes
    };

    // Schedule calculations for all AI snakes
    aiSnakes.forEach(snake => {
      aiProcessor.current!.scheduleAICalculation(snake, fullGameState);
    });
  }, []);

  /**
   * Process the next AI calculation
   */
  const processNextAI = useCallback(() => {
    if (!aiProcessor.current) return null;
    return aiProcessor.current.processNextAI();
  }, []);

  /**
   * Get AI direction for a specific snake
   */
  const getAIDirection = useCallback((snakeId: string, fallback: Direction = 'RIGHT'): Direction => {
    if (!aiProcessor.current) return fallback;
    const direction = aiProcessor.current.getAIDirection(snakeId);
    return direction || fallback;
  }, []);

  /**
   * Get performance metrics
   */
  const getPerformanceMetrics = useCallback(() => {
    if (!aiProcessor.current) return null;
    return aiProcessor.current.getPerformanceMetrics();
  }, []);

  /**
   * Clear all AI calculations
   */
  const clearAI = useCallback(() => {
    if (!aiProcessor.current) return;
    aiProcessor.current.clear();
  }, []);

  /**
   * Check if AI system is overloaded
   */
  const isAIOverloaded = useCallback(() => {
    if (!aiProcessor.current) return false;
    const metrics = aiProcessor.current.getPerformanceMetrics();
    return metrics.averageCalculationTime > config.maxCalculationTime * 0.8;
  }, [config.maxCalculationTime]);

  return {
    scheduleAICalculations,
    processNextAI,
    getAIDirection,
    getPerformanceMetrics,
    clearAI,
    isAIOverloaded,
    config
  };
};