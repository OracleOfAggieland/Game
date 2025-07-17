// src/App.tsx
import React, { useState } from 'react';
import SnakeGame from './components/Game/SnakeGame';
import './App.css';

type GameMode = 'menu' | 'single';

function App() {
  const [gameMode, setGameMode] = useState<GameMode>('menu');

  const renderModeSelector = () => (
    <div className="app-container">
      <div className="menu-container">
        <h1>🐍 Snake Game 🐍</h1>
        <h2>Choose Your Mode</h2>
        
        <button
          onClick={() => setGameMode('single')}
          className="menu-button"
        >
          <div className="button-title">🎯 Classic Mode</div>
          <div className="button-description">A timeless solo snake experience.</div>
        </button>
        
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
      {gameMode === 'single' && <SnakeGame />}
    </div>
  );
}

export default App;