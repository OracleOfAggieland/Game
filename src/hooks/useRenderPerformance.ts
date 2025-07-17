// src/hooks/useRenderPerformance.ts
import { useRef, useEffect } from 'react';

interface RenderMetrics {
  renderCount: number;
  averageRenderTime: number;
  lastRenderTime: number;
  maxRenderTime: number;
  totalRenderTime: number;
}

export const useRenderPerformance = (componentName: string = 'Component') => {
  const renderStartTime = useRef<number>(0);
  const metricsRef = useRef<RenderMetrics>({
    renderCount: 0,
    averageRenderTime: 0,
    lastRenderTime: 0,
    maxRenderTime: 0,
    totalRenderTime: 0
  });

  // Start timing at the beginning of render
  renderStartTime.current = performance.now();

  useEffect(() => {
    // End timing after render is complete
    const renderEndTime = performance.now();
    const renderTime = renderEndTime - renderStartTime.current;
    
    const metrics = metricsRef.current;
    metrics.renderCount++;
    metrics.lastRenderTime = renderTime;
    metrics.totalRenderTime += renderTime;
    metrics.averageRenderTime = metrics.totalRenderTime / metrics.renderCount;
    metrics.maxRenderTime = Math.max(metrics.maxRenderTime, renderTime);

    // Log performance warnings for slow renders
    if (renderTime > 16) { // More than 1 frame at 60fps
      console.warn(`${componentName} render took ${renderTime.toFixed(2)}ms (>16ms)`);
    }

    // Log periodic performance summary
    if (metrics.renderCount % 100 === 0) {
      console.log(`${componentName} Performance Summary:`, {
        renders: metrics.renderCount,
        avgTime: metrics.averageRenderTime.toFixed(2) + 'ms',
        maxTime: metrics.maxRenderTime.toFixed(2) + 'ms',
        lastTime: metrics.lastRenderTime.toFixed(2) + 'ms'
      });
    }
  });

  const getMetrics = (): RenderMetrics => ({ ...metricsRef.current });

  const resetMetrics = () => {
    metricsRef.current = {
      renderCount: 0,
      averageRenderTime: 0,
      lastRenderTime: 0,
      maxRenderTime: 0,
      totalRenderTime: 0
    };
  };

  return { getMetrics, resetMetrics };
};