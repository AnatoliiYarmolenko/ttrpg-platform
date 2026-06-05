import { describe, it, expect } from 'vitest';
import {
  parseFormula,
  extractDiceGroups,
  evaluateFormula,
  getStaticModifier
} from '@/features/vtt/utils/diceFormulaEngine';

describe('diceFormulaEngine', () => {
  describe('parseFormula', () => {
    it('parses standard dice formulas', () => {
      expect(parseFormula('1d20')).toEqual([{ type: 'dice', sign: '+', count: 1, letter: 'd', sides: 20 }]);
      expect(parseFormula('2d6 + 5')).toEqual([
        { type: 'dice', sign: '+', count: 2, letter: 'd', sides: 6 },
        { type: 'modifier', sign: '+', value: 5 }
      ]);
    });

    it('cleans up spaces between count, letter, and sides', () => {
      expect(parseFormula('1 д 6')).toEqual([{ type: 'dice', sign: '+', count: 1, letter: 'd', sides: 6 }]);
      expect(parseFormula('2  d   20')).toEqual([{ type: 'dice', sign: '+', count: 2, letter: 'd', sides: 20 }]);
    });

    it('normalizes custom letters (д, к, в, l, л, r) to d', () => {
      expect(parseFormula('1д6')).toEqual([{ type: 'dice', sign: '+', count: 1, letter: 'd', sides: 6 }]);
      expect(parseFormula('1к6')).toEqual([{ type: 'dice', sign: '+', count: 1, letter: 'd', sides: 6 }]);
      expect(parseFormula('1в6')).toEqual([{ type: 'dice', sign: '+', count: 1, letter: 'd', sides: 6 }]);
      expect(parseFormula('1l6')).toEqual([{ type: 'dice', sign: '+', count: 1, letter: 'd', sides: 6 }]);
      expect(parseFormula('1л6')).toEqual([{ type: 'dice', sign: '+', count: 1, letter: 'd', sides: 6 }]);
      expect(parseFormula('1r6')).toEqual([{ type: 'dice', sign: '+', count: 1, letter: 'd', sides: 6 }]);
    });

    it('handles negative modifiers and dice', () => {
      expect(parseFormula('1d20 - 3')).toEqual([
        { type: 'dice', sign: '+', count: 1, letter: 'd', sides: 20 },
        { type: 'modifier', sign: '-', value: 3 }
      ]);
      expect(parseFormula('1d20 - 1d4')).toEqual([
        { type: 'dice', sign: '+', count: 1, letter: 'd', sides: 20 },
        { type: 'dice', sign: '-', count: 1, letter: 'd', sides: 4 }
      ]);
    });

    it('handles uppercase input', () => {
      expect(parseFormula('1D20 + 2D6')).toEqual([
        { type: 'dice', sign: '+', count: 1, letter: 'd', sides: 20 },
        { type: 'dice', sign: '+', count: 2, letter: 'd', sides: 6 }
      ]);
    });

    it('ignores /r or /roll prefix', () => {
      expect(parseFormula('/r 1d20')).toEqual([{ type: 'dice', sign: '+', count: 1, letter: 'd', sides: 20 }]);
      expect(parseFormula('/roll 1d20')).toEqual([{ type: 'dice', sign: '+', count: 1, letter: 'd', sides: 20 }]);
    });
  });

  describe('extractDiceGroups', () => {
    it('returns an array of dice strings', () => {
      expect(extractDiceGroups('2d6 + 1d4 + 5')).toEqual(['2d6', '1d4']);
      expect(extractDiceGroups('5')).toEqual([]);
    });
  });

  describe('getStaticModifier', () => {
    it('calculates the sum of all static modifiers', () => {
      expect(getStaticModifier('1d20 + 5 - 2')).toBe(3);
      expect(getStaticModifier('1d20')).toBe(0);
      expect(getStaticModifier('2d6 + 10 + 5 - 1')).toBe(14);
    });
  });

  describe('evaluateFormula', () => {
    it('evaluates dice correctly using provided results', () => {
      const tokens = parseFormula('1d20 + 2d6 + 5');
      const diceResults = [
        { sides: 20, value: 15 },
        { sides: 6, rolls: [{ value: 3 }, { value: 4 }] }
      ];
      
      const { total, details } = evaluateFormula(tokens, diceResults);
      
      expect(total).toBe(15 + 3 + 4 + 5); // 27
      expect(details).toHaveLength(3);
      expect(details[0]).toEqual({ label: '1d20', values: [15], sign: '+', subtotal: 15 });
      expect(details[1]).toEqual({ label: '2d6', values: [3, 4], sign: '+', subtotal: 7 });
      expect(details[2]).toEqual({ label: '5', values: [], sign: '+', subtotal: 5 });
    });

    it('evaluates negative dice and modifiers', () => {
      const tokens = parseFormula('1d20 - 1d4 - 2');
      const diceResults = [
        { sides: 20, value: 18 },
        { sides: 4, value: 3 }
      ];
      
      const { total, details } = evaluateFormula(tokens, diceResults);
      
      expect(total).toBe(18 - 3 - 2); // 13
      expect(details[1].subtotal).toBe(-3);
      expect(details[2].subtotal).toBe(-2);
    });
  });
});
