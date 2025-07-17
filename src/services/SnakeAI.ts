import type { Direction } from '../types/GameEnhancements';

// Minimal legacy AI used only for benchmarking utilities.
export class SnakeAI {
  static getNextDirection(_snake: any, _gameState: any): Direction {
    const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    return directions[Math.floor(Math.random() * directions.length)];
  }
}
