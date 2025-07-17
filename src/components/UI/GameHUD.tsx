// src/components/UI/GameHUD.tsx
import React, { useMemo } from 'react';
// import PowerUpIndicator from '../Game/PowerUpIndicator'; // Commented out as unused
import { Snake } from '../../types/GameEnhancements';
import { PowerUpManager } from '../../managers/PowerUpManager';
import { Wave, BossSnake } from '../../types/Wave';

interface GameHUDProps {
  playerSnake: Snake | null;
  allSnakes: Snake[];
  timeLeft: number;
  roomCode: string;
  powerUpManager: PowerUpManager;
  currentWave?: Wave | null;
  bossSnakes?: BossSnake[];
  isMobile?: boolean;
}

const GameHUD: React.FC<GameHUDProps> = React.memo(({
  playerSnake,
  allSnakes,
  timeLeft,
  roomCode,
  powerUpManager,
  currentWave,
  bossSnakes = [],
  isMobile = false
}) => {
  // Memoize expensive calculations
  const activePowerUps = useMemo(() => powerUpManager.getActivePowerUps(), [powerUpManager]);
  const aliveBossSnakes = useMemo(() => bossSnakes.filter(boss => boss.isAlive), [bossSnakes]);
  
  // Memoize sorted snakes for leaderboard with stable sort
  const sortedSnakes = useMemo(() => 
    [...allSnakes].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.id.localeCompare(b.id); // Stable sort by ID
    }), 
    [allSnakes]
  );

  // Memoize formatted time to prevent unnecessary re-renders (commented out as unused)
  // const formattedTime = useMemo(() => {
  //   const minutes = Math.floor(timeLeft / 60);
  //   const seconds = (timeLeft % 60).toString().padStart(2, '0');
  //   return `${minutes}:${seconds}`;
  // }, [timeLeft]);

  return (
    <div className={`game-hud ${isMobile ? 'mobile' : 'desktop'}`}>
      {/* Top HUD - Game Info */}
      <div className="hud-top">
        <div className="game-title">Snake Arena</div>
        <div className="game-stats">
          <div className="room-code">Room: {roomCode}</div>
          <div className="time-left">
            Time: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
          {/* Wave Information */}
          {currentWave && (
            <div className={`wave-info ${currentWave.isBossWave ? 'boss-wave' : ''}`}>
              Wave {currentWave.number}
              {currentWave.isBossWave && ' 👑'}
              {aliveBossSnakes.length > 0 && (
                <span className="boss-count"> ({aliveBossSnakes.length} Boss)</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Player Power-ups */}
      {playerSnake && (
        <div className="hud-powerups">
          <div className="powerups-label">Active Effects:</div>
          {/* TODO: PowerUpIndicator needs to be updated to work with Snake type or we need EnhancedSnake */}
          <div className="powerup-placeholder">Power-ups: {powerUpManager.getPlayerPowerUps(playerSnake.id).length}</div>
        </div>
      )}

      {/* Active Power-ups on Board */}
      {activePowerUps.length > 0 && (
        <div className="hud-board-powerups">
          <div className="board-powerups-label">Available Power-ups:</div>
          <div className="board-powerups-list">
            {activePowerUps.map(powerUp => {
              const config = powerUpManager.getPowerUpConfig(powerUp.type);
              return (
                <div
                  key={powerUp.id}
                  className="board-powerup-item"
                  style={{
                    backgroundColor: config.color,
                    boxShadow: `0 0 6px ${config.color}`
                  }}
                  title={`${config.name}: ${config.description}`}
                >
                  {getPowerUpIcon(powerUp.type)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Player Scores */}
      <div className="hud-scores">
        <div className="scores-label">Leaderboard:</div>
        <div className="scores-list">
          {sortedSnakes.map((snake, index) => (
            <div
              key={snake.id}
              className={`score-item ${!snake.isAlive ? 'dead' : ''} ${
                playerSnake && snake.id === playerSnake.id ? 'player' : ''
              }`}
              style={{ color: snake.color }}
            >
              <span className="rank">#{index + 1}</span>
              <span className="name">
                {snake.name}
                {snake.isAI ? ' 🤖' : ' 👤'}
              </span>
              <span className="score">{snake.score}</span>
              {snake.isAI && snake.aiPersonality && !isMobile && (
                <span className="ai-type">({snake.aiPersonality})</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Power-up Legend (Desktop only) */}
      {!isMobile && (
        <div className="hud-legend">
          <div className="legend-label">Power-up Guide:</div>
          <div className="legend-items">
            <div className="legend-item">
              <span className="legend-icon" style={{ color: '#FFD700' }}>⚡</span>
              <span className="legend-text">Speed Boost</span>
            </div>
            <div className="legend-item">
              <span className="legend-icon" style={{ color: '#4169E1' }}>🛡️</span>
              <span className="legend-text">Shield</span>
            </div>
            <div className="legend-item">
              <span className="legend-icon" style={{ color: '#9370DB' }}>👻</span>
              <span className="legend-text">Ghost Mode</span>
            </div>
            <div className="legend-item">
              <span className="legend-icon" style={{ color: '#00FFFF' }}>❄️</span>
              <span className="legend-text">Freeze AI</span>
            </div>
            <div className="legend-item">
              <span className="legend-icon" style={{ color: '#FF6347' }}>💎</span>
              <span className="legend-text">Score 2x</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// Helper function to get power-up icons
const getPowerUpIcon = (type: string): string => {
  switch (type) {
    case 'SPEED_BOOST':
      return '⚡';
    case 'SHIELD':
      return '🛡️';
    case 'GHOST_MODE':
      return '👻';
    case 'FREEZE':
      return '❄️';
    case 'SCORE_MULTIPLIER':
      return '💎';
    default:
      return '✨';
  }
};

export default GameHUD;