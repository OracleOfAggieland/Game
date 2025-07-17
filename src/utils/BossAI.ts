// src/utils/BossAI.ts
import { BossSnake, AIPersonality } from '../types/Wave';
import { Position } from '../types/PowerUp';
import { EnhancedSnake } from '../types/GameEnhancements';

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface GameState {
  snakes: EnhancedSnake[];
  food: Position[];
  powerUps: Position[];
  boardWidth: number;
  boardHeight: number;
  currentTime: number;
}

export interface BossAIDecision {
  direction: Direction;
  abilityToUse?: string;
  confidence: number; // 0-1 how confident the AI is in this decision
  reasoning: string; // For debugging
}

export class BossAI {
  private static readonly DIRECTION_CHANGE_COOLDOWN = 200; // ms
  private static readonly ABILITY_COOLDOWN = 3000; // 3 seconds between abilities
  private static readonly PREDICTION_STEPS = 5; // How many steps ahead to predict
  private static readonly DANGER_RADIUS = 3; // Cells to consider dangerous
  
  /**
   * Get the next direction for a boss snake
   */
  public static getNextDirection(
    boss: BossSnake, 
    gameState: GameState
  ): BossAIDecision {
    const currentTime = gameState.currentTime;
    
    // Respect direction change cooldown
    if (boss.lastDirectionChange && 
        currentTime - boss.lastDirectionChange < this.DIRECTION_CHANGE_COOLDOWN) {
      return {
        direction: boss.direction,
        confidence: 0.5,
        reasoning: 'Direction change on cooldown'
      };
    }

    // Get possible directions (not opposite to current)
    const possibleDirections = this.getPossibleDirections(boss.direction);
    
    // Evaluate each direction based on boss type and abilities
    const directionScores = possibleDirections.map(direction => ({
      direction,
      score: this.evaluateDirection(boss, direction, gameState),
      reasoning: this.getDirectionReasoning(boss, direction, gameState)
    }));

    // Sort by score (highest first)
    directionScores.sort((a, b) => b.score - a.score);
    
    const bestChoice = directionScores[0];
    
    // Check if we should use a special ability
    const abilityToUse = this.shouldUseAbility(boss, gameState, currentTime);
    
    return {
      direction: bestChoice.direction,
      abilityToUse,
      confidence: Math.min(1, bestChoice.score / 100),
      reasoning: bestChoice.reasoning + (abilityToUse ? ` + Using ${abilityToUse}` : '')
    };
  }

  /**
   * Get directions that are not opposite to current direction
   */
  private static getPossibleDirections(currentDirection: Direction): Direction[] {
    const opposites: Record<Direction, Direction> = {
      'UP': 'DOWN',
      'DOWN': 'UP',
      'LEFT': 'RIGHT',
      'RIGHT': 'LEFT'
    };

    return (['UP', 'DOWN', 'LEFT', 'RIGHT'] as Direction[])
      .filter(dir => dir !== opposites[currentDirection]);
  }

  /**
   * Evaluate a direction based on boss type and game state
   */
  private static evaluateDirection(
    boss: BossSnake, 
    direction: Direction, 
    gameState: GameState
  ): number {
    const head = boss.positions[0];
    const nextPosition = this.getNextPosition(head, direction);
    
    let score = 50; // Base score
    
    // Check if position is valid (not wall or snake body)
    if (!this.isValidPosition(nextPosition, gameState, boss)) {
      return -1000; // Invalid move
    }

    // Boss type specific scoring
    switch (boss.bossType) {
      case 'SMART':
        score += this.evaluateSmartBossDirection(boss, nextPosition, gameState);
        break;
      case 'FAST':
        score += this.evaluateFastBossDirection(boss, nextPosition, gameState);
        break;
      case 'GIANT':
        score += this.evaluateGiantBossDirection(boss, nextPosition, gameState);
        break;
    }

    // Apply AI personality modifiers
    score += this.applyPersonalityModifiers(boss.aiPersonality, nextPosition, gameState);
    
    return score;
  }

  /**
   * Smart boss evaluation - focuses on strategic positioning and prediction
   */
  private static evaluateSmartBossDirection(
    boss: BossSnake, 
    nextPosition: Position, 
    gameState: GameState
  ): number {
    let score = 0;
    
    // Predict player movements and avoid future collisions
    if (boss.specialAbilities.includes('PREDICT_MOVEMENT')) {
      score += this.evaluatePredictiveMovement(nextPosition, gameState) * 30;
    }
    
    // Avoid trap situations
    if (boss.specialAbilities.includes('AVOID_TRAPS')) {
      score += this.evaluateTrapAvoidance(nextPosition, gameState) * 25;
    }
    
    // Strategic food positioning
    score += this.evaluateStrategicFoodApproach(nextPosition, gameState) * 20;
    
    // Maintain safe distance from other snakes
    score += this.evaluateSafeDistance(nextPosition, gameState) * 15;
    
    return score;
  }

