// src/types/GameEnhancements.ts
import { PowerUp, ActivePowerUp, Position } from './PowerUp';
import { Wave, BossSnake, WaveState } from './Wave';

// Re-export commonly used types
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

// Base interfaces that other components need
export interface Snake {
  id: string;
  name: string;
  positions: Position[];
  direction: Direction;
  score: number;
  color: string;
  isAlive: boolean;
  isAI: boolean;
  aiPersonality?: string;
  lastDirectionChange?: number;
}

export interface GameRoom {
  id: string;
  players: { [playerId: string]: Snake };
  food: Position[];
  gameState: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  createdAt?: number;
  winner?: string;
}

// Export Position for convenience
export type { Position } from './PowerUp';
export type { Wave, BossSnake } from './Wave';

// Enhanced game state interfaces that extend existing types
export interface EnhancedGameRoom {
  id: string;
  players: { [playerId: string]: EnhancedSnake };
  food: Position[];
  powerUps: PowerUp[];
  activePowerUps: Map<string, ActivePowerUp[]>;
  gameState: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  createdAt?: number;
  winner?: string;
  
  // Wave system additions
  currentWave: number;
  waveState: WaveState;
  bossSnakes: BossSnake[];
  
  // Game settings
  gameSettings: GameSettings;
}

export interface EnhancedSnake {
  id: string;
  name: string;
  positions: Position[];
  direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  score: number;
  color: string;
  isAlive: boolean;
  isAI: boolean;
  aiPersonality?: import('./Wave').AIPersonality;
  lastDirectionChange?: number;
  
  // Power-up enhancements
  activePowerUps: ActivePowerUp[];
  shieldCount: number;
  lastPowerUpCollection: number;
  effectsState: SnakeEffectsState;
}

export interface SnakeEffectsState {
  isGhost: boolean;
  isFrozen: boolean;
  speedMultiplier: number;
  scoreMultiplier: number;
  shieldActive: boolean;
  lastEffectUpdate: number;
}

export interface GameSettings {
  powerUpsEnabled: boolean;
  wavesEnabled: boolean;
  maxPowerUps: number;
  syncInterval: number;
  performanceMode: 'HIGH' | 'MEDIUM' | 'LOW';
  visualEffectsEnabled: boolean;
  soundEnabled: boolean;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  powerUpsEnabled: true,
  wavesEnabled: true,
  maxPowerUps: 5,
  syncInterval: 500, // 500ms batched updates
  performanceMode: 'HIGH',
  visualEffectsEnabled: true,
  soundEnabled: false
};

// Performance tracking interfaces
export interface PerformanceMetrics {
  averageFrameTime: number;
  frameTimeHistory: number[];
  memoryUsage: number;
  renderTime: number;
  updateTime: number;
  lastMeasurement: number;
}

export interface GameCell {
  id: string;
  x: number;
  y: number;
  type: 'empty' | 'snake-head' | 'snake-body' | 'food' | 'powerup';
  color?: string;
  isActive: boolean;
}

// Particle system types
export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number; // velocity x
  vy: number; // velocity y
  life: number; // remaining life (0-1)
  maxLife: number;
  color: string;
  size: number;
  type: 'explosion' | 'sparkle' | 'trail' | 'score';
}

export interface ParticleEmitter {
  id: string;
  x: number;
  y: number;
  particleCount: number;
  emissionRate: number;
  particleLife: number;
  particleSpeed: number;
  particleSize: number;
  color: string;
  type: string;
  isActive: boolean;
}

// Event system for game enhancements
export type GameEvent = 
  | { type: 'POWER_UP_SPAWNED'; powerUp: PowerUp }
  | { type: 'POWER_UP_COLLECTED'; powerUp: PowerUp; playerId: string }
  | { type: 'WAVE_STARTED'; wave: Wave }
  | { type: 'WAVE_COMPLETED'; wave: Wave; bonusPoints: number }
  | { type: 'BOSS_SPAWNED'; boss: BossSnake }
  | { type: 'SNAKE_DIED'; snakeId: string; cause: 'collision' | 'wall' | 'self' }
  | { type: 'FOOD_CONSUMED'; position: Position; playerId: string; points: number }
  | { type: 'COMBO_ACHIEVED'; playerId: string; comboCount: number; bonusPoints: number };

export interface GameEventHandler {
  handleEvent(event: GameEvent): void;
}

// Feature flags for A/B testing
export interface FeatureFlags {
  enhancedPowerUps: boolean;
  progressiveWaves: boolean;
  bossSnakes: boolean;
  particleEffects: boolean;
  soundEffects: boolean;
  performanceOptimizations: boolean;
  webglRenderer: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  enhancedPowerUps: true,
  progressiveWaves: true,
  bossSnakes: true,
  particleEffects: true,
  soundEffects: false,
  performanceOptimizations: true,
  webglRenderer: false // Will be enabled based on device capability
};