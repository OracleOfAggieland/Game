import { Direction, Position, Snake } from '../types/GameEnhancements';
import { AI_CONSTANTS } from '../constants/GameConstants';
import { GameErrorHandler } from './GameErrorHandler';

export interface GameState {
  food: Position[];
  snakes: Snake[];
  bossSnakes?: any[];
  powerUps?: any[];
}

export interface AIStrategy {
  calculateNextMove(snake: Snake, gameState: GameState): Direction;
}

class AggressiveStrategy implements AIStrategy {
  calculateNextMove(snake: Snake, gameState: GameState): Direction {
    const head = snake.positions[0];
    const possibleDirections = this.getPossibleDirections(snake, gameState);
    
    if (possibleDirections.length === 0) {
      return snake.direction;
    }

    // Prioritize food and aggressive moves
    const foodTargets = gameState.food.filter(food => 
      this.calculateDistance(head, food) < 10
    );

    if (foodTargets.length > 0) {
      const closestFood = foodTargets.reduce((closest, food) => 
        this.calculateDistance(head, food) < this.calculateDistance(head, closest) ? food : closest
      );
      
      const directionToFood = this.getDirectionToTarget(head, closestFood);
      if (possibleDirections.includes(directionToFood)) {
        return directionToFood;
      }
    }

    // Default to first safe direction
    return possibleDirections[0];
  }

  private getPossibleDirections(snake: Snake, gameState: GameState): Direction[] {
    const head = snake.positions[0];
    const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    
    return directions.filter(direction => {
      if (this.isOppositeDirection(direction, snake.direction)) {
        return false;
      }
      
      const nextPosition = this.getNextPosition(head, direction);
      return this.isValidPosition(nextPosition, gameState);
    });
  }

  private isOppositeDirection(direction: Direction, currentDirection: Direction): boolean {
    const opposites: Record<Direction, Direction> = {
      'UP': 'DOWN',
      'DOWN': 'UP',
      'LEFT': 'RIGHT',
      'RIGHT': 'LEFT'
    };
    return opposites[direction] === currentDirection;
  }

  private getNextPosition(position: Position, direction: Direction): Position {
    const moves = {
      'UP': { x: 0, y: -1 },
      'DOWN': { x: 0, y: 1 },
      'LEFT': { x: -1, y: 0 },
      'RIGHT': { x: 1, y: 0 }
    };
    
    const move = moves[direction];
    return {
      x: position.x + move.x,
      y: position.y + move.y
    };
  }

  private isValidPosition(position: Position, gameState: GameState): boolean {
    // Check bounds
    if (position.x < 0 || position.x >= 25 || position.y < 0 || position.y >= 25) {
      return false;
    }

    // Check collision with snakes
    for (const snake of gameState.snakes) {
      for (const segment of snake.positions) {
        if (segment.x === position.x && segment.y === position.y) {
          return false;
        }
      }
    }

    return true;
  }

  private calculateDistance(pos1: Position, pos2: Position): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  private getDirectionToTarget(from: Position, to: Position): Direction {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'RIGHT' : 'LEFT';
    } else {
      return dy > 0 ? 'DOWN' : 'UP';
    }
  }
}

class DefensiveStrategy implements AIStrategy {
  calculateNextMove(snake: Snake, gameState: GameState): Direction {
    const head = snake.positions[0];
    const possibleDirections = this.getPossibleDirections(snake, gameState);
    
    if (possibleDirections.length === 0) {
      return snake.direction;
    }

    // Prioritize safety over food
    const safestDirection = possibleDirections.reduce((safest, direction) => {
      const nextPos = this.getNextPosition(head, direction);
      const safetyScore = this.calculateSafetyScore(nextPos, gameState);
      const safestPos = this.getNextPosition(head, safest);
      const safestScore = this.calculateSafetyScore(safestPos, gameState);
      
      return safetyScore > safestScore ? direction : safest;
    });

    return safestDirection;
  }

