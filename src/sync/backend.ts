/** The account server (Supabase): sign-in and storage of the encrypted backup. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE_KEY, SUPABASE_URL, accountsConfigured } from '@/config';
import type { Remote } from '@/lib/sync/engine';

let client: SupabaseClient | null = null;

export function backend(): SupabaseClient {
  if (!accountsConfigured) throw new Error('Accounts are not configured');
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

/** The signed-in user's encrypted backup row. Row-level rules on the server limit it to its owner. */
export function vaultRemote(userId: string): Remote {
  const table = () => backend().from('vaults');
  return {
    async fetch() {
      const { data, error } = await table().select('ciphertext, revision').eq('user_id', userId).limit(1);
      if (error) throw new Error(error.message);
      return data.length ? { ciphertext: data[0].ciphertext as string, revision: data[0].revision as number } : null;
    },
    async push(ciphertext, expectedRevision) {
      if (expectedRevision === null) {
        const { error } = await table().insert({ user_id: userId, ciphertext, revision: 1 });
        if (!error) return true;
        // Unique violation: another device created the backup first.
        if (error.code === '23505') return false;
        throw new Error(error.message);
      }
      const { data, error } = await table()
        .update({ ciphertext, revision: expectedRevision + 1, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('revision', expectedRevision)
        .select('revision');
      if (error) throw new Error(error.message);
      return data.length === 1;
    },
  };
}
