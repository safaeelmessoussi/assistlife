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
import type { HijriRegionId } from '@/lib/hijri/engine';
import { LAYER_COLORS } from '@/theme';

export type Layer = {
  id: string;
  /** Custom name; when absent the built-in name for `nameKey` is shown in the current language. */
  name?: string;
  nameKey?: StringKey;
  color: string;
  visible: boolean;
};

export type Settings = {
  language: Lang;
  /** 0 = Sunday, 1 = Monday, 6 = Saturday. */
  weekStart: number;
  hijriRegion: HijriRegionId;
  hijriAdjust: number;
  theme: 'system' | 'light' | 'dark';
};

export type EventDraft = Omit<CalEvent, 'id' | 'createdAt' | 'updatedAt'>;

type State = {
  hydrated: boolean;
  settings: Settings;
  layers: Layer[];
  events: CalEvent[];
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
).map((nameKey, i) => ({ id: nameKey, nameKey, color: LAYER_COLORS[i], visible: true }));

export const DEFAULT_SETTINGS: Settings = {
  language: 'ar',
  weekStart: 1,
  hijriRegion: 'MA',
  hijriAdjust: 0,
  theme: 'system',
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      hydrated: false,
      settings: DEFAULT_SETTINGS,
      layers: DEFAULT_LAYERS,
      events: [],

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addLayer: (name, color) => set((s) => ({ layers: [...s.layers, { id: newId(), name, color, visible: true }] })),

      updateLayer: (id, patch) => set((s) => ({ layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),

      removeLayer: (id) =>
        set((s) => {
          const layers = s.layers.filter((l) => l.id !== id);
          // The last layer cannot be removed: every event needs one.
          if (layers.length === 0 || layers.length === s.layers.length) return s;
          return {
            layers,
            events: s.events.map((e) => (e.layerId === id ? { ...e, layerId: layers[0].id, updatedAt: Date.now() } : e)),
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

      removeEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
    }),
    {
      name: 'assistlife/v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ settings, layers, events }) => ({ settings, layers, events }),
      merge: (saved, current) => {
        const data = (saved ?? {}) as Partial<State>;
        return {
          ...current,
          ...data,
          settings: { ...DEFAULT_SETTINGS, ...data.settings },
          layers: data.layers?.length ? data.layers : current.layers,
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
