/** Google Calendar on this device: which calendars are shown and a copy of their events. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { STRINGS } from '@/i18n/strings';
import { today } from '@/lib/dates';
import type { CalEvent } from '@/lib/events';
import { googleLayerId, mapGoogleEvent, splitGoogleId, syncWindow, toGoogleBody, type GoogleCalendar, type GoogleEvent } from '@/lib/google';
import { useStore, type EventDraft, type Layer } from '@/store';

import { currentToken, ensureToken, requestToken, revokeToken } from './auth';

const API = 'https://www.googleapis.com/calendar/v3';

export type ConnectedCalendar = { id: string; name: string; color: string; shown: boolean; writable?: boolean };

type GoogleState = {
  /** The Google account's address, or null when not connected. */
  email: string | null;
  calendars: ConnectedCalendar[];
  /** A copy of the shown calendars' events, so they display offline and before a refresh. */
  events: CalEvent[];
  lastRefreshAt: number | null;
  /** When the account, the shown calendars or the events last changed; decides which device's copy is newest. */
  updatedAt: number;
  status: 'idle' | 'refreshing' | 'error';
};

/** The part of the Google state that travels in the encrypted backup, so every device shows the same calendar. */
export type GoogleBlock = Pick<GoogleState, 'email' | 'calendars' | 'events' | 'lastRefreshAt'>;

export function googleBlock(): { updatedAt: number; data: GoogleBlock } {
  const { email, calendars, events, lastRefreshAt, updatedAt } = useGoogle.getState();
  return { updatedAt, data: { email, calendars, events, lastRefreshAt } };
}

/** Take over the copy another device put in the backup. */
export function applyGoogleBlock(block: { updatedAt: number; data: unknown }): void {
  const data = block.data as Partial<GoogleBlock> | null;
  if (!data || block.updatedAt <= useGoogle.getState().updatedAt) return;
  useGoogle.setState({
    email: data.email ?? null,
    calendars: data.calendars ?? [],
    events: data.events ?? [],
    lastRefreshAt: data.lastRefreshAt ?? null,
    updatedAt: block.updatedAt,
  });
}

export const useGoogle = create<GoogleState>()(
  persist((): GoogleState => ({ email: null, calendars: [], events: [], lastRefreshAt: null, updatedAt: 0, status: 'idle' }), {
    name: 'assistlife/google/v1',
    storage: createJSONStorage(() => AsyncStorage),
    partialize: ({ email, calendars, events, lastRefreshAt, updatedAt }) => ({ email, calendars, events, lastRefreshAt, updatedAt }),
    merge: (saved, current) => {
      const data = { ...current, ...(saved as Partial<GoogleState> | undefined) };
      // A connection made before the copy travelled in the backup has no change time yet.
      if (data.email !== null && !data.updatedAt) data.updatedAt = data.lastRefreshAt ?? Date.now();
      return data;
    },
  }),
);

async function getJson<T>(token: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${API}${path}${query ? `?${query}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Google Calendar answered ${response.status}`);
  return (await response.json()) as T;
}

