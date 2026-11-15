import { describe, expect, it } from 'vitest';
import { decryptJson, deriveKeys, encryptJson, fromBase64, toBase64 } from '../sync/crypto';
import { syncOnce, WrongKeyError, type Remote, type RemoteVault } from '../sync/engine';
import { mergeSnapshots, TOMBSTONE_TTL_MS, type Snapshot } from '../sync/merge';

type Rec = { id: string; updatedAt: number; title?: string };
type Snap = Snapshot<{ lang: string }, Rec, Rec>;

const snap = (over: Partial<Snap> = {}): Snap => ({
  settings: { lang: 'ar' },
  settingsUpdatedAt: 0,
  layers: [{ id: 'l1', updatedAt: 0 }],
  events: [],
  tombstones: { layers: {}, events: {} },
  ...over,
});

class FakeRemote implements Remote {
  vault: RemoteVault | null = null;
  pushes = 0;
  /** Runs once, just before the next push, to simulate another device writing first. */
  beforePush: (() => Promise<void>) | null = null;
  async fetch() {
    return this.vault ? { ...this.vault } : null;
  }
  async push(ciphertext: string, expected: number | null) {
    if (this.beforePush) {
      const hook = this.beforePush;
      this.beforePush = null;
      await hook();
    }
    if ((this.vault?.revision ?? null) !== expected) return false;
    this.vault = { ciphertext, revision: (expected ?? 0) + 1 };
    this.pushes += 1;
    return true;
  }
}

describe('crypto', () => {
  it('round-trips base64', () => {
    for (let length = 0; length < 70; length += 1) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 37 + length) & 255);
      expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
    }
    expect(toBase64(new TextEncoder().encode('hello'))).toBe('aGVsbG8=');
  });

  it('derives two unrelated secrets, the same on every device', async () => {
    const a = await deriveKeys(' User@Example.com ', 'correct horse');
    const b = await deriveKeys('user@example.com', 'correct horse');
    expect(a).toEqual(b);
    expect(a.authSecret).toHaveLength(64);
    expect(a.encKey).toHaveLength(64);
    expect(a.authSecret).not.toBe(a.encKey);
    expect((await deriveKeys('user@example.com', 'correct horsf')).encKey).not.toBe(a.encKey);
    expect((await deriveKeys('other@example.com', 'correct horse')).encKey).not.toBe(a.encKey);
  });

  it('encrypts so that only the right key opens it', async () => {
    const { encKey } = await deriveKeys('a@b.c', 'pw');
    const other = (await deriveKeys('a@b.c', 'pw2')).encKey;
    const value = { title: 'موعد الطبيب', n: 3 };
    const sealed = encryptJson(encKey, value);
    expect(sealed).not.toContain('موعد');
    expect(encryptJson(encKey, value)).not.toBe(sealed); // fresh nonce every time
    expect(decryptJson(encKey, sealed)).toEqual(value);
    expect(() => decryptJson(other, sealed)).toThrow();
    const tampered = fromBase64(sealed);
    tampered[tampered.length - 1] ^= 1;
    expect(() => decryptJson(encKey, toBase64(tampered))).toThrow();
  });
});

describe('mergeSnapshots', () => {
  it('keeps the newer copy of each record and unions the rest', () => {
    const local = snap({ events: [{ id: 'a', updatedAt: 5, title: 'local' }, { id: 'b', updatedAt: 1 }] });
    const remote = snap({ events: [{ id: 'a', updatedAt: 3, title: 'remote' }, { id: 'c', updatedAt: 2 }] });
    const merged = mergeSnapshots(local, remote, 10);
    expect(merged.events.map((e) => e.id).sort()).toEqual(['a', 'b', 'c']);
    expect(merged.events.find((e) => e.id === 'a')!.title).toBe('local');
  });

  it('lets a deletion win over an older copy, and a later edit win over the deletion', () => {
    const local = snap({ tombstones: { layers: {}, events: { a: 5, b: 5 } } });
    const remote = snap({ events: [{ id: 'a', updatedAt: 3 }, { id: 'b', updatedAt: 9 }] });
    expect(mergeSnapshots(local, remote, 10).events.map((e) => e.id)).toEqual(['b']);
  });

  it('takes the newer settings and forgets very old tombstones', () => {
    const local = snap({ settingsUpdatedAt: 1, tombstones: { layers: {}, events: { old: 1 } } });
    const remote = snap({ settings: { lang: 'fr' }, settingsUpdatedAt: 2 });
    const merged = mergeSnapshots(local, remote, TOMBSTONE_TTL_MS + 2);
    expect(merged.settings.lang).toBe('fr');
    expect(merged.tombstones.events).toEqual({});
  });

  it('replaces a whole block with the newest copy', () => {
    const local = snap({ blocks: { google: { updatedAt: 5, data: ['old'] }, other: { updatedAt: 9, data: 'keep' } } });
    const remote = snap({ blocks: { google: { updatedAt: 7, data: ['new'] }, other: { updatedAt: 1, data: 'stale' } } });
    const merged = mergeSnapshots(local, remote, 10);
    expect(merged.blocks).toEqual({ google: { updatedAt: 7, data: ['new'] }, other: { updatedAt: 9, data: 'keep' } });
    // A backup written before blocks existed leaves the device's blocks alone.
    expect(mergeSnapshots(local, snap(), 10).blocks).toEqual(local.blocks);
  });

  it('never leaves the user without a layer', () => {
    const local = snap({ tombstones: { layers: { l1: 9 }, events: {} } });
    expect(mergeSnapshots(local, snap(), 10).layers).toHaveLength(1);
  });
});

