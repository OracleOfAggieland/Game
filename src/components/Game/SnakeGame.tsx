// src/components/Game/SnakeGame.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { updateUserStats } from '../../services/auth';
import UserProfile from '../User/UserProfile';
import LoginForm from '../Auth/LoginForm';
import './SnakeGame.css';
import '../Auth/Auth.css';

interface Position {
  x: number;
  y: number;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

const BOARD_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_FOOD = { x: 15, y: 15 };
const INITIAL_DIRECTION: Direction = 'RIGHT';

const SnakeGame: React.FC = () => {
  const { currentUser, userData, loading, refreshUserData } = useAuth();
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Position>(INITIAL_FOOD);
  const [direction, setDirection] = useState<Direction>(INITIAL_DIRECTION);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  // Generate random food position
  const generateFood = useCallback(() => {
    const newFood = {
      x: Math.floor(Math.random() * BOARD_SIZE),
      y: Math.floor(Math.random() * BOARD_SIZE)
    };
    return newFood;
  }, []);

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

  // Handle game over
  const handleGameOver = useCallback(async () => {
    setGameOver(true);
    
    // Check for new high score
    const isNewHigh = userData ? score > userData.highScore : false;
    setIsNewHighScore(isNewHigh);
    
    // Update user stats if logged in
    if (currentUser) {
      try {
        await updateUserStats(currentUser.uid, score);
        await refreshUserData();
      } catch (error) {
        console.error('Error updating user stats:', error);
      }
    }
  }, [currentUser, score, userData, refreshUserData]);

  // Move snake
  const moveSnake = useCallback(() => {
    if (gameOver || !gameStarted) return;

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
        handleGameOver();
        return currentSnake;
      }

      newSnake.unshift(head);

      // Check if food is eaten
      if (head.x === food.x && head.y === food.y) {
        setScore(prev => prev + 10);
        setFood(generateFood());
      } else {
        newSnake.pop(); // Remove tail if no food eaten
      }

      return newSnake;
    });
  }, [direction, food, gameOver, gameStarted, generateFood, handleGameOver]);

  // Handle keyboard input
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    // Prevent default behavior for arrow keys and space to stop page scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }

    if (!gameStarted && !gameOver) {
      if (e.code === 'Space') {
        setGameStarted(true);
        setIsNewHighScore(false);
      }
      return;
    }

    if (gameOver) {
      if (e.code === 'Space') {
        // Restart game
        setSnake(INITIAL_SNAKE);
        setFood(INITIAL_FOOD);
        setDirection(INITIAL_DIRECTION);
        setGameOver(false);
        setScore(0);
        setGameStarted(true);
        setIsNewHighScore(false);
      }
      return;
    }

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
    }
  }, [direction, gameOver, gameStarted]);

  // Game loop
  useEffect(() => {
    const gameInterval = setInterval(moveSnake, 150);
    return () => clearInterval(gameInterval);
  }, [moveSnake]);

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

  if (loading) {
    return (
      <div className="snake-game">
        <div className="game-message">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="snake-game">
      {currentUser ? (
        <UserProfile />
      ) : (
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <button 
            onClick={() => setShowAuth(true)} 
            className="submit-btn"
            style={{ maxWidth: '200px', margin: '0 auto' }}
          >
            Login / Sign Up
          </button>
          <p style={{ color: '#ccc', marginTop: '10px', fontSize: '14px' }}>
            Sign in to save your high scores!
          </p>
        </div>
      )}

      <div className="game-info">
        <h1>Snake Game</h1>
        <div className="score">
          Current Score: {score}
          {userData && (
            <div style={{ fontSize: '16px', marginTop: '5px', color: '#00ff88' }}>
              Best: {userData.highScore}
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
          <p>Use arrow keys or WASD to move</p>
          {currentUser && (
            <p style={{ color: '#00ff88', fontSize: '14px' }}>
              Playing as {userData?.displayName}
            </p>
          )}
        </div>
      )}

      {gameOver && (
        <div className="game-message">
          <h2>Game Over!</h2>
          {isNewHighScore && (
            <p style={{ color: '#ffaa00', fontSize: '20px', fontWeight: 'bold' }}>
              🎉 NEW HIGH SCORE! 🎉
            </p>
          )}
          <p>Final Score: {score}</p>
          {userData && (
            <p>Best Score: {userData.highScore}</p>
          )}
          <p>Press SPACE to play again</p>
          {!currentUser && (
            <p style={{ color: '#00ff88', fontSize: '14px', marginTop: '10px' }}>
              Sign in to save your scores!
            </p>
          )}
        </div>
      )}

      <div className="controls">
        <p>Controls: Arrow keys or WASD to move</p>
        {gameStarted && !gameOver && <p>Length: {snake.length}</p>}
      </div>

      {showAuth && (
        <div className="auth-overlay">
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowAuth(false)}
              style={{
                position: 'absolute',
                top: '-10px',
                right: '-10px',
                background: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                cursor: 'pointer',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
            <LoginForm onSuccess={() => setShowAuth(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default SnakeGame;