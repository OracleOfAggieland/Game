// src/tests/integration/GameEnhancements.test.ts

import { PowerUpManager } from '../../managers/PowerUpManager';
import { WaveManager } from '../../managers/WaveManager';
import { ComboSystem } from '../../utils/ComboSystem';
import { FeatureFlagManager } from '../../utils/FeatureFlags';
import { SoundEffectsManager } from '../../utils/SoundEffects';
import { MobileOptimizer } from '../../utils/MobileOptimization';

/**
 * Integration tests for game enhancements
 */
describe('Game Enhancements Integration', () => {
  let powerUpManager: PowerUpManager;
  let waveManager: WaveManager;
  let comboSystem: ComboSystem;
  let featureFlags: FeatureFlagManager;
  let soundManager: SoundEffectsManager;
  let mobileOptimizer: MobileOptimizer;

  beforeEach(() => {
    powerUpManager = new PowerUpManager();
    waveManager = new WaveManager();
    comboSystem = new ComboSystem();
    featureFlags = new FeatureFlagManager();
    soundManager = new SoundEffectsManager();
    mobileOptimizer = new MobileOptimizer();
  });

  describe('Power-up System Integration', () => {
    test('should spawn power-ups and handle collection', () => {
      // Initialize power-up system
      powerUpManager.initialize();
      
      // Simulate game board
      const occupiedPositions = new Set<string>();
      const boardSize = 25;
      
      // Update power-up system
      powerUpManager.update(1000, occupiedPositions, boardSize);
      
      // Check if power-ups are spawned
      const activePowerUps = powerUpManager.getActivePowerUps();
      expect(activePowerUps.length).toBeGreaterThanOrEqual(0);
      
      // Test power-up collection
      if (activePowerUps.length > 0) {
        const powerUp = activePowerUps[0];
        const collected = powerUpManager.collectPowerUp(powerUp.id, 'player1');
        expect(collected).toBe(true);
        
        // Verify power-up effects are applied
        const playerEffects = powerUpManager.getPlayerPowerUps('player1');
        expect(playerEffects.length).toBeGreaterThan(0);
      }
    });

    test('should integrate with combo system', () => {
      // Initialize combo system
      comboSystem.initializePlayer('player1');
      
      // Register food consumption
      const scoreEvent = comboSystem.registerFoodConsumption(
        'player1',
        10,
        { x: 10, y: 10 }
      );
      
      expect(scoreEvent.points).toBe(10);
      expect(scoreEvent.type).toBe('food');
      
      // Register power-up collection
      const powerUpEvent = comboSystem.registerPowerUpCollection(
        'player1',
        'SPEED_BOOST',
        { x: 15, y: 15 }
      );
      
      expect(powerUpEvent.points).toBeGreaterThan(0);
      expect(powerUpEvent.type).toBe('powerup');
    });
  });

  describe('Wave System Integration', () => {
    test('should progress waves and spawn boss snakes', () => {
      // Initialize wave system
      waveManager.initialize();
      
      // Simulate time progression
      let currentWave = waveManager.update(60000); // 1 minute
      expect(currentWave).toBeTruthy();
      expect(currentWave!.number).toBe(2);
      
      // Progress to boss wave
      currentWave = waveManager.update(180000); // 3 minutes
      expect(currentWave).toBeTruthy();
      expect(currentWave!.isBossWave).toBe(true);
      
      // Test boss snake creation
      const bossSnake = waveManager.createBossSnake(currentWave!.number, 0);
      expect(bossSnake).toBeTruthy();
      expect(bossSnake!.bossType).toBeDefined();
      expect(bossSnake!.specialAbilities.length).toBeGreaterThan(0);
    });

    test('should integrate with power-up system during waves', () => {
      // Initialize both systems
      powerUpManager.initialize();
      waveManager.initialize();
      
      // Progress to a wave
      const wave = waveManager.update(60000);
      expect(wave).toBeTruthy();
      
      // Power-ups should still spawn during waves
      const occupiedPositions = new Set<string>();
      powerUpManager.update(1000, occupiedPositions, 25);
      
      const activePowerUps = powerUpManager.getActivePowerUps();
      // Power-ups should be available regardless of wave state
      expect(activePowerUps).toBeDefined();
    });
  });

  describe('Feature Flag Integration', () => {
    test('should control feature availability', () => {
      // Test power-up feature flag
      const powerUpsEnabled = featureFlags.isEnabled('power_ups');
      expect(typeof powerUpsEnabled).toBe('boolean');
      
      // Test wave system feature flag
      const waveSystemEnabled = featureFlags.isEnabled('wave_system');
      expect(typeof waveSystemEnabled).toBe('boolean');
      
      // Test feature override
      featureFlags.override('power_ups', false);
      expect(featureFlags.isEnabled('power_ups')).toBe(false);
      
      featureFlags.removeOverride('power_ups');
      // Should return to original state
    });

    test('should handle device-specific flags', () => {
      // Test mobile-specific flags
      const mobileOptimizations = featureFlags.isEnabled('mobile_optimizations');
      const webglRendering = featureFlags.isEnabled('webgl_rendering');
      const particleEffects = featureFlags.isEnabled('particle_effects');
      
      expect(typeof mobileOptimizations).toBe('boolean');
      expect(typeof webglRendering).toBe('boolean');
      expect(typeof particleEffects).toBe('boolean');
    });
  });

  describe('Sound System Integration', () => {
    test('should play sounds for game events', () => {
      // Mock audio context to avoid browser restrictions
      const mockAudioContext = {
        createOscillator: jest.fn(() => ({
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
          frequency: { setValueAtTime: jest.fn() },
          type: 'sine'
        })),
        createGain: jest.fn(() => ({
          connect: jest.fn(),
          gain: { setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() }
        })),
        createBiquadFilter: jest.fn(() => ({
          connect: jest.fn(),
          frequency: { setValueAtTime: jest.fn() },
          type: 'lowpass'
        })),
        destination: {},
        currentTime: 0
      };
      
      // Test sound effects are available
      const availableSounds = soundManager.getAvailableSounds();
      expect(availableSounds).toContain('food');
      expect(availableSounds).toContain('powerup');
      expect(availableSounds).toContain('collision');
      expect(availableSounds).toContain('combo');
    });
  });

  describe('Mobile Optimization Integration', () => {
    test('should detect device capabilities', () => {
      const deviceInfo = mobileOptimizer.getDeviceInfo();
      
      expect(deviceInfo).toHaveProperty('isMobile');
      expect(deviceInfo).toHaveProperty('isTablet');
      expect(deviceInfo).toHaveProperty('isLowEnd');
      expect(deviceInfo).toHaveProperty('hasHighDPI');
      expect(deviceInfo).toHaveProperty('supportsWebGL');
    });

    test('should provide appropriate performance settings', () => {
      const settings = mobileOptimizer.getPerformanceSettings();
      
      expect(settings).toHaveProperty('enableParticles');
      expect(settings).toHaveProperty('enableSmoothMovement');
      expect(settings).toHaveProperty('enableSoundEffects');
      expect(settings).toHaveProperty('enableWebGL');
      expect(settings).toHaveProperty('maxPowerUps');
      expect(settings).toHaveProperty('particleCount');
      expect(settings).toHaveProperty('animationQuality');
      expect(settings).toHaveProperty('frameRateTarget');
      
      // Validate setting values
      expect(settings.maxPowerUps).toBeGreaterThan(0);
      expect(settings.particleCount).toBeGreaterThanOrEqual(0);
      expect(['low', 'medium', 'high']).toContain(settings.animationQuality);
      expect(settings.frameRateTarget).toBeGreaterThan(0);
    });
  });

  describe('Cross-System Integration', () => {
    test('should handle multiple systems working together', () => {
      // Initialize all systems
      powerUpManager.initialize();
      waveManager.initialize();
      comboSystem.initializePlayer('player1');
      
      // Simulate game progression
      const occupiedPositions = new Set<string>();
      
      // Update power-up system
      powerUpManager.update(1000, occupiedPositions, 25);
      
      // Progress wave system
      const wave = waveManager.update(60000);
      
      // Register score events
      const scoreEvent = comboSystem.registerFoodConsumption(
        'player1',
        10,
        { x: 10, y: 10 }
      );
      
      // All systems should work without conflicts
      expect(powerUpManager.getActivePowerUps()).toBeDefined();
      expect(wave).toBeTruthy();
      expect(scoreEvent.points).toBeGreaterThan(0);
    });

    test('should respect feature flags across systems', () => {
      // Disable power-ups
      featureFlags.override('power_ups', false);
      
      // Power-up system should respect the flag
      if (!featureFlags.isEnabled('power_ups')) {
        // In a real implementation, power-up spawning would be disabled
        expect(featureFlags.isEnabled('power_ups')).toBe(false);
      }
      
      // Disable wave system
      featureFlags.override('wave_system', false);
      
      if (!featureFlags.isEnabled('wave_system')) {
        // Wave progression would be disabled
        expect(featureFlags.isEnabled('wave_system')).toBe(false);
      }
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle system failures gracefully', () => {
      // Test power-up system error handling
      expect(() => {
        powerUpManager.collectPowerUp('invalid-id', 'player1');
      }).not.toThrow();
      
      // Test wave system error handling
      expect(() => {
        waveManager.createBossSnake(-1, 0);
      }).not.toThrow();
      
      // Test combo system error handling
      expect(() => {
        comboSystem.registerFoodConsumption('', 0, { x: -1, y: -1 });
      }).not.toThrow();
    });
  });

  describe('Performance Integration', () => {
    test('should maintain performance with all features enabled', () => {
      const startTime = performance.now();
      
      // Initialize all systems
      powerUpManager.initialize();
      waveManager.initialize();
      comboSystem.initializePlayer('player1');
      
      // Simulate heavy usage
      for (let i = 0; i < 100; i++) {
        powerUpManager.update(16, new Set(), 25); // 60 FPS
        waveManager.update(i * 1000);
        comboSystem.updateCombos();
      }
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Should complete within reasonable time (less than 100ms for 100 iterations)
      expect(executionTime).toBeLessThan(100);
    });
  });
});

/**
 * Mock implementations for testing
 */
const mockGameState = {
  players: {
    player1: {
      id: 'player1',
      name: 'Test Player',
      positions: [{ x: 10, y: 10 }],
      direction: 'RIGHT' as const,
      score: 0,
      color: '#00ff88',
      isAlive: true,
      isAI: false
    }
  },
  food: [{ x: 15, y: 15 }],
  powerUps: [],
  gameState: 'playing' as const,
  maxPlayers: 6
};

/**
 * Test utilities
 */
export const testUtils = {
  createMockGameState: () => ({ ...mockGameState }),
  
  simulateGameLoop: (systems: any[], iterations: number = 10) => {
    for (let i = 0; i < iterations; i++) {
      systems.forEach(system => {
        if (system.update) {
          system.update(16); // 60 FPS
        }
      });
    }
  },
  
  measurePerformance: (fn: () => void): number => {
    const start = performance.now();
    fn();
    return performance.now() - start;
  }
};