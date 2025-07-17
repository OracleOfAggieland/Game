// src/utils/GameUtils.ts
import { Position, Direction, Snake } from '../types/GameEnhancements';
import { GAME_CONSTANTS } from '../constants/GameConstants';

export class GameUtils {
  /**
   * Check if a position is within board bounds
   */
  public static isWithinBounds(position: Position): boolean {
    return position.x >= 0 && 
           position.x < GAME_CONSTANTS.BOARD_SIZE && 
           position.y >= 0 && 
           position.y < GAME_CONSTANTS.BOARD_SIZE;
  }

  /**
   * Check if a position collides with any snake
   */
  public static hasSnakeCollision(position: Position, snakes: Snake[]): boolean {
    return snakes.some(snake => 
      snake.isAlive && snake.positions.some(segment => 
        segment.x === position.x && segment.y === position.y
      )
    );
  }

  /**
   * Check if a position is valid (within bounds and no collisions)
   */
  public static isValidPosition(position: Position, snakes: Snake[]): boolean {
    return this.isWithinBounds(position) && !this.hasSnakeCollision(position, snakes);
  }

  /**
   * Get next position based on current position and direction
   */
  public static getNextPosition(position: Position, direction: Direction): Position {
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

  /**
   * Calculate Manhattan distance between two positions
   */
  public static getManhattanDistance(pos1: Position, pos2: Position): number {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }

  /**
   * Get opposite direction
   */
  public static getOppositeDirection(direction: Direction): Direction {
    const opposites: Record<Direction, Direction> = {
      'UP': 'DOWN',
      'DOWN': 'UP',
      'LEFT': 'RIGHT',
      'RIGHT': 'LEFT'
    };
    return opposites[direction];
  }

  /**
   * Check if two directions are opposite
   */
  public static areOppositeDirections(dir1: Direction, dir2: Direction): boolean {
    return this.getOppositeDirection(dir1) === dir2;
  }

  /**
   * Get all valid directions from a position
   */
  public static getValidDirections(position: Position, currentDirection: Direction, snakes: Snake[]): Direction[] {
    const allDirections: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    
    return allDirections.filter(direction => {
      // Don't allow opposite direction
      if (this.areOppositeDirections(direction, currentDirection)) {
        return false;
      }
      
      const nextPos = this.getNextPosition(position, direction);
      return this.isValidPosition(nextPos, snakes);
    });
  }
}