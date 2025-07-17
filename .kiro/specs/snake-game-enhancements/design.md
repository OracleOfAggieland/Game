# Design Document

## Overview

This design document outlines the architecture for enhancing the existing React/TypeScript Snake game with streamlined Arena mode entry, power-up systems, progressive wave mechanics, performance optimizations, and visual polish. The design maintains the current clean architecture while introducing new modular components that integrate seamlessly with the existing game loop and Firebase infrastructure.

The enhancements are designed to be backward-compatible, maintaining all existing functionality while adding new features through composition and extension patterns.

## Architecture

### Current Architecture Analysis

The existing codebase follows a clean component-based architecture:
- **App.tsx**: Main game mode selector and routing
- **SnakeGame.tsx**: Classic single-player mode with optimized game loop
- **MultiplayerSnakeGame.tsx**: Arena mode with Firebase integration and AI opponents
- **Firebase Services**: Real-time multiplayer state management

### Enhanced Architecture

The enhanced architecture introduces several new managers and components while preserving the existing structure:

```
src/
├── components/
│   ├── Game/
│   │   ├── SnakeGame.tsx (enhanced)
│   │   ├── MultiplayerSnakeGame.tsx (enhanced)
│   │   ├── PowerUpIndicator.tsx (new)
│   │   ├── WaveIndicator.tsx (new)
│   │   └── ParticleSystem.tsx (new)
│   └── UI/
│       ├── GameHUD.tsx (new)
│       └── EffectsOverlay.tsx (new)
├── managers/
│   ├── PowerUpManager.ts (new)
│   ├── WaveManager.ts (new)
│   ├── PerformanceManager.ts (new)
│   └── EffectsManager.ts (new)
├── types/
│   ├── PowerUp.ts (new)
│   ├── Wave.ts (new)
│   └── GameEnhancements.ts (new)
└── utils/
    ├── ObjectPool.ts (new)
    ├── SpatialPartitioning.ts (new)
    └── NameGenerator.ts (new)
```

## Components and Interfaces

### Core Type Definitions

```typescript
// types/PowerUp.ts
export interface PowerUp {
  id: string;
  type: PowerUpType;
  position: Position;
  spawnTime: number;
  duration?: number;
  isActive: boolean;
}

export type PowerUpType = 'SPEED_BOOST' | 'SHIELD' | 'GHOST_MODE' | 'FREEZE' | 'SCORE_MULTIPLIER';

export interface ActivePowerUp {
  type: PowerUpType;
  startTime: number;
  duration: number;
  playerId: string;
}

// types/Wave.ts
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
```

### PowerUpManager Class

The PowerUpManager handles all power-up related logic:

```typescript
class PowerUpManager {
  private powerUps: Map<string, PowerUp> = new Map();
  private activePowerUps: Map<string, ActivePowerUp[]> = new Map();
  private lastSpawnTime: number = 0;
  private spawnInterval: number = 25000; // 25 seconds average

  // Core methods
  public spawnPowerUp(occupiedPositions: Set<string>): PowerUp | null
  public collectPowerUp(powerUpId: string, playerId: string): boolean
  public updateActivePowerUps(deltaTime: number): void
  public getPlayerPowerUps(playerId: string): ActivePowerUp[]
  public shouldSpawnPowerUp(): boolean
  
  // Effect application methods
  private applySpeedBoost(playerId: string): void
  private applyShield(playerId: string): void
  private applyGhostMode(playerId: string): void
  private applyFreeze(playerId: string): void
  private applyScoreMultiplier(playerId: string): void
}
```

### WaveManager Class

The WaveManager handles progressive wave mechanics:

```typescript
class WaveManager {
  private currentWave: number = 1;
  private waveStartTime: number = 0;
  private waveDefinitions: Wave[] = [];
  private bossSnakes: Map<string, BossSnake> = new Map();

  // Core methods
  public initializeWaves(): void
  public checkWaveProgression(gameTime: number): Wave | null
  public spawnBossSnake(waveNumber: number): BossSnake
  public calculateWaveBonus(waveNumber: number, survivalTime: number): number
  public getAIPersonalityForWave(waveNumber: number): AIPersonality
  
  // Boss AI methods
  public getBossAIDirection(boss: BossSnake, gameState: GameState): Direction
  private executeBossAbility(boss: BossSnake, ability: string): void
}
```

### PerformanceManager Class

The PerformanceManager optimizes game performance:

```typescript
class PerformanceManager {
  private objectPools: Map<string, ObjectPool> = new Map();
  private spatialGrid: SpatialPartitioning;
  private frameTimeHistory: number[] = [];
  private lastSyncTime: number = 0;

  // Core methods
  public initializePools(): void
  public getPooledCell(): GameCell
  public returnPooledCell(cell: GameCell): void
  public updateSpatialGrid(gameObjects: GameObject[]): void
  public getCollisionCandidates(position: Position, radius: number): GameObject[]
  public shouldSyncToFirebase(): boolean
  public trackFrameTime(frameTime: number): void
  public getAverageFrameTime(): number
}
```

## Data Models

### Enhanced Game State

The existing game state is extended to support new features:

