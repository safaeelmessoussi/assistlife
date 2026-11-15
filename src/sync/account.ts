/** Account state and the actions around it: sign in, sign out, sync. */
import { AppState } from 'react-native';
import { create } from 'zustand';

import { accountsConfigured } from '@/config';
import { deriveKeys, normalizeEmail } from '@/lib/sync/crypto';
import { syncOnce, WrongKeyError } from '@/lib/sync/engine';
import { currentSnapshot, useStore } from '@/store';

import { backend, vaultRemote } from './backend';
import { clearEncKey, loadEncKey, saveEncKey } from './secrets';

export type SyncState = 'idle' | 'syncing' | 'error' | 'wrongPassword';
export type AuthError = 'invalid' | 'exists' | 'weak' | 'network' | 'unknown';

type AccountState = {
  ready: boolean;
  email: string | null;
  sync: SyncState;
  lastSyncAt: number | null;
};

export const useAccount = create<AccountState>(() => ({ ready: !accountsConfigured, email: null, sync: 'idle', lastSyncAt: null }));

let userId: string | null = null;
let encKey: string | null = null;
let running: Promise<void> | null = null;
let again = false;
/** True while a sync writes its result into the store, so that write does not trigger another sync. */
let applying = false;

/** Bring this device and the backup into agreement. Calls made while one runs are folded into one follow-up. */
export function syncNow(): Promise<void> {
  if (!userId || !encKey) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  const uid = userId;
  const key = encKey;
  running = (async () => {
    useAccount.setState({ sync: 'syncing' });
    try {
      do {
        again = false;
        const outcome = await syncOnce(currentSnapshot(), vaultRemote(uid), key);
        if (outcome.pulled) {
          applying = true;
          useStore.getState().applySnapshot(outcome.snapshot);
          applying = false;
        }
      } while (again);
      useAccount.setState({ sync: 'idle', lastSyncAt: Date.now() });
    } catch (error) {
      applying = false;
      useAccount.setState({ sync: error instanceof WrongKeyError ? 'wrongPassword' : 'error' });
    } finally {
      running = null;
    }
  })();
  return running;
}

function classify(message: string, status?: number): AuthError {
  const text = message.toLowerCase();
  if (text.includes('already registered') || text.includes('already exists')) return 'exists';
  if (text.includes('invalid login') || text.includes('invalid credentials') || status === 400) return 'invalid';
  if (text.includes('weak') || text.includes('at least')) return 'weak';
  if (text.includes('fetch') || text.includes('network')) return 'network';
  return 'unknown';
}

export type AuthResult = { ok: true; confirmEmail?: boolean } | { ok: false; error: AuthError };

/**
 * Sign in, or create the account when `create` is true. The password itself
 * is never sent: the server receives one derived secret, the device keeps the other.
 */
export async function authenticate(email: string, password: string, createAccount: boolean): Promise<AuthResult> {
  const address = normalizeEmail(email);
  const keys = await deriveKeys(address, password);
  const auth = backend().auth;
  try {
    const { data, error } = createAccount
      ? await auth.signUp({ email: address, password: keys.authSecret })
      : await auth.signInWithPassword({ email: address, password: keys.authSecret });
    if (error) return { ok: false, error: classify(error.message, error.status) };
    // With e-mail confirmation switched on, a new account has no session until the link is opened.
    if (!data.session || !data.user) return { ok: true, confirmEmail: true };
    await saveEncKey(keys.encKey);
    encKey = keys.encKey;
    userId = data.user.id;
    useAccount.setState({ email: data.user.email ?? address, sync: 'idle' });
    void syncNow();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: classify(String(error)) };
  }
}

/** Sign out of the account. The data stays on the device. */
export async function signOut(): Promise<void> {
  userId = null;
  encKey = null;
  useAccount.setState({ email: null, sync: 'idle', lastSyncAt: null });
  await clearEncKey();
  try {
    await backend().auth.signOut({ scope: 'local' });
  } catch {
    // Already signed out on the server, or offline: the local session is gone either way.
  }
}

let started = false;

/** Restore the session at launch and keep the backup current while the app runs. */
export function startSync(): void {
  if (started || !accountsConfigured) return;
  started = true;

  void (async () => {
    try {
      const [{ data }, key] = await Promise.all([backend().auth.getSession(), loadEncKey()]);
      if (data.session && key) {
        userId = data.session.user.id;
        encKey = key;
        useAccount.setState({ email: data.session.user.email ?? null });
        void syncNow();
      }
    } finally {
      useAccount.setState({ ready: true });
    }
  })();

  // A change on this device is backed up a few seconds later.
  let timer: ReturnType<typeof setTimeout> | undefined;
  useStore.subscribe((state, previous) => {
    if (applying || !userId) return;
    const changed =
      state.events !== previous.events ||
      state.layers !== previous.layers ||
      state.settings !== previous.settings ||
      state.tombstones !== previous.tombstones;
    if (!changed) return;
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), 3000);
  });

  // Coming back to the app picks up what other devices changed.
  AppState.addEventListener('change', (status) => {
    if (status === 'active') void syncNow();
  });
  setInterval(() => void syncNow(), 5 * 60 * 1000);
}
