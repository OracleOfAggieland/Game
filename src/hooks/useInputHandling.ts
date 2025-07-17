import { useCallback, useEffect, useRef } from 'react';
import { Direction } from '../types/GameEnhancements';

// Constants for input handling
const MIN_DIRECTION_CHANGE_INTERVAL = 100;
const MIN_SWIPE_DISTANCE = 30;

export interface InputHandlingOptions {
    onDirectionChange: (direction: Direction) => void;
    currentDirection: Direction;
    isGameActive: boolean;
    enableMobileControls?: boolean;
}

export function useInputHandling(options: InputHandlingOptions) {
    const lastDirectionChangeRef = useRef<number>(0);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    const isOppositeDirection = useCallback((newDirection: Direction, currentDirection: Direction): boolean => {
        const opposites: Record<Direction, Direction> = {
            'UP': 'DOWN',
            'DOWN': 'UP',
            'LEFT': 'RIGHT',
            'RIGHT': 'LEFT'
        };
        return opposites[newDirection] === currentDirection;
    }, []);

    const canChangeDirection = useCallback((): boolean => {
        const now = Date.now();
        return now - lastDirectionChangeRef.current >= MIN_DIRECTION_CHANGE_INTERVAL;
    }, []);

    const handleDirectionChange = useCallback((newDirection: Direction) => {
        if (!options.isGameActive || !canChangeDirection()) {
            return;
        }

        if (isOppositeDirection(newDirection, options.currentDirection)) {
            return;
        }

        lastDirectionChangeRef.current = Date.now();
        options.onDirectionChange(newDirection);
    }, [options, canChangeDirection, isOppositeDirection]);

    const handleKeyPress = useCallback((event: KeyboardEvent) => {
        if (!options.isGameActive) {
            return;
        }

        const keyToDirection: Record<string, Direction> = {
            'ArrowUp': 'UP',
            'ArrowDown': 'DOWN',
            'ArrowLeft': 'LEFT',
            'ArrowRight': 'RIGHT',
            'w': 'UP',
            'W': 'UP',
            's': 'DOWN',
            'S': 'DOWN',
            'a': 'LEFT',
            'A': 'LEFT',
            'd': 'RIGHT',
            'D': 'RIGHT'
        };

        const direction = keyToDirection[event.key];
        if (direction) {
            event.preventDefault();
            handleDirectionChange(direction);
        }
    }, [options.isGameActive, handleDirectionChange]);

    const handleTouchStart = useCallback((event: TouchEvent) => {
        if (!options.enableMobileControls || !options.isGameActive) {
            return;
        }

        const touch = event.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY
        };
    }, [options.enableMobileControls, options.isGameActive]);

    const handleTouchEnd = useCallback((event: TouchEvent) => {
        if (!options.enableMobileControls || !options.isGameActive || !touchStartRef.current) {
            return;
        }

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;
        const minSwipeDistance = 30;

        if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) {
            touchStartRef.current = null;
            return;
        }

        let direction: Direction;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            direction = deltaX > 0 ? 'RIGHT' : 'LEFT';
        } else {
            direction = deltaY > 0 ? 'DOWN' : 'UP';
        }

        handleDirectionChange(direction);
        touchStartRef.current = null;
    }, [options.enableMobileControls, options.isGameActive, handleDirectionChange]);

    // Mobile control buttons
    const handleMobileButton = useCallback((direction: Direction) => {
        if (options.enableMobileControls && options.isGameActive) {
            handleDirectionChange(direction);
        }
    }, [options.enableMobileControls, options.isGameActive, handleDirectionChange]);

    // Set up event listeners
    useEffect(() => {
        if (options.isGameActive) {
            document.addEventListener('keydown', handleKeyPress);

            if (options.enableMobileControls) {
                document.addEventListener('touchstart', handleTouchStart, { passive: true });
                document.addEventListener('touchend', handleTouchEnd, { passive: true });
            }
        }

        return () => {
            document.removeEventListener('keydown', handleKeyPress);
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [options.isGameActive, options.enableMobileControls, handleKeyPress, handleTouchStart, handleTouchEnd]);

    return {
        handleMobileButton,
        canChangeDirection,
        lastDirectionChange: lastDirectionChangeRef.current
    };
}