import { describe, expect, it } from 'vitest';
import { getInitials } from '../format';

describe('getInitials', () => {
  it('returns first letters of first two words in uppercase', () => {
    expect(getInitials('Admin Bani Sukar')).toBe('AB');
    expect(getInitials('siti aminah')).toBe('SA');
  });

  it('returns first two characters for single-word names', () => {
    expect(getInitials('Sukar')).toBe('SU');
    expect(getInitials('A')).toBe('A');
  });

  it('handles extra whitespace and empty strings', () => {
    expect(getInitials('  Ahmad   Fauzi  ')).toBe('AF');
    expect(getInitials('   ')).toBe('?');
    expect(getInitials('')).toBe('?');
  });
});