  /**
   * Fast boss evaluation - focuses on speed and aggressive movement
   */
  private static evaluateFastBossDirection(
    boss: BossSnake, 
    nextPosition: Position, 
    gameState: GameState
  ): number {
    let score = 0;
    
    // Prioritize direct paths to food
    const nearestFood = this.findNearestFood(nextPosition, gameState.food);
    if (nearestFood) {
      const distance = this.getManhattanDistance(nextPosition, nearestFood);
      score += Math.max(0, 50 - distance * 5); // Closer food = higher score
    }
    
    // Bonus for maintaining high speed (straight lines)
    if (this.isDirectionMaintained(boss, nextPosition)) {
      score += 20;
    }
    
    // Aggressive positioning near other snakes
    score += this.evaluateAggressivePositioning(nextPosition, gameState) * 15;
    
    return score;
  }

  /**
   * Giant boss evaluation - focuses on patience and wall-hugging
   */
  private static evaluateGiantBossDirection(
    boss: BossSnake, 
    nextPosition: Position, 
    gameState: GameState
  ): number {
    let score = 0;
    
    // Prefer wall-adjacent positions
    if (boss.specialAbilities.includes('WALL_HUG')) {
      score += this.evaluateWallProximity(nextPosition, gameState) * 25;
    }
    
    // Patient food approach - don't rush
    score += this.evaluatePatientFoodApproach(nextPosition, gameState) * 20;
    
    // Avoid risky positions
    score += this.evaluateRiskAvoidance(nextPosition, gameState) * 30;
    
    return score;
  }

  /**
   * Apply AI personality modifiers to the score
   */
  private static applyPersonalityModifiers(
    personality: AIPersonality, 
    position: Position, 
    gameState: GameState
  ): number {
    let modifier = 0;
    
    // Aggression affects food pursuit
    const nearestFood = this.findNearestFood(position, gameState.food);
    if (nearestFood) {
      const distance = this.getManhattanDistance(position, nearestFood);
      modifier += personality.aggression * Math.max(0, 20 - distance * 2);
    }
    
    // Intelligence affects danger avoidance
    const dangerScore = this.evaluateDanger(position, gameState);
    modifier -= personality.intelligence * dangerScore * 10;
    
    // Patience affects risk-taking
    const riskScore = this.evaluateRisk(position, gameState);
    modifier -= personality.patience * riskScore * 5;
    
    return modifier;
  }

  /**
   * Check if boss should use a special ability
   */
  private static shouldUseAbility(
    boss: BossSnake, 
    gameState: GameState, 
    currentTime: number
  ): string | undefined {
    // Check cooldown
    if (boss.lastAbilityUse && 
        currentTime - boss.lastAbilityUse < this.ABILITY_COOLDOWN) {
      return undefined;
    }

    // Evaluate each ability
    for (const ability of boss.specialAbilities) {
      if (this.shouldActivateAbility(ability, boss, gameState)) {
        return ability;
      }
    }

    return undefined;
  }

  /**
   * Check if a specific ability should be activated
   */
  private static shouldActivateAbility(
    ability: string, 
    boss: BossSnake, 
    gameState: GameState
  ): boolean {
    switch (ability) {
      case 'SPEED_BURST':
        // Use when chasing food or in danger
        const nearestFood = this.findNearestFood(boss.positions[0], gameState.food);
        const isNearFood = nearestFood && 
          this.getManhattanDistance(boss.positions[0], nearestFood) <= 5;
        const isInDanger = this.evaluateDanger(boss.positions[0], gameState) > 0.7;
        return isNearFood || isInDanger;
        
      case 'AGGRESSIVE_CHASE':
        // Use when other snakes are nearby
        return this.hasNearbySnakes(boss.positions[0], gameState, 4);
        
      default:
        return Math.random() < 0.1; // 10% chance for other abilities
    }
  }

  /**
   * Execute a boss ability
   */
  public static executeBossAbility(
    boss: BossSnake, 
    ability: string, 
    gameState: GameState
  ): void {
    switch (ability) {
      case 'SPEED_BURST':
        // This would be handled by the game engine to temporarily increase speed
        console.log(`${boss.name} uses Speed Burst!`);
        break;
        
      case 'QUICK_TURNS':
        // Reduce direction change cooldown
        boss.lastDirectionChange = Math.max(0, 
          (boss.lastDirectionChange || 0) - this.DIRECTION_CHANGE_COOLDOWN / 2);
        console.log(`${boss.name} uses Quick Turns!`);
        break;
        
      case 'AGGRESSIVE_CHASE':
        console.log(`${boss.name} enters aggressive mode!`);
        break;
        
      default:
        console.log(`${boss.name} uses ${ability}!`);
    }
    
    boss.lastAbilityUse = gameState.currentTime;
  }

