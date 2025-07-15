// src/components/Game/SnakeGame.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './SnakeGame.css';

interface Position {
  x: number;
  y: number;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

const BOARD_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION: Direction = 'RIGHT';
const INITIAL_SPEED = 200;
const MIN_SPEED = 80;
const SPEED_INCREMENT = 5;
const SCORE_THRESHOLD = 50;

const SnakeGame: React.FC = () => {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<Direction>(INITIAL_DIRECTION);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameSpeed, setGameSpeed] = useState(INITIAL_SPEED);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);

  useEffect(() => {
    const savedHighScore = localStorage.getItem('snakeHighScore');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }
  }, []);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snakeHighScore', score.toString());
    }
  }, [score, highScore]);

  // src/components/Game/SnakeGame.tsx: Corrected Code
const generateFood = useCallback((currentSnake: Position[]) => {
  let newFood: Position;
  let foodOnSnake: boolean;
  let attempts = 0;

  do {
    newFood = {
      x: Math.floor(Math.random() * BOARD_SIZE),
      y: Math.floor(Math.random() * BOARD_SIZE),
    };
    
    foodOnSnake = false;
    for (const segment of currentSnake) {
      if (segment.x === newFood.x && segment.y === newFood.y) {
        foodOnSnake = true;
        break;
      }
    }
    attempts++;
  } while (foodOnSnake && attempts < 100);

  // If we couldn't find a free spot after 100 attempts, we might return the last position
  // which could be on the snake. This is consistent with the original logic.
  return newFood;
}, []);

  useEffect(() => {
    setFood(generateFood(INITIAL_SNAKE));
  }, [generateFood]);

  const calculateSpeed = useCallback((currentScore: number) => {
    const speedReduction = Math.floor(currentScore / SCORE_THRESHOLD) * SPEED_INCREMENT;
    return Math.max(MIN_SPEED, INITIAL_SPEED - speedReduction);
  }, []);
  
  useEffect(() => {
    setGameSpeed(calculateSpeed(score));
  }, [score, calculateSpeed]);

  const moveSnake = useCallback(() => {
    if (gameOver || !gameStarted || isPaused) return;

    setSnake(currentSnake => {
      const newSnake = [...currentSnake];
      const head = { ...newSnake[0] };

      switch (direction) {
        case 'UP': head.y -= 1; break;
        case 'DOWN': head.y += 1; break;
        case 'LEFT': head.x -= 1; break;
        case 'RIGHT': head.x += 1; break;
      }

      if (head.x < 0 || head.x >= BOARD_SIZE || head.y < 0 || head.y >= BOARD_SIZE || 
          newSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
        setGameOver(true);
        return currentSnake;
      }

      newSnake.unshift(head);

      if (head.x === food.x && head.y === food.y) {
        setScore(prev => prev + 10);
        setFood(generateFood(newSnake));
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [direction, food.x, food.y, gameOver, gameStarted, isPaused, generateFood]);

  const resetGame = useCallback(() => {
    setSnake(INITIAL_SNAKE);
    setFood(generateFood(INITIAL_SNAKE));
    setDirection(INITIAL_DIRECTION);
    setGameOver(false);
    setScore(0);
    setGameSpeed(INITIAL_SPEED);
    setIsPaused(false);
    setGameStarted(true);
  }, [generateFood]);

  const togglePause = useCallback(() => {
    if (gameStarted && !gameOver) {
      setIsPaused(prev => !prev);
    }
  }, [gameStarted, gameOver]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    e.preventDefault();

    if (!gameStarted) {
        if (e.code === 'Space' || e.key === ' ') {
            setGameStarted(true);
        }
        return;
    }

    if (gameOver) {
        if (e.code === 'Space' || e.key === ' ') {
            resetGame();
        }
        return;
    }

    if (e.code === 'KeyP' || (e.code === 'Space' && gameStarted)) {
      togglePause();
      return;
    }

    if (isPaused) return;

    let newDirection = direction;
    switch (e.key) {
      case 'ArrowUp': case 'w': if (direction !== 'DOWN') newDirection = 'UP'; break;
      case 'ArrowDown': case 's': if (direction !== 'UP') newDirection = 'DOWN'; break;
      case 'ArrowLeft': case 'a': if (direction !== 'RIGHT') newDirection = 'LEFT'; break;
      case 'ArrowRight': case 'd': if (direction !== 'LEFT') newDirection = 'RIGHT'; break;
    }
    setDirection(newDirection);
  }, [direction, gameOver, gameStarted, isPaused, togglePause, resetGame]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
      if (!touchStartPos.current) return;

      const deltaX = e.changedTouches[0].clientX - touchStartPos.current.x;
      const deltaY = e.changedTouches[0].clientY - touchStartPos.current.y;

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
          if (deltaX > 0 && direction !== 'LEFT') setDirection('RIGHT');
          else if (deltaX < 0 && direction !== 'RIGHT') setDirection('LEFT');
      } else {
          if (deltaY > 0 && direction !== 'UP') setDirection('DOWN');
          else if (deltaY < 0 && direction !== 'DOWN') setDirection('UP');
      }
      touchStartPos.current = null;
  }, [direction]);

  useEffect(() => {
    const gameInterval = setInterval(moveSnake, gameSpeed);
    return () => clearInterval(gameInterval);
  }, [moveSnake, gameSpeed]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Fixed: Move renderCell outside of the loop to avoid the no-loop-func error
  const renderCell = useCallback((x: number, y: number) => {
    const isSnake = snake.some(segment => segment.x === x && segment.y === y);
    const isHead = snake[0]?.x === x && snake[0]?.y === y;
    const isFood = food.x === x && food.y === y;

    let className = 'cell';
    if (isSnake) className += isHead ? ' snake-head' : ' snake-body';
    if (isFood) className += ' food';

    return <div key={`${x}-${y}`} className={className}></div>;
  }, [snake, food]);

  // Create cells array outside of render
  const cells = [];
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
    const x = i % BOARD_SIZE;
    const y = Math.floor(i / BOARD_SIZE);
    cells.push(renderCell(x, y));
  }
  
  return (
    <div
      className="snake-game"
      ref={gameContainerRef}
      tabIndex={0}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{'--board-size': BOARD_SIZE} as React.CSSProperties}
    >
      <div className="game-info">
        <h1>Classic Snake</h1>
        <div className="score-container">
          <div className="score">Score: {score}</div>
          <div className="high-score">High Score: {highScore}</div>
          {gameStarted && !gameOver && (
            <div className="game-stats">
              <div className="length">Length: {snake.length}</div>
            </div>
          )}
        </div>
      </div>

      <div className="game-board">{cells}</div>

      {!gameStarted && !gameOver && (
        <div className="game-message">
          <h2>Get Ready!</h2>
          <p>Use arrow keys, WASD, or swipe to move.</p>
          <p>Press SPACE to start!</p>
        </div>
      )}

      {isPaused && (
        <div className="game-message">
          <h2 style={{color: '#88ccff'}}>Paused</h2>
          <p>Press SPACE or P to resume</p>
        </div>
      )}

      {gameOver && (
        <div className="game-message">
          <h2>Game Over!</h2>
          <p>Final Score: {score}</p>
          {score > 0 && score === highScore && (
            <p className="new-high-score">🎉 New High Score! 🎉</p>
          )}
          <p>Press SPACE to play again</p>
        </div>
      )}

      <div className="controls">
        <p>Controls: Arrow keys / WASD / Swipe</p>
        <p>P or SPACE to pause/resume</p>
      </div>
    </div>
  );
};

export default SnakeGame;