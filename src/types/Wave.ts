// src/types/Wave.ts
import { Position } from './PowerUp';

export interface Wave {
  number: number;
  startTime: number;
  aiCount: number;
  speedMultiplier: number;
  isBossWave: boolean;
  bonusPoints: number;
  duration?: number; // Optional duration for timed waves
}

export type BossType = 'GIANT' | 'FAST' | 'SMART';

export interface AIPersonality {
  aggression: number; // 0-1: How likely to take risks for food
  intelligence: number; // 0-1: How good at pathfinding and avoiding danger
  patience: number; // 0-1: How willing to wait for better opportunities
  name: string;
  description: string;
}

export interface BossSnake {
  id: string;
  name: string;
  positions: Position[];
  direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  score: number;
  color: string;
  isAlive: boolean;
  isAI: boolean;
  bossType: BossType;
  specialAbilities: string[];
  health: number;
  maxHealth: number;
  aiPersonality: AIPersonality;
  lastDirectionChange?: number;
  lastAbilityUse?: number;
}

export interface WaveDefinition {
  waveNumber: number;
  triggerTime: number; // Time in seconds when wave starts
  aiCount: number;
  speedMultiplier: number;
  isBossWave: boolean;
  bonusPoints: number;
  bossConfig?: {
    type: BossType;
    abilities: string[];
    healthMultiplier: number;
  };
}

export const DEFAULT_WAVE_DEFINITIONS: WaveDefinition[] = [
  {
    waveNumber: 1,
    triggerTime: 0,
    aiCount: 3,
    speedMultiplier: 1.0,
    isBossWave: false,
    bonusPoints: 0
  },
  {
    waveNumber: 2,
    triggerTime: 60, // 1 minute
    aiCount: 4,
    speedMultiplier: 1.0,
    isBossWave: false,
    bonusPoints: 50
  },
  {
    waveNumber: 3,
    triggerTime: 120, // 2 minutes
    aiCount: 4,
    speedMultiplier: 1.15,
    isBossWave: false,
    bonusPoints: 100
  },
  {
    waveNumber: 4,
    triggerTime: 180, // 3 minutes - First Boss Wave
    aiCount: 4,
    speedMultiplier: 1.15,
    isBossWave: true,
    bonusPoints: 200,
    bossConfig: {
      type: 'SMART',
      abilities: ['PREDICT_MOVEMENT', 'AVOID_TRAPS'],
      healthMultiplier: 2.0
    }
  },
  {
    waveNumber: 5,
    triggerTime: 300, // 5 minutes
    aiCount: 5,
    speedMultiplier: 1.3,
    isBossWave: false,
    bonusPoints: 150
  },
  {
    waveNumber: 6,
    triggerTime: 360, // 6 minutes - Second Boss Wave
    aiCount: 5,
    speedMultiplier: 1.3,
    isBossWave: true,
    bonusPoints: 300,
    bossConfig: {
      type: 'FAST',
      abilities: ['SPEED_BURST', 'QUICK_TURNS'],
      healthMultiplier: 1.5
    }
  }
];

export interface WaveState {
  currentWave: number;
  waveStartTime: number;
  gameStartTime: number;
  completedWaves: number[];
  totalBonusPoints: number;
  nextWaveTime?: number;
}

export const BOSS_ABILITIES = {
  PREDICT_MOVEMENT: 'Can predict player movement patterns',
  AVOID_TRAPS: 'Actively avoids dangerous positions',
  SPEED_BURST: 'Temporary speed increase when chasing food',
  QUICK_TURNS: 'Can change direction more rapidly',
  WALL_HUG: 'Prefers to move along walls for safety',
  AGGRESSIVE_CHASE: 'Actively pursues other snakes'
} as const;