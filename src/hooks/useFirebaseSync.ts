import { useCallback, useEffect, useRef } from 'react';
import { doc, setDoc, onSnapshot, updateDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { GameRoom, Snake } from '../types/GameEnhancements';
import { GameErrorHandler } from '../services/GameErrorHandler';
import { gameEvents } from '../services/GameEventEmitter';

export interface FirebaseSyncOptions {
  roomId?: string;
  playerId?: string;
  onRoomUpdate?: (room: GameRoom) => void;
  onError?: (error: string) => void;
}

export function useFirebaseSync(options: FirebaseSyncOptions) {
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isConnectedRef = useRef(false);

  const createRoom = useCallback(async (roomCode: string, initialRoom: GameRoom) => {
    try {
      await setDoc(doc(db, 'gameRooms', roomCode), initialRoom);
      isConnectedRef.current = true;
      gameEvents.emit('game-started', { 
        roomId: roomCode, 
        playerCount: Object.keys(initialRoom.players).length 
      });
      return { success: true };
    } catch (error) {
      const result = GameErrorHandler.handleFirebaseError(error as Error, {
        operation: 'create room',
        roomId: roomCode
      });
      options.onError?.(result.message || 'Failed to create room');
      return result;
    }
  }, [options]);

  const joinRoom = useCallback(async (roomCode: string, player: Snake) => {
    try {
      const roomRef = doc(db, 'gameRooms', roomCode);
      await updateDoc(roomRef, {
        [`players.${player.id}`]: player
      });
      
      gameEvents.emit('player-joined', {
        playerId: player.id,
        playerName: player.name
      });
      
      return { success: true };
    } catch (error) {
      const result = GameErrorHandler.handleFirebaseError(error as Error, {
        operation: 'join room',
        roomId: roomCode,
        userId: player.id
      });
      options.onError?.(result.message || 'Failed to join room');
      return result;
    }
  }, [options]);

  const leaveRoom = useCallback(async (roomCode: string, playerId: string, playerName: string) => {
    try {
      const roomRef = doc(db, 'gameRooms', roomCode);
      await updateDoc(roomRef, {
        [`players.${playerId}`]: null
      });
      
      gameEvents.emit('player-left', {
        playerId,
        playerName
      });
      
      return { success: true };
    } catch (error) {
      const result = GameErrorHandler.handleFirebaseError(error as Error, {
        operation: 'leave room',
        roomId: roomCode,
        userId: playerId
      });
      options.onError?.(result.message || 'Failed to leave room');
      return result;
    }
  }, [options]);

  const updateGameState = useCallback(async (roomCode: string, updates: Partial<GameRoom>) => {
    try {
      const roomRef = doc(db, 'gameRooms', roomCode);
      await updateDoc(roomRef, updates);
      return { success: true };
    } catch (error) {
      const result = GameErrorHandler.handleFirebaseError(error as Error, {
        operation: 'update game state',
        roomId: roomCode
      });
      options.onError?.(result.message || 'Failed to update game state');
      return result;
    }
  }, [options]);

  const updatePlayerState = useCallback(async (roomCode: string, playerId: string, playerUpdates: Partial<Snake>) => {
    try {
      const roomRef = doc(db, 'gameRooms', roomCode);
      const updateObject: any = {};
      
      Object.keys(playerUpdates).forEach(key => {
        updateObject[`players.${playerId}.${key}`] = (playerUpdates as any)[key];
      });
      
      await updateDoc(roomRef, updateObject);
      return { success: true };
    } catch (error) {
      const result = GameErrorHandler.handleFirebaseError(error as Error, {
        operation: 'update player state',
        roomId: roomCode,
        userId: playerId
      });
      options.onError?.(result.message || 'Failed to update player state');
      return result;
    }
  }, [options]);

  const subscribeToRoom = useCallback((roomCode: string) => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    try {
      const roomRef = doc(db, 'gameRooms', roomCode);
      unsubscribeRef.current = onSnapshot(roomRef, (doc) => {
        if (doc.exists()) {
          const roomData = doc.data() as GameRoom;
          isConnectedRef.current = true;
          options.onRoomUpdate?.(roomData);
        } else {
          options.onError?.('Room not found');
        }
      }, (error) => {
        isConnectedRef.current = false;
        const result = GameErrorHandler.handleFirebaseError(error, {
          operation: 'subscribe to room',
          roomId: roomCode
        });
        options.onError?.(result.message || 'Connection lost');
      });

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      };
    } catch (error) {
      const result = GameErrorHandler.handleFirebaseError(error as Error, {
        operation: 'subscribe to room',
        roomId: roomCode
      });
      options.onError?.(result.message || 'Failed to connect to room');
      return () => {};
    }
  }, [options]);

  const deleteRoom = useCallback(async (roomCode: string) => {
    try {
      await deleteDoc(doc(db, 'gameRooms', roomCode));
      return { success: true };
    } catch (error) {
      const result = GameErrorHandler.handleFirebaseError(error as Error, {
        operation: 'delete room',
        roomId: roomCode
      });
      options.onError?.(result.message || 'Failed to delete room');
      return result;
    }
  }, [options]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return {
    createRoom,
    joinRoom,
    leaveRoom,
    updateGameState,
    updatePlayerState,
    subscribeToRoom,
    deleteRoom,
    isConnected: isConnectedRef.current
  };
}