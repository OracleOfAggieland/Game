// src/components/Game/SnakeGame.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import './SnakeGame.css';

interface Position {
  x: number;
  y: number;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

const BOARD_SIZE = 20;
const INITIAL_SNAKE: Position[] = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION: Direction = 'RIGHT';
const INITIAL_SPEED = 180;
const MIN_SPEED = 60;
const SPEED_INCREMENT = 8;
const SCORE_THRESHOLD = 50;
const MIN_DIRECTION_CHANGE_INTERVAL = 50; // Minimum ms between direction changes

const SnakeGame: React.FC = () => {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [, setDirection] = useState<Direction>(INITIAL_DIRECTION);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameSpeed, setGameSpeed] = useState(INITIAL_SPEED);
  const [isMobile, setIsMobile] = useState(false);
  
  // Refs for performance optimization
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const directionQueue = useRef<Direction[]>([]);
  const lastMoveTime = useRef<number>(0);
  const lastDirection = useRef<Direction>(INITIAL_DIRECTION);
  const lastDirectionChange = useRef<number>(0);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);


  const generateFood = useCallback((currentSnake: Position[]): Position => {
    const occupiedCells = new Set(currentSnake.map(pos => `${pos.x},${pos.y}`));
    let newFood: Position;
    let attempts = 0;

    do {
      newFood = {
        x: Math.floor(Math.random() * BOARD_SIZE),
        y: Math.floor(Math.random() * BOARD_SIZE),
      };
      attempts++;
    } while (occupiedCells.has(`${newFood.x},${newFood.y}`) && attempts < 100);

    return newFood;
  }, []);

  // Initialize food position
  useEffect(() => {
    setFood(generateFood(INITIAL_SNAKE));
  }, [generateFood]);

  const calculateSpeed = useCallback((currentScore: number): number => {
    const speedReduction = Math.floor(currentScore / SCORE_THRESHOLD) * SPEED_INCREMENT;
    return Math.max(MIN_SPEED, INITIAL_SPEED - speedReduction);
  }, []);
  
  // Update game speed based on score
  useEffect(() => {
    setGameSpeed(calculateSpeed(score));
  }, [score, calculateSpeed]);

  // Helper function to check if direction change is valid
  const isValidDirectionChange = useCallback((currentDir: Direction, newDir: Direction): boolean => {
    const opposites: { [key in Direction]: Direction } = {
      'UP': 'DOWN',
      'DOWN': 'UP',
      'LEFT': 'RIGHT',
      'RIGHT': 'LEFT'
    };
    return opposites[currentDir] !== newDir;
  }, []);

  // Optimized direction queue processing with timing control
  const processDirectionQueue = useCallback(() => {
    const now = performance.now();
    if (directionQueue.current.length > 0 && now - lastDirectionChange.current > MIN_DIRECTION_CHANGE_INTERVAL) {
      const nextDirection = directionQueue.current.shift()!;
      
      if (isValidDirectionChange(lastDirection.current, nextDirection)) {
        setDirection(nextDirection);
        lastDirection.current = nextDirection;
        lastDirectionChange.current = now;
      }
    }
  }, [isValidDirectionChange]);

  const moveSnake = useCallback(() => {
    if (gameOver || !gameStarted || isPaused) return;

    const now = performance.now();
    if (now - lastMoveTime.current < gameSpeed) return;
    
    lastMoveTime.current = now;
    processDirectionQueue();

    setSnake(currentSnake => {
      const newSnake = [...currentSnake];
      const head = { ...newSnake[0] };

      // Calculate new head position based on current direction
      switch (lastDirection.current) {
        case 'UP': head.y -= 1; break;
        case 'DOWN': head.y += 1; break;
        case 'LEFT': head.x -= 1; break;
        case 'RIGHT': head.x += 1; break;
      }

      // Check wall collisions
      if (head.x < 0 || head.x >= BOARD_SIZE || head.y < 0 || head.y >= BOARD_SIZE) {
        setGameOver(true);
        return currentSnake;
      }

      // Check self collision
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
  }, [food.x, food.y, gameOver, gameStarted, isPaused, generateFood, gameSpeed, processDirectionQueue]);

  const resetGame = useCallback(() => {
    setSnake(INITIAL_SNAKE);
    setFood(generateFood(INITIAL_SNAKE));
    setDirection(INITIAL_DIRECTION);
    lastDirection.current = INITIAL_DIRECTION;
    setGameOver(false);
    setScore(0);
    setGameSpeed(INITIAL_SPEED);
    setIsPaused(false);
    setGameStarted(true);
    directionQueue.current = [];
    lastMoveTime.current = performance.now();
    lastDirectionChange.current = 0;
  }, [generateFood]);

  const startGame = useCallback(() => {
    if (!gameStarted && !gameOver) {
      setGameStarted(true);
      lastMoveTime.current = performance.now();
    } else if (gameOver) {
      resetGame();
    }
  }, [gameStarted, gameOver, resetGame]);

  const togglePause = useCallback(() => {
    if (gameStarted && !gameOver) {
      setIsPaused(prev => {
        if (!prev) {
          // Pausing - reset move timer
          lastMoveTime.current = 0;
        } else {
          // Unpausing - reset move timer to current time
          lastMoveTime.current = performance.now();
        }
        return !prev;
      });
    }
  }, [gameStarted, gameOver]);

  // Optimized direction handling with queue
  const queueDirection = useCallback((newDirection: Direction) => {
    if (gameStarted && !gameOver && !isPaused) {
      // Get the most recent direction (either from queue or current direction)
      const currentEffectiveDirection = directionQueue.current.length > 0 
        ? directionQueue.current[directionQueue.current.length - 1] 
        : lastDirection.current;
      
      // Only allow valid direction changes
      if (isValidDirectionChange(currentEffectiveDirection, newDirection)) {
        // Only add to queue if it's different from the last queued direction
        if (directionQueue.current.length === 0 || 
            directionQueue.current[directionQueue.current.length - 1] !== newDirection) {
          // Limit queue size to prevent lag
          if (directionQueue.current.length < 2) {
            directionQueue.current.push(newDirection);
          }
        }
      }
    }
  }, [gameStarted, gameOver, isPaused, isValidDirectionChange]);

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

    // Queue direction changes instead of setting immediately
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': queueDirection('UP'); break;
      case 'ArrowDown': case 's': case 'S': queueDirection('DOWN'); break;
      case 'ArrowLeft': case 'a': case 'A': queueDirection('LEFT'); break;
      case 'ArrowRight': case 'd': case 'D': queueDirection('RIGHT'); break;
    }
  }, [gameOver, gameStarted, isPaused, togglePause, resetGame, startGame, queueDirection]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!touchStartPos.current) return;

    const deltaX = e.changedTouches[0].clientX - touchStartPos.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartPos.current.y;
    const minSwipeDistance = 30;

    // Check if this is a tap (small movement)
    if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) {
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
        if (deltaX > minSwipeDistance) {
          queueDirection('RIGHT');
        } else if (deltaX < -minSwipeDistance) {
          queueDirection('LEFT');
        }
      } else {
        // Vertical swipe
        if (deltaY > minSwipeDistance) {
          queueDirection('DOWN');
        } else if (deltaY < -minSwipeDistance) {
          queueDirection('UP');
        }
      }
    }
    
    touchStartPos.current = null;
  }, [gameStarted, gameOver, isPaused, startGame, resetGame, togglePause, queueDirection]);

  const handleBoardClick = useCallback(() => {
    if (!gameStarted && !gameOver) {
      startGame();
    } else if (gameOver) {
      resetGame();
    }
  }, [gameStarted, gameOver, startGame, resetGame]);

  // High-performance game loop using requestAnimationFrame
  const gameLoop = useCallback(() => {
    if (gameStarted && !gameOver && !isPaused) {
      moveSnake();
    }
    if (gameStarted && !gameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gameStarted, gameOver, isPaused, moveSnake]);

  useEffect(() => {
    if (gameStarted && !gameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameStarted, gameOver, gameLoop]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Auto-start for mobile devices
  useEffect(() => {
    if (isMobile && !gameStarted && !gameOver) {
      const timer = setTimeout(() => {
        if (!gameStarted && !gameOver) {
          setGameStarted(true);
          lastMoveTime.current = performance.now();
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isMobile, gameStarted, gameOver]);

  // Memoized board cells for better performance
  const boardCells = useMemo(() => {
    const cells = [];
    const snakePositions = new Set(snake.map(pos => `${pos.x},${pos.y}`));
    const headPosition = snake.length > 0 ? `${snake[0].x},${snake[0].y}` : '';
    const foodPosition = `${food.x},${food.y}`;
    
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      const x = i % BOARD_SIZE;
      const y = Math.floor(i / BOARD_SIZE);
      const posKey = `${x},${y}`;
      
      let className = 'cell';
      if (posKey === foodPosition) className += ' food';
      if (snakePositions.has(posKey)) {
        className += posKey === headPosition ? ' snake-head' : ' snake-body';
      }

      cells.push(<div key={i} className={className}></div>);
    }
    return cells;
  }, [snake, food]);
  
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
        </div>
      </div>

      <div 
        className="game-board"
        onClick={!gameStarted || gameOver ? handleBoardClick : undefined}
        style={{cursor: (!gameStarted || gameOver) ? 'pointer' : 'default'}}
      >
        {boardCells}
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