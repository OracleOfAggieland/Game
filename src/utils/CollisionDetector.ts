// src/utils/CollisionDetector.ts
import { Position, Snake } from '../types/GameEnhancements';
import { GameUtils } from './GameUtils';

export type CollisionType = 'wall' | 'snake' | 'self' | 'head-to-head' | 'none';

export interface CollisionResult {
  hasCollision: boolean;
  type: CollisionType;
  collidedWith?: string; // Snake ID if applicable
}

export class CollisionDetector {
  /**
   * Check for all types of collisions for a snake's next position
   */
  public static checkCollision(
    snakeId: string,
    nextPosition: Position,
    allSnakes: Snake[],
    nextMoves?: Map<string, Position>
  ): CollisionResult {
    // Check wall collision
    if (!GameUtils.isWithinBounds(nextPosition)) {
      return {
        hasCollision: true,
        type: 'wall'
      };
    }

    // Check head-to-head collision (if nextMoves provided)
    if (nextMoves) {
      const headCollision = this.checkHeadToHeadCollision(snakeId, nextPosition, nextMoves);
      if (headCollision.hasCollision) {
        return headCollision;
      }
    }

    // Check snake body collision
    const bodyCollision = this.checkSnakeBodyCollision(snakeId, nextPosition, allSnakes);
    if (bodyCollision.hasCollision) {
      return bodyCollision;
    }

    return {
      hasCollision: false,
      type: 'none'
    };
  }

  /**
   * Check for head-to-head collisions
   */
  private static checkHeadToHeadCollision(
    snakeId: string,
    nextPosition: Position,
    nextMoves: Map<string, Position>
  ): CollisionResult {
    // Convert Map.entries() to array to avoid iterator issues with ES5 target
    const nextMovesArray = Array.from(nextMoves.entries());
    for (const [otherId, otherPosition] of nextMovesArray) {
      if (otherId !== snakeId && 
          otherPosition.x === nextPosition.x && 
          otherPosition.y === nextPosition.y) {
        return {
          hasCollision: true,
          type: 'head-to-head',
          collidedWith: otherId
        };
      }
    }

    return {
      hasCollision: false,
      type: 'none'
    };
  }

  /**
   * Check for collision with snake bodies
   */
  private static checkSnakeBodyCollision(
    snakeId: string,
    nextPosition: Position,
    allSnakes: Snake[]
  ): CollisionResult {
    for (const snake of allSnakes) {
      if (!snake.isAlive) continue;

      // Check collision with other snakes' bodies
      if (snake.id !== snakeId) {
        for (const segment of snake.positions) {
          if (segment.x === nextPosition.x && segment.y === nextPosition.y) {
            return {
              hasCollision: true,
              type: 'snake',
              collidedWith: snake.id
            };
          }
        }
      } else {
        // Check self-collision (skip head)
        for (let i = 1; i < snake.positions.length; i++) {
          const segment = snake.positions[i];
          if (segment.x === nextPosition.x && segment.y === nextPosition.y) {
            return {
              hasCollision: true,
              type: 'self'
            };
          }
        }
      }
    }

    return {
      hasCollision: false,
      type: 'none'
    };
  }

  /**
   * Get all snakes that would collide with a position
   */
  public static getCollidingSnakes(position: Position, snakes: Snake[]): Snake[] {
    return snakes.filter(snake => 
      snake.isAlive && snake.positions.some(segment => 
        segment.x === position.x && segment.y === position.y
      )
    );
  }

  /**
   * Check if a position is safe (no immediate collision threats)
   */
  public static isSafePosition(
    position: Position,
    snakes: Snake[],
    safetyRadius: number = 1
  ): boolean {
    for (let dx = -safetyRadius; dx <= safetyRadius; dx++) {
      for (let dy = -safetyRadius; dy <= safetyRadius; dy++) {
        const checkPos = { x: position.x + dx, y: position.y + dy };
        
        if (!GameUtils.isWithinBounds(checkPos)) {
          return false;
        }

        if (GameUtils.hasSnakeCollision(checkPos, snakes)) {
          return false;
        }
      }
    }

    return true;
  }
}