  // Helper methods for evaluation

  private static getNextPosition(position: Position, direction: Direction): Position {
    switch (direction) {
      case 'UP': return { x: position.x, y: position.y - 1 };
      case 'DOWN': return { x: position.x, y: position.y + 1 };
      case 'LEFT': return { x: position.x - 1, y: position.y };
      case 'RIGHT': return { x: position.x + 1, y: position.y };
    }
  }

  private static isValidPosition(
    position: Position, 
    gameState: GameState, 
    boss: BossSnake
  ): boolean {
    // Check bounds
    if (position.x < 0 || position.x >= gameState.boardWidth ||
        position.y < 0 || position.y >= gameState.boardHeight) {
      return false;
    }

    // Check collision with other snakes (including self)
    for (const snake of gameState.snakes) {
      if (snake.id === boss.id) continue; // Skip self for now
      
      for (const segment of snake.positions) {
        if (segment.x === position.x && segment.y === position.y) {
          return false;
        }
      }
    }

    // Check collision with own body (except head)
    for (let i = 1; i < boss.positions.length; i++) {
      const segment = boss.positions[i];
      if (segment.x === position.x && segment.y === position.y) {
        return false;
      }
    }

    return true;
  }

  private static findNearestFood(position: Position, food: Position[]): Position | null {
    if (food.length === 0) return null;
    
    let nearest = food[0];
    let minDistance = this.getManhattanDistance(position, nearest);
    
    for (const f of food) {
      const distance = this.getManhattanDistance(position, f);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = f;
      }
    }
    