  private calculateSafetyScore(position: Position, gameState: GameState): number {
    let score = 0;
    const radius = AI_CONSTANTS.RISK_CALCULATION_RADIUS;

    // Check surrounding area for threats
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const checkPos = { x: position.x + dx, y: position.y + dy };
        
        // Penalty for being near snake bodies
        for (const snake of gameState.snakes) {
          for (const segment of snake.positions) {
            if (segment.x === checkPos.x && segment.y === checkPos.y) {
              score -= 10 / (Math.abs(dx) + Math.abs(dy) + 1);
            }
          }
        }
      }
    }

    return score;
  }

  private getPossibleDirections(snake: Snake, gameState: GameState): Direction[] {
    const head = snake.positions[0];
    const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    
    return directions.filter(direction => {
      if (this.isOppositeDirection(direction, snake.direction)) {
        return false;
      }
      
      const nextPosition = this.getNextPosition(head, direction);
      return this.isValidPosition(nextPosition, gameState);
    });
  }

  private isOppositeDirection(direction: Direction, currentDirection: Direction): boolean {
    const opposites: Record<Direction, Direction> = {
      'UP': 'DOWN',
      'DOWN': 'UP',
      'LEFT': 'RIGHT',
      'RIGHT': 'LEFT'
    };
    return opposites[direction] === currentDirection;
  }

  private getNextPosition(position: Position, direction: Direction): Position {
    const moves = {
      'UP': { x: 0, y: -1 },
      'DOWN': { x: 0, y: 1 },
      'LEFT': { x: -1, y: 0 },
      'RIGHT': { x: 1, y: 0 }
    };
    
    const move = moves[direction];
    return {
      x: position.x + move.x,
      y: position.y + move.y
    };
  }

  private isValidPosition(position: Position, gameState: GameState): boolean {
    // Check bounds
    if (position.x < 0 || position.x >= 25 || position.y < 0 || position.y >= 25) {
      return false;
    }

    // Check collision with snakes
    for (const snake of gameState.snakes) {
      for (const segment of snake.positions) {
        if (segment.x === position.x && segment.y === position.y) {
          return false;
        }
      }
    }

    return true;
  }
}

export class AIStrategyFactory {
  static create(personality: string): AIStrategy {
    switch (personality) {
      case 'aggressive':
        return new AggressiveStrategy();
      case 'defensive':
        return new DefensiveStrategy();
      default:
        return new AggressiveStrategy();
    }
  }
}

export class SnakeAI {
  static getNextDirection(snake: Snake, gameState: GameState): Direction {
    try {
      const strategy = AIStrategyFactory.create(snake.aiPersonality || 'aggressive');
      return strategy.calculateNextMove(snake, gameState);
    } catch (error) {
      GameErrorHandler.handleAIError(error as Error, {
        operation: 'AI direction calculation',
        userId: snake.id
      });
      
      // Fallback: continue in current direction if safe, otherwise turn right
      const head = snake.positions[0];
      const nextPos = this.getNextPosition(head, snake.direction);
      
      if (this.isValidPosition(nextPos, gameState)) {
        return snake.direction;
      }
      
      // Simple fallback logic
      const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
      for (const direction of directions) {
        if (direction !== snake.direction) {
          const testPos = this.getNextPosition(head, direction);
          if (this.isValidPosition(testPos, gameState)) {
            return direction;
          }
        }
      }
      
      return snake.direction;
    }
  }

  private static getNextPosition(position: Position, direction: Direction): Position {
    const moves = {
      'UP': { x: 0, y: -1 },
      'DOWN': { x: 0, y: 1 },
      'LEFT': { x: -1, y: 0 },
      'RIGHT': { x: 1, y: 0 }
    };
    
    const move = moves[direction];
    return {
      x: position.x + move.x,
      y: position.y + move.y
    };
  }

  private static isValidPosition(position: Position, gameState: GameState): boolean {
    // Check bounds
    if (position.x < 0 || position.x >= 25 || position.y < 0 || position.y >= 25) {
      return false;
    }

    // Check collision with snakes
    for (const snake of gameState.snakes) {
      for (const segment of snake.positions) {
        if (segment.x === position.x && segment.y === position.y) {
          return false;
        }
      }
    }

    return true;
  }
}