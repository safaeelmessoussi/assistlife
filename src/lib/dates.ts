/**
 * Calendar-date arithmetic on plain day numbers.
 *
 * A DayNum is the count of days since 1970-01-01 in the proleptic Gregorian
 * calendar. It carries no time zone, so a date never shifts when the device
 * clock or zone changes.
 */
export type DayNum = number;

export type Ymd = { y: number; m: number; d: number };

export const MIN_PER_DAY = 1440;

/** Gregorian date → day number (m is 1–12). */
export function toDayNum(y: number, m: number, d: number): DayNum {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Day number → Gregorian date. */
export function fromDayNum(n: DayNum): Ymd {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m, d };
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(n: DayNum): number {
  return (((n + 4) % 7) + 7) % 7;
}

const pad = (v: number) => (v < 10 ? `0${v}` : `${v}`);

/** Day number → 'YYYY-MM-DD'. */
export function toIso(n: DayNum): string {
  const { y, m, d } = fromDayNum(n);
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** 'YYYY-MM-DD' → day number, or null when the text is not a real date. */
export function parseIso(s: string | undefined | null): DayNum | null {
  if (!s) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return toDayNum(y, m, d);
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** Today on the device's own clock. */
export function today(): DayNum {
  const now = new Date();
  return toDayNum(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Minutes since local midnight on the device's own clock. */
export function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** First day of the week containing `n`, for a week starting on `weekStart` (0 = Sunday). */
export function startOfWeek(n: DayNum, weekStart: number): DayNum {
  return n - ((weekday(n) - weekStart + 7) % 7);
}

/** Shift a year/month pair by a number of months. */
export function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const index = y * 12 + (m - 1) + delta;
  return { y: Math.floor(index / 12), m: (((index % 12) + 12) % 12) + 1 };
}

/** The 5 or 6 week rows (as day numbers) that display a Gregorian month. */
export function monthGrid(y: number, m: number, weekStart: number): DayNum[][] {
  const first = toDayNum(y, m, 1);
  const last = toDayNum(y, m, daysInMonth(y, m));
  const weeks: DayNum[][] = [];
  for (let start = startOfWeek(first, weekStart); start <= last; start += 7) {
    weeks.push(Array.from({ length: 7 }, (_, i) => start + i));
  }
  return weeks;
}

/** 'HH:MM' for minutes since midnight. */
export function formatTime(min: number): string {
  const wrapped = ((min % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  return `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`;
}
