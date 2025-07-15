// src/App.tsx
import React, { useState } from 'react';
import SnakeGame from './components/Game/SnakeGame';
import MultiplayerSnakeGame from './components/Game/MultiplayerSnakeGame';
import './App.css';

type GameMode = 'menu' | 'single' | 'multiplayer';

function App() {
  const [gameMode, setGameMode] = useState<GameMode>('menu');

  const renderModeSelector = () => (
    <div className="app-container">
      <div className="menu-container">
        <h1>🐍 Snake Game 🐍</h1>
        <h2>Choose Your Arena</h2>
        
        <button
          onClick={() => setGameMode('single')}
          className="menu-button"
        >
          <div className="button-title">🎯 Classic Mode</div>
          <div className="button-description">A timeless solo snake experience.</div>
        </button>
        
        <button
          onClick={() => setGameMode('multiplayer')}
          className="menu-button multiplayer"
        >
          <div className="button-title">⚔️ Arena Mode</div>
          <div className="button-description">Battle players & AI in real-time.</div>
        </button>
        
        <div className="feature-box">
          <h3>🔥 Arena Mode Features</h3>
          <ul>
            <li>• Real-time multiplayer battles</li>
            <li>• Smart AI opponents</li>
            <li>• 3-minute competitive rounds</li>
            <li>• Collision-based elimination</li>
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
      {gameMode === 'single' && <SnakeGame />}
      {gameMode === 'multiplayer' && <MultiplayerSnakeGame />}
    </div>
  );
}

export default App;