// src/utils/SoundEffects.ts

export interface SoundConfig {
  volume: number;
  pitch?: number;
  duration?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface SoundEffect {
  id: string;
  audioBuffer?: AudioBuffer;
  frequency?: number;
  type: 'generated' | 'file';
  config: SoundConfig;
}

/**
 * Sound effects manager with Web Audio API
 */
export class SoundEffectsManager {
  private audioContext: AudioContext | null = null;
  private masterVolume: number = 0.3;
  private isEnabled: boolean = true;
  private soundEffects: Map<string, SoundEffect> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    this.initializeAudioContext();
    this.generateBasicSounds();
  }

  /**
   * Initialize Web Audio API context
   */
  private async initializeAudioContext(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Handle browser autoplay policies
      if (this.audioContext.state === 'suspended') {
        // Will be resumed on first user interaction
        document.addEventListener('click', this.resumeAudioContext.bind(this), { once: true });
        document.addEventListener('keydown', this.resumeAudioContext.bind(this), { once: true });
        document.addEventListener('touchstart', this.resumeAudioContext.bind(this), { once: true });
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.warn('Web Audio API not supported, sound effects disabled:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Resume audio context (required for autoplay policy)
   */
  private async resumeAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Generate basic sound effects using Web Audio API
   */
  private generateBasicSounds(): void {
    // Food consumption sound
    this.soundEffects.set('food', {
      id: 'food',
      frequency: 800,
      type: 'generated',
      config: {
        volume: 0.3,
        duration: 0.1,
        pitch: 1
      }
    });

    // Power-up collection sound
    this.soundEffects.set('powerup', {
      id: 'powerup',
      frequency: 1200,
      type: 'generated',
      config: {
        volume: 0.4,
        duration: 0.3,
        pitch: 1.5
      }
    });

    // Collision sound
    this.soundEffects.set('collision', {
      id: 'collision',
      frequency: 200,
      type: 'generated',
      config: {
        volume: 0.5,
        duration: 0.5,
        pitch: 0.5
      }
    });

    // Combo sound
    this.soundEffects.set('combo', {
      id: 'combo',
      frequency: 1000,
      type: 'generated',
      config: {
        volume: 0.4,
        duration: 0.2,
        pitch: 2
      }
    });

    // Wave complete sound
    this.soundEffects.set('wave_complete', {
      id: 'wave_complete',
      frequency: 600,
      type: 'generated',
      config: {
        volume: 0.6,
        duration: 0.8,
        pitch: 1.2
      }
    });

    // Boss spawn sound
    this.soundEffects.set('boss_spawn', {
      id: 'boss_spawn',
      frequency: 300,
      type: 'generated',
      config: {
        volume: 0.7,
        duration: 1.0,
        pitch: 0.8
      }
    });
  }

  /**
   * Play a sound effect
   */
  public playSound(soundId: string, config?: Partial<SoundConfig>): void {
    if (!this.isEnabled || !this.audioContext || !this.isInitialized) {
      return;
    }

    const soundEffect = this.soundEffects.get(soundId);
    if (!soundEffect) {
      console.warn(`Sound effect '${soundId}' not found`);
      return;
    }

    const finalConfig = { ...soundEffect.config, ...config };
    const volume = finalConfig.volume * this.masterVolume;

    if (volume <= 0) return;

    try {
      if (soundEffect.type === 'generated') {
        this.playGeneratedSound(soundEffect, finalConfig);
      } else if (soundEffect.audioBuffer) {
        this.playBufferedSound(soundEffect.audioBuffer, finalConfig);
      }
    } catch (error) {
      console.warn(`Failed to play sound '${soundId}':`, error);
    }
  }

  /**
   * Play a generated sound using oscillators
   */
  private playGeneratedSound(soundEffect: SoundEffect, config: SoundConfig): void {
    if (!this.audioContext || !soundEffect.frequency) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filterNode = this.audioContext.createBiquadFilter();

    // Configure oscillator
    oscillator.type = this.getOscillatorType(soundEffect.id);
    oscillator.frequency.setValueAtTime(
      soundEffect.frequency * (config.pitch || 1),
      this.audioContext.currentTime
    );

    // Configure filter for better sound quality
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(2000, this.audioContext.currentTime);

    // Configure gain (volume)
    const volume = config.volume * this.masterVolume;
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    
    // Fade in
    const fadeInTime = config.fadeIn || 0.01;
    gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + fadeInTime);
    
    // Fade out
    const duration = config.duration || 0.2;
    const fadeOutTime = config.fadeOut || 0.05;
    const fadeOutStart = this.audioContext.currentTime + duration - fadeOutTime;
    gainNode.gain.setValueAtTime(volume, fadeOutStart);
    gainNode.gain.linearRampToValueAtTime(0, fadeOutStart + fadeOutTime);

    // Connect nodes
    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Start and stop
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);

    // Add frequency modulation for more interesting sounds
    this.addFrequencyModulation(oscillator, soundEffect.id);
  }

  /**
   * Play a buffered sound (for loaded audio files)
   */
  private playBufferedSound(audioBuffer: AudioBuffer, config: SoundConfig): void {
    if (!this.audioContext) return;

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();

    source.buffer = audioBuffer;
    
    // Configure playback rate (pitch)
    source.playbackRate.setValueAtTime(
      config.pitch || 1,
      this.audioContext.currentTime
    );

    // Configure volume
    const volume = config.volume * this.masterVolume;
    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);

    // Connect and play
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    source.start();
  }

