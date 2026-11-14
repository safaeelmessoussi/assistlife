/**
 * Event model and expansion of repeating events into dated occurrences.
 *
 * Event times are wall-clock values on the day they are written for; they do
 * not move when the device changes time zone.
 */
import { daysInMonth, fromDayNum, parseIso, toDayNum, weekday, MIN_PER_DAY, type DayNum } from './dates';
import { addHijriMonths, hijriFromDay, hijriToDay, type HijriConfig } from './hijri/engine';

export type RepeatFreq = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'hijriMonthly' | 'hijriYearly';

export type Repeat = {
  freq: RepeatFreq;
  /** Every `interval` days / weeks / months / years. */
  interval: number;
  /** Weekly only: weekdays (0 = Sunday). Empty means the start day's weekday. */
  weekdays?: number[];
  /** Last day (inclusive, 'YYYY-MM-DD') on which an occurrence may start. */
  until?: string;
};

export type CalEvent = {
  id: string;
  title: string;
  layerId: string;
  /** First day, 'YYYY-MM-DD'. */
  date: string;
  allDay: boolean;
  /** All-day events: number of days covered (1 or more). */
  spanDays: number;
  /** Timed events: minutes since midnight. */
  startMin: number;
  /** Timed events: length in minutes; may run past midnight. */
  durationMin: number;
  repeat?: Repeat;
  location?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

export type Occurrence = {
  event: CalEvent;
  /** Day this occurrence starts. */
  day: DayNum;
  /** Last day this occurrence touches. */
  endDay: DayNum;
};

/** Last day touched by an occurrence of `event` starting on `day`. */
function endDayOf(event: CalEvent, day: DayNum): DayNum {
  if (event.allDay) return day + Math.max(1, event.spanDays) - 1;
  const endMin = event.startMin + Math.max(0, event.durationMin);
  // An event ending exactly at midnight does not touch the next day.
  return day + Math.floor(Math.max(0, endMin - 1) / MIN_PER_DAY);
}

/** Start days of an event's occurrences that begin within [from, to]. */
function startDays(event: CalEvent, from: DayNum, to: DayNum, hijri: HijriConfig): DayNum[] {
  const first = parseIso(event.date);
  if (first === null) return [];
  const repeat = event.repeat;
  if (!repeat) return first >= from && first <= to ? [first] : [];

  const until = parseIso(repeat.until);
  const last = until === null ? to : Math.min(to, until);
  const lo = Math.max(from, first);
  const interval = Math.max(1, Math.floor(repeat.interval) || 1);
  const out: DayNum[] = [];
  if (lo > last) return out;

  switch (repeat.freq) {
    case 'daily': {
      const skip = Math.ceil((lo - first) / interval);
      for (let day = first + skip * interval; day <= last; day += interval) out.push(day);
      break;
    }
    case 'weekly': {
      const days = repeat.weekdays?.length ? repeat.weekdays : [weekday(first)];
      const firstWeek = first - weekday(first);
      for (let day = lo; day <= last; day += 1) {
        const weeks = Math.floor((day - firstWeek) / 7);
        if (weeks % interval === 0 && days.includes(weekday(day))) out.push(day);
      }
      break;
    }
    case 'monthly':
    case 'yearly': {
      const start = fromDayNum(first);
      const step = repeat.freq === 'yearly' ? 12 * interval : interval;
      const loDate = fromDayNum(lo);
      const monthsApart = (loDate.y - start.y) * 12 + (loDate.m - start.m);
      for (let i = Math.max(0, Math.floor(monthsApart / step) - 1); ; i += 1) {
        const index = start.y * 12 + (start.m - 1) + i * step;
        const y = Math.floor(index / 12);
        const m = (index % 12) + 1;
        if (toDayNum(y, m, 1) > last) break;
        // A month without that day (the 31st, 29 February) is skipped.
        if (start.d > daysInMonth(y, m)) continue;
        const day = toDayNum(y, m, start.d);
        if (day >= lo && day <= last) out.push(day);
      }
      break;
    }
    case 'hijriMonthly':
    case 'hijriYearly': {
      const start = hijriFromDay(first, hijri);
      const step = repeat.freq === 'hijriYearly' ? 12 * interval : interval;
      const loDate = hijriFromDay(lo, hijri);
      const monthsApart = (loDate.year - start.year) * 12 + (loDate.month - start.month);
      for (let i = Math.max(0, Math.floor(monthsApart / step) - 1); ; i += 1) {
        const target = addHijriMonths(start.year, start.month, i * step);
        if (hijriToDay(target.year, target.month, 1, hijri) > last) break;
        // The 30th of a 29-day month falls on that month's last day.
        const day = hijriToDay(target.year, target.month, start.day, hijri);
        if (day >= lo && day <= last) out.push(day);
      }
      break;
    }
  }
  return out;
}

/** Every occurrence that touches at least one day in [from, to], in start order. */
export function expandEvents(events: CalEvent[], from: DayNum, to: DayNum, hijri: HijriConfig): Occurrence[] {
  const out: Occurrence[] = [];
  for (const event of events) {
    // Look back far enough to catch occurrences that began before `from` and still run.
    const reach = endDayOf(event, 0);
    for (const day of startDays(event, from - reach, to, hijri)) {
      const endDay = endDayOf(event, day);
      if (endDay >= from) out.push({ event, day, endDay });
    }
  }
  return out.sort(compareOccurrences);
}

/** All-day first, then by start time, then by title. */
export function compareOccurrences(a: Occurrence, b: Occurrence): number {
  if (a.day !== b.day) return a.day - b.day;
  if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1;
  if (a.event.startMin !== b.event.startMin) return a.event.startMin - b.event.startMin;
  return a.event.title.localeCompare(b.event.title);
}

/** Occurrences touching each day in [from, to], keyed by day number. */
export function groupByDay(occurrences: Occurrence[], from: DayNum, to: DayNum): Map<DayNum, Occurrence[]> {
  const map = new Map<DayNum, Occurrence[]>();
  for (const occ of occurrences) {
    for (let day = Math.max(from, occ.day); day <= Math.min(to, occ.endDay); day += 1) {
      const list = map.get(day);
      if (list) list.push(occ);
      else map.set(day, [occ]);
    }
  }
  return map;
}

/** The minutes of `day` (0–1440) that a timed occurrence covers. */
export function minutesOnDay(occ: Occurrence, day: DayNum): { start: number; end: number } {
  const offset = (day - occ.day) * MIN_PER_DAY;
  const start = occ.event.startMin - offset;
  const end = start + Math.max(0, occ.event.durationMin);
  return { start: Math.max(0, start), end: Math.min(MIN_PER_DAY, end) };
}

export type Placed<T> = { item: T; column: number; columns: number };

/** Side-by-side columns for items that overlap in time. */
export function layoutColumns<T>(items: T[], range: (item: T) => { start: number; end: number }): Placed<T>[] {
  const sorted = [...items].sort((a, b) => range(a).start - range(b).start || range(b).end - range(a).end);
  const placed: Placed<T>[] = [];
  let cluster: Placed<T>[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const p of cluster) p.columns = columnEnds.length;
    placed.push(...cluster);
    cluster = [];
    columnEnds = [];
  };

  for (const item of sorted) {
    const { start, end } = range(item);
    if (cluster.length && start >= clusterEnd) flush();
    let column = columnEnds.findIndex((e) => e <= start);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = Math.max(end, start + 1);
    clusterEnd = Math.max(clusterEnd, columnEnds[column]);
    cluster.push({ item, column, columns: 1 });
  }
  flush();
  return placed;
}
