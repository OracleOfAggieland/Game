// src/App.tsx
import React, { useState } from 'react';
import SnakeGame from './components/Game/SnakeGame';
import MultiplayerSnakeGame from './components/Game/MultiplayerSnakeGame';
import './App.css';

type GameMode = 'menu' | 'single' | 'multiplayer';

function App() {
  const [gameMode, setGameMode] = useState<GameMode>('menu');

  const renderModeSelector = () => (
    <div className="snake-game">
      <div className="game-info">
        <h1>🐍 Snake Game 🐍</h1>
        <div className="menu-container" style={{ 
          background: 'rgba(0,0,0,0.8)', 
          padding: '40px', 
          borderRadius: '15px',
          border: '3px solid #00ff88',
          maxWidth: '500px',
          boxShadow: '0 0 30px rgba(0, 255, 136, 0.3)'
        }}>
          <h2 style={{ color: '#00ff88', marginBottom: '30px', textAlign: 'center' }}>
            Choose Game Mode
          </h2>
          
          <button
            onClick={() => setGameMode('single')}
            style={{
              width: '100%',
              padding: '20px',
              marginBottom: '15px',
              backgroundColor: '#00ff88',
              color: 'black',
              border: 'none',
              borderRadius: '10px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(0, 255, 136, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 255, 136, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 255, 136, 0.3)';
            }}
          >
            🎯 Classic Mode
            <div style={{ fontSize: '14px', fontWeight: 'normal', marginTop: '5px', opacity: 0.8 }}>
              Play solo against the clock
            </div>
          </button>
          
          <button
            onClick={() => setGameMode('multiplayer')}
            style={{
              width: '100%',
              padding: '20px',
              marginBottom: '20px',
              backgroundColor: '#ff4444',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(255, 68, 68, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 68, 68, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 68, 68, 0.3)';
            }}
          >
            ⚔️ Arena Mode
            <div style={{ fontSize: '14px', fontWeight: 'normal', marginTop: '5px', opacity: 0.8 }}>
              Battle players & AI in real-time
            </div>
          </button>
          
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.1)', 
            padding: '15px', 
            borderRadius: '8px',
            fontSize: '14px',
            color: '#ccc',
            textAlign: 'center'
          }}>
            <strong style={{ color: '#ffaa00' }}>🔥 Arena Mode Features:</strong>
            <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0 0' }}>
              <li>• Real-time multiplayer battles</li>
              <li>• Smart AI opponents</li>
              <li>• 3-minute competitive rounds</li>
              <li>• Collision-based elimination</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBackButton = () => (
    <button
      onClick={() => setGameMode('menu')}
      style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        padding: '10px 15px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: '#00ff88',
        border: '2px solid #00ff88',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 'bold',
        cursor: 'pointer',
        zIndex: 1000,
        transition: 'all 0.3s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#00ff88';
        e.currentTarget.style.color = 'black';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        e.currentTarget.style.color = '#00ff88';
      }}
    >
      ← Back to Menu
    </button>
  );

  return (
    <div className="App">
      {gameMode === 'menu' && renderModeSelector()}
      {gameMode === 'single' && (
        <>
          {renderBackButton()}
          <SnakeGame />
        </>
      )}
      {gameMode === 'multiplayer' && (
        <>
          {renderBackButton()}
          <MultiplayerSnakeGame />
        </>
      )}
    </div>
  );
}

export default App;