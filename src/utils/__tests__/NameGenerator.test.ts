// src/utils/__tests__/NameGenerator.test.ts
import { NameGenerator } from '../NameGenerator';

describe('NameGenerator', () => {
  beforeEach(() => {
    NameGenerator.clearUsedNames();
  });

  afterEach(() => {
    NameGenerator.clearUsedNames();
  });

  test('should generate unique names', () => {
    const name1 = NameGenerator.generateName();
    const name2 = NameGenerator.generateName();
    
    expect(name1).toBeDefined();
    expect(name2).toBeDefined();
    expect(name1).not.toBe(name2);
  });

  test('should generate names with specific patterns', () => {
    const adjectiveNoun = NameGenerator.generateName('adjective_noun');
    const colorNoun = NameGenerator.generateName('color_noun');
    const simpleId = NameGenerator.generateName('simple_id');

    expect(adjectiveNoun).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+$/);
    expect(colorNoun).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+$/);
    expect(simpleId).toMatch(/^[A-Z][a-z]+_\d+$/);
  });

  test('should track used names', () => {
    const name = NameGenerator.generateName();
    expect(NameGenerator.isNameUsed(name)).toBe(true);
    expect(NameGenerator.getUsedNameCount()).toBe(1);
  });

  test('should generate multiple unique names', () => {
    const names = NameGenerator.generateMultipleNames(5);
    
    expect(names).toHaveLength(5);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(5); // All names should be unique
  });

  test('should reserve and release names', () => {
    const customName = 'TestPlayer';
    NameGenerator.reserveName(customName);
    
    expect(NameGenerator.isNameUsed(customName)).toBe(true);
    
    NameGenerator.releaseName(customName);
    expect(NameGenerator.isNameUsed(customName)).toBe(false);
  });
});