// src/components/Game/RefactoredMultiplayerSnakeGame.tsx
import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import { GameRoom, Snake, Position, Direction, Wave, BossSnake } from '../../types/GameEnhancements';
import { PowerUpManager } from '../../managers/PowerUpManager';
import { WaveManager } from '../../managers/WaveManager';
import { PowerUpEffects } from '../../utils/PowerUpEffects';
import { BossAI, GameState as BossGameState } from '../../utils/BossAI';
import { NameGenerator } from '../../utils/NameGenerator';
import GameHUD from '../UI/GameHUD';
import BoardCell from './BoardCell';
import { useGameState } from '../../hooks/useGameState';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { useGameLoop } from '../../hooks/useGameLoop';
import { useInputHandling } from '../../hooks/useInputHandling';
import { SnakeAI } from '../../services/SnakeAI';
import { gameEvents } from '../../services/GameEventEmitter';
import { GAME_CONSTANTS } from '../../constants/GameConstants';
import { GameErrorHandler } from '../../services/GameErrorHandler';
import './SnakeGame.css';

interface AIPersonality {
  aggression: number;
  intelligence: number;
  patience: number;
  name: string;
  description: string;
}

const AI_PERSONALITIES: AIPersonality[] = [
  { aggression: 0.9, intelligence: 0.95, patience: 0.3, name: 'Viper', description: 'Aggressive and smart' },
  { aggression: 0.4, intelligence: 0.85, patience: 0.8, name: 'Python', description: 'Patient strategist' },
  { aggression: 0.7, intelligence: 0.6, patience: 0.5, name: 'Cobra', description: 'Balanced fighter' },
  { aggression: 0.3, intelligence: 0.4, patience: 0.9, name: 'Mamba', description: 'Cautious survivor' },
  { aggression: 0.8, intelligence: 0.3, patience: 0.2, name: 'Anaconda', description: 'Reckless hunter' }
];

const SNAKE_COLORS = ['#00ff88', '#ff4444', '#4444ff', '#ffaa00', '#ff44ff', '#44ffff'];

