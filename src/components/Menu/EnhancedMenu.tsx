import React, { useState, useEffect, useRef } from 'react';
import './EnhancedMenu.css';

interface EnhancedMenuProps {
  onSelectMode: (mode: 'level1' | 'level2' | 'level3' | 'tutorial') => void;
}

interface GameStats {
  gamesPlayed: number;
  highScores: {
    level1: number;
    level2: number;
    level3: number;
  };
  totalFoodEaten: number;
  totalPowerUpsCollected: number;
  achievements: string[];
}

interface Theme {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

const THEMES: Theme[] = [
  { name: 'Classic', primary: '#00ff88', secondary: '#ff4444', accent: '#ffaa00', background: '#111' },
  { name: 'Neon', primary: '#ff00ff', secondary: '#00ffff', accent: '#ffff00', background: '#0a0a0a' },
  { name: 'Ocean', primary: '#00ced1', secondary: '#4169e1', accent: '#20b2aa', background: '#001f3f' },
  { name: 'Sunset', primary: '#ff6347', secondary: '#ffa500', accent: '#ff1493', background: '#2b1329' },
  { name: 'Matrix', primary: '#00ff00', secondary: '#008000', accent: '#90ee90', background: '#000000' }
];

const ACHIEVEMENTS = [
  { id: 'first_win', name: 'First Victory', description: 'Win your first game', icon: '🏆' },
  { id: 'speed_demon', name: 'Speed Demon', description: 'Reach maximum speed', icon: '⚡' },
  { id: 'power_collector', name: 'Power Collector', description: 'Collect 50 power-ups', icon: '💎' },
  { id: 'survivor', name: 'Survivor', description: 'Survive for 5 minutes', icon: '⏱️' },
  { id: 'snake_master', name: 'Snake Master', description: 'Score 1000 points', icon: '👑' }
];

export const EnhancedMenu: React.FC<EnhancedMenuProps> = ({ onSelectMode }) => {
  const [currentTheme, setCurrentTheme] = useState<Theme>(THEMES[0]);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [gameStats, setGameStats] = useState<GameStats>({
    gamesPlayed: 0,
    highScores: { level1: 0, level2: 0, level3: 0 },
    totalFoodEaten: 0,
    totalPowerUpsCollected: 0,
    achievements: []
  });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [particlesEnabled, setParticlesEnabled] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snakeAnimationRef = useRef<number>();

  // Load saved settings and stats
  useEffect(() => {
    const savedTheme = localStorage.getItem('snakeTheme');
    if (savedTheme) {
      const theme = THEMES.find(t => t.name === savedTheme) || THEMES[0];
      setCurrentTheme(theme);
      applyTheme(theme);
    }

    const savedStats = localStorage.getItem('snakeGameStats');
    if (savedStats) {
      setGameStats(JSON.parse(savedStats));
    }

    const savedSound = localStorage.getItem('snakeSoundEnabled');
    setSoundEnabled(savedSound !== 'false');

    const savedParticles = localStorage.getItem('snakeParticlesEnabled');
    setParticlesEnabled(savedParticles !== 'false');
  }, []);

  // Apply theme to CSS variables
  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', theme.primary);
    root.style.setProperty('--secondary-color', theme.secondary);
    root.style.setProperty('--accent-color', theme.accent);
    root.style.setProperty('--background-color', theme.background);
  };

