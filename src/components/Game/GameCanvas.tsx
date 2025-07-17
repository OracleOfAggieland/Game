import React, { useRef, useEffect } from 'react';
import { BossSnake, Position } from '../../types/GameEnhancements';
import { GAME_CONSTANTS } from '../../constants/GameConstants';

interface BasicSnake {
  positions: Position[];
  color: string;
  isAlive: boolean;
}

interface CanvasGameRoom {
  players: { [playerId: string]: BasicSnake };
  food: Position[];
}

interface GameCanvasProps {
  gameRoom: CanvasGameRoom | null;
  bossSnakes: BossSnake[];
}

const GameCanvas: React.FC<GameCanvasProps> = ({ gameRoom, bossSnakes }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement as HTMLElement | null;
    if (parent) {
      // Match canvas size to the board container
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameRoom) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { BOARD_SIZE } = GAME_CONSTANTS;
    const cellSize = canvas.width / BOARD_SIZE;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw food
    ctx.fillStyle = '#ff4444';
    gameRoom.food.forEach((f) => {
      ctx.beginPath();
      ctx.arc((f.x + 0.5) * cellSize, (f.y + 0.5) * cellSize, cellSize / 2.4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Helper to draw a snake
    const drawSnake = (positions: Position[], color: string) => {
      ctx.fillStyle = color;
      positions.forEach((pos) => {
        ctx.fillRect(pos.x * cellSize, pos.y * cellSize, cellSize, cellSize);
      });
    };

    // Draw snakes
    Object.values(gameRoom.players).forEach((p) => {
      if (p.isAlive) {
        drawSnake(p.positions, p.color);
      }
    });

    // Draw bosses
    bossSnakes.forEach((b) => {
      if (b.isAlive) {
        drawSnake(b.positions, b.color);
      }
    });
  }, [gameRoom, bossSnakes]);

  return <canvas ref={canvasRef} className="game-canvas" />;
};

export default React.memo(GameCanvas);
