/**
 * Prayer times and what follows from them: events tied to a prayer, and
 * events that swallow a whole prayer window.
 *
 * The astronomy comes from the `adhan` library. Times are minutes since
 * midnight on the device's own clock, so they follow its time zone and any
 * clock changes.
 */
import { CalculationMethod, Coordinates, Madhab, PrayerTimes, type CalculationParameters } from 'adhan';

import { fromDayNum, MIN_PER_DAY, type DayNum } from './dates';

export const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerName = (typeof PRAYERS)[number];
export type DayPrayers = Record<PrayerName, number>;

export const PRAYER_METHODS = ['morocco', 'mwl', 'ummAlQura', 'egypt', 'karachi', 'northAmerica', 'turkey'] as const;
export type PrayerMethod = (typeof PRAYER_METHODS)[number];

export type Place = { name: string; lat: number; lon: number };

function parameters(method: PrayerMethod, asrHanafi: boolean): CalculationParameters {
  let params: CalculationParameters;
  switch (method) {
    case 'morocco': {
      // Ministry of Habous and Islamic Affairs: Fajr at 19°, Isha at 17°, with its customary safety minutes.
      params = CalculationMethod.Other();
      params.fajrAngle = 19;
      params.ishaAngle = 17;
      params.methodAdjustments = { ...params.methodAdjustments, sunrise: -3, dhuhr: 5, maghrib: 5 };
      break;
    }
    case 'mwl':
      params = CalculationMethod.MuslimWorldLeague();
      break;
    case 'ummAlQura':
      params = CalculationMethod.UmmAlQura();
      break;
    case 'egypt':
      params = CalculationMethod.Egyptian();
      break;
    case 'karachi':
      params = CalculationMethod.Karachi();
      break;
    case 'northAmerica':
      params = CalculationMethod.NorthAmerica();
      break;
    case 'turkey':
      params = CalculationMethod.Turkey();
      break;
  }
  params.madhab = asrHanafi ? Madhab.Hanafi : Madhab.Shafi;
  return params;
}

const cache = new Map<string, DayPrayers>();

/** The day's prayer times at a place. */
export function prayerTimes(day: DayNum, place: Place, method: PrayerMethod, asrHanafi: boolean): DayPrayers {
  const key = `${day}|${place.lat}|${place.lon}|${method}|${asrHanafi}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { y, m, d } = fromDayNum(day);
  const times = new PrayerTimes(new Coordinates(place.lat, place.lon), new Date(y, m - 1, d), parameters(method, asrHanafi));
  const minutes = (date: Date) => {
    // Near the poles a time may not exist on some days.
    if (Number.isNaN(date.getTime())) return -1;
    return date.getHours() * 60 + date.getMinutes();
  };
  const out = Object.fromEntries(PRAYERS.map((name) => [name, minutes(times[name])])) as DayPrayers;
  if (cache.size > 2000) cache.clear();
  cache.set(key, out);
  return out;
}

/** A start time tied to a prayer: "20 minutes after Asr", "an hour before Maghrib". */
export type Anchor = { prayer: PrayerName; offsetMin: number };

export function resolveAnchor(anchor: Anchor, times: DayPrayers): number {
  const base = times[anchor.prayer];
  if (base < 0) return 0;
  return Math.min(MIN_PER_DAY - 1, Math.max(0, base + anchor.offsetMin));
}

/** The four prayers whose time ends at a known moment the same day, with that moment. */
const WINDOWS: [PrayerName, PrayerName][] = [
  ['fajr', 'sunrise'],
  ['dhuhr', 'asr'],
  ['asr', 'maghrib'],
  ['maghrib', 'isha'],
];

/**
 * Prayers whose whole time falls inside [start, end) — an event that leaves
 * no moment to pray them on time.
 */
export function coveredPrayers(times: DayPrayers, start: number, end: number): PrayerName[] {
  return WINDOWS.filter(([prayer, next]) => times[prayer] >= 0 && times[next] >= 0 && start <= times[prayer] && end >= times[next]).map(
    ([prayer]) => prayer,
  );
}

/** The next prayer (not sunrise) after `minutes` today, or null after Isha. */
export function nextPrayer(times: DayPrayers, minutes: number): PrayerName | null {
  return PRAYERS.find((name) => name !== 'sunrise' && times[name] > minutes) ?? null;
}