```typescript
interface EnhancedGameRoom extends GameRoom {
  powerUps: PowerUp[];
  activePowerUps: Map<string, ActivePowerUp[]>;
  currentWave: number;
  waveStartTime: number;
  bossSnakes: BossSnake[];
  gameSettings: {
    powerUpsEnabled: boolean;
    wavesEnabled: boolean;
    maxPowerUps: number;
    syncInterval: number;
  };
}

interface EnhancedSnake extends Snake {
  activePowerUps: ActivePowerUp[];
  shieldCount: number;
  lastPowerUpCollection: number;
  effectsState: {
    isGhost: boolean;
    isFrozen: boolean;
    speedMultiplier: number;
    scoreMultiplier: number;
  };
}
```

### Power-Up Configuration

```typescript
const POWER_UP_CONFIG = {
  SPEED_BOOST: {
    color: '#FFD700', // Yellow
    duration: 5000,
    effect: 2.0, // 2x speed
    rarity: 0.3
  },
  SHIELD: {
    color: '#4169E1', // Blue
    duration: -1, // One-time use
    effect: 1, // One collision immunity
    rarity: 0.25
  },
  GHOST_MODE: {
    color: '#9370DB', // Purple
    duration: 3000,
    effect: 1, // Pass through snakes
    rarity: 0.2
  },
  FREEZE: {
    color: '#00FFFF', // Cyan
    duration: 2000,
    effect: 1, // Freeze all AI
    rarity: 0.15
  },
  SCORE_MULTIPLIER: {
    color: '#FF6347', // Gold/Red
    duration: 10000,
    effect: 2.0, // 2x points
    rarity: 0.1
  }
};
```

## Error Handling

### Power-Up Error Handling

```typescript
class PowerUpErrorHandler {
  public static handleCollectionError(error: Error, powerUpId: string): void {
    console.warn(`Failed to collect power-up ${powerUpId}:`, error);
    // Graceful degradation - continue game without power-up
  }

  public static handleSpawnError(error: Error): void {
    console.warn('Failed to spawn power-up:', error);
    // Continue game loop without spawning
  }

  public static handleEffectError(error: Error, effectType: string): void {
    console.warn(`Power-up effect ${effectType} failed:`, error);
    // Remove problematic effect and continue
  }
}
```

### Performance Error Handling

```typescript
class PerformanceErrorHandler {
  public static handleFrameDrops(averageFrameTime: number): void {
    if (averageFrameTime > 20) { // Below 50 FPS
      // Reduce visual effects
      // Decrease power-up spawn rate
      // Simplify collision detection
    }
  }

  public static handleMemoryPressure(): void {
    // Force garbage collection of object pools
    // Reduce particle count
    // Clear old game state history
  }
}
```

## Testing Strategy

### Unit Testing

1. **PowerUpManager Tests**
   - Power-up spawning logic
   - Effect application and removal
   - Collision detection with power-ups
   - Stacking behavior validation

2. **WaveManager Tests**
   - Wave progression timing
   - Boss snake spawning
   - AI difficulty scaling
   - Bonus point calculations

3. **PerformanceManager Tests**
   - Object pool efficiency
   - Spatial partitioning accuracy
   - Frame rate monitoring
   - Memory usage tracking

### Integration Testing

1. **Game Loop Integration**
   - Power-ups in single-player mode
   - Power-ups in multiplayer mode
   - Wave progression with AI opponents
   - Performance optimization impact

2. **Firebase Integration**
   - Reduced sync frequency
   - Power-up state synchronization
   - Wave state persistence
   - Error recovery mechanisms

### Performance Testing

1. **Load Testing**
   - 6 snakes + 5 power-ups + particles
   - Boss wave with special effects
   - Extended gameplay sessions
   - Memory leak detection

2. **Mobile Testing**
   - Touch responsiveness with new features
   - Battery usage optimization
   - Frame rate consistency
   - UI scaling with new elements

## Implementation Phases

### Phase 1: Streamlined Arena Entry
- Remove name input requirement
- Implement auto-name generation
- Direct game start functionality
- Maintain room code system

### Phase 2: Core Power-Up System
- PowerUpManager implementation
- Basic power-up spawning and collection
- Visual indicators and effects
- Integration with existing game loop

### Phase 3: Wave System
- WaveManager implementation
- Progressive AI difficulty
- Boss snake mechanics
- Wave completion notifications

### Phase 4: Performance Optimizations
- Object pooling implementation
- Spatial partitioning for collisions
- Firebase sync optimization
- React.memo optimizations

### Phase 5: Visual Polish
- Particle system implementation
- Smooth movement interpolation
- Death animations
- Sound effects integration

## Security Considerations

### Client-Side Validation
- Power-up collection validation
- Wave progression verification
- Score manipulation prevention
- Input sanitization for generated names

### Firebase Security
- Rate limiting for game state updates
- Validation of power-up states
- Prevention of unauthorized room modifications
- Cleanup of abandoned game rooms

## Scalability Considerations

### Performance Scaling
- Object pool sizing based on device capabilities
- Dynamic quality adjustment
- Progressive feature degradation
- Memory usage monitoring

### Feature Scaling
- Modular power-up system for easy additions
- Configurable wave definitions
- Extensible boss snake types
- Plugin-based effect system

This design maintains the existing clean architecture while providing a solid foundation for all the requested enhancements. The modular approach ensures that features can be implemented incrementally and that the system remains maintainable and extensible.