describe('syncOnce', () => {
  const KEY = 'ab'.repeat(32);

  it('uploads on first sync and is quiet when nothing changed', async () => {
    const remote = new FakeRemote();
    const local = snap({ events: [{ id: 'a', updatedAt: 1 }] });
    expect(await syncOnce(local, remote, KEY, 10)).toMatchObject({ pulled: false, pushed: true });
    expect(remote.vault!.revision).toBe(1);
    expect(await syncOnce(local, remote, KEY, 10)).toMatchObject({ pulled: false, pushed: false });
    expect(remote.pushes).toBe(1);
  });

  it('carries changes between two devices in both directions', async () => {
    const remote = new FakeRemote();
    let phone = snap({ events: [{ id: 'p', updatedAt: 1 }] });
    let laptop = snap({ events: [{ id: 'l', updatedAt: 2 }] });
    phone = (await syncOnce(phone, remote, KEY, 10)).snapshot;
    const second = await syncOnce(laptop, remote, KEY, 10);
    laptop = second.snapshot;
    expect(second).toMatchObject({ pulled: true, pushed: true });
    const third = await syncOnce(phone, remote, KEY, 10);
    phone = third.snapshot;
    expect(third).toMatchObject({ pulled: true, pushed: false });
    expect(phone.events.map((e) => e.id).sort()).toEqual(['l', 'p']);
    expect(laptop.events.map((e) => e.id).sort()).toEqual(['l', 'p']);

    // The laptop deletes an event; the phone must lose it too.
    laptop = { ...laptop, events: laptop.events.filter((e) => e.id !== 'p'), tombstones: { layers: {}, events: { p: 5 } } };
    await syncOnce(laptop, remote, KEY, 10);
    phone = (await syncOnce(phone, remote, KEY, 10)).snapshot;
    expect(phone.events.map((e) => e.id)).toEqual(['l']);
  });

  it('carries a block to a device that never had it, and uploads nothing for an empty one', async () => {
    const remote = new FakeRemote();
    await syncOnce(snap({ blocks: { google: { updatedAt: 0, data: null } } }), remote, KEY, 10);
    await syncOnce(snap(), remote, KEY, 10);
    expect(remote.pushes).toBe(1); // an unfilled block is not a change
    await syncOnce(snap({ blocks: { google: { updatedAt: 4, data: { events: ['e'] } } } }), remote, KEY, 10);
    const other = await syncOnce(snap({ blocks: { google: { updatedAt: 0, data: null } } }), remote, KEY, 10);
    expect(other.pulled).toBe(true);
    expect(other.snapshot.blocks!.google).toEqual({ updatedAt: 4, data: { events: ['e'] } });
  });

  it('merges instead of overwriting when another device writes first', async () => {
    const remote = new FakeRemote();
    await syncOnce(snap(), remote, KEY, 10);
    remote.beforePush = async () => {
      await syncOnce(snap({ events: [{ id: 'other', updatedAt: 3 }] }), remote, KEY, 10);
    };
    const outcome = await syncOnce(snap({ events: [{ id: 'mine', updatedAt: 4 }] }), remote, KEY, 10);
    expect(outcome.snapshot.events.map((e) => e.id).sort()).toEqual(['mine', 'other']);
    const stored = decryptJson<{ data: Snap }>(KEY, remote.vault!.ciphertext);
    expect(stored.data.events.map((e) => e.id).sort()).toEqual(['mine', 'other']);
  });

  it('refuses a wrong key without touching the backup', async () => {
    const remote = new FakeRemote();
    await syncOnce(snap({ events: [{ id: 'a', updatedAt: 1 }] }), remote, KEY, 10);
    const before = remote.vault!.ciphertext;
    await expect(syncOnce(snap(), remote, 'cd'.repeat(32), 10)).rejects.toBeInstanceOf(WrongKeyError);
    expect(remote.vault!.ciphertext).toBe(before);
  });
});
