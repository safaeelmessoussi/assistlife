/**
 * Officially announced Hijri month starts, by region.
 *
 * Key: 'year-month' (month 1–12). Value: day number of the first day of the
 * month. An entry here overrides the calculated estimate. Entries are added
 * as authorities announce each month; later these will be delivered from the
 * server instead of being bundled.
 */
import { toDayNum, type DayNum } from '../dates';
import type { HijriRegionId } from './engine';

export const CORRECTIONS: Partial<Record<HijriRegionId, Record<string, DayNum>>> = {
  MA: {
    // 1 Jumada al-Ula 1448 = 12 October 2026 (Morocco).
    '1448-5': toDayNum(2026, 10, 12),
  },
};
