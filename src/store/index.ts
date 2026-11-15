/**
 * App state: settings, layers and events, saved on the device.
 *
 * Storage goes through AsyncStorage (browser storage on the web). Everything
 * the screens need is read through this store, so the storage underneath can
 * be replaced by a synced database without touching the screens.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { STRINGS, type Lang, type StringKey } from '@/i18n/strings';
import type { CalEvent } from '@/lib/events';
import { DEFAULT_PLACE } from '@/data/cities';
import type { HijriRegionId } from '@/lib/hijri/engine';
import type { Place, PrayerMethod } from '@/lib/prayer';
import type { Snapshot, Tombstones } from '@/lib/sync/merge';
import { LAYER_COLORS } from '@/theme';

export type Layer = {
  id: string;
  /** Custom name; when absent the built-in name for `nameKey` is shown in the current language. */
  name?: string;
  nameKey?: StringKey;
  color: string;
  visible: boolean;
  updatedAt: number;
};

export type Settings = {
  language: Lang;
  /** 0 = Sunday, 1 = Monday, 6 = Saturday. */
  weekStart: number;
  hijriRegion: HijriRegionId;
  hijriAdjust: number;
  theme: 'system' | 'light' | 'dark';
  /** Where prayer times are computed for. */
  place: Place;
  prayerMethod: PrayerMethod;
  /** Asr by the Hanafi school (later) instead of the majority's. */
  asrHanafi: boolean;
  showPrayers: boolean;
  showFasting: boolean;
  fastMonThu: boolean;
  fastWhiteDays: boolean;
  showOccasions: boolean;
  showAthkar: boolean;
  /** Announce prayers and remembrance times while the app is open. */
  notify: boolean;
};

export type EventDraft = Omit<CalEvent, 'id' | 'createdAt' | 'updatedAt'>;

export type AppSnapshot = Snapshot<Settings, Layer, CalEvent>;

type State = {
  hydrated: boolean;
  settings: Settings;
  settingsUpdatedAt: number;
  layers: Layer[];
  events: CalEvent[];
  /** Deleted records, remembered so a sync cannot bring them back. */
  tombstones: { layers: Tombstones; events: Tombstones };
  /** Replace the device's data with the result of a sync. */
  applySnapshot: (snapshot: AppSnapshot) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  addLayer: (name: string, color: string) => void;
  updateLayer: (id: string, patch: Partial<Omit<Layer, 'id'>>) => void;
  removeLayer: (id: string) => void;
  addEvent: (draft: EventDraft) => string;
  updateEvent: (id: string, draft: EventDraft) => void;
  removeEvent: (id: string) => void;
};

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const DEFAULT_LAYERS: Layer[] = (
  ['layerPersonal', 'layerWorship', 'layerHealth', 'layerFamily', 'layerWork', 'layerStudy'] as const
).map((nameKey, i) => ({ id: nameKey, nameKey, color: LAYER_COLORS[i], visible: true, updatedAt: 0 }));

export const DEFAULT_SETTINGS: Settings = {
  language: 'ar',
  weekStart: 1,
  hijriRegion: 'MA',
  hijriAdjust: 0,
  theme: 'system',
  place: DEFAULT_PLACE,
  prayerMethod: 'morocco',
  asrHanafi: false,
  showPrayers: true,
  showFasting: true,
  fastMonThu: true,
  fastWhiteDays: true,
  showOccasions: true,
  showAthkar: true,
  notify: false,
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      hydrated: false,
      settings: DEFAULT_SETTINGS,
      settingsUpdatedAt: 0,
      layers: DEFAULT_LAYERS,
      events: [],
      tombstones: { layers: {}, events: {} },

      applySnapshot: ({ settings, settingsUpdatedAt, layers, events, tombstones }) =>
        set({ settings: { ...DEFAULT_SETTINGS, ...settings }, settingsUpdatedAt, layers, events, tombstones }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch }, settingsUpdatedAt: Date.now() })),

      addLayer: (name, color) =>
        set((s) => ({ layers: [...s.layers, { id: newId(), name, color, visible: true, updatedAt: Date.now() }] })),

      updateLayer: (id, patch) =>
        set((s) => ({ layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch, updatedAt: Date.now() } : l)) })),

      removeLayer: (id) =>
        set((s) => {
          const layers = s.layers.filter((l) => l.id !== id);
          // The last layer cannot be removed: every event needs one.
          if (layers.length === 0 || layers.length === s.layers.length) return s;
          const now = Date.now();
          return {
            layers,
            events: s.events.map((e) => (e.layerId === id ? { ...e, layerId: layers[0].id, updatedAt: now } : e)),
            tombstones: { ...s.tombstones, layers: { ...s.tombstones.layers, [id]: now } },
          };
        }),

      addEvent: (draft) => {
        const id = newId();
        const now = Date.now();
        set((s) => ({ events: [...s.events, { ...draft, id, createdAt: now, updatedAt: now }] }));
        return id;
      },

      updateEvent: (id, draft) =>
        set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, ...draft, updatedAt: Date.now() } : e)) })),

      removeEvent: (id) =>
        set((s) => ({
          events: s.events.filter((e) => e.id !== id),
          tombstones: { ...s.tombstones, events: { ...s.tombstones.events, [id]: Date.now() } },
        })),
    }),
    {
      name: 'assistlife/v1',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ settings, settingsUpdatedAt, layers, events, tombstones }) => ({
        settings,
        settingsUpdatedAt,
        layers,
        events,
        tombstones,
      }),
      // Version 1 had no change times on layers and no record of deletions.
      migrate: (saved) => {
        const data = (saved ?? {}) as Partial<State>;
        return { ...data, layers: data.layers?.map((l) => ({ ...l, updatedAt: l.updatedAt ?? 0 })) };
      },
      merge: (saved, current) => {
        const data = (saved ?? {}) as Partial<State>;
        return {
          ...current,
          ...data,
          settings: { ...DEFAULT_SETTINGS, ...data.settings },
          layers: data.layers?.length ? data.layers : current.layers,
          tombstones: { layers: {}, events: {}, ...data.tombstones },
        };
      },
      onRehydrateStorage: () => () => useStore.setState({ hydrated: true }),
    },
  ),
);

/** Display name of a layer in a language. */
export function layerName(layer: Layer, lang: Lang): string {
  return layer.name ?? (layer.nameKey ? STRINGS[lang][layer.nameKey] : '');
}

/** The data that is backed up, as it stands now. */
export function currentSnapshot(): AppSnapshot {
  const { settings, settingsUpdatedAt, layers, events, tombstones } = useStore.getState();
  return { settings, settingsUpdatedAt, layers, events, tombstones };
}
