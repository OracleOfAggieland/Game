// src/components/Game/SnakeGameLevel2.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Position, Direction, Obstacle } from '../../types/GameTypes';
import { 
  generateObstacles, 
  isPositionOccupied, 
  getRandomPosition, 
  isReachable,
  isDeadEnd,
  positionEquals
} from '../../utils/GameUtils';
import './SnakeGame.css';

const BOARD_SIZE = 20;
const INITIAL_SNAKE: Position[] = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION: Direction = 'RIGHT';
const INITIAL_SPEED = 200;
const MIN_SPEED = 80;
const SPEED_INCREMENT = 10;
const SCORE_THRESHOLD = 50;

const SnakeGameLevel2: React.FC = () => {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [, setDirection] = useState<Direction>(INITIAL_DIRECTION);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameSpeed, setGameSpeed] = useState(INITIAL_SPEED);
  const [isMobile, setIsMobile] = useState(false);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  
  // Refs for performance optimization
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const directionQueue = useRef<Direction[]>([]);
  const lastMoveTime = useRef<number>(0);
  const lastDirection = useRef<Direction>(INITIAL_DIRECTION);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load high score from localStorage
  useEffect(() => {
    const savedHighScore = localStorage.getItem('snakeHighScoreLevel2');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }
  }, []);

  // Save high score to localStorage
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snakeHighScoreLevel2', score.toString());
    }
  }, [score, highScore]);

  // Generate obstacles when game starts
  useEffect(() => {
    if (gameStarted && obstacles.length === 0) {
      setObstacles(generateObstacles(BOARD_SIZE, difficulty));
    }
  }, [gameStarted, obstacles.length, difficulty]);

  // Smart food generation that avoids dead ends
  const generateSmartFood = useCallback((currentSnake: Position[], currentObstacles: Obstacle[]): Position => {
    const allObstaclePositions = currentObstacles.flatMap(obs => obs.positions);
    let attempts = 0;
    let newFood: Position;
    
    do {
      newFood = getRandomPosition(BOARD_SIZE);
      attempts++;
      
      // Check if position is occupied
      if (isPositionOccupied(newFood, currentSnake, allObstaclePositions)) {
        continue;
      }
      
      // Check if position is in a dead end
      if (isDeadEnd(newFood, allObstaclePositions, BOARD_SIZE)) {
        continue;
      }
      
      // Check if position is reachable from snake head
      if (currentSnake.length > 0 && !isReachable(currentSnake[0], newFood, allObstaclePositions, BOARD_SIZE)) {
        continue;
      }
      
      // If we've tried many times, just find any valid position
      if (attempts > 100) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          for (let y = 0; y < BOARD_SIZE; y++) {
            const pos = { x, y };
            if (!isPositionOccupied(pos, currentSnake, allObstaclePositions) &&
                isReachable(currentSnake[0], pos, allObstaclePositions, BOARD_SIZE)) {
              return pos;
            }
          }
        }
      }
      
      break;
    } while (attempts < 200);

    return newFood;
  }, []);

  // Initialize food position
  useEffect(() => {
    if (obstacles.length > 0) {
      setFood(generateSmartFood(INITIAL_SNAKE, obstacles));
    }
  }, [obstacles, generateSmartFood]);

  const calculateSpeed = useCallback((currentScore: number): number => {
    const speedReduction = Math.floor(currentScore / SCORE_THRESHOLD) * SPEED_INCREMENT;
    return Math.max(MIN_SPEED, INITIAL_SPEED - speedReduction);
  }, []);
  
  useEffect(() => {
    setGameSpeed(calculateSpeed(score));
  }, [score, calculateSpeed]);

  const isValidDirectionChange = useCallback((currentDir: Direction, newDir: Direction): boolean => {
    const opposites: { [key in Direction]: Direction } = {
      'UP': 'DOWN',
      'DOWN': 'UP',
      'LEFT': 'RIGHT',
      'RIGHT': 'LEFT'
    };
    return opposites[currentDir] !== newDir;
  }, []);

  const processDirectionQueue = useCallback(() => {
    if (directionQueue.current.length > 0) {
      const nextDirection = directionQueue.current.shift()!;
      
      if (isValidDirectionChange(lastDirection.current, nextDirection)) {
        setDirection(nextDirection);
        lastDirection.current = nextDirection;
      }
    }
  }, [isValidDirectionChange]);

  const moveSnake = useCallback(() => {
    if (gameOver || !gameStarted || isPaused || obstacles.length === 0) return;

    const now = performance.now();
    if (now - lastMoveTime.current < gameSpeed) return;
    
    lastMoveTime.current = now;
    processDirectionQueue();

    setSnake(currentSnake => {
      const newSnake = [...currentSnake];
      const head = { ...newSnake[0] };

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

      // Check obstacle collisions
      const allObstaclePositions = obstacles.flatMap(obs => obs.positions);
      if (allObstaclePositions.some(pos => positionEquals(pos, head))) {
        setGameOver(true);
        return currentSnake;
      }

      // Check self collision
      if (currentSnake.some(segment => positionEquals(segment, head))) {
        setGameOver(true);
        return currentSnake;
      }

      newSnake.unshift(head);

      // Check food collision
      if (positionEquals(head, food)) {
        const points = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 15 : 20;
        setScore(prev => prev + points);
        setFood(generateSmartFood(newSnake, obstacles));
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [food, gameOver, gameStarted, isPaused, generateSmartFood, gameSpeed, processDirectionQueue, obstacles, difficulty]);

  const resetGame = useCallback(() => {
    setSnake(INITIAL_SNAKE);
    setObstacles([]);
    setDirection(INITIAL_DIRECTION);
    lastDirection.current = INITIAL_DIRECTION;
    setGameOver(false);
    setScore(0);
    setGameSpeed(INITIAL_SPEED);
    setIsPaused(false);
    setGameStarted(true);
    directionQueue.current = [];
    lastMoveTime.current = performance.now();
  }, []);

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
      setIsPaused(prev => !prev);
    }
  }, [gameStarted, gameOver]);

  const queueDirection = useCallback((newDirection: Direction) => {
    if (gameStarted && !gameOver && !isPaused) {
      const currentEffectiveDirection = directionQueue.current.length > 0 
        ? directionQueue.current[directionQueue.current.length - 1] 
        : lastDirection.current;
      
      if (isValidDirectionChange(currentEffectiveDirection, newDirection)) {
        if (directionQueue.current.length === 0 || 
            directionQueue.current[directionQueue.current.length - 1] !== newDirection) {
          if (directionQueue.current.length < 2) {
            directionQueue.current.push(newDirection);
          }
        }
      }
    }
  }, [gameStarted, gameOver, isPaused, isValidDirectionChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
      e.preventDefault();
    }

    // Difficulty selection before game starts
    if (!gameStarted && !gameOver) {
      if (e.key === '1') {
        setDifficulty('easy');
        return;
      } else if (e.key === '2') {
        setDifficulty('medium');
        return;
      } else if (e.key === '3') {
        setDifficulty('hard');
        return;
      }
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

    if (gameStarted && !gameOver && !isPaused) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > minSwipeDistance) {
          queueDirection('RIGHT');
        } else if (deltaX < -minSwipeDistance) {
          queueDirection('LEFT');
        }
      } else {
        if (deltaY > minSwipeDistance) {
          queueDirection('DOWN');
        } else if (deltaY < -minSwipeDistance) {
          queueDirection('UP');
        }
      }
    }
    
    touchStartPos.current = null;
  }, [gameStarted, gameOver, isPaused, startGame, resetGame, togglePause, queueDirection]);

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

  const boardCells = useMemo(() => {
    const cells = [];
    const snakePositions = new Set(snake.map(pos => `${pos.x},${pos.y}`));
    const headPosition = snake.length > 0 ? `${snake[0].x},${snake[0].y}` : '';
    const foodPosition = `${food.x},${food.y}`;
    const obstaclePositions = new Set(obstacles.flatMap(obs => obs.positions).map(pos => `${pos.x},${pos.y}`));
    
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      const x = i % BOARD_SIZE;
      const y = Math.floor(i / BOARD_SIZE);
      const posKey = `${x},${y}`;
      
      let className = 'cell';
      let style: React.CSSProperties = {};
      
      if (obstaclePositions.has(posKey)) {
        className += ' obstacle';
        const obstacle = obstacles.find(obs => obs.positions.some(p => `${p.x},${p.y}` === posKey));
        if (obstacle?.type === 'wall') {
          style.backgroundColor = '#666';
          style.border = '1px solid #888';
        } else {
          style.backgroundColor = '#8B4513';
          style.border = '1px solid #A0522D';
        }
      } else if (posKey === foodPosition) {
        className += ' food';
      } else if (snakePositions.has(posKey)) {
        className += posKey === headPosition ? ' snake-head' : ' snake-body';
      }

      cells.push(<div key={i} className={className} style={style}></div>);
    }
    return cells;
  }, [snake, food, obstacles]);
  
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
        <h1>Level 2: Obstacles</h1>
        <div className="score-container">
          <div className="score">Score: {score}</div>
          <div className="high-score">High Score: {highScore}</div>
          {gameStarted && !gameOver && (
            <div className="game-stats">
              <div className="length">Length: {snake.length}</div>
              <div className="speed">Difficulty: {difficulty}</div>
            </div>
          )}
        </div>
      </div>

      <div className="game-board">
        {boardCells}
      </div>

      {!gameStarted && !gameOver && (
        <div className="game-message">
          <h2>Level 2: Obstacles</h2>
          <p>Navigate through the maze!</p>
          <p style={{marginTop: '15px', fontWeight: 'bold'}}>Choose Difficulty:</p>
          <p>Press 1: Easy | 2: Medium | 3: Hard</p>
          <p style={{color: difficulty === 'easy' ? '#00ff88' : difficulty === 'medium' ? '#ffaa00' : '#ff4444'}}>
            Current: {difficulty.toUpperCase()}
          </p>
          <p style={{marginTop: '15px'}}>Press SPACE to start!</p>
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

export default SnakeGameLevel2;