  /**
   * Get oscillator type based on sound ID
   */
  private getOscillatorType(soundId: string): OscillatorType {
    const typeMap: { [key: string]: OscillatorType } = {
      'food': 'sine',
      'powerup': 'square',
      'collision': 'sawtooth',
      'combo': 'triangle',
      'wave_complete': 'sine',
      'boss_spawn': 'sawtooth'
    };
    return typeMap[soundId] || 'sine';
  }

  /**
   * Add frequency modulation for more interesting sounds
   */
  private addFrequencyModulation(oscillator: OscillatorNode, soundId: string): void {
    if (!this.audioContext) return;

    const modulationMap: { [key: string]: { rate: number; depth: number } } = {
      'powerup': { rate: 10, depth: 50 },
      'combo': { rate: 15, depth: 100 },
      'wave_complete': { rate: 5, depth: 30 },
      'boss_spawn': { rate: 3, depth: 20 }
    };

    const modulation = modulationMap[soundId];
    if (!modulation) return;

    const modulator = this.audioContext.createOscillator();
    const modulatorGain = this.audioContext.createGain();

    modulator.frequency.setValueAtTime(modulation.rate, this.audioContext.currentTime);
    modulatorGain.gain.setValueAtTime(modulation.depth, this.audioContext.currentTime);

    modulator.connect(modulatorGain);
    modulatorGain.connect(oscillator.frequency);

    modulator.start(this.audioContext.currentTime);
    modulator.stop(this.audioContext.currentTime + 1);
  }

  /**
   * Load audio file and create sound effect
   */
  public async loadSoundFile(soundId: string, url: string, config: SoundConfig): Promise<void> {
    if (!this.audioContext) return;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      this.soundEffects.set(soundId, {
        id: soundId,
        audioBuffer,
        type: 'file',
        config
      });
    } catch (error) {
      console.warn(`Failed to load sound file '${url}':`, error);
    }
  }

  /**
   * Set master volume (0-1)
   */
  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Get master volume
   */
  public getMasterVolume(): number {
    return this.masterVolume;
  }

  /**
   * Enable or disable sound effects
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Check if sound effects are enabled
   */
  public isEnabledState(): boolean {
    return this.isEnabled && this.isInitialized;
  }

  /**
   * Get available sound effect IDs
   */
  public getAvailableSounds(): string[] {
    return Array.from(this.soundEffects.keys());
  }

  /**
   * Preload all sound effects (call this after user interaction)
   */
  public async preloadSounds(): Promise<void> {
    if (!this.audioContext) return;

    await this.resumeAudioContext();
    
    // Test each sound effect to ensure they work
    this.soundEffects.forEach((_, soundId) => {
      this.playSound(soundId, { volume: 0.01, duration: 0.01 });
    });
  }

  /**
   * Create sound effect variations
   */
  public createSoundVariation(baseSoundId: string, variationId: string, modifications: {
    pitchMultiplier?: number;
    volumeMultiplier?: number;
    durationMultiplier?: number;
  }): void {
    const baseSound = this.soundEffects.get(baseSoundId);
    if (!baseSound) return;

    const newConfig = { ...baseSound.config };
    
    if (modifications.pitchMultiplier) {
      newConfig.pitch = (newConfig.pitch || 1) * modifications.pitchMultiplier;
    }
    if (modifications.volumeMultiplier) {
      newConfig.volume = newConfig.volume * modifications.volumeMultiplier;
    }
    if (modifications.durationMultiplier) {
      newConfig.duration = (newConfig.duration || 0.2) * modifications.durationMultiplier;
    }

    this.soundEffects.set(variationId, {
      ...baseSound,
      id: variationId,
      config: newConfig
    });
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.soundEffects.clear();
    this.isInitialized = false;
  }
}

