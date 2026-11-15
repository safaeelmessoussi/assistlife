/**
 * Merging two copies of the user's data (this device and the backup).
 *
 * Every record carries the time it was last changed; the newer copy wins.
 * A deletion is remembered as a tombstone so that an old copy on another
 * device cannot bring the record back.
 */
export type Stamped = { id: string; updatedAt: number };

export type Tombstones = Record<string, number>;

export type Snapshot<Settings, Layer extends Stamped, Event extends Stamped> = {
  settings: Settings;
  settingsUpdatedAt: number;
  layers: Layer[];
  events: Event[];
  /** Deleted record id → time of deletion. */
  tombstones: { layers: Tombstones; events: Tombstones };
};

/** Tombstones older than this are dropped; a device offline for longer may resurrect a record. */
export const TOMBSTONE_TTL_MS = 180 * 24 * 60 * 60 * 1000;

function mergeTombstones(a: Tombstones, b: Tombstones, now: number): Tombstones {
  const out: Tombstones = {};
  for (const source of [a, b]) {
    for (const [id, at] of Object.entries(source)) {
      if (now - at > TOMBSTONE_TTL_MS) continue;
      out[id] = Math.max(out[id] ?? 0, at);
    }
  }
  return out;
}

function mergeRecords<T extends Stamped>(a: T[], b: T[], tombstones: Tombstones): T[] {
  const byId = new Map<string, T>();
  // `a` first so that its order is kept and, on equal times, its copy stays.
  for (const record of [...a, ...b]) {
    const current = byId.get(record.id);
    if (!current || record.updatedAt > current.updatedAt) byId.set(record.id, record);
  }
  // A record changed after its deletion (re-created on another device) survives.
  return [...byId.values()].filter((record) => !(tombstones[record.id] >= record.updatedAt));
}

export function mergeSnapshots<S, L extends Stamped, E extends Stamped>(
  local: Snapshot<S, L, E>,
  remote: Snapshot<S, L, E>,
  now: number,
): Snapshot<S, L, E> {
  const tombstones = {
    layers: mergeTombstones(local.tombstones.layers, remote.tombstones.layers, now),
    events: mergeTombstones(local.tombstones.events, remote.tombstones.events, now),
  };
  const remoteSettingsNewer = remote.settingsUpdatedAt > local.settingsUpdatedAt;
  const layers = mergeRecords(local.layers, remote.layers, tombstones.layers);
  return {
    settings: remoteSettingsNewer ? remote.settings : local.settings,
    settingsUpdatedAt: Math.max(local.settingsUpdatedAt, remote.settingsUpdatedAt),
    // Never end up with no layer at all: every event needs one.
    layers: layers.length ? layers : local.layers.length ? local.layers : remote.layers,
    events: mergeRecords(local.events, remote.events, tombstones.events),
    tombstones,
  };
}

/** Stable text form of a snapshot, for telling whether two copies are the same. */
export function fingerprint(snapshot: Snapshot<unknown, Stamped, Stamped>): string {
  const byId = (a: Stamped, b: Stamped) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const sortKeys = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(sortKeys)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
              .filter(([, v]) => v !== undefined)
              .sort(([a], [b]) => (a < b ? -1 : 1))
              .map(([k, v]) => [k, sortKeys(v)]),
          )
        : value;
  return JSON.stringify(
    sortKeys({
      ...snapshot,
      layers: [...snapshot.layers].sort(byId),
      events: [...snapshot.events].sort(byId),
    }),
  );
}
