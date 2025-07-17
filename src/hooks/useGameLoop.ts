import { useCallback, useRef, useEffect } from 'react';
import { PERFORMANCE_CONSTANTS } from '../constants/GameConstants';
import { gameEvents } from '../services/GameEventEmitter';

export interface GameLoopOptions {
  isActive: boolean;
  targetFPS?: number;
  onUpdate: () => void;
  onPerformanceWarning?: (fps: number, frameTime: number) => void;
}

export function useGameLoop(options: GameLoopOptions) {
  const gameLoopRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(0);
  const currentFpsRef = useRef<number>(60);

  const targetFrameTime = 1000 / (options.targetFPS || 60);

  const gameLoop = useCallback((currentTime: number) => {
    if (!options.isActive) {
      return;
    }

    const deltaTime = currentTime - lastFrameTimeRef.current;
    
    // Frame rate limiting
    if (deltaTime >= targetFrameTime) {
      // Performance monitoring
      frameCountRef.current++;
      const timeSinceLastFpsUpdate = currentTime - lastFpsUpdateRef.current;
      
      if (timeSinceLastFpsUpdate >= 1000) {
        currentFpsRef.current = (frameCountRef.current * 1000) / timeSinceLastFpsUpdate;
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = currentTime;
        
        // Performance warning
        if (currentFpsRef.current < PERFORMANCE_CONSTANTS.OPTIMIZATION_THRESHOLD) {
          const frameTime = deltaTime;
          options.onPerformanceWarning?.(currentFpsRef.current, frameTime);
          gameEvents.emit('performance-warning', {
            fps: currentFpsRef.current,
            frameTime
          });
        }
      }

      try {
        options.onUpdate();
      } catch (error) {
        console.error('Error in game loop update:', error);
      }

      lastFrameTimeRef.current = currentTime;
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [options, targetFrameTime]);

  const startLoop = useCallback(() => {
    if (!gameLoopRef.current && options.isActive) {
      lastFrameTimeRef.current = performance.now();
      lastFpsUpdateRef.current = performance.now();
      frameCountRef.current = 0;
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gameLoop, options.isActive]);

  const stopLoop = useCallback(() => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }
  }, []);

  const getCurrentFPS = useCallback(() => {
    return currentFpsRef.current;
  }, []);

  // Auto-start/stop based on isActive
  useEffect(() => {
    if (options.isActive) {
      startLoop();
    } else {
      stopLoop();
    }

    return stopLoop;
  }, [options.isActive, startLoop, stopLoop]);

  // Cleanup on unmount
  useEffect(() => {
    return stopLoop;
  }, [stopLoop]);

  return {
    startLoop,
    stopLoop,
    getCurrentFPS,
    isRunning: gameLoopRef.current !== null
  };
}