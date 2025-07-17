// src/components/Game/ParticleSystem.tsx
import React, { useEffect, useRef, useCallback } from 'react';
import { ParticlePool, Particle } from '../../utils/ObjectPool';

interface ParticleSystemProps {
  width: number;
  height: number;
  isActive: boolean;
}

interface ParticleEffect {
  id: string;
  particles: Particle[];
  startTime: number;
  duration: number;
  type: 'explosion' | 'sparkle' | 'trail' | 'score';
}

const ParticleSystem: React.FC<ParticleSystemProps> = ({ width, height, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlePoolRef = useRef<ParticlePool>(new ParticlePool(100, 500));
  const activeEffectsRef = useRef<ParticleEffect[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // Create explosion effect
  const createExplosion = useCallback((x: number, y: number, color: string = '#ff4444', intensity: number = 1) => {
    const particles: Particle[] = [];
    const particleCount = Math.floor(8 * intensity);

    for (let i = 0; i < particleCount; i++) {
      const particle = particlePoolRef.current.get();
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 2 + Math.random() * 3;

      particle.id = `explosion-${Date.now()}-${i}`;
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
      particle.life = 1;
      particle.maxLife = 0.8 + Math.random() * 0.4;
      particle.color = color;
      particle.size = 2 + Math.random() * 2;
      particle.type = 'explosion';

      particles.push(particle);
    }

    const effect: ParticleEffect = {
      id: `explosion-${Date.now()}`,
      particles,
      startTime: performance.now(),
      duration: 1000,
      type: 'explosion'
    };

    activeEffectsRef.current.push(effect);
  }, []);

  // Create sparkle effect
  const createSparkle = useCallback((x: number, y: number, color: string = '#ffaa00', count: number = 5) => {
    const particles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const particle = particlePoolRef.current.get();
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;

      particle.id = `sparkle-${Date.now()}-${i}`;
      particle.x = x + (Math.random() - 0.5) * 10;
      particle.y = y + (Math.random() - 0.5) * 10;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed - 1; // Slight upward bias
      particle.life = 1;
      particle.maxLife = 0.5 + Math.random() * 0.5;
      particle.color = color;
      particle.size = 1 + Math.random();
      particle.type = 'sparkle';

      particles.push(particle);
    }

    const effect: ParticleEffect = {
      id: `sparkle-${Date.now()}`,
      particles,
      startTime: performance.now(),
      duration: 800,
      type: 'sparkle'
    };

    activeEffectsRef.current.push(effect);
  }, []);

  // Create score popup effect
  const createScorePopup = useCallback((x: number, y: number, score: number, color: string = '#00ff88') => {
    const particle = particlePoolRef.current.get();

    particle.id = `score-${Date.now()}`;
    particle.x = x;
    particle.y = y;
    particle.vx = (Math.random() - 0.5) * 2;
    particle.vy = -2 - Math.random();
    particle.life = 1;
    particle.maxLife = 1.5;
    particle.color = color;
    particle.size = score; // Store score in size field
    particle.type = 'score';

    const effect: ParticleEffect = {
      id: `score-${Date.now()}`,
      particles: [particle],
      startTime: performance.now(),
      duration: 1500,
      type: 'score'
    };

    activeEffectsRef.current.push(effect);
  }, []);

  // Update particles
  const updateParticles = useCallback((deltaTime: number) => {
    const currentTime = performance.now();
    
    activeEffectsRef.current = activeEffectsRef.current.filter(effect => {
      const elapsed = currentTime - effect.startTime;
      
      if (elapsed > effect.duration) {
        // Return particles to pool
        effect.particles.forEach(particle => {
          particlePoolRef.current.release(particle);
        });
        return false;
      }

      // Update particles in this effect
      effect.particles = effect.particles.filter(particle => {
        particle.life -= deltaTime / 1000 / particle.maxLife;
        
        if (particle.life <= 0) {
          particlePoolRef.current.release(particle);
          return false;
        }

        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Apply gravity for certain particle types
        if (particle.type === 'explosion' || particle.type === 'sparkle') {
          particle.vy += 0.1; // Gravity
          particle.vx *= 0.98; // Air resistance
          particle.vy *= 0.98;
        }

        return true;
      });

      return effect.particles.length > 0;
    });
  }, []);

  // Render particles
  const renderParticles = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, width, height);

    activeEffectsRef.current.forEach(effect => {
      effect.particles.forEach(particle => {
        const alpha = particle.life;
        
        if (particle.type === 'score') {
          // Render score text
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = particle.color;
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`+${particle.size}`, particle.x, particle.y);
          ctx.restore();
        } else {
          // Render particle dot
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = particle.color;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
          
          // Add glow effect for sparkles
          if (particle.type === 'sparkle') {
            ctx.shadowColor = particle.color;
            ctx.shadowBlur = particle.size * 2;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
          
          ctx.restore();
        }
      });
    });
  }, [width, height]);

  // Animation loop
  const animate = useCallback(() => {
    if (!isActive) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - lastUpdateTimeRef.current;
    lastUpdateTimeRef.current = currentTime;

    updateParticles(deltaTime);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (ctx) {
      renderParticles(ctx);
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [isActive, updateParticles, renderParticles]);

  // Start/stop animation
  useEffect(() => {
    if (isActive) {
      lastUpdateTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, animate]);

  // Expose methods to parent component
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Attach methods to canvas for external access
      (canvas as any).createExplosion = createExplosion;
      (canvas as any).createSparkle = createSparkle;
      (canvas as any).createScorePopup = createScorePopup;
    }
  }, [createExplosion, createSparkle, createScorePopup]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 5
      }}
    />
  );
};

export default ParticleSystem;