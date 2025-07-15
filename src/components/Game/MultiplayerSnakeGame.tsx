// src/components/Game/MultiplayerSnakeGame.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
// This component requires a Firebase setup. Ensure `firebase.ts` is configured.
// import { db } from '../../services/firebase'; 
// import { doc, setDoc, onSnapshot, updateDoc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import './SnakeGame.css';

// MOCKING FIREBASE for demonstration since I can't access a real database.
// Replace these mocks with your actual Firebase imports.
const db = {}; 
const doc = (...args: any[]) => ({});
const setDoc = async (...args: any[]) => {};
const updateDoc = async (...args: any[]) => {};
// END OF MOCKING

interface Position { x: number; y: number; }
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
const AI_NAMES = ['Viper', 'Python', 'Cobra', 'Mamba', 'Anaconda'];
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

  const gameLoopRef = useRef<number | null>(null);
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

  const generateFood = (snakes: Snake[]): Position[] => {
    const occupied = new Set(snakes.flatMap(s => s.positions.map(p => `${p.x},${p.y}`)));
    const food: Position[] = [];
    for (let i = 0; i < 5; i++) {
        let newFood: Position;
        do {
            newFood = { x: Math.floor(Math.random() * BOARD_SIZE), y: Math.floor(Math.random() * BOARD_SIZE) };
        } while (occupied.has(`${newFood.x},${newFood.y}`));
        food.push(newFood);
        occupied.add(`${newFood.x},${newFood.y}`);
    }
    return food;
  };

  const createInitialSnake = (id: string, name: string, index: number, isAI: boolean = false): Snake => ({
    id, name, isAI,
    positions: [{ x: 3 + (index * 2), y: 3 }],
    direction: 'RIGHT',
    score: 0,
    color: SNAKE_COLORS[index % SNAKE_COLORS.length],
    isAlive: true,
  });

  // AI logic for bot movement
  const getAIDirection = useCallback((snake: Snake, food: Position[], allSnakes: Snake[]): Direction => {
    const head = snake.positions[0];
    const currentDirection = snake.direction;
    
    // Get all occupied positions by other snakes (including self body)
    const occupiedPositions = new Set<string>();
    allSnakes.forEach(s => {
      if (s.isAlive) {
        s.positions.forEach((pos, index) => {
          // Don't include the current snake's head in occupied positions
          if (!(s.id === snake.id && index === 0)) {
            occupiedPositions.add(`${pos.x},${pos.y}`);
          }
        });
      }
    });

    // Find the closest food
    let closestFood = food[0];
    let minDistance = Infinity;
    food.forEach(f => {
      const distance = Math.abs(head.x - f.x) + Math.abs(head.y - f.y);
      if (distance < minDistance) {
        minDistance = distance;
        closestFood = f;
      }
    });

    // Helper function to check if a position is safe
    const isSafe = (x: number, y: number): boolean => {
      return x >= 0 && x < BOARD_SIZE && 
             y >= 0 && y < BOARD_SIZE && 
             !occupiedPositions.has(`${x},${y}`);
    };

    // Get possible directions (not opposite to current)
    const possibleDirections: Direction[] = [];
    const oppositeDirection = {
      'UP': 'DOWN',
      'DOWN': 'UP',
      'LEFT': 'RIGHT',
      'RIGHT': 'LEFT'
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
      // If even current direction is unsafe, try any direction to avoid immediate death
      for (const dir of ['UP', 'DOWN', 'LEFT', 'RIGHT'] as Direction[]) {
        const nextPos = getNextPosition(head, dir);
        if (isSafe(nextPos.x, nextPos.y)) {
          return dir;
        }
      }
      return currentDirection; // Last resort
    }

    // If only one safe direction, take it
    if (possibleDirections.length === 1) {
      return possibleDirections[0];
    }

    // Choose direction that moves towards closest food
    let bestDirection = possibleDirections[0];
    let bestScore = Infinity;

    possibleDirections.forEach(dir => {
      const nextPos = getNextPosition(head, dir);
      const distanceToFood = Math.abs(nextPos.x - closestFood.x) + Math.abs(nextPos.y - closestFood.y);
      
      // Bonus for continuing in same direction (reduces erratic movement)
      const continuityBonus = dir === currentDirection ? -0.5 : 0;
      const score = distanceToFood + continuityBonus;
      
      if (score < bestScore) {
        bestScore = score;
        bestDirection = dir;
      }
    });

    return bestDirection;
  }, []);

  // Helper function to get next position based on direction
  const getNextPosition = (currentPos: Position, direction: Direction): Position => {
    const newPos = { ...currentPos };
    switch (direction) {
      case 'UP': newPos.y -= 1; break;
      case 'DOWN': newPos.y += 1; break;
      case 'LEFT': newPos.x -= 1; break;
      case 'RIGHT': newPos.x += 1; break;
    }
    return newPos;
  };
  
  const createRoom = async () => {
    if (!playerName.trim()) return alert("Please enter your name!");
    const newRoomCode = Math.random().toString(36).substr(2, 5).toUpperCase();
    const humanPlayer = createInitialSnake(playerId, playerName, 0);
    const players: { [key: string]: Snake } = { [playerId]: humanPlayer };

    for (let i = 1; i < 4; i++) {
      const aiId = `ai_${i}`;
      players[aiId] = createInitialSnake(aiId, AI_NAMES[i-1], i, true);
    }
    
    const newRoom: GameRoom = {
      id: newRoomCode,
      players,
      food: generateFood(Object.values(players)),
      gameState: 'playing', // Auto-start for simplicity in this version
      maxPlayers: MAX_PLAYERS,
    };
    
    try {
        await setDoc(doc(db, 'gameRooms', newRoomCode), newRoom);
        setRoomCode(newRoomCode);
        setGameRoom(newRoom); // Set room locally for mocked version
        setGameMode('playing');
    } catch(e) { console.error("Failed to create room:", e)}
  };
  
  // NOTE: In a real app, `joinRoom` would fetch from Firebase. 
  // Here, we'll just show an alert as mocking joining is complex.
  const joinRoom = async () => {
    alert("Joining rooms requires a full Firebase backend. Please use 'Create Arena' for this demo.");
  };

  const endGame = useCallback(() => {
    if (!gameRoom) return;
    const winner = Object.values(gameRoom.players).reduce((a, b) => a.score > b.score ? a : b);
    updateDoc(doc(db, 'gameRooms', gameRoom.id), { gameState: 'finished', winner: winner.id });
  }, [gameRoom]);

  const updateGameState = useCallback(() => {
    if (!gameRoom || gameRoom.gameState !== 'playing') return;
  
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
        
        // Use AI logic for bots, player input for human
        let newDirection: Direction;
        if (p.isAI) {
          newDirection = getAIDirection(p, newFood, Object.values(currentRoom.players));
        } else {
          newDirection = direction;
        }
        
        let head = { ...p.positions[0] };
        
        switch (newDirection) {
          case 'UP': head.y -= 1; break;
          case 'DOWN': head.y += 1; break;
          case 'LEFT': head.x -= 1; break;
          case 'RIGHT': head.x += 1; break;
        }
        
        nextMoves[p.id] = { newHead: head, newDirection: newDirection };
      }
      
      // Get all snake body positions (excluding heads for collision detection)
      const snakeBodies = new Set(Object.values(currentRoom.players).flatMap(s => 
        s.positions.slice(1).map(p => `${p.x},${p.y}`)
      ));
  
      // Update players based on pre-calculated moves
      for (const p of Object.values(currentRoom.players)) {
        if (!p.isAlive) {
          updatedPlayers[p.id] = p;
          continue;
        }

        const { newHead, newDirection } = nextMoves[p.id];
        let newSnake = { ...p };
        
        // Check for wall collisions and body collisions
        if (newHead.x < 0 || newHead.x >= BOARD_SIZE || 
            newHead.y < 0 || newHead.y >= BOARD_SIZE || 
            snakeBodies.has(`${newHead.x},${newHead.y}`)) {
          newSnake.isAlive = false;
        } else {
          // Check for head-to-head collisions
          const headsAtSamePosition = Object.values(nextMoves).filter(move => 
            move.newHead.x === newHead.x && move.newHead.y === newHead.y
          );
          
          if (headsAtSamePosition.length > 1) {
            newSnake.isAlive = false; // Head-on collision
          }
        }

        if (newSnake.isAlive) {
          newSnake.positions = [newHead, ...newSnake.positions];
          newSnake.direction = newDirection;
          
          const foodIndex = newFood.findIndex(f => f.x === newHead.x && f.y === newHead.y);
          if (foodIndex !== -1) {
            newSnake.score += 10;
            newFood.splice(foodIndex, 1);
            foodEaten = true;
          } else {
            newSnake.positions.pop(); // Remove tail if no food eaten
          }
        }
        
        updatedPlayers[p.id] = newSnake;
      }
      
      // If food was eaten, generate more
      if (foodEaten) {
        const alivePlayers = Object.values(updatedPlayers).filter(p => p.isAlive);
        if (newFood.length < 3) { // Ensure minimum food on board
          newFood.push(...generateFood(alivePlayers));
        }
      }
  
      // In a real app, this update would be sent to Firebase
      // and the local state would be set by the onSnapshot listener.
      // For the mock, we set it directly.
      return { ...currentRoom, players: updatedPlayers, food: newFood };
    });
  }, [gameRoom, direction, getAIDirection]);

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
  
  // Game Loop
  useEffect(() => {
    if (gameMode === 'playing' && gameRoom?.gameState === 'playing') {
      gameLoopRef.current = window.setInterval(updateGameState, 150);
      return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current) };
    }
  }, [gameMode, gameRoom, updateGameState]);
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Prevent default browser behavior for arrow keys and WASD
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
      e.preventDefault();
    }
    
    if (gameMode !== 'playing' || gameRoom?.gameState !== 'playing') return;
    
    let newDirection = direction;
    switch(e.key) {
        case 'ArrowUp': 
        case 'w': 
        case 'W':
          if(direction !== 'DOWN') newDirection = 'UP'; 
          break;
        case 'ArrowDown': 
        case 's': 
        case 'S':
          if(direction !== 'UP') newDirection = 'DOWN'; 
          break;
        case 'ArrowLeft': 
        case 'a': 
        case 'A':
          if(direction !== 'RIGHT') newDirection = 'LEFT'; 
          break;
        case 'ArrowRight': 
        case 'd': 
        case 'D':
          if(direction !== 'LEFT') newDirection = 'RIGHT'; 
          break;
    }
    setDirection(newDirection);
  }, [direction, gameMode, gameRoom]);

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
  }, [direction, gameMode, gameRoom]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  if (gameMode === 'menu') {
    return (
        <div className="snake-game">
            <div className="game-info">
                <h1>Multiplayer Arena</h1>
            </div>
            <div className="menu-container" style={{maxWidth: '400px'}}>
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
                  <div className="button-description">Start a new multiplayer battle</div>
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
                
                {isMobile && (
                  <div style={{
                    marginTop: '20px',
                    padding: '15px',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid #00ff88',
                    fontSize: '14px',
                    color: '#00ff88'
                  }}>
                    📱 Mobile Controls:<br/>
                    • Swipe to move your snake<br/>
                    • Tap for additional controls
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
                  {p.name}{p.isAI ? ' 🤖' : ''}: {p.score}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="game-board">
        {gameRoom && Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => {
          const x = i % BOARD_SIZE;
          const y = Math.floor(i / BOARD_SIZE);
          let cellClass = 'cell';
          let cellStyle = {};

          const food = gameRoom.food.find(f => f.x === x && f.y === y);
          if (food) cellClass += ' food';

          for(const p of Object.values(gameRoom.players)) {
              if (p.isAlive) {
                  const isHead = p.positions[0].x === x && p.positions[0].y === y;
                  const isBody = p.positions.some(pos => pos.x === x && pos.y === y);
                  if (isHead) {
                      cellClass += ' snake-head';
                      cellStyle = { background: p.color, boxShadow: `0 0 8px ${p.color}`};
                  } else if (isBody) {
                      cellClass += ' snake-body';
                      cellStyle = { background: p.color, opacity: 0.7 };
                  }
              }
          }
          return <div key={i} className={cellClass} style={cellStyle}></div>;
        })}
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
                  {index + 1}. {p.name}{p.isAI ? ' 🤖' : ''}: {p.score}
                </div>
              ))
            }
          </div>
        </div>
      )}
      
      <div className="controls">
        {isMobile ? (
          <>
            <p>Controls: Swipe to move</p>
            <p>Compete against AI bots for the highest score!</p>
          </>
        ) : (
          <>
            <p>Controls: Arrow keys / WASD / Swipe</p>
            <p>Compete against AI bots for the highest score!</p>
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
            marginTop: '10px',
            padding: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '8px',
            border: '1px solid #00ff88'
          }}>
            <span style={{color: '#00ff88', fontSize: '14px'}}>
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