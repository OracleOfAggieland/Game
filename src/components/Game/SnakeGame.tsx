// src/components/Game/SnakeGame.tsx
import React, { useState, useEffect, useCallback } from 'react';
import './SnakeGame.css';

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
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Position>(INITIAL_FOOD);
  const [direction, setDirection] = useState<Direction>(INITIAL_DIRECTION);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);

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
        setGameOver(true);
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
  }, [direction, food, gameOver, gameStarted, generateFood]);

  // Handle keyboard input
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (!gameStarted) {
      if (e.code === 'Space') {
        setGameStarted(true);
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

  return (
    <div className="snake-game">
      <div className="game-info">
        <h1>Snake Game</h1>
        <div className="score">Score: {score}</div>
      </div>
      
      <div className="game-board">
        {createBoard()}
      </div>

      {!gameStarted && !gameOver && (
        <div className="game-message">
          <p>Press SPACE to start!</p>
          <p>Use arrow keys or WASD to move</p>
        </div>
      )}

      {gameOver && (
        <div className="game-message">
          <h2>Game Over!</h2>
          <p>Final Score: {score}</p>
          <p>Press SPACE to play again</p>
        </div>
      )}

      <div className="controls">
        <p>Controls: Arrow keys or WASD to move</p>
        {gameStarted && !gameOver && <p>Length: {snake.length}</p>}
      </div>
    </div>
  );
};

export default SnakeGame;