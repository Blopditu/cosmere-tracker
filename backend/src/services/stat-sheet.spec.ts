import { describe, expect, it } from 'vitest';
import { computeCharacterStatSheet, createEmptyCharacterStatSheet, tableValue } from '@shared/domain';

describe('Character stat sheet formulas', () => {
  it('computes defenses, resources, and skill modifiers from Chapter 3 formulas', () => {
    const sheet = createEmptyCharacterStatSheet();
    sheet.attributeScores['strength'] = 4;
    sheet.attributeScores['speed'] = 3;
    sheet.attributeScores['intellect'] = 2;
    sheet.attributeScores['willpower'] = 5;
    sheet.attributeScores['awareness'] = 1;
    sheet.attributeScores['presence'] = 6;
    sheet.resourceBonuses.health = 1;
    sheet.resourceBonuses.focus = 2;
    sheet.resourceBonuses.investiture = 3;
    sheet.defenseBonuses['physical-defense'] = 1;
    sheet.defenseBonuses['cognitive-defense'] = 2;
    sheet.defenseBonuses['spiritual-defense'] = 3;
    sheet.skillRanks['stealth'] = 2;
    sheet.skillRanks['lore'] = 1;

    const computed = computeCharacterStatSheet(sheet);

    expect(computed.defenses['physical-defense']).toBe(18);
    expect(computed.defenses['cognitive-defense']).toBe(19);
    expect(computed.defenses['spiritual-defense']).toBe(20);
    expect(computed.resources.health).toBe(15);
    expect(computed.resources.focus).toBe(9);
    expect(computed.resources.investiture).toBe(11);
    expect(computed.skillModifiers['stealth']).toBe(5);
    expect(computed.skillModifiers['lore']).toBe(3);
  });

  it('uses the Chapter 3 lookup tables for derived statistics', () => {
    expect(tableValue('strength-lifting-carrying', 7, 'lifting-capacity')).toBe('5,000 lb.');
    expect(tableValue('strength-lifting-carrying', 7, 'carrying-capacity')).toBe('2,500 lb.');
    expect(tableValue('speed-movement', 5, 'movement-rate')).toBe('40 feet per action');
    expect(tableValue('willpower-recovery-die', 8, 'recovery-die')).toBe('1d12');
    expect(tableValue('awareness-senses-range', 9, 'senses-range')).toBe('Unaffected by obscured senses');
    expect(tableValue('presence-connections', 4, 'established-connections')).toBe('5 days');
  });
});
