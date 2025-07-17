// src/components/Game/PowerUpIndicator.tsx
import React from 'react';
import { PowerUpType, POWER_UP_CONFIG } from '../../types/PowerUp';
import { PowerUpEffects } from '../../utils/PowerUpEffects';
import { EnhancedSnake } from '../../types/GameEnhancements';

interface PowerUpIndicatorProps {
  snake: EnhancedSnake;
  isCompact?: boolean;
}

const PowerUpIndicator: React.FC<PowerUpIndicatorProps> = React.memo(({ snake, isCompact = false }) => {
  const activeEffects = PowerUpEffects.getActiveEffectIndicators(snake);

  if (activeEffects.length === 0) {
    return null;
  }

  return (
    <div className={`powerup-indicator ${isCompact ? 'compact' : ''}`}>
      {activeEffects.map((effect, index) => {
        const config = POWER_UP_CONFIG[effect.type];
        const timeRemaining = effect.timeRemaining ? Math.ceil(effect.timeRemaining / 1000) : null;
        
        return (
          <div
            key={`${effect.type}-${index}`}
            className={`powerup-effect ${effect.isActive ? 'active' : 'inactive'}`}
            style={{
              backgroundColor: effect.color,
              boxShadow: `0 0 8px ${effect.color}`,
              opacity: effect.isActive ? 1 : 0.5
            }}
            title={`${config.name}: ${config.description}${timeRemaining ? ` (${timeRemaining}s)` : ''}`}
          >
            <div className="powerup-icon">
              {getPowerUpIcon(effect.type)}
            </div>
            {!isCompact && (
              <div className="powerup-info">
                <div className="powerup-name">{config.name}</div>
                {timeRemaining && (
                  <div className="powerup-timer">{timeRemaining}s</div>
                )}
                {effect.type === 'SHIELD' && snake.shieldCount > 0 && (
                  <div className="powerup-count">×{snake.shieldCount}</div>
                )}
              </div>
            )}
            {timeRemaining && isCompact && (
              <div className="powerup-timer-compact">{timeRemaining}</div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// Helper function to get power-up icons
const getPowerUpIcon = (type: PowerUpType): string => {
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

export default PowerUpIndicator;