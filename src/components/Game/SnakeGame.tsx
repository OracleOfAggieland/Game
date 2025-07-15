// src/components/Game/SnakeGame.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './SnakeGame.css';

interface Position {
  x: number;
  y: number;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface TouchStartPos {
  x: number;
  y: number;
}

const BOARD_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION: Direction = 'RIGHT';
const INITIAL_SPEED = 200;
const MIN_SPEED = 80;
const SPEED_INCREMENT = 5;
const SCORE_THRESHOLD = 50; // Increase speed every 50 points

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
  const touchStartRef = useRef<TouchStartPos | null>(null);

  // Load high score from localStorage on component mount
  useEffect(() => {
    const savedHighScore = localStorage.getItem('snakeHighScore');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }
  }, []);

  // Save high score to localStorage when it changes
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snakeHighScore', score.toString());
    }
  }, [score, highScore]);

  // Manage body class for preventing scroll
  useEffect(() => {
    if (gameStarted && !gameOver) {
      document.body.classList.add('game-active');
    } else {
      document.body.classList.remove('game-active');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('game-active');
    };
  }, [gameStarted, gameOver]);

  // Generate random food position that doesn't overlap with snake
  const generateFood = useCallback((currentSnake: Position[]) => {
    let newFood: Position;
    let attempts = 0;
    const maxAttempts = BOARD_SIZE * BOARD_SIZE;

    do {
      newFood = {
        x: Math.floor(Math.random() * BOARD_SIZE),
        y: Math.floor(Math.random() * BOARD_SIZE)
      };
      attempts++;
    } while (
      attempts < maxAttempts &&
      currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y)
    );

    return newFood;
  }, []);

  // Initialize food position that doesn't overlap with initial snake
  useEffect(() => {
    setFood(generateFood(INITIAL_SNAKE));
  }, [generateFood]);

  // Calculate game speed based on score
  const calculateSpeed = useCallback((currentScore: number) => {
    const speedReduction = Math.floor(currentScore / SCORE_THRESHOLD) * SPEED_INCREMENT;
    return Math.max(MIN_SPEED, INITIAL_SPEED - speedReduction);
  }, []);

  // Update game speed when score changes
  useEffect(() => {
    setGameSpeed(calculateSpeed(score));
  }, [score, calculateSpeed]);

  // Check collision with walls or self
  const checkCollision = (head: Position, snakeBody: Position[]) => {
    // Wall collision
    if (head.x < 0 || head.x >= BOARD_SIZE || head.y < 0 || head.y >= BOARD_SIZE) {
      return true;
    }
    
    // Self collision
    for (const segment of snakeBody) {
      if (head.x === segment.x && head.y === segment.y) {
        return true;
      }
    }
    
    return false;
  };

  // Move snake
  const moveSnake = useCallback(() => {
    if (gameOver || !gameStarted || isPaused) return;

    setSnake(currentSnake => {
      const newSnake = [...currentSnake];
      const head = { ...newSnake[0] };

      // Move head based on direction
      switch (direction) {
        case 'UP':
          head.y -= 1;
          break;
        case 'DOWN':
          head.y += 1;
          break;
        case 'LEFT':
          head.x -= 1;
          break;
        case 'RIGHT':
          head.x += 1;
          break;
      }

      // Check collision
      if (checkCollision(head, newSnake)) {
        setGameOver(true);
        return currentSnake;
      }

      newSnake.unshift(head);

      // Check if food is eaten
      if (head.x === food.x && head.y === food.y) {
        setScore(prev => prev + 10);
        setFood(generateFood(newSnake));
      } else {
        newSnake.pop(); // Remove tail if no food eaten
      }

      return newSnake;
    });
  }, [direction, food, gameOver, gameStarted, isPaused, generateFood]);

  // Reset game
  const resetGame = useCallback(() => {
    setSnake(INITIAL_SNAKE);
    setFood(generateFood(INITIAL_SNAKE));
    setDirection(INITIAL_DIRECTION);
    setGameOver(false);
    setScore(0);
    setGameSpeed(INITIAL_SPEED);
    setIsPaused(false);
  }, [generateFood]);

  // Toggle pause
  const togglePause = useCallback(() => {
    if (gameStarted && !gameOver) {
      setIsPaused(prev => !prev);
    }
  }, [gameStarted, gameOver]);

  // Handle keyboard input
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    // Prevent default behavior for arrow keys and space to stop page scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyP'].includes(e.code)) {
      e.preventDefault();
    }

    // Handle pause/resume
    if (e.code === 'KeyP') {
      togglePause();
      return;
    }

    if (!gameStarted) {
      if (e.code === 'Space') {
        setGameStarted(true);
      }
      return;
    }

    if (gameOver) {
      if (e.code === 'Space') {
        resetGame();
        setGameStarted(true);
      }
      return;
    }

    if (isPaused) {
      if (e.code === 'Space') {
        setIsPaused(false);
      }
      return;
    }

    // Handle movement
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        if (direction !== 'DOWN') setDirection('UP');
        break;
      case 'ArrowDown':
      case 'KeyS':
        if (direction !== 'UP') setDirection('DOWN');
        break;
      case 'ArrowLeft':
      case 'KeyA':
        if (direction !== 'RIGHT') setDirection('LEFT');
        break;
      case 'ArrowRight':
      case 'KeyD':
        if (direction !== 'LEFT') setDirection('RIGHT');
        break;
      case 'Space':
        setIsPaused(true);
        break;
    }
  }, [direction, gameOver, gameStarted, isPaused, togglePause, resetGame]);

  // Touch controls
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY
    };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    if (!gameStarted || gameOver || isPaused) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const minSwipeDistance = 30;

    // Determine swipe direction
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      if (Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0 && direction !== 'LEFT') {
          setDirection('RIGHT');
        } else if (deltaX < 0 && direction !== 'RIGHT') {
          setDirection('LEFT');
        }
      }
    } else {
      // Vertical swipe
      if (Math.abs(deltaY) > minSwipeDistance) {
        if (deltaY > 0 && direction !== 'UP') {
          setDirection('DOWN');
        } else if (deltaY < 0 && direction !== 'DOWN') {
          setDirection('UP');
        }
      }
    }

    touchStartRef.current = null;
  }, [direction, gameStarted, gameOver, isPaused]);

  // Game loop
  useEffect(() => {
    const gameInterval = setInterval(moveSnake, gameSpeed);
    return () => clearInterval(gameInterval);
  }, [moveSnake, gameSpeed]);

  // Keyboard event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Render cell
  const renderCell = (x: number, y: number) => {
    const isSnake = snake.some(segment => segment.x === x && segment.y === y);
    const isHead = snake[0]?.x === x && snake[0]?.y === y;
    const isFood = food.x === x && food.y === y;

    let className = 'cell';
    if (isSnake) className += isHead ? ' snake-head' : ' snake-body';
    if (isFood) className += ' food';

    return <div key={`${x}-${y}`} className={className}></div>;
  };

  // Create game board
  const createBoard = () => {
    const board = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        board.push(renderCell(x, y));
      }
    }
    return board;
  };

  return (
    <div 
      className="snake-game" 
      ref={gameContainerRef}
      tabIndex={0}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="game-info">
        <h1>Snake Game</h1>
        <div className="score-container">
          <div className="score">Score: {score}</div>
          <div className="high-score">High Score: {highScore}</div>
          {gameStarted && !gameOver && (
            <div className="game-stats">
              <div className="speed">Speed: {Math.round((INITIAL_SPEED - gameSpeed + SPEED_INCREMENT) / SPEED_INCREMENT)}</div>
              <div className="length">Length: {snake.length}</div>
            </div>
          )}
        </div>
      </div>
      
      <div className="game-board">
        {createBoard()}
      </div>

      {!gameStarted && !gameOver && (
        <div className="game-message">
          <p>Press SPACE to start!</p>
          <p>Use arrow keys, WASD, or swipe to move</p>
          <p>Press P to pause during game</p>
        </div>
      )}

      {isPaused && gameStarted && !gameOver && (
        <div className="game-message">
          <h2>Paused</h2>
          <p>Press SPACE or P to resume</p>
        </div>
      )}

      {gameOver && (
        <div className="game-message">
          <h2>Game Over!</h2>
          <p>Final Score: {score}</p>
          {score === highScore && score > 0 && (
            <p className="new-high-score">🎉 New High Score! 🎉</p>
          )}
          <p>Press SPACE to play again</p>
        </div>
      )}

      <div className="controls">
        <p>Controls: Arrow keys, WASD, or swipe to move</p>
        <p>P to pause • SPACE to pause/resume</p>
        {gameStarted && !gameOver && !isPaused && (
          <p className="speed-indicator">
            Next speed increase at {Math.ceil(score / SCORE_THRESHOLD) * SCORE_THRESHOLD} points
          </p>
        )}
      </div>
    </div>
  );
};

export default SnakeGame;