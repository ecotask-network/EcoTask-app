import {
  formatTokenAmount,
  formatReward,
  formatUsdc,
} from '../utils/formatTokens';

describe('formatTokenAmount', () => {
  it('formats small numbers with decimals', () => {
    expect(formatTokenAmount(42)).toBe('42.00');
  });

  it('formats thousands with K suffix', () => {
    expect(formatTokenAmount(1500)).toBe('1.50K');
  });

  it('formats millions with M suffix', () => {
    expect(formatTokenAmount(2500000)).toBe('2.50M');
  });

  it('handles string input', () => {
    expect(formatTokenAmount('99.5')).toBe('99.50');
  });

  it('returns 0 for NaN input', () => {
    expect(formatTokenAmount(NaN)).toBe('0');
    expect(formatTokenAmount('not-a-number')).toBe('0');
  });

  it('respects custom decimals', () => {
    expect(formatTokenAmount(1.23456, 4)).toBe('1.2346');
  });
});

describe('formatReward', () => {
  it('formats with default ECO token', () => {
    expect(formatReward(100)).toBe('100.00 ECO');
  });

  it('formats with custom token', () => {
    expect(formatReward(500, 'XLM')).toBe('500.00 XLM');
  });

  it('formats large amounts', () => {
    expect(formatReward(10000, 'ECO')).toBe('10.00K ECO');
  });
});

describe('formatUsdc', () => {
  it('always formats with 2 decimal places', () => {
    expect(formatUsdc(25.5)).toBe('25.50');
    expect(formatUsdc('100.1234567')).toBe('100.12');
    expect(formatUsdc(0)).toBe('0.00');
  });

  it('applies K/M suffixes at scale', () => {
    expect(formatUsdc(1500)).toBe('1.50K');
    expect(formatUsdc(2000000)).toBe('2.00M');
  });

  it('returns 0 for invalid input', () => {
    expect(formatUsdc(NaN)).toBe('0');
    expect(formatUsdc('not-a-number')).toBe('0');
  });
});