  // Animated snake background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const snakes: Array<{
      x: number;
      y: number;
      length: number;
      direction: number;
      segments: Array<{ x: number; y: number }>;
      color: string;
      speed: number;
    }> = [];

    // Create background snakes
    for (let i = 0; i < 3; i++) {
      const snake = {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        length: 15 + Math.random() * 10,
        direction: Math.random() * Math.PI * 2,
        segments: [] as Array<{ x: number; y: number }>,
        color: i === 0 ? currentTheme.primary : i === 1 ? currentTheme.secondary : currentTheme.accent,
        speed: 1 + Math.random() * 2
      };

      // Initialize segments
      for (let j = 0; j < snake.length; j++) {
        snake.segments.push({ x: snake.x, y: snake.y });
      }

      snakes.push(snake);
    }

    const animate = () => {
      ctx.fillStyle = currentTheme.background + '20';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      snakes.forEach(snake => {
        // Update snake position
        snake.direction += (Math.random() - 0.5) * 0.2;
        snake.x += Math.cos(snake.direction) * snake.speed;
        snake.y += Math.sin(snake.direction) * snake.speed;

        // Wrap around screen
        if (snake.x < 0) snake.x = canvas.width;
        if (snake.x > canvas.width) snake.x = 0;
        if (snake.y < 0) snake.y = canvas.height;
        if (snake.y > canvas.height) snake.y = 0;

        // Update segments
        snake.segments.unshift({ x: snake.x, y: snake.y });
        snake.segments.pop();

        // Draw snake
        ctx.strokeStyle = snake.color + '40';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        
        snake.segments.forEach((segment, index) => {
          if (index === 0) {
            ctx.moveTo(segment.x, segment.y);
          } else {
            ctx.lineTo(segment.x, segment.y);
          }
        });
        
        ctx.stroke();

        // Draw snake head
        ctx.fillStyle = snake.color + '80';
        ctx.beginPath();
        ctx.arc(snake.x, snake.y, 6, 0, Math.PI * 2);
        ctx.fill();
      });

      snakeAnimationRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (snakeAnimationRef.current) {
        cancelAnimationFrame(snakeAnimationRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [currentTheme]);

  const handleThemeChange = (theme: Theme) => {
    setCurrentTheme(theme);
    applyTheme(theme);
    localStorage.setItem('snakeTheme', theme.name);
  };

  const handleSoundToggle = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem('snakeSoundEnabled', newValue.toString());
  };

  const handleParticlesToggle = () => {
    const newValue = !particlesEnabled;
    setParticlesEnabled(newValue);
    localStorage.setItem('snakeParticlesEnabled', newValue.toString());
  };

  const startTutorial = () => {
    setShowTutorial(false);
    onSelectMode('tutorial');
  };

  return (
    <div className="enhanced-menu">
      <canvas ref={canvasRef} className="menu-background" />
      
      <div className="menu-content">
        <div className="menu-header">
          <h1 className="game-title">
            <span className="snake-icon">🐍</span>
            <span className="title-text">SNAKE EVOLUTION</span>
            <span className="snake-icon">🐍</span>
          </h1>
          <p className="game-subtitle">A Modern Classic Reimagined</p>
        </div>

        {!showSettings && !showStats && !showTutorial ? (
          <div className="main-menu">
            <div className="level-cards">
              <div className="level-card" onClick={() => onSelectMode('level1')}>
                <div className="card-icon">🎯</div>
                <h3>Classic Mode</h3>
                <p>The timeless snake experience</p>
                <div className="high-score">Best: {gameStats.highScores.level1}</div>
              </div>

              <div className="level-card" onClick={() => onSelectMode('level2')}>
                <div className="card-icon">🧱</div>
                <h3>Obstacle Course</h3>
                <p>Navigate through challenging mazes</p>
                <div className="high-score">Best: {gameStats.highScores.level2}</div>
              </div>

              <div className="level-card" onClick={() => onSelectMode('level3')}>
                <div className="card-icon">🤖</div>
                <h3>AI Battle</h3>
                <p>Face off against smart opponents</p>
                <div className="high-score">Best: {gameStats.highScores.level3}</div>
              </div>
            </div>

            <div className="menu-actions">
              <button className="menu-button tutorial-btn" onClick={() => setShowTutorial(true)}>
                <span className="btn-icon">🎓</span>
                Tutorial
              </button>
              <button className="menu-button stats-btn" onClick={() => setShowStats(true)}>
                <span className="btn-icon">📊</span>
                Statistics
              </button>
              <button className="menu-button settings-btn" onClick={() => setShowSettings(true)}>
                <span className="btn-icon">⚙️</span>
                Settings
              </button>
            </div>

            <div className="quick-stats">
              <div className="stat-item">
                <span className="stat-icon">🎮</span>
                <span className="stat-value">{gameStats.gamesPlayed}</span>
                <span className="stat-label">Games</span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">🍎</span>
                <span className="stat-value">{gameStats.totalFoodEaten}</span>
                <span className="stat-label">Food</span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">✨</span>
                <span className="stat-value">{gameStats.achievements.length}/{ACHIEVEMENTS.length}</span>
                <span className="stat-label">Achievements</span>
              </div>
            </div>
          </div>
        ) : showSettings ? (
          <div className="settings-panel">
            <h2>Settings</h2>
            
            <div className="settings-section">
              <h3>Theme</h3>
              <div className="theme-selector">
                {THEMES.map(theme => (
                  <div
                    key={theme.name}
                    className={`theme-option ${currentTheme.name === theme.name ? 'active' : ''}`}
                    onClick={() => handleThemeChange(theme)}
                  >
                    <div className="theme-preview" style={{
                      background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`
                    }} />
                    <span>{theme.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <h3>Game Options</h3>
              <div className="toggle-option">
                <span>Sound Effects</span>
                <button 
                  className={`toggle-button ${soundEnabled ? 'active' : ''}`}
                  onClick={handleSoundToggle}
                >
                  {soundEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="toggle-option">
                <span>Particle Effects</span>
                <button 
                  className={`toggle-button ${particlesEnabled ? 'active' : ''}`}
                  onClick={handleParticlesToggle}
                >
                  {particlesEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            <button className="back-btn" onClick={() => setShowSettings(false)}>
              ← Back to Menu
            </button>
          </div>
        ) : showStats ? (
          <div className="stats-panel">
            <h2>Statistics & Achievements</h2>
            
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Games Played</h3>
                <div className="stat-number">{gameStats.gamesPlayed}</div>
              </div>
              <div className="stat-card">
                <h3>Total Food Eaten</h3>
                <div className="stat-number">{gameStats.totalFoodEaten}</div>
              </div>
              <div className="stat-card">
                <h3>Power-ups Collected</h3>
                <div className="stat-number">{gameStats.totalPowerUpsCollected}</div>
              </div>
              <div className="stat-card">
                <h3>Best Combined Score</h3>
                <div className="stat-number">
                  {gameStats.highScores.level1 + gameStats.highScores.level2 + gameStats.highScores.level3}
                </div>
              </div>
            </div>

            <div className="achievements-section">
              <h3>Achievements</h3>
              <div className="achievements-grid">
                {ACHIEVEMENTS.map(achievement => (
                  <div 
                    key={achievement.id}
                    className={`achievement-card ${gameStats.achievements.includes(achievement.id) ? 'unlocked' : 'locked'}`}
                  >
                    <div className="achievement-icon">{achievement.icon}</div>
                    <div className="achievement-info">
                      <h4>{achievement.name}</h4>
                      <p>{achievement.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button className="back-btn" onClick={() => setShowStats(false)}>
              ← Back to Menu
            </button>
          </div>
        ) : showTutorial ? (
          <div className="tutorial-panel">
            <h2>How to Play</h2>
            
            <div className="tutorial-content">
              <div className="tutorial-section">
                <h3>🎮 Controls</h3>
                <p>• Use Arrow Keys or WASD to move</p>
                <p>• Swipe on mobile devices</p>
                <p>• Press SPACE to pause</p>
              </div>

              <div className="tutorial-section">
                <h3>🎯 Objectives</h3>
                <p>• Eat food to grow longer</p>
                <p>• Avoid walls and your own tail</p>
                <p>• Collect power-ups for special abilities</p>
              </div>

              <div className="tutorial-section">
                <h3>⚡ Power-ups</h3>
                <div className="powerup-list">
                  <p>⚡ Speed Boost - Move faster</p>
                  <p>🛡️ Shield - Survive one collision</p>
                  <p>👻 Ghost Mode - Pass through snakes</p>
                  <p>💎 Double Points - 2x score</p>
                  <p>🐌 Slow Motion - Move slower</p>
                </div>
              </div>

              <div className="tutorial-section">
                <h3>💡 Tips</h3>
                <p>• Plan your path ahead</p>
                <p>• Use the edges strategically</p>
                <p>• Collect combos for bonus points</p>
              </div>
            </div>

            <div className="tutorial-actions">
              <button className="menu-button play-tutorial" onClick={startTutorial}>
                Play Interactive Tutorial
              </button>
              <button className="back-btn" onClick={() => setShowTutorial(false)}>
                ← Back to Menu
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
