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
const _onSnapshot = (doc: any, callback: Function) => {
    console.log("Mock onSnapshot called. In a real app, this would listen for DB changes.");
    return () => {}; // Return an unsubscribe function
};
const updateDoc = async (...args: any[]) => {};
const _deleteDoc = async (...args: any[]) => {};
const _serverTimestamp = () => new Date();
const _getDoc = async (...args: any[]) => ({
    exists: () => false, 
    data: () => ({})
});
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

  const gameLoopRef = useRef<number | null>(null);

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
        
        let newDirection = p.isAI ? p.direction : direction; // Simplified AI, replace with your logic
        let head = { ...p.positions[0] };
        
        switch (newDirection) {
          case 'UP': head.y -= 1; break;
          case 'DOWN': head.y += 1; break;
          case 'LEFT': head.x -= 1; break;
          case 'RIGHT': head.x += 1; break;
        }
        
        nextMoves[p.id] = { newHead: head, newDirection: newDirection };
      }
      
      const snakeBodies = new Set(Object.values(currentRoom.players).flatMap(s => s.positions.slice(1).map(p => `${p.x},${p.y}`)));
  
      // Update players based on pre-calculated moves
      for (const p of Object.values(currentRoom.players)) {
          if (!p.isAlive) {
            updatedPlayers[p.id] = p;
            continue;
          }

        const { newHead, newDirection } = nextMoves[p.id];
        let newSnake = { ...p };
        
        // Check for collisions
        if (newHead.x < 0 || newHead.x >= BOARD_SIZE || newHead.y < 0 || newHead.y >= BOARD_SIZE || snakeBodies.has(`${newHead.x},${newHead.y}`)) {
            newSnake.isAlive = false;
        } else {
            // Add self head to occupied positions for next iteration checks
            Object.values(nextMoves).forEach(move => {
                if (move !== nextMoves[p.id] && move.newHead.x === newHead.x && move.newHead.y === newHead.y) {
                    newSnake.isAlive = false; // Head-on collision
                }
            })
        }

        if(newSnake.isAlive) {
            newSnake.positions.unshift(newHead);
            newSnake.direction = newDirection;
            
            const foodIndex = newFood.findIndex(f => f.x === newHead.x && f.y === newHead.y);
            if (foodIndex !== -1) {
              newSnake.score += 10;
              newFood.splice(foodIndex, 1);
              foodEaten = true;
            } else {
              newSnake.positions.pop();
            }
        }
        updatedPlayers[p.id] = newSnake;
      }
      
      // If food was eaten, generate more
      if (foodEaten) {
          newFood.push(...generateFood(Object.values(updatedPlayers)));
      }
  
      // In a real app, this update would be sent to Firebase
      // and the local state would be set by the onSnapshot listener.
      // For the mock, we set it directly.
      return { ...currentRoom, players: updatedPlayers, food: newFood };
    });
  }, [gameRoom, direction]);


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
    let newDirection = direction;
    switch(e.key) {
        case 'ArrowUp': case 'w': if(direction !== 'DOWN') newDirection = 'UP'; break;
        case 'ArrowDown': case 's': if(direction !== 'UP') newDirection = 'DOWN'; break;
        case 'ArrowLeft': case 'a': if(direction !== 'RIGHT') newDirection = 'LEFT'; break;
        case 'ArrowRight': case 'd': if(direction !== 'LEFT') newDirection = 'RIGHT'; break;
    }
    setDirection(newDirection);
  }, [direction]);

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
                <input type="text" placeholder="Enter your name" value={playerName} onChange={e => setPlayerName(e.target.value)} style={{width: '100%', padding: '10px', marginBottom: '15px'}}/>
                <button onClick={createRoom} disabled={!playerName.trim()} className="menu-button">Create Arena</button>
                <div style={{margin: '20px 0', textAlign: 'center'}}>- OR -</div>
                <input type="text" placeholder="Enter room code" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} style={{width: '100%', padding: '10px', marginBottom: '15px'}}/>
                <button onClick={joinRoom} disabled={!playerName.trim() || !roomCode.trim()} className="menu-button multiplayer">Join Arena</button>
            </div>
        </div>
    );
  }
  
  return (
    <div className="snake-game" style={{ '--board-size': BOARD_SIZE } as React.CSSProperties}>
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
        </div>
      )}
    </div>
  );
};

export default MultiplayerSnakeGame;