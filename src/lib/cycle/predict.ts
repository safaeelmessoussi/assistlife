/**
 * From recorded periods to what the calendar shows: period days, the days a
 * next period is expected, and the estimated fertile days.
 *
 * These are estimates from past cycle lengths. They are not medical advice
 * and are not reliable for avoiding or achieving pregnancy.
 */
import { parseIso, type DayNum } from '../dates';

export type Period = { start: string; days: number };

export type CycleDayKind = 'period' | 'expected' | 'fertile' | 'ovulation';
export type CycleDay = {
  kind?: CycleDayKind;
  /** Day of the cycle, counted from the first day of the last period (1 = first day). */
  cycleDay?: number;
};

const DEFAULT_CYCLE = 28;
const DEFAULT_DAYS = 5;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2);
};

export type CycleStats = { cycleLength: number; periodDays: number; starts: DayNum[] };

/** Typical cycle and period lengths: the middle value of the last six, so one unusual month does not skew them. */
export function cycleStats(periods: Period[]): CycleStats {
  const sorted = periods
    .map((p) => ({ start: parseIso(p.start), days: p.days }))
    .filter((p): p is { start: DayNum; days: number } => p.start !== null)
    .sort((a, b) => a.start - b.start);
  const starts = sorted.map((p) => p.start);
  // Gaps outside 15–60 days are skipped months or mistakes, not cycles.
  const gaps = starts.slice(1).map((start, i) => start - starts[i]).filter((gap) => gap >= 15 && gap <= 60);
  return {
    cycleLength: gaps.length ? median(gaps.slice(-6)) : DEFAULT_CYCLE,
    periodDays: sorted.length ? median(sorted.slice(-6).map((p) => p.days)) : DEFAULT_DAYS,
    starts,
  };
}

/** What each day in [from, to] is, for the recorded periods and up to `ahead` expected cycles. */
export function cycleDays(periods: Period[], from: DayNum, to: DayNum, ahead = 6): Map<DayNum, CycleDay> {
  const out = new Map<DayNum, CycleDay>();
  if (!periods.length) return out;
  const stats = cycleStats(periods);
  const put = (day: DayNum, kind: CycleDayKind) => {
    if (day < from || day > to) return;
    const current = out.get(day) ?? {};
    // A recorded period outranks any estimate for the same day.
    if (current.kind === 'period' || (current.kind === 'expected' && kind !== 'period')) return;
    out.set(day, { ...current, kind });
  };

  for (const period of periods) {
    const start = parseIso(period.start);
    if (start === null) continue;
    for (let i = 0; i < period.days; i += 1) put(start + i, 'period');
  }

  const last = stats.starts[stats.starts.length - 1];
  // Fertile days are estimated backwards from each next start: ovulation about 14 days before it.
  const fertile = (nextStart: DayNum) => {
    const ovulation = nextStart - 14;
    for (let day = ovulation - 5; day <= ovulation + 1; day += 1) put(day, day === ovulation ? 'ovulation' : 'fertile');
  };
  for (let i = 1; i < stats.starts.length; i += 1) {
    if (stats.starts[i] >= from - 60) fertile(stats.starts[i]);
  }
  for (let n = 1; n <= ahead; n += 1) {
    const start = last + n * stats.cycleLength;
    if (start - 20 > to) break;
    fertile(start);
    for (let i = 0; i < stats.periodDays; i += 1) put(start + i, 'expected');
  }

  // Day of the cycle, from the most recent recorded start on or before each day.
  let index = 0;
  for (let day = Math.max(from, stats.starts[0]); day <= to; day += 1) {
    while (index + 1 < stats.starts.length && stats.starts[index + 1] <= day) index += 1;
    const cycleDay = day - stats.starts[index] + 1;
    // Long after the last record the count means nothing.
    if (cycleDay <= 60) out.set(day, { ...out.get(day), cycleDay });
  }
  return out;
}
