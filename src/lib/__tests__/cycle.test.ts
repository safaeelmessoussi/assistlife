import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseIso } from '../dates';
import { parsePeriodBackup } from '../cycle/pcBackup';
import { cycleDays, cycleStats } from '../cycle/predict';

const fixture = () => new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'period-backup.pc')));
const day = (iso: string) => parseIso(iso)!;

describe('parsePeriodBackup', () => {
  it('reads every period from a backup, oldest first', () => {
    // The fixture is synthetic: 400 made-up periods, enough to span several database pages.
    const periods = parsePeriodBackup(fixture());
    expect(periods).toHaveLength(400);
    expect(periods[0]).toEqual({ start: '2015-01-03', days: 6 });
    expect(periods[1]).toEqual({ start: '2015-01-29', days: 5 });
    expect(periods[399].start).toBe('2045-08-04');
    expect(periods.map((p) => p.start)).toEqual([...periods.map((p) => p.start)].sort());
    expect(new Set(periods.map((p) => p.days))).toEqual(new Set([5, 6, 7]));
  });

  it('refuses files that are not such a backup', () => {
    expect(() => parsePeriodBackup(new Uint8Array([1, 2, 3, 4]))).toThrow('Not a period tracker backup');
    expect(() => parsePeriodBackup(new Uint8Array([0xac, 0xed, 0, 5, 0x77, 2, 9, 9]))).toThrow('Not a period tracker backup');
    const cut = fixture().slice(0, 900);
    expect(() => parsePeriodBackup(cut)).toThrow();
  });
});

describe('cycle estimates', () => {
  const periods = [
    { start: '2026-08-01', days: 5 },
    { start: '2026-08-27', days: 6 },
    { start: '2026-09-22', days: 6 },
    { start: '2026-10-17', days: 6 },
    { start: '2026-11-12', days: 6 },
  ];

  it('takes the typical lengths from recent cycles', () => {
    expect(cycleStats(periods)).toMatchObject({ cycleLength: 26, periodDays: 6 });
    expect(cycleStats([])).toMatchObject({ cycleLength: 28, periodDays: 5 });
    // A skipped month is not a 90-day cycle.
    expect(cycleStats([...periods, { start: '2027-02-10', days: 5 }]).cycleLength).toBe(26);
  });

  it('marks recorded days, the expected next period and the fertile days', () => {
    const map = cycleDays(periods, day('2026-11-01'), day('2026-12-31'));
    expect(map.get(day('2026-11-12'))).toEqual({ kind: 'period', cycleDay: 1 });
    expect(map.get(day('2026-11-17'))).toEqual({ kind: 'period', cycleDay: 6 });
    expect(map.get(day('2026-11-18'))).toEqual({ cycleDay: 7 });
    // Next start 26 days later: 8 December; ovulation about 14 days before it.
    expect(map.get(day('2026-12-08'))!.kind).toBe('expected');
    expect(map.get(day('2026-12-13'))!.kind).toBe('expected');
    expect(map.get(day('2026-12-14'))!.kind).toBeUndefined();
    expect(map.get(day('2026-11-24'))!.kind).toBe('ovulation');
    expect(map.get(day('2026-11-19'))!.kind).toBe('fertile');
    expect(map.get(day('2026-11-25'))!.kind).toBe('fertile');
    expect(map.get(day('2026-11-26'))!.kind).toBeUndefined();
    expect(map.get(day('2026-11-05'))).toEqual({ cycleDay: 20 });
  });

  it('shows nothing without records', () => {
    expect(cycleDays([], day('2026-11-01'), day('2026-11-30')).size).toBe(0);
  });
});
