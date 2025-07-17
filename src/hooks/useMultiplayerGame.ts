// src/hooks/useMultiplayerGame.ts
import { useState, useRef, useCallback } from 'react';
import { GameRoom, Snake, Position, Direction } from '../types/GameEnhancements';
import { PowerUpManager } from '../managers/PowerUpManager';
import { WaveManager } from '../managers/WaveManager';
import { BossSnake, Wave } from '../types/Wave';

export interface UseMultiplayerGameOptions {
  playerId: string;
  onError?: (error: string) => void;
}

export function useMultiplayerGame(options: UseMultiplayerGameOptions) {
  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [currentWave, setCurrentWave] = useState<Wave | null>(null);
  const [bossSnakes, setBossSnakes] = useState<BossSnake[]>([]);
  const [waveNotification, setWaveNotification] = useState<string | null>(null);
  
  const powerUpManagerRef = useRef<PowerUpManager>(new PowerUpManager());
  const waveManagerRef = useRef<WaveManager>(new WaveManager());

  const initializeGame = useCallback(() => {
    powerUpManagerRef.current.initialize();
    waveManagerRef.current.initialize();
  }, []);

  const updateGameState = useCallback(() => {
    if (!gameRoom || gameRoom.gameState !== 'playing') return;

    // Update power-up system
    const deltaTime = 1000 / 60;
    const occupiedPositions = new Set(
      Object.values(gameRoom.players).flatMap(s =>
        s.isAlive ? s.positions.map(p => `${p.x},${p.y}`) : []
      )
    );
    powerUpManagerRef.current.update(deltaTime, occupiedPositions, 25);

    // Update wave system
    const newWave = waveManagerRef.current.update(deltaTime);
    if (newWave) {
      setCurrentWave(newWave);
      setWaveNotification(`Wave ${newWave.number} ${newWave.isBossWave ? 'BOSS WAVE!' : 'Started!'}`);
      setTimeout(() => setWaveNotification(null), 3000);

      if (newWave.isBossWave) {
        const newBoss = waveManagerRef.current.createBossSnake(newWave.number, bossSnakes.length);
        if (newBoss) {
          setBossSnakes(prev => [...prev, newBoss]);
        }
      }
    }
  }, [gameRoom, bossSnakes.length]);

  return {
    gameRoom,
    setGameRoom,
    currentWave,
    bossSnakes,
    setBossSnakes,
    waveNotification,
    powerUpManager: powerUpManagerRef.current,
    waveManager: waveManagerRef.current,
    initializeGame,
    updateGameState
  };
}