async function fetchCalendars(token: string): Promise<GoogleCalendar[]> {
  const out: GoogleCalendar[] = [];
  let pageToken: string | undefined;
  do {
    const page = await getJson<{ items?: GoogleCalendar[]; nextPageToken?: string }>(token, '/users/me/calendarList', {
      maxResults: '250',
      ...(pageToken ? { pageToken } : {}),
    });
    out.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

async function fetchEvents(token: string, calendarId: string): Promise<GoogleEvent[]> {
  const out: GoogleEvent[] = [];
  let pageToken: string | undefined;
  do {
    // singleEvents: Google expands repeating events (and their exceptions) into occurrences.
    const page = await getJson<{ items?: GoogleEvent[]; nextPageToken?: string }>(
      token,
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      { singleEvents: 'true', showDeleted: 'false', maxResults: '2500', ...syncWindow(today()), ...(pageToken ? { pageToken } : {}) },
    );
    out.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

async function refreshWith(token: string): Promise<void> {
  useGoogle.setState({ status: 'refreshing' });
  try {
    const remote = await fetchCalendars(token);
    const known = new Map(useGoogle.getState().calendars.map((c) => [c.id, c]));
    const calendars: ConnectedCalendar[] = remote.map((c) => ({
      id: c.id,
      name: c.summaryOverride ?? c.summary ?? c.id,
      color: c.backgroundColor ?? '#6E7A86',
      writable: c.accessRole === 'owner' || c.accessRole === 'writer',
      // A calendar keeps the user's choice; a new one follows what Google itself shows.
      shown: known.get(c.id)?.shown ?? (c.selected === true || c.primary === true),
    }));
    const untitled = STRINGS[useStore.getState().settings.language].untitled;
    const lists = await Promise.all(
      calendars.filter((c) => c.shown).map(async (c) => (await fetchEvents(token, c.id)).map((item) => mapGoogleEvent(item, c.id, untitled))),
    );
    useGoogle.setState({
      email: remote.find((c) => c.primary)?.id ?? useGoogle.getState().email ?? '',
      calendars,
      events: lists.flat().filter((e): e is CalEvent => e !== null),
      lastRefreshAt: Date.now(),
      updatedAt: Date.now(),
      status: 'idle',
    });
  } catch (error) {
    useGoogle.setState({ status: 'error' });
    throw error;
  }
}

/** Connect, or reconnect, from a tap: Google asks the user, then events are fetched. */
export async function connectGoogle(): Promise<void> {
  try {
    await refreshWith(await requestToken());
  } catch {
    useGoogle.setState({ status: 'error' });
  }
}

/** Refresh quietly when access is still valid; does nothing otherwise. */
export async function refreshGoogleIfPossible(): Promise<void> {
  const token = currentToken();
  if (!token || !useGoogle.getState().email || useGoogle.getState().status === 'refreshing') return;
  try {
    await refreshWith(token);
  } catch {
    // Shown as an error state; the stored copy stays on screen.
  }
}

export function setCalendarShown(id: string, shown: boolean): void {
  useGoogle.setState((s) => ({
    calendars: s.calendars.map((c) => (c.id === id ? { ...c, shown } : c)),
    // Hiding takes effect at once; showing needs the events, fetched below when possible.
    events: shown ? s.events : s.events.filter((e) => e.layerId !== googleLayerId(id)),
    updatedAt: Date.now(),
  }));
  if (shown) void refreshGoogleIfPossible();
}

export async function disconnectGoogle(): Promise<void> {
  useGoogle.setState({ email: null, calendars: [], events: [], lastRefreshAt: null, updatedAt: Date.now(), status: 'idle' });
  await revokeToken();
}

/** The shown Google calendars, in the shape the calendar screen uses for its own layers. */
export function googleLayers(calendars: ConnectedCalendar[]): Layer[] {
  return calendars.filter((c) => c.shown).map((c) => ({ id: googleLayerId(c.id), name: c.name, color: c.color, visible: true, updatedAt: 0 }));
}

async function send<T>(token: string, method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T | null> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  // Deleting something already gone counts as done.
  if (!response.ok && !(method === 'DELETE' && (response.status === 404 || response.status === 410))) {
    throw new Error(`Google Calendar answered ${response.status}`);
  }
  return response.status === 204 || method === 'DELETE' ? null : ((await response.json()) as T);
}

const untitledText = () => STRINGS[useStore.getState().settings.language].untitled;

/**
 * Create an event in a Google calendar, or change an existing one (`existingId`).
 * Changing one occurrence of a repeating event changes that day only.
 * Resolves false when Google could not be reached or refused. Call from a tap.
 */
export async function saveGoogleEvent(draft: EventDraft, existingId?: string): Promise<boolean> {
  try {
    const token = await ensureToken();
    const calendarId = existingId ? splitGoogleId(existingId).calendarId : draft.layerId.slice(2);
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const base = `/calendars/${encodeURIComponent(calendarId)}/events`;
    const saved = existingId
      ? await send<GoogleEvent>(token, 'PATCH', `${base}/${encodeURIComponent(splitGoogleId(existingId).eventId)}`, toGoogleBody(draft, zone, false))
      : await send<GoogleEvent>(token, 'POST', base, toGoogleBody(draft, zone, true));
    if (!existingId && draft.repeat) {
      // Google expands the new repeating event into its occurrences.
      await refreshWith(token);
      return true;
    }
    const event = saved ? mapGoogleEvent(saved, calendarId, untitledText()) : null;
    useGoogle.setState((s) => ({
      events: [...s.events.filter((e) => e.id !== (existingId ?? event?.id)), ...(event ? [event] : [])],
      updatedAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
}

/** Delete a Google event, or one occurrence of a repeating one. Call from a tap. */
export async function deleteGoogleEvent(id: string): Promise<boolean> {
  try {
    const { calendarId, eventId } = splitGoogleId(id);
    await send(await ensureToken(), 'DELETE', `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
    useGoogle.setState((s) => ({ events: s.events.filter((e) => e.id !== id), updatedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}
