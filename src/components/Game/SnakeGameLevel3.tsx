// src/components/Game/SnakeGameLevel3.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Position, 
  Direction, 
  PowerUp, 
  ActivePowerUp, 
  BotSnake, 
  POWER_UP_CONFIG, 
  PowerUpType 
} from '../../types/GameTypes';
import {
  isPositionOccupied,
  getRandomPosition,
  findPath,
  moveInDirection,
  positionEquals,
  floodFillArea
} from '../../utils/GameUtils';
import './SnakeGame.css';

const BOARD_SIZE = 20;
const INITIAL_SNAKE: Position[] = [{ x: 5, y: 10 }];
const INITIAL_BOT_SNAKE: Position[] = [{ x: 15, y: 10 }];
const INITIAL_DIRECTION: Direction = 'RIGHT';
const GAME_SPEED = 150;
const POWERUP_SPAWN_INTERVAL = 8000;
const MAX_POWERUPS = 3;

const isOnPowerUp = (pos: Position, list: PowerUp[]): boolean =>
  list.some(pu => positionEquals(pu.position, pos));

const SnakeGameLevel3: React.FC = () => {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [botSnake, setBotSnake] = useState<BotSnake>({
    id: 'bot1',
    positions: INITIAL_BOT_SNAKE,
    direction: 'LEFT',
    color: '#ff4444',
    name: 'Bot Snake',
    score: 0
  });
  const [food, setFood] = useState<Position>({ x: 10, y: 10 });
  const [, setDirection] = useState<Direction>(INITIAL_DIRECTION);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<'player' | 'bot' | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [activePowerUps, setActivePowerUps] = useState<ActivePowerUp[]>([]);
  const [botActivePowerUps, setBotActivePowerUps] = useState<ActivePowerUp[]>([]);
  
  // Refs
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const directionQueue = useRef<Direction[]>([]);
  const lastMoveTime = useRef<number>(0);
  const lastDirection = useRef<Direction>(INITIAL_DIRECTION);
  const lastPowerUpSpawn = useRef<number>(0);
  const lastBotDecisionTime = useRef<number>(0);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load high score
  useEffect(() => {
    const savedHighScore = localStorage.getItem('snakeHighScoreLevel3');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }
  }, []);

  // Save high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snakeHighScoreLevel3', score.toString());
    }
  }, [score, highScore]);

  // Generate food avoiding all snakes
  const generateFood = useCallback((currentSnake: Position[], currentBotSnake: Position[]): Position => {
    let attempts = 0;
    let newFood: Position;
    
    do {
      newFood = getRandomPosition(BOARD_SIZE);
      attempts++;
    } while (
      (isPositionOccupied(newFood, currentSnake, []) ||
       isPositionOccupied(newFood, currentBotSnake, []) ||
       isOnPowerUp(newFood, powerUps)) &&
      attempts < 100
    );

    return newFood;
  }, [powerUps]);

  // Initialize food position
  useEffect(() => {
    setFood(generateFood(INITIAL_SNAKE, INITIAL_BOT_SNAKE));
  }, [generateFood]);

  // Spawn power-ups
  const spawnPowerUp = useCallback(() => {
    if (powerUps.length >= MAX_POWERUPS) return;

    const types: PowerUpType[] = ['SPEED_BOOST', 'INVINCIBILITY', 'DOUBLE_POINTS', 'SLOW_MOTION', 'GHOST_MODE'];
    const type = types[Math.floor(Math.random() * types.length)];
    const config = POWER_UP_CONFIG[type];
    
    let position: Position;
    let attempts = 0;
    
    do {
      position = getRandomPosition(BOARD_SIZE);
      attempts++;
    } while (
      (isPositionOccupied(position, snake, []) ||
       isPositionOccupied(position, botSnake.positions, []) ||
       positionEquals(position, food) ||
       isOnPowerUp(position, powerUps)) &&
      attempts < 100
    );

    if (attempts < 100) {
      const newPowerUp: PowerUp = {
        id: `pu-${Date.now()}-${Math.random()}`,
        type,
        position,
        duration: config.duration,
        color: config.color,
        icon: config.icon
      };
      
      setPowerUps(prev => [...prev, newPowerUp]);
    }
  }, [powerUps, snake, botSnake.positions, food]);

  // Update active power-ups
  const updateActivePowerUps = useCallback(() => {
    const now = Date.now();
    
    setActivePowerUps(prev => prev.filter(pu => now - pu.startTime < pu.duration));
    setBotActivePowerUps(prev => prev.filter(pu => now - pu.startTime < pu.duration));
  }, []);

  // Get current speed based on power-ups
  const getCurrentSpeed = useCallback((powerUps: ActivePowerUp[]): number => {
    let speed = GAME_SPEED;
    
    if (powerUps.some(pu => pu.type === 'SPEED_BOOST')) {
      speed /= 2; // Faster
    }
    if (powerUps.some(pu => pu.type === 'SLOW_MOTION')) {
      speed *= 2; // Slower
    }
    
    return speed;
  }, []);

  // Check if snake has invincibility
  const hasInvincibility = useCallback((powerUps: ActivePowerUp[]): boolean => {
    return powerUps.some(pu => pu.type === 'INVINCIBILITY');
  }, []);

  // Check if snake has ghost mode
  const hasGhostMode = useCallback((powerUps: ActivePowerUp[]): boolean => {
    return powerUps.some(pu => pu.type === 'GHOST_MODE');
  }, []);

  // Get score multiplier
  const getScoreMultiplier = useCallback((powerUps: ActivePowerUp[]): number => {
    return powerUps.some(pu => pu.type === 'DOUBLE_POINTS') ? 2 : 1;
  }, []);

  // Bot AI decision making
  const getBotDirection = useCallback((bot: BotSnake, playerSnake: Position[]): Direction => {
    const head = bot.positions[0];
    const currentDir = bot.direction;

    // Determine potential targets: food and power-ups with simple prioritisation
    let targets: { pos: Position; priority: number }[] = [{ pos: food, priority: 1 }];
    powerUps.forEach(pu => {
      let priority = 2;
      if (pu.type === 'INVINCIBILITY' || pu.type === 'SPEED_BOOST') priority = 0;
      targets.push({ pos: pu.position, priority });
    });

    targets.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const distA = Math.abs(head.x - a.pos.x) + Math.abs(head.y - a.pos.y);
      const distB = Math.abs(head.x - b.pos.x) + Math.abs(head.y - b.pos.y);
      return distA - distB;
    });

    const target = targets[0].pos;
    const occupied = [...playerSnake, ...bot.positions.slice(1)];
    const path = findPath(head, target, [], BOARD_SIZE, occupied);

    const candidateDirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    let bestDir = currentDir;
    let bestScore = -Infinity;

    candidateDirs.forEach(dir => {
      if (dir === getOppositeDirection(currentDir) && bot.positions.length > 1) return;
      const nextPos = moveInDirection(head, dir);

      // wall check
      if (nextPos.x < 0 || nextPos.x >= BOARD_SIZE || nextPos.y < 0 || nextPos.y >= BOARD_SIZE) return;

      if (!hasInvincibility(botActivePowerUps) && !hasGhostMode(botActivePowerUps)) {
        if (occupied.some(p => positionEquals(p, nextPos))) return;
      }

      const area = floodFillArea(nextPos, occupied, BOARD_SIZE);
      const distance = Math.abs(nextPos.x - target.x) + Math.abs(nextPos.y - target.y);
      const followsPath = path.length > 1 && positionEquals(path[1], nextPos) ? 1 : 0;

      const score = area * 0.2 - distance + followsPath * 2;
      if (score > bestScore) {
        bestScore = score;
        bestDir = dir;
      }
    });

    return bestDir;
  }, [food, powerUps, botActivePowerUps, hasInvincibility, hasGhostMode]);

  const getOppositeDirection = (dir: Direction): Direction => {
    const opposites: { [key in Direction]: Direction } = {
      'UP': 'DOWN',
      'DOWN': 'UP',
      'LEFT': 'RIGHT',
      'RIGHT': 'LEFT'
    };
    return opposites[dir];
  };

  const isValidDirectionChange = useCallback((currentDir: Direction, newDir: Direction): boolean => {
    return getOppositeDirection(currentDir) !== newDir;
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

  const moveSnakes = useCallback(() => {
    if (gameOver || !gameStarted || isPaused) return;

    const now = performance.now();
    const playerSpeed = getCurrentSpeed(activePowerUps);
    const botSpeed = getCurrentSpeed(botActivePowerUps);
    
    // Move player snake
    if (now - lastMoveTime.current >= playerSpeed) {
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
          if (!hasInvincibility(activePowerUps)) {
            setGameOver(true);
            setWinner('bot');
            return currentSnake;
          }
          // Wrap around if invincible
          head.x = (head.x + BOARD_SIZE) % BOARD_SIZE;
          head.y = (head.y + BOARD_SIZE) % BOARD_SIZE;
        }

        // Check collisions
        const selfCollision = currentSnake.some(segment => positionEquals(segment, head));
        const botCollision = !hasGhostMode(activePowerUps) && 
                           botSnake.positions.some(segment => positionEquals(segment, head));
        
        if ((selfCollision || botCollision) && !hasInvincibility(activePowerUps)) {
          setGameOver(true);
          setWinner('bot');
          return currentSnake;
        }

        newSnake.unshift(head);

        // Check food collision
        if (positionEquals(head, food)) {
          const points = 10 * getScoreMultiplier(activePowerUps);
          setScore(prev => prev + points);
          setFood(generateFood(newSnake, botSnake.positions));
        } else {
          newSnake.pop();
        }

        // Check power-up collision
        const collidedPowerUp = powerUps.find(pu => positionEquals(pu.position, head));
        if (collidedPowerUp) {
          const newActivePowerUp: ActivePowerUp = {
            type: collidedPowerUp.type,
            startTime: Date.now(),
            duration: collidedPowerUp.duration || 5000
          };
          setActivePowerUps(prev => [...prev, newActivePowerUp]);
          setPowerUps(prev => prev.filter(pu => pu.id !== collidedPowerUp.id));
        }

        return newSnake;
      });
    }

    // Move bot snake
    if (now - lastBotDecisionTime.current >= botSpeed) {
      lastBotDecisionTime.current = now;
      
      // Get bot decision
      const newDirection = getBotDirection(botSnake, snake);
      
      setBotSnake(currentBot => {
        const newBot = { ...currentBot };
        newBot.direction = newDirection;
        newBot.positions = [...currentBot.positions];
        const head = { ...newBot.positions[0] };

        switch (newDirection) {
          case 'UP': head.y -= 1; break;
          case 'DOWN': head.y += 1; break;
          case 'LEFT': head.x -= 1; break;
          case 'RIGHT': head.x += 1; break;
        }

        // Check wall collisions for bot
        if (head.x < 0 || head.x >= BOARD_SIZE || head.y < 0 || head.y >= BOARD_SIZE) {
          if (!hasInvincibility(botActivePowerUps)) {
            setGameOver(true);
            setWinner('player');
            return currentBot;
          }
          head.x = (head.x + BOARD_SIZE) % BOARD_SIZE;
          head.y = (head.y + BOARD_SIZE) % BOARD_SIZE;
        }

        // Check collisions for bot
        const selfCollision = currentBot.positions.some(segment => positionEquals(segment, head));
        const playerCollision = !hasGhostMode(botActivePowerUps) && 
                              snake.some(segment => positionEquals(segment, head));
        
        if ((selfCollision || playerCollision) && !hasInvincibility(botActivePowerUps)) {
          setGameOver(true);
          setWinner('player');
          return currentBot;
        }

        newBot.positions.unshift(head);

        // Check food collision for bot
        if (positionEquals(head, food)) {
          const points = 10 * getScoreMultiplier(botActivePowerUps);
          newBot.score += points;
          setFood(generateFood(snake, newBot.positions));
        } else {
          newBot.positions.pop();
        }

        // Check power-up collision for bot
        const collidedPowerUp = powerUps.find(pu => positionEquals(pu.position, head));
        if (collidedPowerUp) {
          const newActivePowerUp: ActivePowerUp = {
            type: collidedPowerUp.type,
            startTime: Date.now(),
            duration: collidedPowerUp.duration || 5000
          };
          setBotActivePowerUps(prev => [...prev, newActivePowerUp]);
          setPowerUps(prev => prev.filter(pu => pu.id !== collidedPowerUp.id));
        }

        return newBot;
      });
    }

    // Spawn power-ups
    if (now - lastPowerUpSpawn.current >= POWERUP_SPAWN_INTERVAL) {
      lastPowerUpSpawn.current = now;
      spawnPowerUp();
    }

    // Update active power-ups
    updateActivePowerUps();
  }, [
    gameOver, gameStarted, isPaused, snake, botSnake, food, powerUps,
    activePowerUps, botActivePowerUps, getCurrentSpeed, hasInvincibility,
    hasGhostMode, getScoreMultiplier, processDirectionQueue, generateFood,
    getBotDirection, spawnPowerUp, updateActivePowerUps
  ]);

  const resetGame = useCallback(() => {
    setSnake(INITIAL_SNAKE);
    setBotSnake({
      id: 'bot1',
      positions: INITIAL_BOT_SNAKE,
      direction: 'LEFT',
      color: '#ff4444',
      name: 'Bot Snake',
      score: 0
    });
    setFood(generateFood(INITIAL_SNAKE, INITIAL_BOT_SNAKE));
    setDirection(INITIAL_DIRECTION);
    lastDirection.current = INITIAL_DIRECTION;
    setGameOver(false);
    setWinner(null);
    setScore(0);
    setIsPaused(false);
    setGameStarted(true);
    setPowerUps([]);
    setActivePowerUps([]);
    setBotActivePowerUps([]);
    directionQueue.current = [];
    lastMoveTime.current = performance.now();
    lastBotDecisionTime.current = performance.now();
    lastPowerUpSpawn.current = performance.now();
  }, [generateFood]);

  const startGame = useCallback(() => {
    if (!gameStarted && !gameOver) {
      setGameStarted(true);
      lastMoveTime.current = performance.now();
      lastBotDecisionTime.current = performance.now();
      lastPowerUpSpawn.current = performance.now();
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
      moveSnakes();
    }
    if (gameStarted && !gameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gameStarted, gameOver, isPaused, moveSnakes]);

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
    const botPositions = new Set(botSnake.positions.map(pos => `${pos.x},${pos.y}`));
    const headPosition = snake.length > 0 ? `${snake[0].x},${snake[0].y}` : '';
    const botHeadPosition = botSnake.positions.length > 0 ? `${botSnake.positions[0].x},${botSnake.positions[0].y}` : '';
    const foodPosition = `${food.x},${food.y}`;
    
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      const x = i % BOARD_SIZE;
      const y = Math.floor(i / BOARD_SIZE);
      const posKey = `${x},${y}`;
      
      let className = 'cell';
      let style: React.CSSProperties = {};
      let content = null;
      
      // Check for power-ups
      const powerUp = powerUps.find(pu => `${pu.position.x},${pu.position.y}` === posKey);
      if (powerUp) {
        className += ' powerup';
        style.backgroundColor = powerUp.color;
        style.boxShadow = `0 0 10px ${powerUp.color}`;
        content = <span style={{ fontSize: '16px' }}>{powerUp.icon}</span>;
      } else if (posKey === foodPosition) {
        className += ' food';
      } else if (snakePositions.has(posKey)) {
        className += posKey === headPosition ? ' snake-head' : ' snake-body';
        if (hasInvincibility(activePowerUps)) {
          style.boxShadow = '0 0 8px #4169E1';
        }
        if (hasGhostMode(activePowerUps)) {
          style.opacity = 0.6;
        }
      } else if (botPositions.has(posKey)) {
        className += posKey === botHeadPosition ? ' snake-head' : ' snake-body';
        style.backgroundColor = posKey === botHeadPosition ? '#ff6666' : '#ff4444';
        if (hasInvincibility(botActivePowerUps)) {
          style.boxShadow = '0 0 8px #ff4444';
        }
        if (hasGhostMode(botActivePowerUps)) {
          style.opacity = 0.6;
        }
      }

      cells.push(
        <div key={i} className={className} style={style}>
          {content}
        </div>
      );
    }
    return cells;
  }, [snake, botSnake, food, powerUps, activePowerUps, botActivePowerUps, hasInvincibility, hasGhostMode]);

  // Render active power-ups
  const renderActivePowerUps = (powerUps: ActivePowerUp[], isBot: boolean = false) => {
    if (powerUps.length === 0) return null;

    return (
      <div className="powerup-indicator" style={{ justifyContent: isBot ? 'flex-end' : 'flex-start' }}>
        {powerUps.map((pu, index) => {
          const config = POWER_UP_CONFIG[pu.type];
          const remaining = Math.ceil((pu.duration - (Date.now() - pu.startTime)) / 1000);
          
          return (
            <div
              key={index}
              className="powerup-effect"
              style={{ backgroundColor: config.color }}
            >
              <span className="powerup-icon">{config.icon}</span>
              <span className="powerup-timer-compact">{remaining}s</span>
            </div>
          );
        })}
      </div>
    );
  };
  
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
        <h1>Level 3: Bot Battle</h1>
        <div className="score-container">
          <div className="score" style={{color: '#00ff88'}}>You: {score}</div>
          <div className="score" style={{color: '#ff4444'}}>Bot: {botSnake.score}</div>
          <div className="high-score">Best: {highScore}</div>
        </div>
        {gameStarted && !gameOver && (
          <div className="game-stats">
            {renderActivePowerUps(activePowerUps)}
            {renderActivePowerUps(botActivePowerUps, true)}
          </div>
        )}
      </div>

      <div className="game-board">
        {boardCells}
      </div>

      {!gameStarted && !gameOver && (
        <div className="game-message">
          <h2>Level 3: Bot Battle!</h2>
          <p>Compete against an AI snake!</p>
          <div style={{marginTop: '15px', fontSize: '14px'}}>
            <p>⚡ Speed Boost - Move faster</p>
            <p>🛡️ Invincibility - No damage</p>
            <p>💎 Double Points - 2x score</p>
            <p>🐌 Slow Motion - Move slower</p>
            <p>👻 Ghost Mode - Pass through</p>
          </div>
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
          <h2 style={{color: winner === 'player' ? '#00ff88' : '#ff4444'}}>
            {winner === 'player' ? 'You Win!' : 'Bot Wins!'}
          </h2>
          <p>Your Score: {score}</p>
          <p>Bot Score: {botSnake.score}</p>
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

export default SnakeGameLevel3;
