import React, { useEffect, useRef, useState } from 'react';
import './Level3.css';

interface Point {
  x: number;
  y: number;
}

const SEGMENT_SIZE = 20;
const BOARD_SIZE = 400;

export default function Level3() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [direction, setDirection] = useState<Point>({ x: 1, y: 0 });
  const [snake, setSnake] = useState<Point[]>([
    { x: 5, y: 10 },
    { x: 4, y: 10 },
    { x: 3, y: 10 },
  ]);
  const [food, setFood] = useState<Point>({ x: 15, y: 10 });
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          if (direction.y === 0) setDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
          if (direction.y === 0) setDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
          if (direction.x === 0) setDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
          if (direction.x === 0) setDirection({ x: 1, y: 0 });
          break;
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [direction]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    let animation: number;

    const draw = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);

      // draw food
      ctx.fillStyle = 'red';
      ctx.beginPath();
      ctx.arc(
        food.x * SEGMENT_SIZE + SEGMENT_SIZE / 2,
        food.y * SEGMENT_SIZE + SEGMENT_SIZE / 2,
        SEGMENT_SIZE / 2,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // move snake
      const newSnake = [...snake];
      const head = {
        x: newSnake[0].x + direction.x,
        y: newSnake[0].y + direction.y,
      };

      if (
        head.x < 0 ||
        head.x >= BOARD_SIZE / SEGMENT_SIZE ||
        head.y < 0 ||
        head.y >= BOARD_SIZE / SEGMENT_SIZE ||
        newSnake.some((seg) => seg.x === head.x && seg.y === head.y)
      ) {
        setGameOver(true);
        cancelAnimationFrame(animation);
        return;
      }

      newSnake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        setFood({
          x: Math.floor(Math.random() * (BOARD_SIZE / SEGMENT_SIZE)),
          y: Math.floor(Math.random() * (BOARD_SIZE / SEGMENT_SIZE)),
        });
      } else {
        newSnake.pop();
      }

      setSnake(newSnake);

      // draw snake with gradient for realistic look
      newSnake.forEach((seg, idx) => {
        const grad = ctx.createRadialGradient(
          seg.x * SEGMENT_SIZE + SEGMENT_SIZE / 2,
          seg.y * SEGMENT_SIZE + SEGMENT_SIZE / 2,
          SEGMENT_SIZE / 4,
          seg.x * SEGMENT_SIZE + SEGMENT_SIZE / 2,
          seg.y * SEGMENT_SIZE + SEGMENT_SIZE / 2,
          SEGMENT_SIZE
        );
        grad.addColorStop(0, '#2f8f2f');
        grad.addColorStop(1, '#145214');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(
          seg.x * SEGMENT_SIZE + SEGMENT_SIZE / 2,
          seg.y * SEGMENT_SIZE + SEGMENT_SIZE / 2,
          SEGMENT_SIZE / 2,
          0,
          Math.PI * 2
        );
        ctx.fill();
        if (idx === 0) {
          // eyes
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(
            seg.x * SEGMENT_SIZE + SEGMENT_SIZE / 3,
            seg.y * SEGMENT_SIZE + SEGMENT_SIZE / 3,
            2,
            0,
            Math.PI * 2
          );
          ctx.arc(
            seg.x * SEGMENT_SIZE + (SEGMENT_SIZE * 2) / 3,
            seg.y * SEGMENT_SIZE + SEGMENT_SIZE / 3,
            2,
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.fillStyle = 'black';
          ctx.beginPath();
          ctx.arc(
            seg.x * SEGMENT_SIZE + SEGMENT_SIZE / 3,
            seg.y * SEGMENT_SIZE + SEGMENT_SIZE / 3,
            1,
            0,
            Math.PI * 2
          );
          ctx.arc(
            seg.x * SEGMENT_SIZE + (SEGMENT_SIZE * 2) / 3,
            seg.y * SEGMENT_SIZE + SEGMENT_SIZE / 3,
            1,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      });

      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [snake, direction, food]);

  return (
    <div className="level3-wrapper">
      <h2>Level 3 - Advanced Snake</h2>
      {gameOver && (
        <div className="game-over">Game Over! Press F5 to restart.</div>
      )}
      <canvas ref={canvasRef} width={BOARD_SIZE} height={BOARD_SIZE} />
    </div>
  );
}
