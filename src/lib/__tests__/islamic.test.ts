import { describe, expect, it } from 'vitest';
import { parseIso, toIso } from '../dates';
import { hijriFromDay, hijriToDay, type HijriConfig } from '../hijri/engine';
import { fastingKey, islamicEvents, occasionKey, systemKey } from '../islamic';
import { coveredPrayers, nextPrayer, prayerTimes, resolveAnchor, type DayPrayers } from '../prayer';

const MA: HijriConfig = { region: 'MA', adjust: 0 };
const hijri = (day: number) => hijriFromDay(day, MA);
const at = (y: number, m: number, d: number) => hijriToDay(y, m, d, MA);
const fast = (day: number, opts = { monThu: true, whiteDays: true }) => fastingKey(day, hijri(day), opts);
const hm = (h: number, m = 0) => h * 60 + m;

describe('fasting days', () => {
  it('marks Ramadan, and nothing on the Eid that follows', () => {
    expect(fast(at(1447, 9, 1))).toBe('ramadan');
    expect(fast(at(1447, 9, 29))).toBe('ramadan');
    expect(fast(at(1447, 10, 1))).toBeNull();
    expect(fast(at(1447, 10, 2))).toBe('shawwal');
  });

  it('marks Arafah and the days before it, never the Eid or the three days after', () => {
    expect(fast(at(1447, 12, 1))).toBe('dhulHijjah');
    expect(fast(at(1447, 12, 9))).toBe('arafah');
    for (const d of [10, 11, 12, 13]) expect(fast(at(1447, 12, d))).toBeNull();
    // The 13th is a white day in other months but not in Dhul Hijjah.
    expect(fast(at(1447, 12, 14))).toBe('whiteDays');
  });

  it('marks Ashura with the day before', () => {
    expect(fast(at(1448, 1, 9))).toBe('tasua');
    expect(fast(at(1448, 1, 10))).toBe('ashura');
  });

  it('marks white days and Mondays and Thursdays, each only when wanted', () => {
    const white = at(1448, 6, 13);
    expect(fast(white)).toBe('whiteDays');
    const monday = parseIso('2026-11-16')!; // 6 Jumada II
    const tuesday = monday + 1;
    expect(fast(monday)).toBe('monThu');
    expect(fast(monday + 3)).toBe('monThu');
    expect(fast(tuesday)).toBeNull();
    expect(fast(monday, { monThu: false, whiteDays: true })).toBeNull();
    expect(fastingKey(white, hijri(white), { monThu: false, whiteDays: false })).toBeNull();
  });
});

describe('occasions', () => {
  it('names the fixed days of the year', () => {
    expect(occasionKey(hijri(at(1448, 1, 1)))).toBe('newYear');
    expect(occasionKey(hijri(at(1447, 9, 1)))).toBe('ramadanStart');
    expect(occasionKey(hijri(at(1447, 9, 21)))).toBe('lastTen');
    expect(occasionKey(hijri(at(1447, 10, 1)))).toBe('eidFitr');
    expect(occasionKey(hijri(at(1447, 12, 10)))).toBe('eidAdha');
    expect(occasionKey(hijri(at(1447, 12, 12)))).toBe('tashriq');
    expect(occasionKey(hijri(at(1448, 6, 5)))).toBeNull();
  });
});

