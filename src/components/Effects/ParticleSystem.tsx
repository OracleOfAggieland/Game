import React, { useEffect, useRef, useState } from 'react';
import './ParticleSystem.css';

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  type: 'food' | 'collision' | 'powerup' | 'trail' | 'combo';
}

interface ParticleSystemProps {
  boardSize: number;
  cellSize: number;
}

export const ParticleSystem: React.FC<ParticleSystemProps> = ({ boardSize, cellSize }) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // Particle emitter functions
  const createParticle = (
    x: number,
    y: number,
    type: Particle['type'],
    color: string = '#fff'
  ): Particle => {
    const angle = Math.random() * Math.PI * 2;
    const speed = type === 'trail' ? 0.5 : 2 + Math.random() * 3;
    const size = type === 'trail' ? 2 + Math.random() * 2 : 3 + Math.random() * 4;
    
    return {
      id: `${Date.now()}-${Math.random()}`,
      x: x * cellSize + cellSize / 2,
      y: y * cellSize + cellSize / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size,
      color,
      life: 1,
      maxLife: type === 'trail' ? 0.3 : 0.6 + Math.random() * 0.4,
      type
    };
  };

  // Public methods exposed through window
  useEffect(() => {
    const particleAPI = {
      emitFoodParticles: (x: number, y: number) => {
        const newParticles: Particle[] = [];
        for (let i = 0; i < 8; i++) {
          newParticles.push(createParticle(x, y, 'food', '#ff4444'));
        }
        setParticles(prev => [...prev, ...newParticles]);
      },
      
      emitCollisionParticles: (x: number, y: number, color: string = '#00ff88') => {
        const newParticles: Particle[] = [];
        for (let i = 0; i < 15; i++) {
          newParticles.push(createParticle(x, y, 'collision', color));
        }
        setParticles(prev => [...prev, ...newParticles]);
        
        // Screen shake effect
        if (canvasRef.current) {
          canvasRef.current.classList.add('shake');
          setTimeout(() => {
            canvasRef.current?.classList.remove('shake');
          }, 300);
        }
      },
      
      emitPowerUpParticles: (x: number, y: number, color: string) => {
        const newParticles: Particle[] = [];
        for (let i = 0; i < 20; i++) {
          const particle = createParticle(x, y, 'powerup', color);
          particle.size *= 1.5;
          particle.maxLife *= 1.5;
          newParticles.push(particle);
        }
        setParticles(prev => [...prev, ...newParticles]);
      },
      
      emitTrailParticle: (x: number, y: number, color: string) => {
        const particle = createParticle(x, y, 'trail', color);
        particle.vx *= 0.1;
        particle.vy *= 0.1;
        setParticles(prev => [...prev, particle]);
      },
      
      emitComboParticles: (x: number, y: number, comboCount: number) => {
        const colors = ['#FFD700', '#FF6347', '#9370DB', '#00CED1'];
        const newParticles: Particle[] = [];
        
        for (let i = 0; i < comboCount * 5; i++) {
          const particle = createParticle(x, y, 'combo', colors[i % colors.length]);
          particle.size *= 1.2;
          particle.vx *= 1.5;
          particle.vy *= 1.5;
          newParticles.push(particle);
        }
        setParticles(prev => [...prev, ...newParticles]);
      }
    };

    // Expose to window for other components to use
    (window as any).particleSystem = particleAPI;

    return () => {
      delete (window as any).particleSystem;
    };
  }, [cellSize]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      setParticles(prevParticles => {
        return prevParticles.filter(particle => {
          // Update particle physics
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.life -= deltaTime / particle.maxLife;
          
          // Apply gravity for some particles
          if (particle.type !== 'trail') {
            particle.vy += 0.2;
          }
          
          // Fade out
          const alpha = Math.max(0, particle.life);
          
          // Draw particle
          ctx.save();
          ctx.globalAlpha = alpha;
          
          if (particle.type === 'trail') {
            // Draw trail as soft circle
            const gradient = ctx.createRadialGradient(
              particle.x, particle.y, 0,
              particle.x, particle.y, particle.size
            );
            gradient.addColorStop(0, particle.color);
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
          } else {
            // Draw other particles with glow effect
            ctx.shadowBlur = particle.size * 2;
            ctx.shadowColor = particle.color;
            ctx.fillStyle = particle.color;
          }
          
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          
          // Keep particle if still alive
          return particle.life > 0;
        });
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Update canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const size = boardSize * cellSize + 16; // Include padding
    canvas.width = size;
    canvas.height = size;
  }, [boardSize, cellSize]);

  return (
    <canvas
      ref={canvasRef}
      className="particle-canvas"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 50
      }}
    />
  );
};
