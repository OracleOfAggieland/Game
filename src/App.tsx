import React, { useState, useEffect } from 'react';
import SnakeGame from './components/Game/SnakeGame';
import SnakeGameLevel2 from './components/Game/SnakeGameLevel2';
import SnakeGameLevel3 from './components/Game/SnakeGameLevel3';
import TutorialMode from './components/Game/TutorialMode';
import { EnhancedMenu } from './components/Menu/EnhancedMenu';
import './App.css';

type GameMode = 'menu' | 'level1' | 'level2' | 'level3' | 'tutorial';

function App() {
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [particlesEnabled, setParticlesEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Load settings
  useEffect(() => {
    const savedParticles = localStorage.getItem('snakeParticlesEnabled');
    setParticlesEnabled(savedParticles !== 'false');
    
    const savedSound = localStorage.getItem('snakeSoundEnabled');
    setSoundEnabled(savedSound !== 'false');
  }, []);

  const handleModeSelect = (mode: 'level1' | 'level2' | 'level3' | 'tutorial') => {
    setGameMode(mode);
  };

  const renderBackButton = () => (
    <button
      onClick={() => setGameMode('menu')}
      className="enhanced-back-button"
    >
      <span className="back-arrow">←</span>
      <span className="back-text">Menu</span>
    </button>
  );

  return (
    <div className="App">
      {gameMode === 'menu' && (
        <EnhancedMenu onSelectMode={handleModeSelect} />
      )}
      {gameMode !== 'menu' && renderBackButton()}
      {gameMode === 'level1' && (
        <SnakeGame 
          particlesEnabled={particlesEnabled} 
          soundEnabled={soundEnabled} 
        />
      )}
      {gameMode === 'level2' && (
        <SnakeGameLevel2 
          particlesEnabled={particlesEnabled} 
          soundEnabled={soundEnabled} 
        />
      )}
      {gameMode === 'level3' && (
        <SnakeGameLevel3 
          particlesEnabled={particlesEnabled} 
          soundEnabled={soundEnabled} 
        />
      )}
      {gameMode === 'tutorial' && (
        <TutorialMode 
          onComplete={() => setGameMode('menu')}
          particlesEnabled={particlesEnabled} 
          soundEnabled={soundEnabled} 
        />
      )}
    </div>
  );
}

export default App;
