import { describe, expect, it } from 'vitest';
import { addMonths, formatTime, fromDayNum, monthGrid, parseIso, startOfWeek, toDayNum, toIso, weekday } from '../dates';

describe('dates', () => {
  it('round-trips every day across four centuries', () => {
    for (let n = toDayNum(1800, 1, 1); n <= toDayNum(2200, 12, 31); n += 1) {
      const { y, m, d } = fromDayNum(n);
      expect(toDayNum(y, m, d)).toBe(n);
    }
  });

  it('knows the epoch and weekdays', () => {
    expect(toDayNum(1970, 1, 1)).toBe(0);
    expect(weekday(toDayNum(2026, 11, 14))).toBe(6); // Saturday
    expect(weekday(toDayNum(2000, 2, 29))).toBe(2); // Tuesday
  });

  it('parses and rejects ISO dates', () => {
    expect(toIso(parseIso('2026-11-14')!)).toBe('2026-11-14');
    expect(parseIso('2026-02-30')).toBeNull();
    expect(parseIso('2026-13-01')).toBeNull();
    expect(parseIso('nonsense')).toBeNull();
  });

  it('builds a Monday-first month grid', () => {
    const grid = monthGrid(2026, 11, 1);
    expect(grid).toHaveLength(6);
    expect(toIso(grid[0][0])).toBe('2026-10-26');
    expect(toIso(grid[5][6])).toBe('2026-12-06');
    expect(startOfWeek(toDayNum(2026, 11, 14), 6)).toBe(toDayNum(2026, 11, 14));
  });

  it('shifts months across year ends', () => {
    expect(addMonths(2026, 12, 1)).toEqual({ y: 2027, m: 1 });
    expect(addMonths(2026, 1, -1)).toEqual({ y: 2025, m: 12 });
    expect(addMonths(2026, 5, -17)).toEqual({ y: 2024, m: 12 });
  });

  it('formats times', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(9 * 60 + 5)).toBe('09:05');
    expect(formatTime(1440)).toBe('00:00');
  });
});
