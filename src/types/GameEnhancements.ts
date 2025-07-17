import type { Position, Direction } from './GameTypes';
export type { Position, Direction } from './GameTypes';

/**
 * Describes the behavioral traits of an AI controlled snake.
 */
export interface AIPersonality {
  /** Aggression level from 0 to 1 influencing food seeking */
  aggression: number;
  /** Intelligence level from 0 to 1 influencing safety checks */
  intelligence: number;
  /** Patience level from 0 to 1 influencing direction stability */
  patience: number;
  /** Optional display name for the AI */
  name: string;
  /** Optional description used for debugging or logs */
  description?: string;
}

/**
 * Simplified snake representation used by AI utilities and tests.
 */
export interface Snake {
  id: string;
  positions: Position[];
  direction: Direction;
  isAlive: boolean;
  score: number;
  isAI: boolean;
  aiPersonality?: AIPersonality | string;
  name?: string;
  color?: string;
  lastDirectionChange?: number;
}

export interface Wave {
  number: number;
  startTime: number;
  aiCount: number;
  speedMultiplier: number;
  isBossWave: boolean;
  bonusPoints: number;
}

export interface BossSnake extends Snake {
  bossType: 'GIANT' | 'FAST' | 'SMART';
  specialAbilities: string[];
  health: number;
}

export interface PerformanceMetrics {
  averageFrameTime: number;
  aiCalculationTime: number;
  renderTime: number;
  collisionTime: number;
}

