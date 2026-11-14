import { describe, expect, it } from 'vitest';
import { toDayNum, toIso } from '../dates';
import { JD_EPOCH, newMoonJd, sunsetJd } from '../hijri/astro';
import { hijriFromDay, hijriMonthLength, hijriMonthStart, hijriToDay, type HijriConfig } from '../hijri/engine';

const utc = (jd: number) => new Date((jd - JD_EPOCH) * 86400000).toISOString().slice(0, 16);
const MA: HijriConfig = { region: 'MA', adjust: 0 };
const MECCA: HijriConfig = { region: 'MECCA', adjust: 0 };
const start = (y: number, m: number, cfg: HijriConfig) => toIso(hijriMonthStart(y, m, cfg));

describe('astronomy', () => {
  it('finds new moons to the minute', () => {
    expect(utc(newMoonJd(0))).toBe('2000-01-06T18:14');
    // Annular solar eclipse of 17 February 2026.
    expect(utc(newMoonJd(323))).toMatch(/^2026-02-17T12:0[0-3]$/);
  });

  it('finds sunset within a few minutes', () => {
    expect(utc(sunsetJd(toDayNum(2026, 11, 14), 34.02, -6.84))).toMatch(/^2026-11-14T17:2\d$/);
    expect(utc(sunsetJd(toDayNum(2026, 2, 17), 21.4225, 39.8262))).toMatch(/^2026-02-17T15:[12]\d$/);
  });
});

describe('Hijri engine', () => {
  it('matches months announced in Morocco', () => {
    expect(start(1446, 9, MA)).toBe('2025-03-02'); // Ramadan 1446
    expect(start(1446, 10, MA)).toBe('2025-03-31'); // Eid al-Fitr 1446
    expect(start(1446, 12, MA)).toBe('2025-05-29'); // Dhul Hijjah 1446
    expect(start(1447, 1, MA)).toBe('2025-06-27'); // Muharram 1447
    expect(start(1447, 9, MA)).toBe('2026-02-19'); // Ramadan 1447
    expect(start(1448, 5, MA)).toBe('2026-10-12'); // Jumada al-Ula 1448
  });

  it('matches the calculated Mecca calendar', () => {
    expect(start(1446, 9, MECCA)).toBe('2025-03-01');
    expect(start(1446, 10, MECCA)).toBe('2025-03-30');
    expect(start(1446, 12, MECCA)).toBe('2025-05-28');
    expect(start(1447, 1, MECCA)).toBe('2025-06-26');
    expect(start(1447, 9, MECCA)).toBe('2026-02-18');
    expect(start(1447, 10, MECCA)).toBe('2026-03-20');
  });

  it('converts a Gregorian day to its Hijri date', () => {
    expect(hijriFromDay(toDayNum(2026, 11, 1), MA)).toMatchObject({ year: 1448, month: 5, day: 21 });
    expect(hijriFromDay(toDayNum(2026, 11, 8), MA)).toMatchObject({ year: 1448, month: 5, day: 28 });
    expect(hijriFromDay(toDayNum(2025, 3, 2), MA)).toMatchObject({ year: 1446, month: 9, day: 1 });
    expect(hijriFromDay(toDayNum(2025, 3, 1), MA)).toMatchObject({ year: 1446, month: 8 });
  });

  it('gives every month 29 or 30 days and round-trips', () => {
    for (const cfg of [MA, MECCA]) {
      for (let year = 1400; year <= 1500; year += 1) {
        for (let month = 1; month <= 12; month += 1) {
          // A published correction may sit one day off the estimate next to it.
          const corrected = cfg.region === 'MA' && year === 1448 && (month === 4 || month === 5);
          const length = hijriMonthLength(year, month, cfg);
          if (!corrected) expect([29, 30]).toContain(length);
          const first = hijriMonthStart(year, month, cfg);
          expect(hijriFromDay(first, cfg)).toMatchObject({ year, month, day: 1 });
          expect(hijriFromDay(first + length - 1, cfg)).toMatchObject({ year, month, day: length });
          expect(hijriToDay(year, month, 1, cfg)).toBe(first);
        }
      }
    }
  });

  it('applies the user adjustment', () => {
    const day = toDayNum(2026, 11, 1);
    expect(hijriFromDay(day, { region: 'MA', adjust: 1 }).day).toBe(22);
    expect(hijriFromDay(day, { region: 'MA', adjust: -1 }).day).toBe(20);
  });

  it('clamps the 30th to the end of a 29-day month', () => {
    const short = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((m) => hijriMonthLength(1447, m, MA) === 29)!;
    expect(hijriToDay(1447, short, 30, MA)).toBe(hijriMonthStart(1447, short, MA) + 28);
  });
});
