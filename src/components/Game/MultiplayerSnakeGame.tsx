// src/components/Game/MultiplayerSnakeGame.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { doc, setDoc, updateDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { NameGenerator } from '../../utils/NameGenerator';
import { PowerUpManager } from '../../managers/PowerUpManager';
// import { PowerUpEffects } from '../../utils/PowerUpEffects'; // Commented out as unused
import { PowerUp, POWER_UP_CONFIG } from '../../types/PowerUp';
// import { EnhancedSnake } from '../../types/GameEnhancements'; // Commented out as unused
import { WaveManager } from '../../managers/WaveManager';
import { Wave, BossSnake } from '../../types/Wave';
import { BossAI, GameState as BossGameState } from '../../utils/BossAI';
import GameHUD from '../UI/GameHUD';
import BoardCell from './BoardCell';

import './SnakeGame.css';

interface Position { x: number; y: number; }
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface AIPersonality {
  aggression: number; // 0-1: How likely to take risks for food
  intelligence: number; // 0-1: How good at pathfinding and avoiding danger
  patience: number; // 0-1: How willing to wait for better opportunities
  name: string;
  description: string;
}

interface LocalSnake {
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
  players: { [playerId: string]: LocalSnake };
  food: Position[];
  gameState: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  createdAt?: number;
  winner?: string;
}

