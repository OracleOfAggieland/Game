// src/utils/NameGenerator.ts

const SNAKE_ADJECTIVES = [
  'Swift', 'Deadly', 'Cunning', 'Fierce', 'Stealthy', 'Lightning', 'Shadow', 'Golden',
  'Silver', 'Crimson', 'Emerald', 'Azure', 'Phantom', 'Venom', 'Thunder', 'Frost',
  'Blazing', 'Mystic', 'Royal', 'Wild', 'Ancient', 'Neon', 'Cyber', 'Quantum'
];

const SNAKE_NOUNS = [
  'Viper', 'Cobra', 'Python', 'Mamba', 'Anaconda', 'Serpent', 'Adder', 'Boa',
  'Rattler', 'Striker', 'Hunter', 'Slither', 'Coil', 'Fang', 'Scale', 'Hiss',
  'Twist', 'Spiral', 'Glide', 'Dart', 'Flash', 'Bolt', 'Whip', 'Lash'
];

const COLORS = [
  'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Pink', 'Cyan',
  'Magenta', 'Lime', 'Indigo', 'Violet', 'Turquoise', 'Coral', 'Amber'
];

const SIMPLE_NAMES = [
  'Player', 'Gamer', 'Snake', 'Serpent', 'Slither', 'Crawler', 'Glider'
];

export class NameGenerator {
  private static usedNames = new Set<string>();

  /**
   * Generates a random snake name using various patterns
   * @param pattern - The naming pattern to use
   * @returns A unique snake name
   */
  public static generateName(pattern: 'adjective_noun' | 'color_noun' | 'simple_id' | 'random' = 'random'): string {
    let name: string;
    let attempts = 0;
    const maxAttempts = 50;

    do {
      switch (pattern) {
        case 'adjective_noun':
          name = this.generateAdjectiveNoun();
          break;
        case 'color_noun':
          name = this.generateColorNoun();
          break;
        case 'simple_id':
          name = this.generateSimpleId();
          break;
        case 'random':
        default:
          name = this.generateRandomPattern();
          break;
      }
      attempts++;
    } while (this.usedNames.has(name) && attempts < maxAttempts);

    // If we couldn't find a unique name, append a number
    if (this.usedNames.has(name)) {
      const baseNumber = Math.floor(Math.random() * 9999) + 1;
      name = `${name}${baseNumber}`;
    }

    this.usedNames.add(name);
    return name;
  }

  /**
   * Generates a name using adjective + noun pattern (e.g., "SwiftViper")
   */
  private static generateAdjectiveNoun(): string {
    const adjective = SNAKE_ADJECTIVES[Math.floor(Math.random() * SNAKE_ADJECTIVES.length)];
    const noun = SNAKE_NOUNS[Math.floor(Math.random() * SNAKE_NOUNS.length)];
    return `${adjective}${noun}`;
  }

  /**
   * Generates a name using color + noun pattern (e.g., "GreenCobra")
   */
  private static generateColorNoun(): string {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const noun = SNAKE_NOUNS[Math.floor(Math.random() * SNAKE_NOUNS.length)];
    return `${color}${noun}`;
  }

  /**
   * Generates a simple name with ID (e.g., "Player_1234")
   */
  private static generateSimpleId(): string {
    const simpleName = SIMPLE_NAMES[Math.floor(Math.random() * SIMPLE_NAMES.length)];
    const id = Math.floor(Math.random() * 9999) + 1;
    return `${simpleName}_${id}`;
  }

  /**
   * Generates a name using a random pattern
   */
  private static generateRandomPattern(): string {
    const patterns = ['adjective_noun', 'color_noun', 'simple_id'];
    const randomPattern = patterns[Math.floor(Math.random() * patterns.length)] as 'adjective_noun' | 'color_noun' | 'simple_id';
    
    switch (randomPattern) {
      case 'adjective_noun':
        return this.generateAdjectiveNoun();
      case 'color_noun':
        return this.generateColorNoun();
      case 'simple_id':
        return this.generateSimpleId();
      default:
        return this.generateAdjectiveNoun();
    }
  }

  /**
   * Clears the used names cache (useful for testing or when starting fresh)
   */
  public static clearUsedNames(): void {
    this.usedNames.clear();
  }

  /**
   * Checks if a name has been used
   */
  public static isNameUsed(name: string): boolean {
    return this.usedNames.has(name);
  }

  /**
   * Manually reserves a name (useful when player sets custom name)
   */
  public static reserveName(name: string): void {
    this.usedNames.add(name);
  }

  /**
   * Releases a name back to the pool (useful when player leaves)
   */
  public static releaseName(name: string): void {
    this.usedNames.delete(name);
  }

  /**
   * Gets the count of currently used names
   */
  public static getUsedNameCount(): number {
    return this.usedNames.size;
  }

  /**
   * Generates multiple unique names at once
   */
  public static generateMultipleNames(count: number, pattern: 'adjective_noun' | 'color_noun' | 'simple_id' | 'random' = 'random'): string[] {
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      names.push(this.generateName(pattern));
    }
    return names;
  }
}