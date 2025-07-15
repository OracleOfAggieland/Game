// src/components/Game/MultiplayerSnakeGame.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../../services/firebase';
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import './SnakeGame.css';

interface Position {
  x: number;
  y: number;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface Snake {
  id: string;
  name: string;
  positions: Position[];
  direction: Direction;
  score: number;
  color: string;
  isAlive: boolean;
  isAI: boolean;
  lastUpdate: any;
}

interface GameRoom {
  id: string;
  players: { [playerId: string]: Snake };
  food: Position[];
  gameState: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  startTime?: any;
  endTime?: any;
  winner?: string;
}

const BOARD_SIZE = 25;
const MAX_PLAYERS = 6;
const GAME_DURATION = 180; // 3 minutes
const AI_NAMES = ['Viper', 'Python', 'Cobra', 'Mamba', 'Anaconda', 'Boa'];
const SNAKE_COLORS = ['#00ff88', '#ff4444', '#4444ff', '#ffaa00', '#ff44ff', '#44ffff'];

const MultiplayerSnakeGame: React.FC = () => {
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [playerId] = useState(`player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [gameMode, setGameMode] = useState<'menu' | 'joining' | 'playing'>('menu');
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [lastDirection, setLastDirection] = useState<Direction>('RIGHT');
  
  const gameLoopRef = useRef<number | null>(null);
  const aiLoopRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  // Generate random room code
  const generateRoomCode = () => {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  };

  // Generate random food positions
  const generateFood = (existingSnakes: Snake[]): Position[] => {
    const food: Position[] = [];
    const occupiedPositions = new Set<string>();
    
    // Mark all snake positions as occupied
    existingSnakes.forEach(snake => {
      snake.positions.forEach(pos => {
        occupiedPositions.add(`${pos.x},${pos.y}`);
      });
    });
    
    // Generate 3-5 food items
    const foodCount = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < foodCount; i++) {
      let attempts = 0;
      let newFood: Position;
      
      do {
        newFood = {
          x: Math.floor(Math.random() * BOARD_SIZE),
          y: Math.floor(Math.random() * BOARD_SIZE)
        };
        attempts++;
      } while (occupiedPositions.has(`${newFood.x},${newFood.y}`) && attempts < 50);
      
      if (attempts < 50) {
        food.push(newFood);
        occupiedPositions.add(`${newFood.x},${newFood.y}`);
      }
    }
    
    return food;
  };

  // Create initial snake position
  const createInitialSnake = (id: string, name: string, index: number, isAI: boolean = false): Snake => {
    const colors = SNAKE_COLORS;
    const startPositions = [
      { x: 3, y: 3 },
      { x: BOARD_SIZE - 4, y: 3 },
      { x: 3, y: BOARD_SIZE - 4 },
      { x: BOARD_SIZE - 4, y: BOARD_SIZE - 4 },
      { x: BOARD_SIZE / 2, y: 3 },
      { x: BOARD_SIZE / 2, y: BOARD_SIZE - 4 }
    ];
    
    return {
      id,
      name,
      positions: [startPositions[index % startPositions.length]],
      direction: 'RIGHT',
      score: 0,
      color: colors[index % colors.length],
      isAlive: true,
      isAI,
      lastUpdate: serverTimestamp()
    };
  };

  // AI Logic
  const calculateAIMove = (snake: Snake, food: Position[], otherSnakes: Snake[]): Direction => {
    if (!snake.isAlive || snake.positions.length === 0) return snake.direction;
    
    const head = snake.positions[0];
    const possibleMoves: { direction: Direction; pos: Position; score: number }[] = [];
    
    // Evaluate all possible directions
    const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    
    directions.forEach(dir => {
      // Don't reverse direction
      if ((dir === 'UP' && snake.direction === 'DOWN') ||
          (dir === 'DOWN' && snake.direction === 'UP') ||
          (dir === 'LEFT' && snake.direction === 'RIGHT') ||
          (dir === 'RIGHT' && snake.direction === 'LEFT')) {
        return;
      }
      
      let newPos = { ...head };
      switch (dir) {
        case 'UP': newPos.y -= 1; break;
        case 'DOWN': newPos.y += 1; break;
        case 'LEFT': newPos.x -= 1; break;
        case 'RIGHT': newPos.x += 1; break;
      }
      
      let score = 0;
      
      // Check bounds
      if (newPos.x < 0 || newPos.x >= BOARD_SIZE || newPos.y < 0 || newPos.y >= BOARD_SIZE) {
        score -= 1000;
      }
      
      // Check collision with self
      if (snake.positions.some(pos => pos.x === newPos.x && pos.y === newPos.y)) {
        score -= 1000;
      }
      
      // Check collision with other snakes
      otherSnakes.forEach(otherSnake => {
        if (otherSnake.id !== snake.id && otherSnake.isAlive) {
          if (otherSnake.positions.some(pos => pos.x === newPos.x && pos.y === newPos.y)) {
            score -= 1000;
          }
        }
      });
      
      // Prefer moves toward food
      if (food.length > 0) {
        const nearestFood = food.reduce((closest, f) => {
          const distToF = Math.abs(newPos.x - f.x) + Math.abs(newPos.y - f.y);
          const distToClosest = Math.abs(newPos.x - closest.x) + Math.abs(newPos.y - closest.y);
          return distToF < distToClosest ? f : closest;
        });
        
        const distance = Math.abs(newPos.x - nearestFood.x) + Math.abs(newPos.y - nearestFood.y);
        score += Math.max(0, 20 - distance);
      }
      
      // Prefer center of board (avoid edges)
      const centerDistance = Math.abs(newPos.x - BOARD_SIZE/2) + Math.abs(newPos.y - BOARD_SIZE/2);
      score += Math.max(0, 10 - centerDistance);
      
      possibleMoves.push({ direction: dir, pos: newPos, score });
    });
    
    // Choose best move
    possibleMoves.sort((a, b) => b.score - a.score);
    return possibleMoves.length > 0 ? possibleMoves[0].direction : snake.direction;
  };

  // End game
  const endGame = useCallback(async () => {
    if (!gameRoom) return;
    
    const alivePlayers = Object.values(gameRoom.players).filter(p => p.isAlive);
    const winner = alivePlayers.length > 0 
      ? alivePlayers.reduce((prev, current) => prev.score > current.score ? prev : current)
      : Object.values(gameRoom.players).reduce((prev, current) => prev.score > current.score ? prev : current);
    
    try {
      await updateDoc(doc(db, 'gameRooms', gameRoom.id), {
        gameState: 'finished',
        endTime: serverTimestamp(),
        winner: winner.id
      });
    } catch (error) {
      console.error('Error ending game:', error);
    }
  }, [gameRoom]);

  // Create new game room
  const createRoom = async () => {
    if (!playerName.trim()) return;
    
    const newRoomCode = generateRoomCode();
    const initialSnake = createInitialSnake(playerId, playerName, 0);
    
    // Add AI opponents
    const aiSnakes: { [key: string]: Snake } = {};
    for (let i = 1; i < 4; i++) {
      const aiId = `ai_${i}`;
      aiSnakes[aiId] = createInitialSnake(aiId, AI_NAMES[i - 1], i, true);
    }
    
    const newRoom: GameRoom = {
      id: newRoomCode,
      players: {
        [playerId]: initialSnake,
        ...aiSnakes
      },
      food: [],
      gameState: 'waiting',
      maxPlayers: MAX_PLAYERS
    };
    
    newRoom.food = generateFood(Object.values(newRoom.players));
    
    try {
      await setDoc(doc(db, 'gameRooms', newRoomCode), newRoom);
      setRoomCode(newRoomCode);
      setGameMode('playing');
      startGame(newRoomCode);
    } catch (error) {
      console.error('Error creating room:', error);
    }
  };

  // Join existing room
  const joinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) return;
    
    try {
      const roomRef = doc(db, 'gameRooms', roomCode.toUpperCase());
      const roomDoc = await getDoc(roomRef);
      
      if (!roomDoc.exists()) {
        alert('Room not found!');
        return;
      }
      
      const room = roomDoc.data() as GameRoom;
      const playerCount = Object.keys(room.players).length;
      
      if (playerCount >= room.maxPlayers) {
        alert('Room is full!');
        return;
      }
      
      const newSnake = createInitialSnake(playerId, playerName, playerCount);
      
      await updateDoc(roomRef, {
        [`players.${playerId}`]: newSnake
      });
      
      setGameMode('playing');
    } catch (error) {
      console.error('Error joining room:', error);
    }
  };

  // Start game
  const startGame = async (roomId: string) => {
    try {
      await updateDoc(doc(db, 'gameRooms', roomId), {
        gameState: 'playing',
        startTime: serverTimestamp()
      });
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  // Move snake
  const moveSnake = useCallback(async () => {
    if (!gameRoom || gameRoom.gameState !== 'playing') return;
    
    const currentSnake = gameRoom.players[playerId];
    if (!currentSnake || !currentSnake.isAlive) return;
    
    const newSnake = { ...currentSnake };
    const head = { ...newSnake.positions[0] };
    
    // Move head based on direction
    switch (direction) {
      case 'UP': head.y -= 1; break;
      case 'DOWN': head.y += 1; break;
      case 'LEFT': head.x -= 1; break;
      case 'RIGHT': head.x += 1; break;
    }
    
    // Check collision with walls
    if (head.x < 0 || head.x >= BOARD_SIZE || head.y < 0 || head.y >= BOARD_SIZE) {
      newSnake.isAlive = false;
    }
    
    // Check collision with any snake (including self)
    Object.values(gameRoom.players).forEach(snake => {
      if (snake.isAlive && snake.positions.some(pos => pos.x === head.x && pos.y === head.y)) {
        newSnake.isAlive = false;
      }
    });
    
    if (newSnake.isAlive) {
      newSnake.positions.unshift(head);
      newSnake.direction = direction;
      
      // Check food collision
      const foodIndex = gameRoom.food.findIndex(f => f.x === head.x && f.y === head.y);
      if (foodIndex !== -1) {
        newSnake.score += 10;
        
        // Remove eaten food and generate new food
        const newFood = [...gameRoom.food];
        newFood.splice(foodIndex, 1);
        
        try {
          await updateDoc(doc(db, 'gameRooms', gameRoom.id), {
            food: newFood.length > 0 ? newFood : generateFood(Object.values(gameRoom.players))
          });
        } catch (error) {
          console.error('Error updating food:', error);
        }
      } else {
        newSnake.positions.pop(); // Remove tail if no food eaten
      }
    }
    
    // Update player in Firebase
    try {
      await updateDoc(doc(db, 'gameRooms', gameRoom.id), {
        [`players.${playerId}`]: {
          ...newSnake,
          lastUpdate: serverTimestamp()
        }
      });
    } catch (error) {
      console.error('Error updating player:', error);
    }
  }, [gameRoom, playerId, direction]);

  // AI movement loop
  const moveAI = useCallback(async () => {
    if (!gameRoom || gameRoom.gameState !== 'playing') return;
    
    const aiPlayers = Object.values(gameRoom.players).filter(p => p.isAI && p.isAlive);
    
    for (const aiSnake of aiPlayers) {
      const otherSnakes = Object.values(gameRoom.players).filter(s => s.id !== aiSnake.id);
      const newDirection = calculateAIMove(aiSnake, gameRoom.food, otherSnakes);
      
      const newSnake = { ...aiSnake };
      const head = { ...newSnake.positions[0] };
      
      // Move AI snake
      switch (newDirection) {
        case 'UP': head.y -= 1; break;
        case 'DOWN': head.y += 1; break;
        case 'LEFT': head.x -= 1; break;
        case 'RIGHT': head.x += 1; break;
      }
      
      // Check collisions
      if (head.x < 0 || head.x >= BOARD_SIZE || head.y < 0 || head.y >= BOARD_SIZE) {
        newSnake.isAlive = false;
      }
      
      Object.values(gameRoom.players).forEach(snake => {
        if (snake.isAlive && snake.positions.some(pos => pos.x === head.x && pos.y === head.y)) {
          newSnake.isAlive = false;
        }
      });
      
      if (newSnake.isAlive) {
        newSnake.positions.unshift(head);
        newSnake.direction = newDirection;
        
        // Check food collision
        const foodIndex = gameRoom.food.findIndex(f => f.x === head.x && f.y === head.y);
        if (foodIndex !== -1) {
          newSnake.score += 10;
          
          const newFood = [...gameRoom.food];
          newFood.splice(foodIndex, 1);
          
          try {
            await updateDoc(doc(db, 'gameRooms', gameRoom.id), {
              food: newFood.length > 0 ? newFood : generateFood(Object.values(gameRoom.players)),
              [`players.${aiSnake.id}`]: {
                ...newSnake,
                lastUpdate: serverTimestamp()
              }
            });
          } catch (error) {
            console.error('Error updating AI:', error);
          }
        } else {
          newSnake.positions.pop();
          
          try {
            await updateDoc(doc(db, 'gameRooms', gameRoom.id), {
              [`players.${aiSnake.id}`]: {
                ...newSnake,
                lastUpdate: serverTimestamp()
              }
            });
          } catch (error) {
            console.error('Error updating AI:', error);
          }
        }
      } else {
        try {
          await updateDoc(doc(db, 'gameRooms', gameRoom.id), {
            [`players.${aiSnake.id}`]: {
              ...newSnake,
              lastUpdate: serverTimestamp()
            }
          });
        } catch (error) {
          console.error('Error updating dead AI:', error);
        }
      }
    }
  }, [gameRoom]);

  // Handle keyboard input
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }

    if (gameMode !== 'playing' || !gameRoom || gameRoom.gameState !== 'playing') return;
    
    const currentPlayer = gameRoom.players[playerId];
    if (!currentPlayer || !currentPlayer.isAlive) return;

    let newDirection = direction;
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        if (lastDirection !== 'DOWN') newDirection = 'UP';
        break;
      case 'ArrowDown':
      case 'KeyS':
        if (lastDirection !== 'UP') newDirection = 'DOWN';
        break;
      case 'ArrowLeft':
      case 'KeyA':
        if (lastDirection !== 'RIGHT') newDirection = 'LEFT';
        break;
      case 'ArrowRight':
      case 'KeyD':
        if (lastDirection !== 'LEFT') newDirection = 'RIGHT';
        break;
    }
    
    if (newDirection !== direction) {
      setDirection(newDirection);
      setLastDirection(newDirection);
    }
  }, [direction, lastDirection, gameMode, gameRoom, playerId]);

  // Game timer
  useEffect(() => {
    if (gameRoom && gameRoom.gameState === 'playing') {
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameRoom, endGame]);

  // Game loops
  useEffect(() => {
    if (gameRoom && gameRoom.gameState === 'playing') {
      gameLoopRef.current = window.setInterval(moveSnake, 120);
      aiLoopRef.current = window.setInterval(moveAI, 150);
    }
    
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (aiLoopRef.current) clearInterval(aiLoopRef.current);
    };
  }, [moveSnake, moveAI, gameRoom]);

  // Listen to room changes
  useEffect(() => {
    if (!roomCode) return;
    
    const unsubscribe = onSnapshot(
      doc(db, 'gameRooms', roomCode),
      (doc) => {
        if (doc.exists()) {
          setGameRoom(doc.data() as GameRoom);
        }
      },
      (error) => {
        console.error('Error listening to room:', error);
      }
    );
    
    return unsubscribe;
  }, [roomCode]);

  // Keyboard event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (aiLoopRef.current) clearInterval(aiLoopRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Leave room when component unmounts
      if (roomCode) {
        deleteDoc(doc(db, 'gameRooms', roomCode)).catch(console.error);
      }
    };
  }, [roomCode]);

  // Render cell
  const renderCell = (x: number, y: number) => {
    let className = 'cell';
    let snakeInfo: { color: string; isHead: boolean } | null = null;
    
    // Check if cell contains any snake
    if (gameRoom) {
      Object.values(gameRoom.players).forEach(snake => {
        if (snake.isAlive) {
          snake.positions.forEach((pos, index) => {
            if (pos.x === x && pos.y === y) {
              className += index === 0 ? ' snake-head' : ' snake-body';
              snakeInfo = { color: snake.color, isHead: index === 0 };
            }
          });
        }
      });
      
      // Check if cell contains food
      if (gameRoom.food.some(f => f.x === x && f.y === y)) {
        className += ' food';
      }
    }
    
    const style: React.CSSProperties = snakeInfo ? { backgroundColor: snakeInfo.color } : {};
    
    return <div key={`${x}-${y}`} className={className} style={style}></div>;
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

  // Render menu
  if (gameMode === 'menu') {
    return (
      <div className="snake-game">
        <div className="game-info">
          <h1>Multiplayer Snake Arena</h1>
          <div className="menu-container" style={{ 
            background: 'rgba(0,0,0,0.8)', 
            padding: '30px', 
            borderRadius: '10px',
            border: '2px solid #00ff88',
            maxWidth: '400px'
          }}>
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '15px',
                borderRadius: '5px',
                border: '1px solid #ccc',
                fontSize: '16px'
              }}
            />
            
            <button
              onClick={createRoom}
              disabled={!playerName.trim()}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '10px',
                backgroundColor: '#00ff88',
                color: 'black',
                border: 'none',
                borderRadius: '5px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                opacity: !playerName.trim() ? 0.5 : 1
              }}
            >
              Create New Arena
            </button>
            
            <div style={{ margin: '20px 0', color: '#ccc' }}>- OR -</div>
            
            <input
              type="text"
              placeholder="Enter room code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '15px',
                borderRadius: '5px',
                border: '1px solid #ccc',
                fontSize: '16px'
              }}
            />
            
            <button
              onClick={joinRoom}
              disabled={!playerName.trim() || !roomCode.trim()}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#4444ff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                opacity: (!playerName.trim() || !roomCode.trim()) ? 0.5 : 1
              }}
            >
              Join Arena
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render game
  return (
    <div className="snake-game">
      <div className="game-info">
        <h1>Snake Arena</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '500px' }}>
          <div className="score">Room: {roomCode}</div>
          <div className="score">Time: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</div>
        </div>
        
        {gameRoom && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'center' }}>
              {Object.values(gameRoom.players).map(player => (
                <div key={player.id} style={{ 
                  color: player.isAlive ? player.color : '#666',
                  fontWeight: player.id === playerId ? 'bold' : 'normal',
                  textDecoration: !player.isAlive ? 'line-through' : 'none'
                }}>
                  {player.name}{player.isAI ? ' 🤖' : ''}: {player.score}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="game-board" style={{ 
        gridTemplateColumns: `repeat(${BOARD_SIZE}, 18px)`,
        gridTemplateRows: `repeat(${BOARD_SIZE}, 18px)`
      }}>
        {createBoard()}
      </div>

      {gameRoom && gameRoom.gameState === 'waiting' && (
        <div className="game-message">
          <h2>Waiting for Game to Start</h2>
          <p>Players: {Object.keys(gameRoom.players).length}/{gameRoom.maxPlayers}</p>
        </div>
      )}

      {gameRoom && gameRoom.gameState === 'finished' && (
        <div className="game-message">
          <h2>Arena Complete!</h2>
          {gameRoom.winner && (
            <p>Winner: {gameRoom.players[gameRoom.winner]?.name}</p>
          )}
          <button
            onClick={() => {
              setGameMode('menu');
              setRoomCode('');
              setTimeLeft(GAME_DURATION);
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#00ff88',
              color: 'black',
              border: 'none',
              borderRadius: '5px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            Back to Menu
          </button>
        </div>
      )}

      <div className="controls">
        <p>Controls: Arrow keys or WASD to move</p>
        {gameRoom && gameRoom.players[playerId] && gameRoom.players[playerId].isAlive && (
          <p>Length: {gameRoom.players[playerId].positions.length}</p>
        )}
      </div>
    </div>
  );
};

export default MultiplayerSnakeGame;