// src/App.tsx
import React, { useState } from 'react';
import SnakeGame from './components/Game/SnakeGame';
import SnakeGameLevel2 from './components/Game/SnakeGameLevel2';
import SnakeGameLevel3 from './components/Game/SnakeGameLevel3';
import './App.css';

type GameMode = 'menu' | 'level1' | 'level2' | 'level3';

function App() {
  const [gameMode, setGameMode] = useState<GameMode>('menu');

  const renderModeSelector = () => (
    <div className="app-container">
      <div className="menu-container">
        <h1>🐍 Snake Game 🐍</h1>
        <h2>Choose Your Level</h2>
        
        <button
          onClick={() => setGameMode('level1')}
          className="menu-button"
        >
          <div className="button-title">🎯 Level 1: Classic</div>
          <div className="button-description">The timeless snake experience</div>
        </button>

        <button
          onClick={() => setGameMode('level2')}
          className="menu-button"
        >
          <div className="button-title">🧱 Level 2: Obstacles</div>
          <div className="button-description">Navigate through walls and barriers</div>
        </button>

        <button
          onClick={() => setGameMode('level3')}
          className="menu-button"
        >
          <div className="button-title">🤖 Level 3: Bot Battle</div>
          <div className="button-description">Face off against AI with power-ups!</div>
        </button>
        
        <div className="feature-box">
          <h3>New Features!</h3>
          <ul>
            <li>🧱 Level 2: Smart obstacle placement</li>
            <li>🤖 Level 3: AI opponent with strategy</li>
            <li>⚡ Power-ups: Speed, invincibility, and more!</li>
            <li>🏆 Score multipliers and special effects</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderBackButton = () => (
    <button
      onClick={() => setGameMode('menu')}
      className="back-button"
    >
      ← Back to Menu
    </button>
  );

  return (
    <div className="App">
      {gameMode === 'menu' && renderModeSelector()}
      {gameMode !== 'menu' && renderBackButton()}
      {gameMode === 'level1' && <SnakeGame />}
      {gameMode === 'level2' && <SnakeGameLevel2 />}
      {gameMode === 'level3' && <SnakeGameLevel3 />}
    </div>
  );
}

export default App;