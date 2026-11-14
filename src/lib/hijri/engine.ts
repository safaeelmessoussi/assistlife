/**
 * Hijri calendar engine.
 *
 * A Hijri month starts the day after the first evening on which the new
 * crescent is old enough at sunset, judged at a reference place. Three layers
 * decide the date, in this order of authority:
 *
 *   1. published corrections — an official month start for a region;
 *   2. the calculated estimate for that region;
 *   3. the user's own ±day adjustment, applied on top.
 */
import type { DayNum } from '../dates';
import { JD_EPOCH, SYNODIC_MONTH, newMoonJd, sunsetJd } from './astro';
import { CORRECTIONS } from './corrections';

export type HijriRegionId = 'MA' | 'MECCA';

type Region = {
  lat: number;
  lon: number;
  /** Minimum age of the moon at sunset, in hours, for the month to start next day. */
  minAgeHours: number;
};

export const REGIONS: Record<HijriRegionId, Region> = {
  // Morocco follows naked-eye sighting; a crescent younger than about 18 hours
  // is practically never seen. Judged at Rabat.
  MA: { lat: 34.02, lon: -6.84, minAgeHours: 18 },
  // Conjunction before sunset at Mecca — the astronomical rule used by
  // calculated calendars in the Gulf.
  MECCA: { lat: 21.4225, lon: 39.8262, minAgeHours: 0 },
};

export type HijriConfig = {
  region: HijriRegionId;
  /** +1 shows Hijri dates one day ahead of the estimate, −1 one day behind. */
  adjust: number;
};

export type HijriDate = {
  year: number;
  /** 1 = Muharram … 12 = Dhul Hijjah. */
  month: number;
  day: number;
  /** 29 or 30. */
  monthLength: number;
};

/** Lunation number of Muharram 1 AH minus the astronomical lunation number. */
const LUNATION_OFFSET = 17037;
/** Day number of the new moon of 6 January 2000 (lunation 0). */
const LUNATION_ZERO_DAY = 10962;

const lunationOf = (year: number, month: number) => (year - 1) * 12 + (month - 1) - LUNATION_OFFSET;

const cache = new Map<string, DayNum>();

/** First day of the lunar month for astronomical lunation `k`, before user adjustment. */
function baseMonthStart(k: number, regionId: HijriRegionId): DayNum {
  const key = `${regionId}:${k}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const n = k + LUNATION_OFFSET;
  const published = CORRECTIONS[regionId]?.[`${Math.floor(n / 12) + 1}-${(n % 12) + 1}`];
  let start: DayNum;
  if (published !== undefined) {
    start = published;
  } else {
    const region = REGIONS[regionId];
    const conjunction = newMoonJd(k);
    let day = Math.floor(conjunction + region.lon / 360 - JD_EPOCH);
    while ((sunsetJd(day, region.lat, region.lon) - conjunction) * 24 < region.minAgeHours) day += 1;
    start = day + 1;
  }
  cache.set(key, start);
  return start;
}

const monthStartK = (k: number, cfg: HijriConfig) => baseMonthStart(k, cfg.region) - cfg.adjust;

/** First day of a Hijri month. */
export function hijriMonthStart(year: number, month: number, cfg: HijriConfig): DayNum {
  return monthStartK(lunationOf(year, month), cfg);
}

/** Number of days (29 or 30) in a Hijri month. */
export function hijriMonthLength(year: number, month: number, cfg: HijriConfig): number {
  const k = lunationOf(year, month);
  return monthStartK(k + 1, cfg) - monthStartK(k, cfg);
}

/** The Hijri date shown for a Gregorian day (the daytime of that day). */
export function hijriFromDay(day: DayNum, cfg: HijriConfig): HijriDate {
  let k = Math.round((day - LUNATION_ZERO_DAY) / SYNODIC_MONTH);
  while (monthStartK(k, cfg) > day) k -= 1;
  while (monthStartK(k + 1, cfg) <= day) k += 1;
  const start = monthStartK(k, cfg);
  const n = k + LUNATION_OFFSET;
  return {
    year: Math.floor(n / 12) + 1,
    month: (((n % 12) + 12) % 12) + 1,
    day: day - start + 1,
    monthLength: monthStartK(k + 1, cfg) - start,
  };
}

/**
 * Gregorian day for a Hijri date. A day beyond the month's length (the 30th
 * of a 29-day month) lands on the month's last day.
 */
export function hijriToDay(year: number, month: number, day: number, cfg: HijriConfig): DayNum {
  const start = hijriMonthStart(year, month, cfg);
  return start + Math.min(day, hijriMonthLength(year, month, cfg)) - 1;
}

/** Shift a Hijri year/month pair by a number of months. */
export function addHijriMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const n = (year - 1) * 12 + (month - 1) + delta;
  return { year: Math.floor(n / 12) + 1, month: (((n % 12) + 12) % 12) + 1 };
}