describe('islamicEvents', () => {
  const all = { fasting: true, occasions: true, athkar: true, monThu: true, whiteDays: true };
  it('builds the week\'s items, with the Friday ones on Friday only', () => {
    const from = parseIso('2026-11-16')!; // Monday
    const events = islamicEvents(from, from + 6, hijri, all, (k) => k);
    const on = (iso: string) => events.filter((e) => e.date === iso).map((e) => systemKey(e.id));
    expect(on('2026-11-16')).toEqual(['monThu', 'morning', 'evening', 'sleep']);
    expect(on('2026-11-20')).toEqual(['morning', 'evening', 'sleep', 'kahf', 'fridayHour']);
    expect(events.find((e) => systemKey(e.id) === 'fridayHour')!.anchor).toEqual({ prayer: 'maghrib', offsetMin: -60 });
    expect(islamicEvents(from, from + 6, hijri, { ...all, athkar: false, fasting: false }, (k) => k)).toEqual([]);
  });

  it('covers a whole Hijri year without a fast on a forbidden day', () => {
    const from = at(1447, 1, 1);
    const events = islamicEvents(from, at(1448, 1, 1) - 1, hijri, { ...all, athkar: false }, (k) => k);
    const fasting = events.filter((e) => e.layerId === 'sys:fasting');
    expect(fasting.filter((e) => systemKey(e.id) === 'ramadan').length).toBeGreaterThanOrEqual(29);
    expect(fasting.filter((e) => systemKey(e.id) === 'arafah').map((e) => e.date)).toEqual([toIso(at(1447, 12, 9))]);
    const eids = new Set([at(1447, 10, 1), at(1447, 12, 10), at(1447, 12, 11), at(1447, 12, 12), at(1447, 12, 13)].map(toIso));
    expect(fasting.some((e) => eids.has(e.date))).toBe(false);
  });
});

describe('prayer times', () => {
  const rabat = { name: 'Rabat', lat: 34.0209, lon: -6.8416 };
  it('gives the six times in order, close to the published ones for Rabat', () => {
    // Device clock for this test: UTC. Rabat's published times on 15 November are one hour later on a UTC+1 clock.
    const t = prayerTimes(parseIso('2026-11-15')!, rabat, 'morocco', false);
    const order = [t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.isha];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const offset = new Date(2026, 10, 15, 12).getTimezoneOffset(); // minutes behind UTC
    const utc = (minutes: number) => minutes + offset;
    expect(Math.abs(utc(t.fajr) - hm(5, 28))).toBeLessThanOrEqual(2);
    expect(Math.abs(utc(t.dhuhr) - hm(12, 17))).toBeLessThanOrEqual(2);
    expect(Math.abs(utc(t.maghrib) - hm(17, 29))).toBeLessThanOrEqual(2);
  });

  it('puts Asr later for the Hanafi school and differs between methods', () => {
    const day = parseIso('2026-06-01')!;
    expect(prayerTimes(day, rabat, 'morocco', true).asr).toBeGreaterThan(prayerTimes(day, rabat, 'morocco', false).asr + 30);
    expect(prayerTimes(day, rabat, 'mwl', false).fajr).toBeGreaterThan(prayerTimes(day, rabat, 'morocco', false).fajr);
  });
});

describe('prayer-tied times and conflicts', () => {
  const t: DayPrayers = { fajr: hm(6, 28), sunrise: hm(7, 57), dhuhr: hm(13, 17), asr: hm(16, 3), maghrib: hm(18, 29), isha: hm(19, 45) };

  it('resolves a start relative to a prayer', () => {
    expect(resolveAnchor({ prayer: 'asr', offsetMin: 20 }, t)).toBe(hm(16, 23));
    expect(resolveAnchor({ prayer: 'maghrib', offsetMin: -60 }, t)).toBe(hm(17, 29));
    expect(resolveAnchor({ prayer: 'isha', offsetMin: 600 }, t)).toBe(1439);
  });

  it('flags only an event that leaves no time for a prayer', () => {
    expect(coveredPrayers(t, hm(13), hm(16, 30))).toEqual(['dhuhr']);
    expect(coveredPrayers(t, hm(13), hm(19, 50))).toEqual(['dhuhr', 'asr', 'maghrib']);
    expect(coveredPrayers(t, hm(13, 30), hm(16, 30))).toEqual([]); // starts after Dhuhr begins: there was time before
    expect(coveredPrayers(t, hm(13), hm(15, 50))).toEqual([]); // ends before Asr: there is time after
  });

  it('finds the next prayer, skipping sunrise', () => {
    expect(nextPrayer(t, hm(7))).toBe('dhuhr');
    expect(nextPrayer(t, hm(16, 3))).toBe('maghrib');
    expect(nextPrayer(t, hm(23))).toBeNull();
  });
});
