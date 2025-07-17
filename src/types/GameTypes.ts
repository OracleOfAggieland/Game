// src/types/GameTypes.ts
export interface Position {
  x: number;
  y: number;
}

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface Obstacle {
  positions: Position[];
  type: 'wall' | 'rock';
}

export interface PowerUp {
  id: string;
  type: PowerUpType;
  position: Position;
  duration?: number;
  color: string;
  icon: string;
}

export type PowerUpType = 'SPEED_BOOST' | 'INVINCIBILITY' | 'DOUBLE_POINTS' | 'SLOW_MOTION' | 'GHOST_MODE';

export interface ActivePowerUp {
  type: PowerUpType;
  startTime: number;
  duration: number;
}

export const POWER_UP_CONFIG: Record<PowerUpType, {
  color: string;
  duration: number;
  icon: string;
  effect: string;
}> = {
  SPEED_BOOST: {
    color: '#FFD700',
    duration: 5000,
    icon: '⚡',
    effect: '2x Speed'
  },
  INVINCIBILITY: {
    color: '#4169E1',
    duration: 7000,
    icon: '🛡️',
    effect: 'No Collision'
  },
  DOUBLE_POINTS: {
    color: '#FF6347',
    duration: 10000,
    icon: '💎',
    effect: '2x Points'
  },
  SLOW_MOTION: {
    color: '#9370DB',
    duration: 8000,
    icon: '🐌',
    effect: '0.5x Speed'
  },
  GHOST_MODE: {
    color: '#00CED1',
    duration: 6000,
    icon: '👻',
    effect: 'Pass Through'
  }
};

export interface BotSnake {
  id: string;
  positions: Position[];
  direction: Direction;
  color: string;
  name: string;
  targetFood?: Position;
  score: number;
}

export interface GameState {
  snake: Position[];
  food: Position;
  obstacles: Obstacle[];
  powerUps: PowerUp[];
  activePowerUps: ActivePowerUp[];
  botSnake?: BotSnake;
  score: number;
  gameOver: boolean;
  winner?: 'player' | 'bot';
}