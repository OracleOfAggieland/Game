import { useReducer, useCallback } from 'react';
import { GameRoom, Snake, Direction, Wave, BossSnake } from '../types/GameEnhancements';

export interface GameState {
  gameRoom: GameRoom | null;
  gameMode: 'menu' | 'playing' | 'paused' | 'ended';
  timeLeft: number;
  direction: Direction;
  currentWave: Wave | null;
  bossSnakes: BossSnake[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
}

export type GameAction = 
  | { type: 'SET_GAME_ROOM'; payload: GameRoom | null }
  | { type: 'SET_GAME_MODE'; payload: GameState['gameMode'] }
  | { type: 'UPDATE_DIRECTION'; payload: Direction }
  | { type: 'SET_TIME_LEFT'; payload: number }
  | { type: 'START_WAVE'; payload: Wave }
  | { type: 'END_WAVE' }
  | { type: 'SPAWN_BOSS'; payload: BossSnake }
  | { type: 'REMOVE_BOSS'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_TIMESTAMP' }
  | { type: 'RESET_GAME' };

const initialState: GameState = {
  gameRoom: null,
  gameMode: 'menu',
  timeLeft: 180,
  direction: 'RIGHT',
  currentWave: null,
  bossSnakes: [],
  isLoading: false,
  error: null,
  lastUpdate: Date.now()
};

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_GAME_ROOM':
      return {
        ...state,
        gameRoom: action.payload,
        lastUpdate: Date.now()
      };

    case 'SET_GAME_MODE':
      return {
        ...state,
        gameMode: action.payload,
        error: action.payload === 'playing' ? null : state.error,
        lastUpdate: Date.now()
      };

    case 'UPDATE_DIRECTION':
      return {
        ...state,
        direction: action.payload,
        lastUpdate: Date.now()
      };

    case 'SET_TIME_LEFT':
      return {
        ...state,
        timeLeft: Math.max(0, action.payload),
        gameMode: action.payload <= 0 ? 'ended' : state.gameMode,
        lastUpdate: Date.now()
      };

    case 'START_WAVE':
      return {
        ...state,
        currentWave: action.payload,
        lastUpdate: Date.now()
      };

    case 'END_WAVE':
      return {
        ...state,
        currentWave: null,
        bossSnakes: [], // Clear bosses when wave ends
        lastUpdate: Date.now()
      };

    case 'SPAWN_BOSS':
      return {
        ...state,
        bossSnakes: [...state.bossSnakes, action.payload],
        lastUpdate: Date.now()
      };

    case 'REMOVE_BOSS':
      return {
        ...state,
        bossSnakes: state.bossSnakes.filter(boss => boss.id !== action.payload),
        lastUpdate: Date.now()
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
        lastUpdate: Date.now()
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        lastUpdate: Date.now()
      };

    case 'UPDATE_TIMESTAMP':
      return {
        ...state,
        lastUpdate: Date.now()
      };

    case 'RESET_GAME':
      return {
        ...initialState,
        lastUpdate: Date.now()
      };

    default:
      return state;
  }
}

export function useGameState() {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const actions = {
    setGameRoom: useCallback((gameRoom: GameRoom | null) => {
      dispatch({ type: 'SET_GAME_ROOM', payload: gameRoom });
    }, []),

    setGameMode: useCallback((mode: GameState['gameMode']) => {
      dispatch({ type: 'SET_GAME_MODE', payload: mode });
    }, []),

    updateDirection: useCallback((direction: Direction) => {
      dispatch({ type: 'UPDATE_DIRECTION', payload: direction });
    }, []),

    setTimeLeft: useCallback((time: number) => {
      dispatch({ type: 'SET_TIME_LEFT', payload: time });
    }, []),

    startWave: useCallback((wave: Wave) => {
      dispatch({ type: 'START_WAVE', payload: wave });
    }, []),

    endWave: useCallback(() => {
      dispatch({ type: 'END_WAVE' });
    }, []),

    spawnBoss: useCallback((boss: BossSnake) => {
      dispatch({ type: 'SPAWN_BOSS', payload: boss });
    }, []),

    removeBoss: useCallback((bossId: string) => {
      dispatch({ type: 'REMOVE_BOSS', payload: bossId });
    }, []),

    setLoading: useCallback((loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    }, []),

    setError: useCallback((error: string | null) => {
      dispatch({ type: 'SET_ERROR', payload: error });
    }, []),

    updateTimestamp: useCallback(() => {
      dispatch({ type: 'UPDATE_TIMESTAMP' });
    }, []),

    resetGame: useCallback(() => {
      dispatch({ type: 'RESET_GAME' });
    }, [])
  };

  return {
    state,
    actions
  };
}