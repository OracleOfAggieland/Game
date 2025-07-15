// src/components/Game/MultiplayerSnakeGame.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import './SnakeGame.css';

// MOCKING FIREBASE for demonstration since I can't access a real database.
const db = {}; 
const doc = (...args: any[]) => ({});
const setDoc = async (...args: any[]) => {};
const updateDoc = async (...args: any[]) => {};

interface Position { x: number; y: number; }
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface AIPersonality {
  aggression: number; // 0-1: How likely to take risks for food
  intelligence: number; // 0-1: How good at pathfinding and avoiding danger
  patience: number; // 0-1: How willing to wait for better opportunities
  name: string;
  description: string;
}

interface Snake {
  id: string;
  name: string;
  positions: Position[];
  direction: Direction;
  score: number;
  color: string;
  isAlive: boolean;
  isAI: boolean;
  aiPersonality?: AIPersonality;
  lastDirectionChange?: number; // Timestamp to prevent rapid direction changes
}

interface GameRoom {
  id: string;
  players: { [playerId: string]: Snake };
  food: Position[];
  gameState: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
}

const BOARD_SIZE = 25;
const MAX_PLAYERS = 6;
const GAME_DURATION = 180;
const GAME_SPEED = 120; // Fixed speed for multiplayer
const MIN_DIRECTION_CHANGE_INTERVAL = 100; // Minimum ms between direction changes

// AI Personalities with different intelligence levels
const AI_PERSONALITIES: AIPersonality[] = [
  { 
    aggression: 0.9, 
    intelligence: 0.95, 
    patience: 0.3, 
    name: 'Viper', 
    description: 'Aggressive and smart' 
  },
  { 
    aggression: 0.4, 
    intelligence: 0.85, 
    patience: 0.8, 
    name: 'Python', 
    description: 'Patient strategist' 
  },
  { 
    aggression: 0.7, 
    intelligence: 0.6, 
    patience: 0.5, 
    name: 'Cobra', 
    description: 'Balanced fighter' 
  },
  { 
    aggression: 0.3, 
    intelligence: 0.4, 
    patience: 0.9, 
    name: 'Mamba', 
    description: 'Cautious survivor' 
  },
  { 
    aggression: 0.8, 
    intelligence: 0.3, 
    patience: 0.2, 
    name: 'Anaconda', 
    description: 'Reckless hunter' 
  }
];

const SNAKE_COLORS = ['#00ff88', '#ff4444', '#4444ff', '#ffaa00', '#ff44ff', '#44ffff'];

