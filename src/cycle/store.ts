/** The cycle layer's data on this device: recorded periods and whether the layer is on. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Period } from '@/lib/cycle/predict';

type CycleState = {
  /** The layer is optional and stays off until switched on or data is imported. */
  enabled: boolean;
  periods: Period[];
  /** When anything here last changed; decides which device's copy is newest. */
  updatedAt: number;
};

export const useCycle = create<CycleState>()(
  persist((): CycleState => ({ enabled: false, periods: [], updatedAt: 0 }), {
    name: 'assistlife/cycle/v1',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

const sorted = (periods: Period[]) => [...periods].sort((a, b) => (a.start < b.start ? -1 : 1));

export function setCycleEnabled(enabled: boolean): void {
  useCycle.setState({ enabled, updatedAt: Date.now() });
}

/** Add periods, replacing any already recorded with the same first day. Returns how many are new. */
export function addPeriods(incoming: Period[]): number {
  const byStart = new Map(useCycle.getState().periods.map((p) => [p.start, p]));
  const before = byStart.size;
  for (const period of incoming) byStart.set(period.start, period);
  useCycle.setState({ enabled: true, periods: sorted([...byStart.values()]), updatedAt: Date.now() });
  return byStart.size - before;
}

export function removePeriod(start: string): void {
  useCycle.setState((s) => ({ periods: s.periods.filter((p) => p.start !== start), updatedAt: Date.now() }));
}

/** The part that travels in the encrypted backup. */
export function cycleBlock(): { updatedAt: number; data: Pick<CycleState, 'enabled' | 'periods'> } {
  const { enabled, periods, updatedAt } = useCycle.getState();
  return { updatedAt, data: { enabled, periods } };
}

export function applyCycleBlock(block: { updatedAt: number; data: unknown }): void {
  const data = block.data as Partial<CycleState> | null;
  if (!data || block.updatedAt <= useCycle.getState().updatedAt) return;
  useCycle.setState({ enabled: data.enabled === true, periods: sorted(data.periods ?? []), updatedAt: block.updatedAt });
}
