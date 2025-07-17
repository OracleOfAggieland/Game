// src/types/PowerUp.ts
export interface Position {
  x: number;
  y: number;
}

export type PowerUpType = 'SPEED_BOOST' | 'SHIELD' | 'GHOST_MODE' | 'FREEZE' | 'SCORE_MULTIPLIER';

export interface PowerUp {
  id: string;
  type: PowerUpType;
  position: Position;
  spawnTime: number;
  duration?: number;
  isActive: boolean;
}

export interface ActivePowerUp {
  type: PowerUpType;
  startTime: number;
  duration: number;
  playerId: string;
}

export interface PowerUpConfig {
  color: string;
  duration: number; // -1 for one-time use
  effect: number;
  rarity: number; // 0-1 probability
  name: string;
  description: string;
}

export const POWER_UP_CONFIG: Record<PowerUpType, PowerUpConfig> = {
  SPEED_BOOST: {
    color: '#FFD700', // Yellow
    duration: 5000,
    effect: 2.0, // 2x speed
    rarity: 0.3,
    name: 'Speed Boost',
    description: '2x speed for 5 seconds'
  },
  SHIELD: {
    color: '#4169E1', // Blue
    duration: -1, // One-time use
    effect: 1, // One collision immunity
    rarity: 0.25,
    name: 'Shield',
    description: 'Immunity to one collision'
  },
  GHOST_MODE: {
    color: '#9370DB', // Purple
    duration: 3000,
    effect: 1, // Pass through snakes
    rarity: 0.2,
    name: 'Ghost Mode',
    description: 'Pass through snakes for 3 seconds'
  },
  FREEZE: {
    color: '#00FFFF', // Cyan
    duration: 2000,
    effect: 1, // Freeze all AI
    rarity: 0.15,
    name: 'Freeze',
    description: 'Freezes all AI opponents for 2 seconds'
  },
  SCORE_MULTIPLIER: {
    color: '#FF6347', // Gold/Red
    duration: 10000,
    effect: 2.0, // 2x points
    rarity: 0.1,
    name: 'Score Multiplier',
    description: '2x points for 10 seconds'
  }
};

export interface PowerUpSpawnConfig {
  minInterval: number; // Minimum time between spawns (ms)
  maxInterval: number; // Maximum time between spawns (ms)
  maxActive: number; // Maximum active power-ups on board
  spawnChance: number; // Base spawn chance per interval
}

export const DEFAULT_POWERUP_SPAWN_CONFIG: PowerUpSpawnConfig = {
  minInterval: 20000, // 20 seconds
  maxInterval: 30000, // 30 seconds
  maxActive: 5,
  spawnChance: 0.8
};