/**
 * Game-specific sound effects helper
 */
export class GameSoundEffects {
  private soundManager: SoundEffectsManager;
  private settings: {
    enabled: boolean;
    volume: number;
  };

  constructor() {
    this.soundManager = new SoundEffectsManager();
    this.settings = {
      enabled: this.getStoredSetting('soundEnabled', true),
      volume: this.getStoredSetting('soundVolume', 0.3)
    };

    this.soundManager.setEnabled(this.settings.enabled);
    this.soundManager.setMasterVolume(this.settings.volume);

    // Create sound variations
    this.createSoundVariations();
  }

  /**
   * Create variations of basic sounds
   */
  private createSoundVariations(): void {
    // Food consumption variations
    this.soundManager.createSoundVariation('food', 'food_combo', {
      pitchMultiplier: 1.5,
      volumeMultiplier: 1.2
    });

    // Power-up variations
    this.soundManager.createSoundVariation('powerup', 'powerup_rare', {
      pitchMultiplier: 0.8,
      durationMultiplier: 1.5,
      volumeMultiplier: 1.3
    });

    // Collision variations
    this.soundManager.createSoundVariation('collision', 'collision_boss', {
      pitchMultiplier: 0.7,
      durationMultiplier: 1.8,
      volumeMultiplier: 1.4
    });
  }

  /**
   * Play food consumption sound
   */
  public playFoodSound(isCombo: boolean = false): void {
    this.soundManager.playSound(isCombo ? 'food_combo' : 'food');
  }

  /**
   * Play power-up collection sound
   */
  public playPowerUpSound(powerUpType: string): void {
    const isRare = ['FREEZE', 'SCORE_MULTIPLIER'].includes(powerUpType);
    this.soundManager.playSound(isRare ? 'powerup_rare' : 'powerup');
  }

  /**
   * Play collision sound
   */
  public playCollisionSound(isBoss: boolean = false): void {
    this.soundManager.playSound(isBoss ? 'collision_boss' : 'collision');
  }

  /**
   * Play combo sound
   */
  public playComboSound(comboCount: number): void {
    const pitch = 1 + (comboCount - 2) * 0.1; // Higher pitch for longer combos
    this.soundManager.playSound('combo', { pitch });
  }

  /**
   * Play wave complete sound
   */
  public playWaveCompleteSound(): void {
    this.soundManager.playSound('wave_complete');
  }

  /**
   * Play boss spawn sound
   */
  public playBossSpawnSound(): void {
    this.soundManager.playSound('boss_spawn');
  }

  /**
   * Toggle sound effects
   */
  public toggleSounds(): boolean {
    this.settings.enabled = !this.settings.enabled;
    this.soundManager.setEnabled(this.settings.enabled);
    this.saveSettings();
    return this.settings.enabled;
  }

  /**
   * Set volume
   */
  public setVolume(volume: number): void {
    this.settings.volume = Math.max(0, Math.min(1, volume));
    this.soundManager.setMasterVolume(this.settings.volume);
    this.saveSettings();
  }

  /**
   * Get current settings
   */
  public getSettings(): { enabled: boolean; volume: number } {
    return { ...this.settings };
  }

  /**
   * Initialize sounds (call after user interaction)
   */
  public async initialize(): Promise<void> {
    await this.soundManager.preloadSounds();
  }

  /**
   * Get stored setting from localStorage
   */
  private getStoredSetting(key: string, defaultValue: any): any {
    try {
      const stored = localStorage.getItem(`snakeGame_${key}`);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem('snakeGame_soundEnabled', JSON.stringify(this.settings.enabled));
      localStorage.setItem('snakeGame_soundVolume', JSON.stringify(this.settings.volume));
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.soundManager.dispose();
  }
}