    return nearest;
  }

  private static getManhattanDistance(pos1: Position, pos2: Position): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  private static evaluatePredictiveMovement(position: Position, gameState: GameState): number {
    // Predict where other snakes will be and avoid those areas
    let score = 0;
    
    for (const snake of gameState.snakes) {
      if (!snake.isAlive) continue;
      
      // Simple prediction: assume snake continues in current direction
      const predictedPositions = this.predictSnakeMovement(snake, this.PREDICTION_STEPS);
      
      for (const predictedPos of predictedPositions) {
        const distance = this.getManhattanDistance(position, predictedPos);
        if (distance <= this.DANGER_RADIUS) {
          score -= (this.DANGER_RADIUS - distance) * 10;
        }
      }
    }
    
    return score;
  }

  private static predictSnakeMovement(snake: EnhancedSnake, steps: number): Position[] {
    const positions: Position[] = [];
    let currentPos = snake.positions[0];
    let currentDir = snake.direction;
    
    for (let i = 0; i < steps; i++) {
      currentPos = this.getNextPosition(currentPos, currentDir);
      positions.push({ ...currentPos });
    }
    
    return positions;
  }

  private static evaluateTrapAvoidance(position: Position, gameState: GameState): number {
    // Check if position leads to a dead end
    const exits = this.countAvailableExits(position, gameState);
    return exits * 10; // More exits = better score
  }

  private static countAvailableExits(position: Position, gameState: GameState): number {
    let exits = 0;
    const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    
    for (const dir of directions) {
      const nextPos = this.getNextPosition(position, dir);
      if (this.isPositionSafe(nextPos, gameState)) {
        exits++;
      }
    }
    
    return exits;
  }

  private static isPositionSafe(position: Position, gameState: GameState): boolean {
    // Check bounds
    if (position.x < 0 || position.x >= gameState.boardWidth ||
        position.y < 0 || position.y >= gameState.boardHeight) {
      return false;
    }

    // Check for snake bodies
    for (const snake of gameState.snakes) {
      for (const segment of snake.positions) {
        if (segment.x === position.x && segment.y === position.y) {
          return false;
        }
      }
    }

    return true;
  }

  private static evaluateStrategicFoodApproach(position: Position, gameState: GameState): number {
    const nearestFood = this.findNearestFood(position, gameState.food);
    if (!nearestFood) return 0;
    
    const distance = this.getManhattanDistance(position, nearestFood);
    const directPath = this.hasDirectPath(position, nearestFood, gameState);
    
    let score = Math.max(0, 20 - distance);
    if (directPath) score += 10;
    
    return score;
  }

  private static hasDirectPath(from: Position, to: Position, gameState: GameState): boolean {
    // Simple check: is there a clear horizontal or vertical path?
    if (from.x === to.x) {
      // Vertical path
      const minY = Math.min(from.y, to.y);
      const maxY = Math.max(from.y, to.y);
      for (let y = minY + 1; y < maxY; y++) {
        if (!this.isPositionSafe({ x: from.x, y }, gameState)) {
          return false;
        }
      }
      return true;
    } else if (from.y === to.y) {
      // Horizontal path
      const minX = Math.min(from.x, to.x);
      const maxX = Math.max(from.x, to.x);
      for (let x = minX + 1; x < maxX; x++) {
        if (!this.isPositionSafe({ x, y: from.y }, gameState)) {
          return false;
        }
      }
      return true;
    }
    
    return false;
  }

  private static evaluateSafeDistance(position: Position, gameState: GameState): number {
    let score = 0;
    
    for (const snake of gameState.snakes) {
      if (!snake.isAlive) continue;
      
      const distance = this.getManhattanDistance(position, snake.positions[0]);
      if (distance < this.DANGER_RADIUS) {
        score -= (this.DANGER_RADIUS - distance) * 5;
      } else if (distance > this.DANGER_RADIUS && distance < this.DANGER_RADIUS * 2) {
        score += 5; // Good safe distance
      }
    }
    
    return score;
  }

  private static isDirectionMaintained(boss: BossSnake, nextPosition: Position): boolean {
    const head = boss.positions[0];
    const currentDirection = boss.direction;
    const expectedNext = this.getNextPosition(head, currentDirection);
    
    return expectedNext.x === nextPosition.x && expectedNext.y === nextPosition.y;
  }

  private static evaluateAggressivePositioning(position: Position, gameState: GameState): number {
    let score = 0;
    
    // Bonus for being near other snakes (aggressive)
    for (const snake of gameState.snakes) {
      if (!snake.isAlive) continue;
      
      const distance = this.getManhattanDistance(position, snake.positions[0]);
      if (distance <= 3) {
        score += (4 - distance) * 5;
      }
    }
    
    return score;
  }

  private static evaluateWallProximity(position: Position, gameState: GameState): number {
    const distanceToWall = Math.min(
      position.x,
      position.y,
      gameState.boardWidth - 1 - position.x,
      gameState.boardHeight - 1 - position.y
    );
    
    // Prefer positions close to walls (but not too close)
    if (distanceToWall === 1) return 20;
    if (distanceToWall === 2) return 15;
    if (distanceToWall === 3) return 10;
    
    return 0;
  }

  private static evaluatePatientFoodApproach(position: Position, gameState: GameState): number {
    const nearestFood = this.findNearestFood(position, gameState.food);
    if (!nearestFood) return 0;
    
    const distance = this.getManhattanDistance(position, nearestFood);
    
    // Patient approach - don't rush, prefer medium distances
    if (distance >= 3 && distance <= 6) return 15;
    if (distance >= 7 && distance <= 10) return 10;
    
    return 0;
  }

  private static evaluateRiskAvoidance(position: Position, gameState: GameState): number {
    const riskLevel = this.evaluateRisk(position, gameState);
    return (1 - riskLevel) * 20; // Higher score for lower risk
  }

  private static evaluateDanger(position: Position, gameState: GameState): number {
    let danger = 0;
    
    // Check proximity to snake heads
    for (const snake of gameState.snakes) {
      if (!snake.isAlive) continue;
      
      const distance = this.getManhattanDistance(position, snake.positions[0]);
      if (distance <= 2) {
        danger += (3 - distance) * 0.3;
      }
    }
    
    // Check proximity to walls
    const wallDistance = Math.min(
      position.x,
      position.y,
      gameState.boardWidth - 1 - position.x,
      gameState.boardHeight - 1 - position.y
    );
    
    if (wallDistance === 0) danger += 1;
    else if (wallDistance === 1) danger += 0.3;
    
    return Math.min(1, danger);
  }

  private static evaluateRisk(position: Position, gameState: GameState): number {
    const exits = this.countAvailableExits(position, gameState);
    const danger = this.evaluateDanger(position, gameState);
    
    // Risk is combination of low exits and high danger
    const exitRisk = exits < 2 ? 0.5 : 0;
    
    return Math.min(1, exitRisk + danger);
  }

  private static hasNearbySnakes(position: Position, gameState: GameState, radius: number): boolean {
    for (const snake of gameState.snakes) {
      if (!snake.isAlive) continue;
      
      const distance = this.getManhattanDistance(position, snake.positions[0]);
      if (distance <= radius) {
        return true;
      }
    }
    
    return false;
  }

  private static getDirectionReasoning(
    boss: BossSnake, 
    direction: Direction, 
    gameState: GameState
  ): string {
    const nextPos = this.getNextPosition(boss.positions[0], direction);
    const nearestFood = this.findNearestFood(nextPos, gameState.food);
    const danger = this.evaluateDanger(nextPos, gameState);
    
    let reasoning = `${boss.bossType} boss moving ${direction}`;
    
    if (nearestFood) {
      const distance = this.getManhattanDistance(nextPos, nearestFood);
      reasoning += `, food distance: ${distance}`;
    }
    
    if (danger > 0.5) {
      reasoning += `, high danger area`;
    }
    
    return reasoning;
  }
}