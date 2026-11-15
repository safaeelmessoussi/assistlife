import { describe, expect, it } from 'vitest';
import { parseIso, toDayNum, toIso } from '../dates';
import { expandEvents, groupByDay, layoutColumns, minutesOnDay, type CalEvent, type Repeat } from '../events';
import { hijriFromDay, type HijriConfig } from '../hijri/engine';

const MA: HijriConfig = { region: 'MA', adjust: 0 };
const day = (iso: string) => parseIso(iso)!;

function ev(date: string, repeat?: Repeat, extra: Partial<CalEvent> = {}): CalEvent {
  return {
    id: 'e',
    title: 't',
    layerId: 'l',
    date,
    allDay: false,
    spanDays: 1,
    startMin: 600,
    durationMin: 60,
    repeat,
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}
const starts = (event: CalEvent, from: string, to: string) =>
  expandEvents([event], day(from), day(to), MA).map((o) => toIso(o.day));

describe('expandEvents', () => {
  it('places a single event', () => {
    expect(starts(ev('2026-11-14'), '2026-11-01', '2026-11-30')).toEqual(['2026-11-14']);
    expect(starts(ev('2026-11-14'), '2026-12-01', '2026-12-31')).toEqual([]);
  });

  it('repeats daily with an interval and an end', () => {
    expect(starts(ev('2026-11-01', { freq: 'daily', interval: 3, until: '2026-11-10' }), '2026-11-01', '2026-11-30')).toEqual([
      '2026-11-01',
      '2026-11-04',
      '2026-11-07',
      '2026-11-10',
    ]);
    expect(starts(ev('2026-11-01', { freq: 'daily', interval: 3 }), '2026-11-05', '2026-11-08')).toEqual(['2026-11-07']);
  });

  it('repeats weekly on chosen weekdays', () => {
    // Tuesdays and Fridays, as in a weekly sport plan.
    expect(starts(ev('2026-11-03', { freq: 'weekly', interval: 1, weekdays: [2, 5] }), '2026-11-01', '2026-11-15')).toEqual([
      '2026-11-03',
      '2026-11-06',
      '2026-11-10',
      '2026-11-13',
    ]);
    expect(starts(ev('2026-11-02', { freq: 'weekly', interval: 2 }), '2026-11-01', '2026-11-30')).toEqual([
      '2026-11-02',
      '2026-11-16',
      '2026-11-30',
    ]);
  });

  it('repeats monthly and skips months without the day', () => {
    expect(starts(ev('2026-01-31', { freq: 'monthly', interval: 1 }), '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-03-31',
      '2026-05-31',
    ]);
  });

  it('repeats yearly', () => {
    expect(starts(ev('2024-02-29', { freq: 'yearly', interval: 1 }), '2024-01-01', '2029-12-31')).toEqual(['2024-02-29', '2028-02-29']);
    expect(starts(ev('2020-11-14', { freq: 'yearly', interval: 1 }), '2026-11-01', '2026-11-30')).toEqual(['2026-11-14']);
  });

  it('repeats on Hijri dates', () => {
    const yearly = expandEvents([ev('2025-03-02', { freq: 'hijriYearly', interval: 1 })], day('2025-01-01'), day('2027-12-31'), MA);
    expect(yearly.map((o) => toIso(o.day))).toEqual(['2025-03-02', '2026-02-19', expect.stringMatching(/^2027-02-0[89]$/)]);
    for (const o of yearly) expect(hijriFromDay(o.day, MA)).toMatchObject({ month: 9, day: 1 });

    // The 13th of every Hijri month (first white day).
    const first = toDayNum(2025, 3, 14);
    expect(hijriFromDay(first, MA).day).toBe(13);
    const monthly = expandEvents([ev(toIso(first), { freq: 'hijriMonthly', interval: 1 })], first, first + 340, MA);
    expect(monthly.length).toBe(12);
    for (const o of monthly) expect(hijriFromDay(o.day, MA).day).toBe(13);
  });

  it('keeps multi-day and past-midnight events on every day they touch', () => {
    const trip = ev('2026-11-10', undefined, { allDay: true, spanDays: 4 });
    const late = ev('2026-11-20', undefined, { startMin: 23 * 60, durationMin: 120 });
    const occ = expandEvents([trip, late], day('2026-11-12'), day('2026-11-21'), MA);
    const byDay = groupByDay(occ, day('2026-11-12'), day('2026-11-21'));
    expect(byDay.get(day('2026-11-12'))).toHaveLength(1);
    expect(byDay.get(day('2026-11-13'))).toHaveLength(1);
    expect(byDay.get(day('2026-11-14'))).toBeUndefined();
    const lateOcc = byDay.get(day('2026-11-21'))![0];
    expect(minutesOnDay(lateOcc, day('2026-11-20'))).toEqual({ start: 1380, end: 1440 });
    expect(minutesOnDay(lateOcc, day('2026-11-21'))).toEqual({ start: 0, end: 60 });
  });

  it('does not spill an event ending at midnight into the next day', () => {
    const occ = expandEvents([ev('2026-11-20', undefined, { startMin: 22 * 60, durationMin: 120 })], day('2026-11-21'), day('2026-11-21'), MA);
    expect(occ).toEqual([]);
  });
});

describe('prayer-tied events', () => {
  it('take their start from the day they fall on', () => {
    const lesson = ev('2026-11-16', { freq: 'daily', interval: 1 }, { anchor: { prayer: 'asr', offsetMin: 15 }, startMin: 0, durationMin: 30 });
    // A stand-in for prayer times: Asr one minute later each day.
    const startOn = (_: CalEvent, d: number) => 16 * 60 + (d - day('2026-11-16')) + 15;
    const occ = expandEvents([lesson], day('2026-11-16'), day('2026-11-18'), MA, startOn);
    expect(occ.map((o) => o.event.startMin)).toEqual([975, 976, 977]);
    expect(occ[0].event.id).toBe('e');
    // Without prayer times the fallback time is kept.
    expect(expandEvents([lesson], day('2026-11-16'), day('2026-11-16'), MA)[0].event.startMin).toBe(0);
  });
});

describe('layoutColumns', () => {
  it('puts overlapping items side by side', () => {
    const items = [
      { id: 'a', start: 60, end: 180 },
      { id: 'b', start: 120, end: 240 },
      { id: 'c', start: 200, end: 260 },
      { id: 'd', start: 300, end: 360 },
    ];
    const placed = Object.fromEntries(layoutColumns(items, (i) => i).map((p) => [p.item.id, [p.column, p.columns]]));
    expect(placed).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2], d: [0, 1] });
  });
});