const RefactoredMultiplayerSnakeGame: React.FC = () => {
  // Use custom hooks for state management
  const { state, actions } = useGameState();
  const [playerId] = React.useState(`player_${Date.now()}`);
  const [playerName, setPlayerName] = React.useState('');
  const [roomCode, setRoomCode] = React.useState('');
  const [isHost, setIsHost] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [waveNotification, setWaveNotification] = React.useState<string | null>(null);

  // Refs for managers
  const powerUpManagerRef = useRef<PowerUpManager>(new PowerUpManager());
  const waveManagerRef = useRef<WaveManager>(new WaveManager());

  // Firebase sync hook
  const firebaseSync = useFirebaseSync({
    roomId: roomCode,
    playerId,
    onRoomUpdate: (room) => {
      actions.setGameRoom(room);
    },
    onError: (error) => {
      actions.setError(error);
      console.warn("Playing in offline mode:", error);
    }
  });

  // Input handling hook
  const inputHandling = useInputHandling({
    onDirectionChange: actions.updateDirection,
    currentDirection: state.direction,
    isGameActive: state.gameMode === 'playing',
    enableMobileControls: isMobile
  });

  // Game loop hook
  const gameLoop = useGameLoop({
    isActive: state.gameMode === 'playing' && state.gameRoom?.gameState === 'playing',
    targetFPS: 60,
    onUpdate: updateGameState,
    onPerformanceWarning: (fps, frameTime) => {
      console.warn(`Performance warning: ${fps} FPS, ${frameTime}ms frame time`);
    }
  });

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Helper functions
  const generateFood = useCallback((snakes: Snake[]): Position[] => {
    const occupiedCells = new Set(snakes.flatMap(s => s.isAlive ? s.positions.map(p => `${p.x},${p.y}`) : []));
    const food: Position[] = [];

    for (let i = 0; i < 6; i++) {
      let newFood: Position;
      let attempts = 0;
      do {
        newFood = {
          x: Math.floor(Math.random() * GAME_CONSTANTS.BOARD_SIZE),
          y: Math.floor(Math.random() * GAME_CONSTANTS.BOARD_SIZE)
        };
        attempts++;
      } while (occupiedCells.has(`${newFood.x},${newFood.y}`) && attempts < GAME_CONSTANTS.POWERUP_SPAWN_ATTEMPTS);

      if (attempts < GAME_CONSTANTS.POWERUP_SPAWN_ATTEMPTS) {
        food.push(newFood);
        occupiedCells.add(`${newFood.x},${newFood.y}`);
      }
    }
    return food;
  }, []);

  const createInitialSnake = useCallback((id: string, name: string, index: number, isAI: boolean = false): Snake => {
    const startPositions = [
      { x: 3, y: 3 },
      { x: GAME_CONSTANTS.BOARD_SIZE - 4, y: 3 },
      { x: 3, y: GAME_CONSTANTS.BOARD_SIZE - 4 },
      { x: GAME_CONSTANTS.BOARD_SIZE - 4, y: GAME_CONSTANTS.BOARD_SIZE - 4 },
      { x: Math.floor(GAME_CONSTANTS.BOARD_SIZE / 2), y: 3 },
      { x: Math.floor(GAME_CONSTANTS.BOARD_SIZE / 2), y: GAME_CONSTANTS.BOARD_SIZE - 4 }
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
      const basePersonality = AI_PERSONALITIES[(index - 1) % AI_PERSONALITIES.length];
      snake.aiPersonality = basePersonality.name;
    }

    return snake;
  }, []);

  // Pre-initialized AI opponents
  const preInitializedAI = useMemo(() => {
    const aiPlayers: { [key: string]: Snake } = {};
    for (let i = 1; i < 4; i++) {
      const aiId = `ai_${i}`;
      aiPlayers[aiId] = createInitialSnake(aiId, AI_PERSONALITIES[(i - 1) % AI_PERSONALITIES.length].name, i, true);
    }
    return aiPlayers;
  }, [createInitialSnake]);

  // Game state update function
  function updateGameState() {
    if (!state.gameRoom || state.gameRoom.gameState !== 'playing' || !isHost) return;

    try {
      // Update power-up system
      const deltaTime = 1000 / 60; // 60 FPS
      const occupiedPositions = new Set(
        Object.values(state.gameRoom.players).flatMap(s =>
          s.isAlive ? s.positions.map(p => `${p.x},${p.y}`) : []
        )
      );
      powerUpManagerRef.current.update(deltaTime, occupiedPositions, GAME_CONSTANTS.BOARD_SIZE);

      // Update wave system
      const newWave = waveManagerRef.current.update(deltaTime);
      if (newWave) {
        actions.startWave(newWave);
        setWaveNotification(`Wave ${newWave.number} ${newWave.isBossWave ? 'BOSS WAVE!' : 'Started!'}`);
        setTimeout(() => setWaveNotification(null), 3000);

        if (newWave.isBossWave) {
          const newBoss = waveManagerRef.current.createBossSnake(newWave.number, state.bossSnakes.length);
          if (newBoss) {
            actions.spawnBoss(newBoss);
            gameEvents.emit('boss-spawned', {
              bossId: newBoss.id,
              type: newBoss.bossType,
              position: newBoss.positions[0]
            });
          }
        }
      }

      // Update game room with new snake positions
      const updatedRoom = updateSnakePositions(state.gameRoom);
      actions.setGameRoom(updatedRoom);

      // Sync with Firebase
      if (firebaseSync.isConnected) {
        firebaseSync.updateGameState(roomCode, updatedRoom);
      }
    } catch (error) {
      GameErrorHandler.handleGameStateError(error as Error, {
        operation: 'game state update',
        component: 'RefactoredMultiplayerSnakeGame'
      });
    }
  }

  const updateSnakePositions = useCallback((gameRoom: GameRoom): GameRoom => {
    const updatedPlayers: { [key: string]: Snake } = {};
    let newFood = [...gameRoom.food];

    // Calculate next moves for all snakes
    for (const player of Object.values(gameRoom.players)) {
      if (!player.isAlive) {
        updatedPlayers[player.id] = player;
        continue;
      }

      let newDirection: Direction;
      if (player.isAI) {
        newDirection = SnakeAI.getNextDirection(player, {
          food: newFood,
          snakes: Object.values(gameRoom.players)
        });
      } else if (player.id === playerId) {
        newDirection = state.direction;
      } else {
        newDirection = player.direction;
      }

      const head = player.positions[0];
      const nextHead = getNextPosition(head, newDirection);

      // Check collisions
      if (isValidMove(nextHead, gameRoom.players)) {
        const newSnake = { ...player };
        newSnake.positions = [nextHead, ...newSnake.positions];
        newSnake.direction = newDirection;

        // Check food consumption
        const foodIndex = newFood.findIndex(f => f.x === nextHead.x && f.y === nextHead.y);
        if (foodIndex !== -1) {
          newSnake.score += 10;
          newFood.splice(foodIndex, 1);

          gameEvents.emit('powerup-collected', {
            playerId: player.id,
            powerUpType: 'food',
            position: nextHead
          });
        } else {
          newSnake.positions.pop(); // Remove tail if no food eaten
        }

        updatedPlayers[newSnake.id] = newSnake;
      } else {
        // Snake died
        updatedPlayers[player.id] = { ...player, isAlive: false };
        gameEvents.emit('snake-died', {
          playerId: player.id,
          cause: 'collision',
          score: player.score
        });
      }
    }

    // Generate new food if needed
    if (newFood.length < 3) {
      const additionalFood = generateFood(Object.values(updatedPlayers));
      newFood.push(...additionalFood.slice(0, 6 - newFood.length));
    }

    return {
      ...gameRoom,
      players: updatedPlayers,
      food: newFood
    };
  }, [state.direction, playerId, generateFood]);

  const getNextPosition = useCallback((pos: Position, direction: Direction): Position => {
    const moves = {
      'UP': { x: 0, y: -1 },
      'DOWN': { x: 0, y: 1 },
      'LEFT': { x: -1, y: 0 },
      'RIGHT': { x: 1, y: 0 }
    };
    const move = moves[direction];
    return { x: pos.x + move.x, y: pos.y + move.y };
  }, []);

  const isValidMove = useCallback((pos: Position, players: { [key: string]: Snake }): boolean => {
    // Check bounds
    if (pos.x < 0 || pos.x >= GAME_CONSTANTS.BOARD_SIZE || pos.y < 0 || pos.y >= GAME_CONSTANTS.BOARD_SIZE) {
      return false;
    }

    // Check collision with snake bodies
    for (const snake of Object.values(players)) {
      if (snake.isAlive) {
        for (const segment of snake.positions) {
          if (segment.x === pos.x && segment.y === pos.y) {
            return false;
          }
        }
      }
    }

    return true;
  }, []);

  const createRoom = async () => {
    actions.setLoading(true);
    actions.setGameMode('playing');

    const generatedName = playerName.trim() || NameGenerator.generateName();
    setPlayerName(generatedName);

    const newRoomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    setRoomCode(newRoomCode);
    setIsHost(true);

    const humanPlayer = createInitialSnake(playerId, generatedName, 0);
    const players: { [key: string]: Snake } = {
      [playerId]: humanPlayer,
      ...preInitializedAI
    };

    const initialFood = generateFood(Object.values(players));

    const newRoom: GameRoom = {
      id: newRoomCode,
      players,
      food: initialFood,
      gameState: 'playing',
      maxPlayers: GAME_CONSTANTS.MAX_PLAYERS,
      createdAt: Date.now()
    };

    actions.setGameRoom(newRoom);
    actions.setLoading(false);

    // Initialize systems
    powerUpManagerRef.current.initialize();
    waveManagerRef.current.initialize();

    // Create room in Firebase
    const result = await firebaseSync.createRoom(newRoomCode, newRoom);
    if (!result.success) {
      console.warn("Playing in offline mode");
    }

    gameEvents.emit('game-started', {
      roomId: newRoomCode,
      playerCount: Object.keys(players).length
    });
  };

  const joinRoom = async () => {
    if (!roomCode.trim()) {
      alert("Please enter a room code!");
      return;
    }

    const generatedName = playerName.trim() || NameGenerator.generateName();
    setPlayerName(generatedName);

    alert("Joining rooms requires a full Firebase backend implementation. Please use 'Create Arena' for this demo.");
  };

  // Render mobile controls
  const renderMobileControls = () => {
    if (!isMobile || state.gameMode !== 'playing') return null;

    return (
      <div className="mobile-controls">
        <div className="control-row">
          <button
            className="control-btn"
            onTouchStart={() => inputHandling.handleMobileButton('UP')}
          >
            ↑
          </button>
        </div>
        <div className="control-row">
          <button
            className="control-btn"
            onTouchStart={() => inputHandling.handleMobileButton('LEFT')}
          >
            ←
          </button>
          <button
            className="control-btn"
            onTouchStart={() => inputHandling.handleMobileButton('DOWN')}
          >
            ↓
          </button>
          <button
            className="control-btn"
            onTouchStart={() => inputHandling.handleMobileButton('RIGHT')}
          >
            →
          </button>
        </div>
      </div>
    );
  };

  // Render game board
  const renderBoard = () => {
    if (!state.gameRoom) return null;

    const board = [];
    for (let y = 0; y < GAME_CONSTANTS.BOARD_SIZE; y++) {
      for (let x = 0; x < GAME_CONSTANTS.BOARD_SIZE; x++) {
        const key = `${x}-${y}`;
        let cellType = 'empty';
        let color = '';

        // Check for snake segments
        for (const snake of Object.values(state.gameRoom.players)) {
          if (snake.isAlive) {
            const segmentIndex = snake.positions.findIndex(pos => pos.x === x && pos.y === y);
            if (segmentIndex !== -1) {
              cellType = segmentIndex === 0 ? 'head' : 'body';
              color = snake.color;
              break;
            }
          }
        }

        // Check for food
        if (cellType === 'empty' && state.gameRoom.food.some(f => f.x === x && f.y === y)) {
          cellType = 'food';
        }

        board.push(
          <BoardCell
            key={key}
            type={cellType as 'empty' | 'head' | 'body' | 'food' | 'powerup'}
            color={color}
          />
        );
      }
    }

    return <div className="game-board">{board}</div>;
  };

  if (state.gameMode === 'menu') {
    return (
      <div className="snake-game-container">
        <div className="menu">
          <h1>Multiplayer Snake Arena</h1>
          <div className="menu-form">
            <input
              type="text"
              placeholder="Your name (optional)"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="name-input"
            />
            <button onClick={createRoom} className="create-btn" disabled={state.isLoading}>
              {state.isLoading ? 'Creating...' : 'Create Arena'}
            </button>
            <div className="join-section">
              <input
                type="text"
                placeholder="Room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="room-input"
              />
              <button onClick={joinRoom} className="join-btn">
                Join Arena
              </button>
            </div>
          </div>
          {state.error && (
            <div className="error-message">{state.error}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="snake-game-container">
      <GameHUD
        playerSnake={state.gameRoom ? state.gameRoom.players[playerId] : null}
        allSnakes={state.gameRoom ? Object.values(state.gameRoom.players) : []}
        timeLeft={state.timeLeft}
        roomCode={roomCode}
        powerUpManager={powerUpManagerRef.current}
        currentWave={state.currentWave}
        bossSnakes={state.bossSnakes}
        isMobile={isMobile}
      />

      {waveNotification && (
        <div className="wave-notification">
          {waveNotification}
        </div>
      )}

      {renderBoard()}
      {renderMobileControls()}

      {state.gameRoom?.gameState === 'finished' && (
        <div className="game-over">
          <h2>Game Over!</h2>
          <p>Winner: {state.gameRoom.winner}</p>
          <button onClick={() => actions.setGameMode('menu')}>
            Back to Menu
          </button>
        </div>
      )}
    </div>
  );
};

export default RefactoredMultiplayerSnakeGame;