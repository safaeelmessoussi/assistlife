/**
 * The Islamic layer of the calendar: which days are fasting days or
 * occasions, and the daily remembrance items. Everything here is computed
 * from the Hijri date and the prayer times; nothing is stored.
 */
import { toIso, weekday, type DayNum } from './dates';
import type { CalEvent } from './events';
import type { HijriDate } from './hijri/engine';
import type { Anchor } from './prayer';

export type FastingKey = 'ramadan' | 'arafah' | 'ashura' | 'tasua' | 'dhulHijjah' | 'shawwal' | 'whiteDays' | 'monThu';
export type OccasionKey = 'newYear' | 'ramadanStart' | 'lastTen' | 'eidFitr' | 'eidAdha' | 'tashriq';
export type AthkarKey = 'morning' | 'evening' | 'sleep' | 'kahf' | 'fridayHour';
export type ContentKey = FastingKey | OccasionKey | AthkarKey;

export const SYSTEM_LAYERS = ['sys:fasting', 'sys:occasions', 'sys:athkar'] as const;
export type SystemLayerId = (typeof SYSTEM_LAYERS)[number];

export const isSystemId = (id: string | undefined) => id?.startsWith('sys:') === true;

/** The content key inside a system event id ('sys:fasting:arafah:20600' → 'arafah'). */
export const systemKey = (id: string) => id.split(':')[2] as ContentKey;

export type FastingOptions = { monThu: boolean; whiteDays: boolean };

/** Days on which fasting is not allowed: the two Eids and the three days after Eid al-Adha. */
function fastingForbidden(h: HijriDate): boolean {
  return (h.month === 10 && h.day === 1) || (h.month === 12 && h.day >= 10 && h.day <= 13);
}

/** The reason to fast on a day, if any. One reason per day: the weightiest. */
export function fastingKey(day: DayNum, h: HijriDate, options: FastingOptions): FastingKey | null {
  if (fastingForbidden(h)) return null;
  if (h.month === 9) return 'ramadan';
  if (h.month === 12 && h.day === 9) return 'arafah';
  if (h.month === 1 && h.day === 10) return 'ashura';
  if (h.month === 1 && h.day === 9) return 'tasua';
  if (h.month === 12 && h.day <= 8) return 'dhulHijjah';
  if (h.month === 10 && h.day >= 2 && h.day <= 7) return 'shawwal';
  if (options.whiteDays && h.day >= 13 && h.day <= 15) return 'whiteDays';
  const wd = weekday(day);
  if (options.monThu && (wd === 1 || wd === 4)) return 'monThu';
  return null;
}

export function occasionKey(h: HijriDate): OccasionKey | null {
  if (h.month === 1 && h.day === 1) return 'newYear';
  if (h.month === 9 && h.day === 1) return 'ramadanStart';
  if (h.month === 9 && h.day === 21) return 'lastTen';
  if (h.month === 10 && h.day === 1) return 'eidFitr';
  if (h.month === 12 && h.day === 10) return 'eidAdha';
  if (h.month === 12 && h.day >= 11 && h.day <= 13) return 'tashriq';
  return null;
}

/** A computed calendar item; a timed one is tied to a prayer through `anchor`. */
export type SystemEvent = CalEvent;

function item(layer: SystemLayerId, key: ContentKey, day: DayNum, title: string, timed?: { anchor: Anchor; durationMin: number }): SystemEvent {
  return {
    id: `${layer}:${key}:${day}`,
    title,
    layerId: layer,
    date: toIso(day),
    allDay: !timed,
    spanDays: 1,
    startMin: 0,
    durationMin: timed?.durationMin ?? 0,
    anchor: timed?.anchor,
    createdAt: 0,
    updatedAt: 0,
  };
}

export type IslamicOptions = {
  fasting: boolean;
  occasions: boolean;
  athkar: boolean;
} & FastingOptions;

/** Every computed item for the days in [from, to]. `title` gives each key its name in the app's language. */
export function islamicEvents(
  from: DayNum,
  to: DayNum,
  hijri: (day: DayNum) => HijriDate,
  options: IslamicOptions,
  title: (key: ContentKey) => string,
): SystemEvent[] {
  const out: SystemEvent[] = [];
  for (let day = from; day <= to; day += 1) {
    const h = hijri(day);
    if (options.occasions) {
      const key = occasionKey(h);
      if (key) out.push(item('sys:occasions', key, day, title(key)));
    }
    if (options.fasting) {
      const key = fastingKey(day, h, options);
      if (key) out.push(item('sys:fasting', key, day, title(key)));
    }
    if (options.athkar) {
      out.push(item('sys:athkar', 'morning', day, title('morning'), { anchor: { prayer: 'fajr', offsetMin: 15 }, durationMin: 15 }));
      out.push(item('sys:athkar', 'evening', day, title('evening'), { anchor: { prayer: 'asr', offsetMin: 20 }, durationMin: 15 }));
      out.push(item('sys:athkar', 'sleep', day, title('sleep'), { anchor: { prayer: 'isha', offsetMin: 90 }, durationMin: 10 }));
      if (weekday(day) === 5) {
        out.push(item('sys:athkar', 'kahf', day, title('kahf')));
        out.push(item('sys:athkar', 'fridayHour', day, title('fridayHour'), { anchor: { prayer: 'maghrib', offsetMin: -60 }, durationMin: 60 }));
      }
    }
  }
  return out;
}
