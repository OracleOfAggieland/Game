export type GameEventType = 
  | 'powerup-collected'
  | 'wave-started'
  | 'wave-completed'
  | 'snake-died'
  | 'boss-spawned'
  | 'boss-defeated'
  | 'game-started'
  | 'game-ended'
  | 'player-joined'
  | 'player-left'
  | 'combo-achieved'
  | 'performance-warning';

export interface GameEventData {
  'powerup-collected': { playerId: string; powerUpType: string; position: { x: number; y: number } };
  'wave-started': { waveNumber: number; difficulty: number };
  'wave-completed': { waveNumber: number; playersAlive: number };
  'snake-died': { playerId: string; cause: string; score: number };
  'boss-spawned': { bossId: string; type: string; position: { x: number; y: number } };
  'boss-defeated': { bossId: string; defeatedBy: string; score: number };
  'game-started': { roomId: string; playerCount: number };
  'game-ended': { roomId: string; winner?: string; duration: number };
  'player-joined': { playerId: string; playerName: string };
  'player-left': { playerId: string; playerName: string };
  'combo-achieved': { playerId: string; comboType: string; multiplier: number };
  'performance-warning': { fps: number; frameTime: number };
}

export class GameEventEmitter {
  private listeners = new Map<GameEventType, Array<(data: any) => void>>();

  on<T extends GameEventType>(event: T, callback: (data: GameEventData[T]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off<T extends GameEventType>(event: T, callback: (data: GameEventData[T]) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  emit<T extends GameEventType>(event: T, data: GameEventData[T]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  removeAllListeners(event?: GameEventType): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Global event emitter instance
export const gameEvents = new GameEventEmitter();