const MultiplayerSnakeGame: React.FC = () => {
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [playerId] = useState(`player_${Date.now()}`);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [gameMode, setGameMode] = useState<'menu' | 'playing'>('menu');
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [isMobile, setIsMobile] = useState(false);

  // Performance optimization refs
  const gameLoopRef = useRef<number | null>(null);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);
  const directionQueue = useRef<Direction[]>([]);
  const lastProcessedDirection = useRef<Direction>('RIGHT');
  const lastMoveTime = useRef<number>(0);
  const lastPlayerDirectionChange = useRef<number>(0);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  // Optimized direction queue processing with timing
  const processDirectionQueue = useCallback(() => {
    const now = performance.now();
    if (directionQueue.current.length > 0 && now - lastPlayerDirectionChange.current > MIN_DIRECTION_CHANGE_INTERVAL) {
      const nextDirection = directionQueue.current.shift()!;
      if (isValidDirectionChange(lastProcessedDirection.current, nextDirection)) {
        setDirection(nextDirection);
        lastProcessedDirection.current = nextDirection;
        lastPlayerDirectionChange.current = now;
      }
    }
  }, [isValidDirectionChange]);

  // Queue direction changes to prevent rapid direction reversals
  const queueDirection = useCallback((newDirection: Direction) => {
    if (gameMode !== 'playing' || gameRoom?.gameState !== 'playing') return;
    
    // Get the most recent direction (either from queue or current direction)
    const currentEffectiveDirection = directionQueue.current.length > 0 
      ? directionQueue.current[directionQueue.current.length - 1] 
      : lastProcessedDirection.current;
    
    // Only allow valid direction changes
    if (isValidDirectionChange(currentEffectiveDirection, newDirection)) {
      // Only add to queue if it's different from the last queued direction
      if (directionQueue.current.length === 0 || 
          directionQueue.current[directionQueue.current.length - 1] !== newDirection) {
        // Limit queue size to prevent too many direction changes
        if (directionQueue.current.length < 1) { // Reduced queue size for more responsive controls
          directionQueue.current.push(newDirection);
        }
      }
    }
  }, [gameMode, gameRoom, isValidDirectionChange]);

  const generateFood = useCallback((snakes: Snake[]): Position[] => {
    const occupiedCells = new Set(snakes.flatMap(s => s.isAlive ? s.positions.map(p => `${p.x},${p.y}`) : []));
    const food: Position[] = [];
    
    for (let i = 0; i < 6; i++) { // Increased food count for better gameplay
      let newFood: Position;
      let attempts = 0;
      do {
        newFood = { 
          x: Math.floor(Math.random() * BOARD_SIZE), 
          y: Math.floor(Math.random() * BOARD_SIZE) 
        };
        attempts++;
      } while (occupiedCells.has(`${newFood.x},${newFood.y}`) && attempts < 200);
      
      if (attempts < 200) { // Only add if we found a valid position
        food.push(newFood);
        occupiedCells.add(`${newFood.x},${newFood.y}`);
      }
    }
    return food;
  }, []);

  const createInitialSnake = useCallback((id: string, name: string, index: number, isAI: boolean = false): Snake => {
    // Create starting positions that are more spread out to prevent immediate collisions
    const startPositions = [
      { x: 3, y: 3 },
      { x: BOARD_SIZE - 4, y: 3 },
      { x: 3, y: BOARD_SIZE - 4 },
      { x: BOARD_SIZE - 4, y: BOARD_SIZE - 4 },
      { x: Math.floor(BOARD_SIZE / 2), y: 3 },
      { x: Math.floor(BOARD_SIZE / 2), y: BOARD_SIZE - 4 }
    ];
    
    const startPos = startPositions[index % startPositions.length];
    
    const snake: Snake = {
      id, 
      name, 
      isAI,
      positions: [startPos],
      direction: 'RIGHT',
      score: 0,
      color: SNAKE_COLORS[index % SNAKE_COLORS.length],
      isAlive: true,
      lastDirectionChange: 0
    };
    
    if (isAI) {
      // Assign a random AI personality with some variation
      const basePersonality = AI_PERSONALITIES[(index - 1) % AI_PERSONALITIES.length];
      snake.aiPersonality = {
        ...basePersonality,
        // Add some randomness to make each bot unique
        aggression: Math.max(0.1, Math.min(0.9, basePersonality.aggression + (Math.random() - 0.5) * 0.3)),
        intelligence: Math.max(0.2, Math.min(0.9, basePersonality.intelligence + (Math.random() - 0.5) * 0.2)),
        patience: Math.max(0.1, Math.min(0.9, basePersonality.patience + (Math.random() - 0.5) * 0.3))
      };
    }
    
    return snake;
  }, []);

  // Enhanced AI logic with personality-based decision making
  const getAIDirection = useCallback((snake: Snake, food: Position[], allSnakes: Snake[]): Direction => {
    if (!snake.aiPersonality) return snake.direction;
    
    const head = snake.positions[0];
    const currentDirection = snake.direction;
    const personality = snake.aiPersonality;
    const now = performance.now();
    
    // Prevent too frequent direction changes for AI too
    if (snake.lastDirectionChange && now - snake.lastDirectionChange < MIN_DIRECTION_CHANGE_INTERVAL) {
      return currentDirection;
    }
    
    // Get all occupied positions by other snakes
    const occupiedPositions = new Set<string>();
    const dangerousPositions = new Set<string>(); // Positions that will be dangerous soon
    
    allSnakes.forEach(s => {
      if (s.isAlive) {
        s.positions.forEach((pos, index) => {
          // Don't include the current snake's head in occupied positions
          if (!(s.id === snake.id && index === 0)) {
            occupiedPositions.add(`${pos.x},${pos.y}`);
          }
        });
        
        // Predict where other snake heads will be (for smarter AIs)
        if (s.id !== snake.id && s.isAlive && personality.intelligence > 0.6) {
          const otherHead = s.positions[0];
          const nextPos = getNextPosition(otherHead, s.direction);
          if (isValidPosition(nextPos)) {
            dangerousPositions.add(`${nextPos.x},${nextPos.y}`);
          }
        }
      }
    });

    // Find food targets based on AI personality
    const foodTargets = food.map(f => ({
      food: f,
      distance: Math.abs(head.x - f.x) + Math.abs(head.y - f.y),
      risk: calculateRisk(f, occupiedPositions, dangerousPositions)
    })).sort((a, b) => {
      // Smart AIs consider both distance and risk
      if (personality.intelligence > 0.7) {
        const scoreA = a.distance + (a.risk * (1 - personality.aggression) * 5);
        const scoreB = b.distance + (b.risk * (1 - personality.aggression) * 5);
        return scoreA - scoreB;
      }
      // Dumber AIs just go for closest food
      return a.distance - b.distance;
    });

    const targetFood = foodTargets[0]?.food || food[0];

    // Helper function to check if a position is safe
    const isSafe = (x: number, y: number, depth: number = 0): boolean => {
      if (!isValidPosition({x, y})) return false;
      
      const posKey = `${x},${y}`;
      if (occupiedPositions.has(posKey)) return false;
      
      // Smart AIs avoid predicted dangerous positions
      if (personality.intelligence > 0.5 && dangerousPositions.has(posKey)) return false;
      
      // Very smart AIs do lookahead planning
      if (personality.intelligence > 0.8 && depth < 2) {
        const futurePositions = [
          {x: x+1, y}, {x: x-1, y}, {x, y: y+1}, {x, y: y-1}
        ];
        const safeNextMoves = futurePositions.filter(pos => isSafe(pos.x, pos.y, depth + 1));
        return safeNextMoves.length > 1; // Ensure we don't trap ourselves
      }
      
      return true;
    };

    // Get possible directions (not opposite to current)
    const possibleDirections: Direction[] = [];
    const oppositeDirection = {
      'UP': 'DOWN', 'DOWN': 'UP', 'LEFT': 'RIGHT', 'RIGHT': 'LEFT'
    }[currentDirection] as Direction;

    (['UP', 'DOWN', 'LEFT', 'RIGHT'] as Direction[]).forEach(dir => {
      if (dir !== oppositeDirection) {
        const nextPos = getNextPosition(head, dir);
        if (isSafe(nextPos.x, nextPos.y)) {
          possibleDirections.push(dir);
        }
      }
    });

    // If no safe directions, try to continue current direction
    if (possibleDirections.length === 0) {
      const nextPos = getNextPosition(head, currentDirection);
      if (isSafe(nextPos.x, nextPos.y)) {
        return currentDirection;
      }
      
      // Last resort - try any direction
      for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT'] as Direction[]) {
        if (dir !== oppositeDirection) {
          const nextPos = getNextPosition(head, dir);
          if (isValidPosition(nextPos) && !occupiedPositions.has(`${nextPos.x},${nextPos.y}`)) {
            return dir;
          }
        }
      }
      return currentDirection; // Accept fate
    }

    // If only one safe direction, take it
    if (possibleDirections.length === 1) {
      return possibleDirections[0];
    }

    // Choose best direction based on personality
    let bestDirection = possibleDirections[0];
    let bestScore = Infinity;

    possibleDirections.forEach(dir => {
      const nextPos = getNextPosition(head, dir);
      let score = 0;
      
      // Distance to target food
      const distanceToFood = Math.abs(nextPos.x - targetFood.x) + Math.abs(nextPos.y - targetFood.y);
      score += distanceToFood * personality.intelligence;
      
      // Bonus for continuing in same direction (reduces jittery movement)
      if (dir === currentDirection) {
        score -= 0.5 * personality.patience;
      }
      
      // Penalty for getting too close to walls (smart AIs avoid corners)
      if (personality.intelligence > 0.6) {
        const wallDistance = Math.min(nextPos.x, BOARD_SIZE - 1 - nextPos.x, nextPos.y, BOARD_SIZE - 1 - nextPos.y);
        if (wallDistance < 3) {
          score += (3 - wallDistance) * 2;
        }
      }
      
      // Penalty for getting close to other snakes
      let minSnakeDistance = Infinity;
      allSnakes.forEach(s => {
        if (s.id !== snake.id && s.isAlive) {
          s.positions.forEach(pos => {
            const dist = Math.abs(nextPos.x - pos.x) + Math.abs(nextPos.y - pos.y);
            minSnakeDistance = Math.min(minSnakeDistance, dist);
          });
        }
      });
      
      if (minSnakeDistance < 3) {
        score += (3 - minSnakeDistance) * (1 - personality.aggression);
      }
      
      // Add some randomness for less predictable behavior
      score += Math.random() * (1 - personality.intelligence);
      
      if (score < bestScore) {
        bestScore = score;
        bestDirection = dir;
      }
    });

    return bestDirection;
  }, [calculateRisk, getNextPosition, isValidPosition]);

  // Helper functions
  const isValidPosition = useCallback((pos: Position): boolean => {
    return pos.x >= 0 && pos.x < BOARD_SIZE && pos.y >= 0 && pos.y < BOARD_SIZE;
  }, []);

  const calculateRisk = useCallback((foodPos: Position, occupied: Set<string>, dangerous: Set<string>): number => {
    let risk = 0;
    
    // Check surrounding positions for danger
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const checkPos = `${foodPos.x + dx},${foodPos.y + dy}`;
        if (occupied.has(checkPos)) risk += 1;
        if (dangerous.has(checkPos)) risk += 0.5;
      }
    }
    
    // Check distance to walls
    const wallDistance = Math.min(
      foodPos.x, BOARD_SIZE - 1 - foodPos.x, 
      foodPos.y, BOARD_SIZE - 1 - foodPos.y
    );
    if (wallDistance < 2) risk += 2;
    
    return risk;
  }, []);

  // Helper function to get next position based on direction
  const getNextPosition = useCallback((currentPos: Position, direction: Direction): Position => {
    const newPos = { ...currentPos };
    switch (direction) {
      case 'UP': newPos.y -= 1; break;
      case 'DOWN': newPos.y += 1; break;
      case 'LEFT': newPos.x -= 1; break;
      case 'RIGHT': newPos.x += 1; break;
    }
    return newPos;
  }, []);
  
  const createRoom = async () => {
    if (!playerName.trim()) return alert("Please enter your name!");
    const newRoomCode = Math.random().toString(36).substr(2, 5).toUpperCase();
    const humanPlayer = createInitialSnake(playerId, playerName, 0);
    const players: { [key: string]: Snake } = { [playerId]: humanPlayer };

    // Create AI players with different personalities
    for (let i = 1; i < 4; i++) {
      const aiId = `ai_${i}`;
      players[aiId] = createInitialSnake(aiId, AI_PERSONALITIES[(i-1) % AI_PERSONALITIES.length].name, i, true);
    }
    
    const newRoom: GameRoom = {
      id: newRoomCode,
      players,
      food: generateFood(Object.values(players)),
      gameState: 'playing',
      maxPlayers: MAX_PLAYERS,
    };
    
    try {
        await setDoc(doc(db, 'gameRooms', newRoomCode), newRoom);
        setRoomCode(newRoomCode);
        setGameRoom(newRoom);
        setGameMode('playing');
        // Reset direction tracking for new game
        directionQueue.current = [];
        lastProcessedDirection.current = 'RIGHT';
        lastMoveTime.current = performance.now();
        lastPlayerDirectionChange.current = 0;
    } catch(e) { console.error("Failed to create room:", e)}
  };
  
  const joinRoom = async () => {
    alert("Joining rooms requires a full Firebase backend. Please use 'Create Arena' for this demo.");
  };

  const endGame = useCallback(() => {
    if (!gameRoom) return;
    const alivePlayers = Object.values(gameRoom.players).filter(p => p.isAlive);
    const winner = Object.values(gameRoom.players).reduce((a, b) => a.score > b.score ? a : b);
    
    setGameRoom(prev => prev ? { ...prev, gameState: 'finished' } : null);
    updateDoc(doc(db, 'gameRooms', gameRoom.id), { gameState: 'finished', winner: winner.id });
  }, [gameRoom]);

  const updateGameState = useCallback(() => {
    if (!gameRoom || gameRoom.gameState !== 'playing') return;

    const now = performance.now();
    if (now - lastMoveTime.current < GAME_SPEED) return;
    
    lastMoveTime.current = now;
    processDirectionQueue();
  
    setGameRoom(currentRoom => {
      if (!currentRoom) return null;
      
      const updatedPlayers: { [key: string]: Snake } = {};
      let newFood = [...currentRoom.food];
      let foodEaten = false;
  
      // Pre-calculate all next moves to handle simultaneous updates correctly
      const nextMoves: { [key: string]: { newHead: Position, newDirection: Direction } } = {};
  
      for (const p of Object.values(currentRoom.players)) {
        if (!p.isAlive) {
          updatedPlayers[p.id] = p;
          continue;
        }
        
        // Use AI logic for bots, processed direction for human
        let newDirection: Direction;
        if (p.isAI) {
          newDirection = getAIDirection(p, newFood, Object.values(currentRoom.players));
          // Update AI's last direction change time
          if (newDirection !== p.direction) {
            p.lastDirectionChange = now;
          }
        } else {
          newDirection = lastProcessedDirection.current;
        }
        
        const head = { ...p.positions[0] };
        const nextHead = getNextPosition(head, newDirection);
        
        nextMoves[p.id] = { newHead: nextHead, newDirection: newDirection };
      }
      
      // Get all snake body positions (excluding heads for collision detection)
      const snakeBodies = new Set(Object.values(currentRoom.players).flatMap(s => 
        s.isAlive ? s.positions.slice(1).map(p => `${p.x},${p.y}`) : []
      ));
  
      // Update players based on pre-calculated moves
      for (const p of Object.values(currentRoom.players)) {
        if (!p.isAlive) {
          updatedPlayers[p.id] = p;
          continue;
        }

        const { newHead, newDirection } = nextMoves[p.id];
        let newSnake = { ...p };
        
        // Check for wall collisions first
        if (newHead.x < 0 || newHead.x >= BOARD_SIZE || 
            newHead.y < 0 || newHead.y >= BOARD_SIZE) {
          newSnake.isAlive = false;
          console.log(`${newSnake.name} hit wall at ${newHead.x},${newHead.y}`);
        }
        // Check for body collisions
        else if (snakeBodies.has(`${newHead.x},${newHead.y}`)) {
          newSnake.isAlive = false;
          console.log(`${newSnake.name} hit body at ${newHead.x},${newHead.y}`);
        }
        // Check for head-to-head collisions
        else {
          const headsAtSamePosition = Object.entries(nextMoves).filter(([id, move]) => 
            id !== p.id && move.newHead.x === newHead.x && move.newHead.y === newHead.y
          );
          
          if (headsAtSamePosition.length > 0) {
            newSnake.isAlive = false; // Head-on collision
            console.log(`${newSnake.name} head-to-head collision at ${newHead.x},${newHead.y}`);
          }
        }

        if (newSnake.isAlive) {
          newSnake.positions = [newHead, ...newSnake.positions];
          newSnake.direction = newDirection;
          
          // Check food consumption
          const foodIndex = newFood.findIndex(f => f.x === newHead.x && f.y === newHead.y);
          if (foodIndex !== -1) {
            newSnake.score += 10;
            newFood.splice(foodIndex, 1);
            foodEaten = true;
            console.log(`${newSnake.name} ate food, score: ${newSnake.score}`);
          } else {
            newSnake.positions.pop(); // Remove tail if no food eaten
          }
        }
        
        updatedPlayers[p.id] = newSnake;
      }
      
      // Generate new food if eaten
      if (foodEaten || newFood.length < 4) {
        const alivePlayers = Object.values(updatedPlayers).filter(p => p.isAlive);
        if (alivePlayers.length > 0) {
          const additionalFood = generateFood(alivePlayers);
          newFood = [...newFood, ...additionalFood].slice(0, 6); // Limit total food
        }
      }
      
      // Check if game should end (all human players dead or time up)
      const aliveHumans = Object.values(updatedPlayers).filter(p => p.isAlive && !p.isAI);
      if (aliveHumans.length === 0) {
        setTimeout(() => endGame(), 2000); // Give a moment to see the final state
      }
  
      return { ...currentRoom, players: updatedPlayers, food: newFood };
    });
  }, [gameRoom, getAIDirection, processDirectionQueue, generateFood, endGame, getNextPosition]);

  // Timer
  useEffect(() => {
    if (gameMode === 'playing' && gameRoom?.gameState === 'playing') {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameMode, gameRoom, endGame]);
  
  // High-performance game loop using requestAnimationFrame
  const gameLoop = useCallback(() => {
    if (gameMode === 'playing' && gameRoom?.gameState === 'playing') {
      updateGameState();
    }
    if (gameMode === 'playing' && gameRoom?.gameState === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gameMode, gameRoom, updateGameState]);

  useEffect(() => {
    if (gameMode === 'playing' && gameRoom?.gameState === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameMode, gameRoom, gameLoop]);
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Prevent default browser behavior for arrow keys and WASD
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
      e.preventDefault();
    }
    
    if (gameMode !== 'playing' || gameRoom?.gameState !== 'playing') return;
    
    // Use the queueDirection function instead of directly setting direction
    switch(e.key) {
        case 'ArrowUp': 
        case 'w': 
        case 'W':
          queueDirection('UP');
          break;
        case 'ArrowDown': 
        case 's': 
        case 'S':
          queueDirection('DOWN');
          break;
        case 'ArrowLeft': 
        case 'a': 
        case 'A':
          queueDirection('LEFT');
          break;
        case 'ArrowRight': 
        case 'd': 
        case 'D':
          queueDirection('RIGHT');
          break;
    }
  }, [gameMode, gameRoom, queueDirection]);

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

    // Only handle swipes during active gameplay
    if (gameMode === 'playing' && gameRoom?.gameState === 'playing') {
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
  }, [gameMode, gameRoom, queueDirection]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Memoized board cells for better performance
  const boardCells = useMemo(() => {
    if (!gameRoom) return [];
    
    const cells = [];
    const foodPositions = new Set(gameRoom.food.map(f => `${f.x},${f.y}`));
    
    // Create position maps for all snakes
    const snakeHeads = new Map<string, string>();
    const snakeBodies = new Map<string, string>();
    
    for (const p of Object.values(gameRoom.players)) {
      if (p.isAlive && p.positions.length > 0) {
        const headPos = `${p.positions[0].x},${p.positions[0].y}`;
        snakeHeads.set(headPos, p.color);
        
        for (let i = 1; i < p.positions.length; i++) {
          const bodyPos = `${p.positions[i].x},${p.positions[i].y}`;
          snakeBodies.set(bodyPos, p.color);
        }
      }
    }
    
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      const x = i % BOARD_SIZE;
      const y = Math.floor(i / BOARD_SIZE);
      const posKey = `${x},${y}`;
      
      let cellClass = 'cell';
      let cellStyle = {};

      if (foodPositions.has(posKey)) {
        cellClass += ' food';
      } else if (snakeHeads.has(posKey)) {
        cellClass += ' snake-head';
        const color = snakeHeads.get(posKey)!;
        cellStyle = { background: color, boxShadow: `0 0 8px ${color}` };
      } else if (snakeBodies.has(posKey)) {
        cellClass += ' snake-body';
        const color = snakeBodies.get(posKey)!;
        cellStyle = { background: color, opacity: 0.7 };
      }

      cells.push(<div key={i} className={cellClass} style={cellStyle}></div>);
    }
    return cells;
  }, [gameRoom]);
  
  if (gameMode === 'menu') {
    return (
        <div className="snake-game">
            <div className="game-info">
                <h1>Multiplayer Arena</h1>
            </div>
            <div className="menu-container" style={{maxWidth: '450px'}}>
                <input 
                  type="text" 
                  placeholder="Enter your name" 
                  value={playerName} 
                  onChange={e => setPlayerName(e.target.value)} 
                  style={{
                    width: '100%', 
                    padding: '12px', 
                    marginBottom: '15px',
                    border: '2px solid #00ff88',
                    borderRadius: '5px',
                    backgroundColor: '#16213e',
                    color: '#eee',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
                <button 
                  onClick={createRoom} 
                  disabled={!playerName.trim()} 
                  className="menu-button"
                  style={{
                    padding: '15px 20px',
                    fontSize: '16px',
                    width: '100%',
                    marginBottom: '20px'
                  }}
                >
                  <div className="button-title">🎯 Create Arena</div>
                  <div className="button-description">Battle against smart AI opponents</div>
                </button>
                <div style={{margin: '20px 0', textAlign: 'center', color: '#ccc'}}>- OR -</div>
                <input 
                  type="text" 
                  placeholder="Enter room code" 
                  value={roomCode} 
                  onChange={e => setRoomCode(e.target.value.toUpperCase())} 
                  style={{
                    width: '100%', 
                    padding: '12px', 
                    marginBottom: '15px',
                    border: '2px solid #00ff88',
                    borderRadius: '5px',
                    backgroundColor: '#16213e',
                    color: '#eee',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                />
                <button 
                  onClick={joinRoom} 
                  disabled={!playerName.trim() || !roomCode.trim()} 
                  className="menu-button multiplayer"
                  style={{
                    padding: '15px 20px',
                    fontSize: '16px',
                    width: '100%'
                  }}
                >
                  <div className="button-title">⚔️ Join Arena</div>
                  <div className="button-description">Enter an existing battle</div>
                </button>
                
                <div style={{
                  marginTop: '20px',
                  padding: '15px',
                  backgroundColor: 'rgba(0, 255, 136, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid #00ff88',
                  fontSize: '14px',
                  color: '#00ff88',
                  textAlign: 'left'
                }}>
                  <strong>🤖 AI Opponents:</strong><br/>
                  • <strong>Viper</strong>: Aggressive & smart<br/>
                  • <strong>Python</strong>: Patient strategist<br/>
                  • <strong>Cobra</strong>: Balanced fighter<br/>
                  Each bot has randomized intelligence levels!
                </div>
                
                {isMobile && (
                  <div style={{
                    marginTop: '15px',
                    padding: '12px',
                    backgroundColor: 'rgba(255, 170, 0, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid #ffaa00',
                    fontSize: '13px',
                    color: '#ffaa00'
                  }}>
                    📱 <strong>Mobile Controls:</strong><br/>
                    • Swipe to change direction<br/>
                    • Responsive touch controls
                  </div>
                )}
            </div>
        </div>
    );
  }
  
  return (
    <div 
      className="snake-game" 
      style={{ '--board-size': BOARD_SIZE } as React.CSSProperties}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="game-info">
        <h1>Snake Arena</h1>
        <div className="multiplayer-info">
            <div className="score">Room: {roomCode}</div>
            <div className="time">Time: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</div>
        </div>
        {gameRoom && (
          <div className="player-scores">
            {Object.values(gameRoom.players)
              .sort((a,b) => b.score - a.score)
              .map(p => (
              <div key={p.id} className={`player-score ${!p.isAlive ? 'dead' : ''}`} style={{color: p.color}}>
                  {p.name}{p.isAI ? ' 🤖' : ' 👤'}: {p.score}
                  {p.isAI && p.aiPersonality && (
                    <span style={{fontSize: '0.8em', opacity: 0.7}}>
                      {' '}({p.aiPersonality.description})
                    </span>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="game-board">
        {boardCells}
      </div>
        
      {gameRoom && gameRoom.gameState === 'finished' && (
        <div className="game-message">
          <h2>Arena Complete!</h2>
          <p>Winner: {gameRoom.players[Object.values(gameRoom.players).reduce((a,b) => a.score > b.score ? a:b).id]?.name}</p>
          <p>Final Scores:</p>
          <div style={{textAlign: 'left', marginTop: '10px'}}>
            {Object.values(gameRoom.players)
              .sort((a,b) => b.score - a.score)
              .map((p, index) => (
                <div key={p.id} style={{color: p.color, marginBottom: '5px'}}>
                  {index + 1}. {p.name}{p.isAI ? ' 🤖' : ' 👤'}: {p.score}
                  {p.isAI && p.aiPersonality && (
                    <span style={{fontSize: '0.9em', opacity: 0.8}}>
                      {' '}({p.aiPersonality.description})
                    </span>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      )}
      
      <div className="controls">
        {isMobile ? (
          <>
            <p>Controls: Swipe to move your snake</p>
            <p>Survive and outscore the AI opponents!</p>
          </>
        ) : (
          <>
            <p>Controls: Arrow keys / WASD / Swipe</p>
            <p>Survive and outscore the AI opponents!</p>
          </>
        )}
      </div>

      {/* Mobile Direction Indicator */}
      {isMobile && gameRoom && gameRoom.gameState === 'playing' && (
        <div className="mobile-controls">
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '8px',
            border: '1px solid #00ff88',
            fontSize: '13px'
          }}>
            <span style={{color: '#00ff88'}}>
              Direction: {direction === 'UP' ? '⬆️' : direction === 'DOWN' ? '⬇️' : 
                          direction === 'LEFT' ? '⬅️' : '➡️'} {direction}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiplayerSnakeGame;