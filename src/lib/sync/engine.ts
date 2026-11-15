/**
 * One round of synchronisation between this device and the encrypted backup.
 *
 * The backup is a single encrypted document with a revision number. A device
 * may only replace the revision it has read; if another device got there
 * first, it reads again, merges and retries. Nothing is ever overwritten
 * blindly.
 */
import { decryptJson, encryptJson } from './crypto';
import { fingerprint, mergeSnapshots, type Snapshot, type Stamped } from './merge';

export type RemoteVault = { ciphertext: string; revision: number };

export interface Remote {
  /** The stored backup, or null when the account has none yet. */
  fetch(): Promise<RemoteVault | null>;
  /**
   * Store a new backup. `expectedRevision` is the revision this device read
   * (null when it read none). Resolves false when someone else wrote first.
   */
  push(ciphertext: string, expectedRevision: number | null): Promise<boolean>;
}

export type SyncOutcome<S, L extends Stamped, E extends Stamped> = {
  /** The merged data, to be applied on this device. */
  snapshot: Snapshot<S, L, E>;
  /** True when the device's data changed as a result. */
  pulled: boolean;
  /** True when the backup was updated. */
  pushed: boolean;
};

/** Thrown when the backup cannot be opened with this device's key (wrong password). */
export class WrongKeyError extends Error {
  constructor() {
    super('The backup cannot be opened with this key');
    this.name = 'WrongKeyError';
  }
}

const VAULT_FORMAT = 1;
type VaultDocument<S, L extends Stamped, E extends Stamped> = { v: number; data: Snapshot<S, L, E> };

export async function syncOnce<S, L extends Stamped, E extends Stamped>(
  local: Snapshot<S, L, E>,
  remote: Remote,
  encKey: string,
  now: number = Date.now(),
): Promise<SyncOutcome<S, L, E>> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const stored = await remote.fetch();
    let merged = local;
    let remoteFingerprint: string | null = null;

    if (stored) {
      let document: VaultDocument<S, L, E>;
      try {
        document = decryptJson<VaultDocument<S, L, E>>(encKey, stored.ciphertext);
      } catch {
        throw new WrongKeyError();
      }
      if (document.v > VAULT_FORMAT) throw new Error('The backup was written by a newer version of the app');
      remoteFingerprint = fingerprint(document.data);
      merged = mergeSnapshots(local, document.data, now);
    }

    const mergedFingerprint = fingerprint(merged);
    const pulled = mergedFingerprint !== fingerprint(local);
    if (mergedFingerprint === remoteFingerprint) return { snapshot: merged, pulled, pushed: false };

    const document: VaultDocument<S, L, E> = { v: VAULT_FORMAT, data: merged };
    if (await remote.push(encryptJson(encKey, document), stored ? stored.revision : null)) {
      return { snapshot: merged, pulled, pushed: true };
    }
    // Another device wrote in between: read again and merge with what it wrote.
  }
  throw new Error('The backup kept changing; try again in a moment');
}
