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
  const [isMobile, setIsMobile] = useState(false);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

      // Calculate new head position
      switch (direction) {
        case 'UP': head.y -= 1; break;
        case 'DOWN': head.y += 1; break;
        case 'LEFT': head.x -= 1; break;
        case 'RIGHT': head.x += 1; break;
      }

      // Check wall collisions first
      if (head.x < 0 || head.x >= BOARD_SIZE || head.y < 0 || head.y >= BOARD_SIZE) {
        setGameOver(true);
        return currentSnake;
      }

      // Check self collision (excluding current head position)
      const bodyCollision = currentSnake.some(segment => segment.x === head.x && segment.y === head.y);
      if (bodyCollision) {
        setGameOver(true);
        return currentSnake;
      }

      // Move snake
      newSnake.unshift(head);

      // Check food collision
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

  const startGame = useCallback(() => {
    if (!gameStarted && !gameOver) {
      setGameStarted(true);
    } else if (gameOver) {
      resetGame();
    }
  }, [gameStarted, gameOver, resetGame]);

  const togglePause = useCallback(() => {
    if (gameStarted && !gameOver) {
      setIsPaused(prev => !prev);
    }
  }, [gameStarted, gameOver]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Prevent default browser behavior for arrow keys and WASD
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
      e.preventDefault();
    }

    if (!gameStarted && !gameOver) {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        startGame();
        return;
      }
    }

    if (gameOver) {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        resetGame();
        return;
      }
    }

    if (e.code === 'KeyP' || (e.code === 'Space' && gameStarted && !gameOver)) {
      e.preventDefault();
      togglePause();
      return;
    }

    if (isPaused) return;

    let newDirection = direction;
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': if (direction !== 'DOWN') newDirection = 'UP'; break;
      case 'ArrowDown': case 's': case 'S': if (direction !== 'UP') newDirection = 'DOWN'; break;
      case 'ArrowLeft': case 'a': case 'A': if (direction !== 'RIGHT') newDirection = 'LEFT'; break;
      case 'ArrowRight': case 'd': case 'D': if (direction !== 'LEFT') newDirection = 'RIGHT'; break;
    }
    setDirection(newDirection);
  }, [direction, gameOver, gameStarted, isPaused, togglePause, resetGame, startGame]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!touchStartPos.current) return;

    const deltaX = e.changedTouches[0].clientX - touchStartPos.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartPos.current.y;
    const minSwipeDistance = 30; // Minimum distance for a swipe

    // Check if this is a tap (small movement)
    if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) {
      // Handle tap
      if (!gameStarted && !gameOver) {
        startGame();
      } else if (gameOver) {
        resetGame();
      } else if (gameStarted) {
        togglePause();
      }
      touchStartPos.current = null;
      return;
    }

    // Handle swipe for direction change
    if (gameStarted && !gameOver && !isPaused) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (deltaX > minSwipeDistance && direction !== 'LEFT') {
          setDirection('RIGHT');
        } else if (deltaX < -minSwipeDistance && direction !== 'RIGHT') {
          setDirection('LEFT');
        }
      } else {
        // Vertical swipe
        if (deltaY > minSwipeDistance && direction !== 'UP') {
          setDirection('DOWN');
        } else if (deltaY < -minSwipeDistance && direction !== 'DOWN') {
          setDirection('UP');
        }
      }
    }
    
    touchStartPos.current = null;
  }, [direction, gameStarted, gameOver, isPaused, startGame, resetGame, togglePause]);

  const handleBoardClick = useCallback(() => {
    if (!gameStarted && !gameOver) {
      startGame();
    } else if (gameOver) {
      resetGame();
    }
  }, [gameStarted, gameOver, startGame, resetGame]);

  useEffect(() => {
    const gameInterval = setInterval(moveSnake, gameSpeed);
    return () => clearInterval(gameInterval);
  }, [moveSnake, gameSpeed]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Auto-start for mobile devices to avoid space bar requirement
  useEffect(() => {
    if (isMobile && !gameStarted && !gameOver) {
      // Add a small delay to prevent immediate auto-start
      const timer = setTimeout(() => {
        if (!gameStarted && !gameOver) {
          setGameStarted(true);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isMobile, gameStarted, gameOver]);

  const renderCell = useCallback((x: number, y: number) => {
    const isSnake = snake.some(segment => segment.x === x && segment.y === y);
    const isHead = snake[0]?.x === x && snake[0]?.y === y;
    const isFood = food.x === x && food.y === y;

    let className = 'cell';
    if (isSnake) className += isHead ? ' snake-head' : ' snake-body';
    if (isFood) className += ' food';

    return <div key={`${x}-${y}`} className={className}></div>;
  }, [snake, food]);

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

      <div 
        className="game-board"
        onClick={!gameStarted || gameOver ? handleBoardClick : undefined}
        style={{cursor: (!gameStarted || gameOver) ? 'pointer' : 'default'}}
      >
        {cells}
      </div>

      {!gameStarted && !gameOver && (
        <div className="game-message">
          <h2>Get Ready!</h2>
          {isMobile ? (
            <>
              <p>Swipe to move the snake.</p>
              <p>Tap to pause/resume.</p>
              <p>Game starts automatically...</p>
            </>
          ) : (
            <>
              <p>Use arrow keys, WASD, or swipe to move.</p>
              <p>Press SPACE to start!</p>
            </>
          )}
        </div>
      )}

      {isPaused && (
        <div className="game-message">
          <h2 style={{color: '#88ccff'}}>Paused</h2>
          {isMobile ? (
            <p>Tap to resume</p>
          ) : (
            <p>Press SPACE or P to resume</p>
          )}
        </div>
      )}

      {gameOver && (
        <div className="game-message">
          <h2>Game Over!</h2>
          <p>Final Score: {score}</p>
          {score > 0 && score === highScore && (
            <p className="new-high-score">🎉 New High Score! 🎉</p>
          )}
          {isMobile ? (
            <p>Tap to play again</p>
          ) : (
            <p>Press SPACE to play again</p>
          )}
        </div>
      )}

      <div className="controls">
        {isMobile ? (
          <>
            <p>Controls: Swipe to move</p>
            <p>Tap to pause/resume or restart</p>
          </>
        ) : (
          <>
            <p>Controls: Arrow keys / WASD / Swipe</p>
            <p>P or SPACE to pause/resume</p>
          </>
        )}
      </div>

      {/* Mobile Control Buttons */}
      {isMobile && gameStarted && !gameOver && (
        <div className="mobile-controls">
          <button 
            className="mobile-control-btn"
            onClick={togglePause}
          >
            {isPaused ? '▶️ Resume' : '⏸️ Pause'}
          </button>
        </div>
      )}
    </div>
  );
};

export default SnakeGame;