const BOARD_SIZE = 25;
const MAX_PLAYERS = 6;
const GAME_DURATION = 180;
const GAME_SPEED = 200; // Slower speed for more stable AI gameplay
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
  const [isHost, setIsHost] = useState(false);

  // Performance optimization refs
  const gameLoopRef = useRef<number | null>(null);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);
  const directionQueue = useRef<Direction[]>([]);
  const lastProcessedDirection = useRef<Direction>('RIGHT');
  const lastMoveTime = useRef<number>(0);
  const lastPlayerDirectionChange = useRef<number>(0);
  const roomListenerRef = useRef<(() => void) | null>(null);

  // Object pooling for performance (commented out unused refs)
  // const cellPoolRef = useRef<import('../../utils/ObjectPool').GameCellPool>(
  //   new (require('../../utils/ObjectPool').GameCellPool)(BOARD_SIZE * BOARD_SIZE, BOARD_SIZE * BOARD_SIZE * 2)
  // );
  // const particlePoolRef = useRef<import('../../utils/ObjectPool').ParticlePool>(
  //   new (require('../../utils/ObjectPool').ParticlePool)(200, 1000)
  // );

  // Spatial partitioning for efficient collision detection (commented out unused ref)
  // const spatialGridRef = useRef<import('../../utils/SpatialPartitioning').SpatialPartitioning>(
  //   new (require('../../utils/SpatialPartitioning').SpatialPartitioning)(BOARD_SIZE, BOARD_SIZE, 5)
  // );

  // Power-up system
  const powerUpManagerRef = useRef<PowerUpManager>(new PowerUpManager());

  // Wave system
  const waveManagerRef = useRef<WaveManager>(new WaveManager());
  const [currentWave, setCurrentWave] = useState<Wave | null>(null);
  const [waveNotification, setWaveNotification] = useState<string | null>(null);

  // Boss snake system
  const [bossSnakes, setBossSnakes] = useState<BossSnake[]>([]);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomListenerRef.current) {
        roomListenerRef.current();
      }
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
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

  const generateFood = useCallback((snakes: LocalSnake[]): Position[] => {
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

  const createInitialSnake = useCallback((id: string, name: string, index: number, isAI: boolean = false): LocalSnake => {
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

    const snake: LocalSnake = {
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

  // Helper function to convert LocalSnake to Snake (for GameHUD)
  const convertToHUDSnake = useCallback((localSnake: LocalSnake): import('../../types/GameEnhancements').Snake => {
    return {
      ...localSnake,
      aiPersonality: localSnake.aiPersonality?.name
    };
  }, []);

  // Helper function to convert Snake to EnhancedSnake (commented out as unused)
  // const createEnhancedSnake = useCallback((snake: LocalSnake): EnhancedSnake => {
  //   return {
  //     ...snake,
  //     aiPersonality: snake.aiPersonality,
  //     activePowerUps: [],
  //     shieldCount: 0,
  //     lastPowerUpCollection: 0,
  //     effectsState: PowerUpEffects.initializeEffectsState()
  //   };
  // }, []);

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

  // Helper function to check if position is valid
  const isValidPosition = useCallback((pos: Position): boolean => {
    return pos.x >= 0 && pos.x < BOARD_SIZE && pos.y >= 0 && pos.y < BOARD_SIZE;
  }, []);

  // Helper function to calculate risk
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

  // Enhanced AI logic with personality-based decision making
  const getAIDirection = useCallback((snake: LocalSnake, food: Position[], allSnakes: LocalSnake[]): Direction => {
    if (!snake.aiPersonality) return snake.direction;

    const head = snake.positions[0];
    const currentDirection = snake.direction;
    const personality = snake.aiPersonality;
    const now = performance.now();

    // Prevent too frequent direction changes for AI - much more stable
    if (snake.lastDirectionChange && now - snake.lastDirectionChange < MIN_DIRECTION_CHANGE_INTERVAL * 5) {
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
      if (!isValidPosition({ x, y })) return false;

      const posKey = `${x},${y}`;
      if (occupiedPositions.has(posKey)) return false;

      // Smart AIs avoid predicted dangerous positions
      if (personality.intelligence > 0.5 && dangerousPositions.has(posKey)) return false;

      // Very smart AIs do lookahead planning
      if (personality.intelligence > 0.8 && depth < 2) {
        const futurePositions = [
          { x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }
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

  // Pre-initialize AI opponents for faster startup
  const preInitializedAI = useMemo(() => {
    const aiPlayers: { [key: string]: LocalSnake } = {};
    for (let i = 1; i < 4; i++) {
      const aiId = `ai_${i}`;
      aiPlayers[aiId] = createInitialSnake(aiId, AI_PERSONALITIES[(i - 1) % AI_PERSONALITIES.length].name, i, true);
    }
    return aiPlayers;
  }, [createInitialSnake]);

  const createRoom = async () => {
    // Start UI transition immediately for perceived speed
    setGameMode('playing');

    // Auto-generate player name if not provided
    const generatedName = playerName.trim() || NameGenerator.generateName();
    setPlayerName(generatedName);

    // Pre-generate room code and initialize game state
    const newRoomCode = Math.random().toString(36).substr(2, 5).toUpperCase();
    setRoomCode(newRoomCode);
    setIsHost(true);

    // Initialize game state immediately with pre-initialized AI
    const humanPlayer = createInitialSnake(playerId, generatedName, 0);
    const players: { [key: string]: LocalSnake } = {
      [playerId]: humanPlayer,
      ...preInitializedAI
    };

    // Pre-generate food positions
    const initialFood = generateFood(Object.values(players));

    const newRoom: GameRoom = {
      id: newRoomCode,
      players,
      food: initialFood,
      gameState: 'playing',
      maxPlayers: MAX_PLAYERS,
      createdAt: Date.now()
    };

    // Set local game state immediately for instant feedback
    setGameRoom(newRoom);

    // Initialize game loop state for immediate start
    directionQueue.current = [];
    lastProcessedDirection.current = 'RIGHT';
    lastMoveTime.current = performance.now();
    lastPlayerDirectionChange.current = 0;

    // Initialize power-up and wave systems
    powerUpManagerRef.current.initialize();
    waveManagerRef.current.initialize();

    // Firebase operations in background (non-blocking)
    try {
      // Use Promise.all for parallel operations
      const [, unsubscribe] = await Promise.all([
        setDoc(doc(db, 'gameRooms', newRoomCode), newRoom),
        // Set up listener immediately
        new Promise<() => void>((resolve) => {
          const unsub = onSnapshot(doc(db, 'gameRooms', newRoomCode), (doc) => {
            if (doc.exists()) {
              const updatedRoom = doc.data() as GameRoom;
              setGameRoom(updatedRoom);
            }
          });
          resolve(unsub);
        })
      ]);

      roomListenerRef.current = unsubscribe;
    } catch (e) {
      console.error("Failed to create room:", e);
      // Don't show alert immediately - game is already started
      // Just log error and continue with local gameplay
      console.warn("Playing in offline mode due to connection issues");
    }
  };

  const joinRoom = async () => {
    if (!roomCode.trim()) {
      return alert("Please enter a room code!");
    }

    // Auto-generate player name if not provided
    const generatedName = playerName.trim() || NameGenerator.generateName();
    setPlayerName(generatedName);

    try {
      // For demo purposes, joining doesn't actually connect to Firebase
      // In a real implementation, you would:
      // 1. Check if room exists
      // 2. Add player to room with generated name
      // 3. Listen to room updates
      alert("Joining rooms requires a full Firebase backend implementation. Please use 'Create Arena' for this demo.");
    } catch (e) {
      console.error("Failed to join room:", e);
      alert("Failed to join room. Please check the room code and try again.");
    }
  };

  const endGame = useCallback(async () => {
    if (!gameRoom || !isHost) return;

    const winner = Object.values(gameRoom.players).reduce((a, b) => a.score > b.score ? a : b);

    setGameRoom(prev => prev ? { ...prev, gameState: 'finished', winner: winner.id } : null);

    try {
      await updateDoc(doc(db, 'gameRooms', gameRoom.id), {
        gameState: 'finished',
        winner: winner.id
      });
    } catch (e) {
      console.error("Failed to update game state:", e);
    }
  }, [gameRoom, isHost]);

  const updateGameState = useCallback(() => {
    if (!gameRoom || gameRoom.gameState !== 'playing' || !isHost) return;

    const now = performance.now();
    if (now - lastMoveTime.current < GAME_SPEED) return;

    lastMoveTime.current = now;
    processDirectionQueue();

    // Update power-up system
    const deltaTime = GAME_SPEED; // Use consistent delta time
    const occupiedPositions = new Set(
      Object.values(gameRoom.players).flatMap(s =>
        s.isAlive ? s.positions.map(p => `${p.x},${p.y}`) : []
      )
    );
    powerUpManagerRef.current.update(deltaTime, occupiedPositions, BOARD_SIZE);

    // Update wave system
    const newWave = waveManagerRef.current.update(deltaTime);
    if (newWave) {
      setCurrentWave(newWave);
      setWaveNotification(`Wave ${newWave.number} ${newWave.isBossWave ? 'BOSS WAVE!' : 'Started!'}`);

      // Clear notification after 3 seconds
      setTimeout(() => setWaveNotification(null), 3000);

      // Spawn boss snake for boss waves
      if (newWave.isBossWave) {
        const newBoss = waveManagerRef.current.createBossSnake(newWave.number, bossSnakes.length);
        if (newBoss) {
          setBossSnakes(prev => [...prev, newBoss]);
          console.log(`Boss Snake spawned: ${newBoss.name} (${newBoss.bossType})`);
        }
      }

      // Add new AI opponents if wave requires it
      if (newWave.aiCount > Object.values(gameRoom.players).filter(p => p.isAI).length) {
        // This will be handled in the next update cycle
        console.log(`Wave ${newWave.number}: Adding more AI opponents`);
      }
    }

    setGameRoom(currentRoom => {
      if (!currentRoom) return null;

      const updatedPlayers: { [key: string]: LocalSnake } = {};
      let newFood = [...currentRoom.food];
      let foodEaten = false;

      // Pre-calculate all next moves to handle simultaneous updates correctly
      const nextMoves: { [key: string]: { newHead: Position, newDirection: Direction } } = {};
      const bossNextMoves: { [key: string]: { newHead: Position, newDirection: Direction, abilityToUse?: string } } = {};
      const alivePlayers = Object.values(currentRoom.players).filter(p => p.isAlive);

      for (const p of alivePlayers) {
        // Use AI logic for bots, processed direction for human
        let newDirection: Direction;
        if (p.isAI) {
          // Only recalculate AI direction if enough time has passed
          if (!p.lastDirectionChange || now - p.lastDirectionChange > MIN_DIRECTION_CHANGE_INTERVAL * 5) {
            newDirection = getAIDirection(p, newFood, alivePlayers);
            if (newDirection !== p.direction) {
              p.lastDirectionChange = now;
            }
          } else {
            newDirection = p.direction; // Keep current direction
          }
        } else if (p.id === playerId) {
          newDirection = lastProcessedDirection.current;
        } else {
          newDirection = p.direction;
        }

        const head = { ...p.positions[0] };
        const nextHead = getNextPosition(head, newDirection);

        nextMoves[p.id] = { newHead: nextHead, newDirection: newDirection };
      }

      // Add dead players without processing
      for (const p of Object.values(currentRoom.players)) {
        if (!p.isAlive) {
          updatedPlayers[p.id] = p;
        }
      }

      // Calculate boss snake moves using BossAI
      const updatedBossSnakes: BossSnake[] = [];
      for (const boss of bossSnakes) {
        if (!boss.isAlive) {
          updatedBossSnakes.push(boss);
          continue;
        }

        // Create game state for boss AI
        const bossGameState: BossGameState = {
          snakes: Object.values(currentRoom.players).map(p => ({
            ...p,
            activePowerUps: [],
            shieldCount: 0,
            lastPowerUpCollection: 0,
            effectsState: {
              isGhost: false,
              isFrozen: false,
              speedMultiplier: 1,
              scoreMultiplier: 1,
              shieldActive: false,
              lastEffectUpdate: 0
            }
          })),
          food: newFood,
          powerUps: powerUpManagerRef.current.getActivePowerUps().map(pu => pu.position),
          boardWidth: BOARD_SIZE,
          boardHeight: BOARD_SIZE,
          currentTime: now
        };

        // Get boss AI decision
        const aiDecision = BossAI.getNextDirection(boss, bossGameState);
        const nextHead = getNextPosition(boss.positions[0], aiDecision.direction);

        bossNextMoves[boss.id] = {
          newHead: nextHead,
          newDirection: aiDecision.direction,
          abilityToUse: aiDecision.abilityToUse
        };

        // Update boss direction change time
        if (aiDecision.direction !== boss.direction) {
          boss.lastDirectionChange = now;
        }
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
        }
        // Check for body collisions
        else if (snakeBodies.has(`${newHead.x},${newHead.y}`)) {
          newSnake.isAlive = false;
        }
        // Check for head-to-head collisions
        else {
          const headsAtSamePosition = Object.entries(nextMoves).filter(([id, move]) =>
            id !== p.id && move.newHead.x === newHead.x && move.newHead.y === newHead.y
          );

          if (headsAtSamePosition.length > 0) {
            newSnake.isAlive = false; // Head-on collision
          }
        }

        if (newSnake.isAlive) {
          newSnake.positions = [newHead, ...newSnake.positions];
          newSnake.direction = newDirection;

          // Check power-up collection
          const activePowerUps = powerUpManagerRef.current.getActivePowerUps();
          const powerUpIndex = activePowerUps.findIndex(pu =>
            pu.position.x === newHead.x && pu.position.y === newHead.y
          );

          if (powerUpIndex !== -1) {
            const powerUp = activePowerUps[powerUpIndex];
            if (powerUpManagerRef.current.collectPowerUp(powerUp.id, p.id)) {
              // Power-up collected successfully
              console.log(`${p.name} collected ${powerUp.type}`);
            }
          }

          // Check food consumption
          const foodIndex = newFood.findIndex(f => f.x === newHead.x && f.y === newHead.y);
          if (foodIndex !== -1) {
            // Apply score multiplier if active
            const scoreMultiplier = powerUpManagerRef.current.getScoreMultiplier(p.id);
            const baseScore = 10;
            const finalScore = Math.floor(baseScore * scoreMultiplier);
            newSnake.score += finalScore;
            newFood.splice(foodIndex, 1);
            foodEaten = true;
          } else {
            newSnake.positions.pop(); // Remove tail if no food eaten
          }
        }

        updatedPlayers[p.id] = newSnake;
      }

      // Update boss snakes based on pre-calculated moves
      for (const boss of bossSnakes) {
        if (!boss.isAlive) {
          updatedBossSnakes.push(boss);
          continue;
        }

        const { newHead, newDirection, abilityToUse } = bossNextMoves[boss.id];
        let updatedBoss = { ...boss };

        // Check for wall collisions
        if (newHead.x < 0 || newHead.x >= BOARD_SIZE ||
          newHead.y < 0 || newHead.y >= BOARD_SIZE) {
          updatedBoss.isAlive = false;
        }
        // Check for body collisions with regular snakes
        else if (snakeBodies.has(`${newHead.x},${newHead.y}`)) {
          updatedBoss.isAlive = false;
        }
        // Check for head-to-head collisions with regular snakes
        else {
          const headsAtSamePosition = Object.entries(nextMoves).filter(([id, move]) =>
            move.newHead.x === newHead.x && move.newHead.y === newHead.y
          );

          if (headsAtSamePosition.length > 0) {
            // Boss snake wins head-to-head collisions due to superior health
            console.log(`${updatedBoss.name} defeats snake in head-to-head collision!`);
            // Mark the regular snake as dead
            for (const [snakeId] of headsAtSamePosition) {
              if (updatedPlayers[snakeId]) {
                updatedPlayers[snakeId].isAlive = false;
              }
            }
          }
        }

        if (updatedBoss.isAlive) {
          updatedBoss.positions = [newHead, ...updatedBoss.positions];
          updatedBoss.direction = newDirection;

          // Execute boss ability if one was chosen
          if (abilityToUse) {
            BossAI.executeBossAbility(updatedBoss, abilityToUse, {
              snakes: Object.values(updatedPlayers).map(p => ({
                ...p,
                activePowerUps: [],
                shieldCount: 0,
                lastPowerUpCollection: 0,
                effectsState: {
                  isGhost: false,
                  isFrozen: false,
                  speedMultiplier: 1,
                  scoreMultiplier: 1,
                  shieldActive: false,
                  lastEffectUpdate: 0
                }
              })),
              food: newFood,
              powerUps: [],
              boardWidth: BOARD_SIZE,
              boardHeight: BOARD_SIZE,
              currentTime: now
            });
          }

          // Check food consumption for boss snakes
          const foodIndex = newFood.findIndex(f => f.x === newHead.x && f.y === newHead.y);
          if (foodIndex !== -1) {
            updatedBoss.score += 20; // Boss snakes get more points
            newFood.splice(foodIndex, 1);
            foodEaten = true;
          } else {
            updatedBoss.positions.pop(); // Remove tail if no food eaten
          }
        }

        updatedBossSnakes.push(updatedBoss);
      }

      // Update boss snakes state
      setBossSnakes(updatedBossSnakes);

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

    // Sync to Firebase periodically
    if (isHost && gameRoom) {
      updateDoc(doc(db, 'gameRooms', gameRoom.id), {
        players: gameRoom.players,
        food: gameRoom.food
      }).catch(e => console.error("Failed to sync game state:", e));
    }
  }, [gameRoom, getAIDirection, processDirectionQueue, generateFood, endGame, getNextPosition, isHost, playerId, bossSnakes]);

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
  }, [gameMode, gameRoom?.gameState, gameLoop]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Prevent default browser behavior for arrow keys and WASD
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
      e.preventDefault();
    }

    if (gameMode !== 'playing' || gameRoom?.gameState !== 'playing') return;

    // Use the queueDirection function instead of directly setting direction
    switch (e.key) {
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

  // Cleanup game room when leaving
  const cleanupRoom = useCallback(async () => {
    if (roomCode && isHost) {
      try {
        await deleteDoc(doc(db, 'gameRooms', roomCode));
      } catch (e) {
        console.error("Failed to cleanup room:", e);
      }
    }
    if (roomListenerRef.current) {
      roomListenerRef.current();
      roomListenerRef.current = null;
    }
  }, [roomCode, isHost]);

  // Cleanup on component unmount or when going back to menu
  useEffect(() => {
    return () => {
      cleanupRoom();
    };
  }, [cleanupRoom]);

  // Memoized board cells for better performance with object pooling
  const boardCells = useMemo(() => {
    if (!gameRoom) return [];

    const cells = [];
    const foodPositions = new Set(gameRoom.food.map(f => `${f.x},${f.y}`));

    // Get active power-ups
    const activePowerUps = powerUpManagerRef.current.getActivePowerUps();
    const powerUpPositions = new Map<string, PowerUp>();
    activePowerUps.forEach(pu => {
      powerUpPositions.set(`${pu.position.x},${pu.position.y}`, pu);
    });

    // Create position maps for all snakes
    const snakeHeads = new Map<string, string>();
    const snakeBodies = new Map<string, string>();
    const bossHeads = new Map<string, BossSnake>();
    const bossBodies = new Map<string, BossSnake>();

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

    // Add boss snake positions
    for (const boss of bossSnakes) {
      if (boss.isAlive && boss.positions.length > 0) {
        const headPos = `${boss.positions[0].x},${boss.positions[0].y}`;
        bossHeads.set(headPos, boss);

        for (let i = 1; i < boss.positions.length; i++) {
          const bodyPos = `${boss.positions[i].x},${boss.positions[i].y}`;
          bossBodies.set(bodyPos, boss);
        }
      }
    }

    // Use object pooling for cell creation (commented out as unused)
    // const pooledCells: any[] = [];

    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      const x = i % BOARD_SIZE;
      const y = Math.floor(i / BOARD_SIZE);
      const posKey = `${x},${y}`;

      // Get a simple cell object for metadata (not for React elements)
      const cellData = {
        id: `cell-${i}`,
        x: x,
        y: y,
        isActive: true,
        type: 'empty' as string,
        color: undefined as string | undefined
      };

      // let cellClass = 'cell';
      // let cellStyle = {};

      if (powerUpPositions.has(posKey)) {
        const powerUp = powerUpPositions.get(posKey)!;
        const config = POWER_UP_CONFIG[powerUp.type];
        // cellClass += ' powerup';
        cellData.type = 'powerup';
        cellData.color = config.color;
        // cellStyle = {
        //   background: config.color,
        //   boxShadow: `0 0 12px ${config.color}`,
        //   borderRadius: '50%',
        //   animation: 'pulse 1.5s infinite'
        // };
      } else if (foodPositions.has(posKey)) {
        // cellClass += ' food';
        cellData.type = 'food';
      } else if (bossHeads.has(posKey)) {
        const boss = bossHeads.get(posKey)!;
        // cellClass += ' boss-head';
        cellData.type = 'snake-head';
        cellData.color = boss.color;
        // cellStyle = {
        //   background: `linear-gradient(45deg, ${boss.color}, #FFD700)`,
        //   boxShadow: `0 0 15px ${boss.color}, 0 0 25px #FFD700`,
        //   border: '2px solid #FFD700',
        //   borderRadius: '4px',
        //   animation: 'bossGlow 2s infinite alternate'
        // };
      } else if (bossBodies.has(posKey)) {
        const boss = bossBodies.get(posKey)!;
        // cellClass += ' boss-body';
        cellData.type = 'snake-body';
        cellData.color = boss.color;
        // cellStyle = {
        //   background: `linear-gradient(45deg, ${boss.color}, #FFD700)`,
        //   opacity: 0.8,
        //   border: '1px solid #FFD700',
        //   borderRadius: '2px'
        // };
      } else if (snakeHeads.has(posKey)) {
        // cellClass += ' snake-head';
        const color = snakeHeads.get(posKey)!;
        cellData.type = 'snake-head';
        cellData.color = color;
        // cellStyle = { background: color, boxShadow: `0 0 8px ${color}` };
      } else if (snakeBodies.has(posKey)) {
        // cellClass += ' snake-body';
        const color = snakeBodies.get(posKey)!;
        cellData.type = 'snake-body';
        cellData.color = color;
        // cellStyle = { background: color, opacity: 0.7 };
      } else {
        cellData.type = 'empty';
      }

      // Create React element using memoized BoardCell component
      // Map cell types to BoardCell expected types
      const boardCellType = cellData.type === 'snake-head' ? 'head' : 
                           cellData.type === 'snake-body' ? 'body' : 
                           cellData.type as 'empty' | 'food' | 'powerup';
      cells.push(<BoardCell key={i} type={boardCellType} color={cellData.color} />);

      // Return cell data to pool for reuse (commented out as cellPoolRef is unused)
      // cellPoolRef.current.release(cellData);
    }

    return cells;
  }, [gameRoom, bossSnakes]);

  if (gameMode === 'menu') {
    return (
      <div className="snake-game">
        <div className="game-info">
          <h1>Multiplayer Arena</h1>
        </div>
        <div className="menu-container" style={{ maxWidth: '450px' }}>
          <button
            onClick={createRoom}
            className="menu-button"
            style={{
              padding: '15px 20px',
              fontSize: '16px',
              width: '100%',
              marginBottom: '20px'
            }}
          >
            <div className="button-title">🎯 Create Arena</div>
            <div className="button-description">Battle against smart AI opponents instantly!</div>
          </button>

          {/* Optional name customization */}
          <div style={{
            marginBottom: '20px',
            padding: '12px',
            backgroundColor: 'rgba(0, 255, 136, 0.05)',
            borderRadius: '8px',
            border: '1px solid rgba(0, 255, 136, 0.2)'
          }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              color: '#00ff88',
              fontWeight: 'bold'
            }}>
              🎭 Custom Name (Optional)
            </label>
            <input
              type="text"
              placeholder="Auto-generated name will be used if empty"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid rgba(0, 255, 136, 0.3)',
                borderRadius: '4px',
                backgroundColor: 'rgba(22, 33, 62, 0.8)',
                color: '#eee',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
            <div style={{
              fontSize: '12px',
              color: '#888',
              marginTop: '4px'
            }}>
              Leave empty for names like "SwiftViper" or "GreenCobra"
            </div>
          </div>
          <div style={{ margin: '20px 0', textAlign: 'center', color: '#ccc' }}>- OR -</div>
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
            disabled={!roomCode.trim()}
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
            <strong>🤖 AI Opponents:</strong><br />
            • <strong>Viper</strong>: Aggressive & smart<br />
            • <strong>Python</strong>: Patient strategist<br />
            • <strong>Cobra</strong>: Balanced fighter<br />
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
              📱 <strong>Mobile Controls:</strong><br />
              • Swipe to change direction<br />
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
      {/* Enhanced Game HUD with Power-up Indicators */}
      {gameRoom && (
        <GameHUD
          playerSnake={gameRoom.players[playerId] ? convertToHUDSnake(gameRoom.players[playerId]) : null}
          allSnakes={Object.values(gameRoom.players).map(convertToHUDSnake)}
          timeLeft={timeLeft}
          roomCode={roomCode}
          powerUpManager={powerUpManagerRef.current}
          currentWave={currentWave}
          bossSnakes={bossSnakes}
          isMobile={isMobile}
        />
      )}

      <div className="game-board">
        {boardCells}
      </div>

      {/* Wave Progress Indicator */}
      {gameRoom && gameRoom.gameState === 'playing' && currentWave && (
        <div className={`wave-progress ${currentWave.isBossWave ? 'boss-wave' : ''}`}>
          Wave {currentWave.number} {currentWave.isBossWave ? '👑 BOSS WAVE' : ''}
          {bossSnakes.filter(b => b.isAlive).length > 0 && (
            <span style={{ marginLeft: '10px' }}>
              🐍 Boss: {bossSnakes.filter(b => b.isAlive).map(b => b.name).join(', ')}
            </span>
          )}
        </div>
      )}

      {/* Wave Notification */}
      {waveNotification && (
        <div className="wave-notification">
          <h2>{waveNotification}</h2>
        </div>
      )}

      {gameRoom && gameRoom.gameState === 'finished' && (
        <div className="game-message arena-complete">
          <h2>Arena Complete!</h2>
          <div className="arena-winner">
            Winner: {gameRoom.players[gameRoom.winner || '']?.name || 'Unknown'}
          </div>
          <div className="final-scores">
            <h3>Final Scores:</h3>
            {Object.values(gameRoom.players)
              .sort((a, b) => b.score - a.score)
              .map((p, index) => (
                <div 
                  key={p.id} 
                  className={`final-score-item ${
                    p.id === gameRoom.winner ? 'winner' : ''
                  } ${
                    p.id === playerId ? 'player' : ''
                  } ${
                    !p.isAlive ? 'dead' : ''
                  }`}
                >
                  <span className="score-rank">{index + 1}.</span>
                  <span className="score-name" style={{ color: p.color }}>
                    {p.name}
                    {p.isAI ? ' 🤖' : ' 👤'}
                  </span>
                  <span className="score-value">{p.score}</span>
                  {p.isAI && p.aiPersonality && (
                    <span className="score-type">
                      ({p.aiPersonality.description})
                    </span>
                  )}
                </div>
              ))
            }
          </div>
          <div className="arena-stats">
            <p><strong>Game Duration:</strong> {Math.floor((GAME_DURATION - timeLeft) / 60)}:{String((GAME_DURATION - timeLeft) % 60).padStart(2, '0')}</p>
            <p><strong>Survivors:</strong> {Object.values(gameRoom.players).filter(p => p.isAlive).length}/{Object.keys(gameRoom.players).length}</p>
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
            <span style={{ color: '#00ff88' }}>
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