/**
 * Google sign-in for calendar access, in the browser.
 *
 * The browser receives a short-lived access token straight from Google. It is
 * kept in memory only, never stored and never sent to our server.
 */
import { Platform } from 'react-native';

import { GOOGLE_WEB_CLIENT_ID } from '@/config';

// Read the list of calendars; read and write their events. Nothing else.
const SCOPE = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events';
const SCRIPT = 'https://accounts.google.com/gsi/client';

type TokenResponse = { access_token?: string; expires_in?: number | string; error?: string };
type TokenClient = { requestAccessToken: (options?: { prompt?: string }) => void };
type GoogleIdentity = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type?: string }) => void;
      }) => TokenClient;
      revoke: (token: string, done?: () => void) => void;
    };
  };
};

export const googleSignInAvailable = Platform.OS === 'web';

let token: { value: string; expiresAt: number } | null = null;
let scriptLoading: Promise<GoogleIdentity> | null = null;

function loadScript(): Promise<GoogleIdentity> {
  scriptLoading ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const existing = (globalThis as { google?: GoogleIdentity }).google;
    if (existing?.accounts?.oauth2) return resolve(existing);
    const tag = document.createElement('script');
    tag.src = SCRIPT;
    tag.async = true;
    tag.onload = () => {
      const loaded = (globalThis as { google?: GoogleIdentity }).google;
      if (loaded?.accounts?.oauth2) resolve(loaded);
      else reject(new Error('Google sign-in did not load'));
    };
    tag.onerror = () => {
      scriptLoading = null;
      reject(new Error('Google sign-in did not load'));
    };
    document.head.appendChild(tag);
  });
  return scriptLoading;
}

/** A token that is still valid, without asking the user for anything; null when there is none. */
export function currentToken(): string | null {
  return token && token.expiresAt > Date.now() + 60_000 ? token.value : null;
}

/**
 * Ask Google for access. Opens Google's own window, so it must be called from
 * a tap or click. Resolves with the access token.
 */
export async function requestToken(): Promise<string> {
  if (!googleSignInAvailable) throw new Error('Google sign-in is only available in the browser');
  const google = await loadScript();
  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_WEB_CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (!response.access_token) return reject(new Error(response.error ?? 'Google sign-in failed'));
        token = { value: response.access_token, expiresAt: Date.now() + (Number(response.expires_in) || 3600) * 1000 };
        resolve(token.value);
      },
      error_callback: (error) => reject(new Error(error.type ?? 'Google sign-in was closed')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

/** Forget the token and withdraw the access the user granted. */
export async function revokeToken(): Promise<void> {
  const value = token?.value;
  token = null;
  if (!value || !googleSignInAvailable) return;
  try {
    const google = await loadScript();
    await new Promise<void>((resolve) => google.accounts.oauth2.revoke(value, resolve));
  } catch {
    // Offline: the token expires on its own within the hour.
  }
}

/** A valid token, asking Google again when the last one has run out. Call from a tap. */
export const ensureToken = async (): Promise<string> => currentToken() ?? requestToken();
