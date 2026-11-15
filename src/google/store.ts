/** Google Calendar on this device: which calendars are shown and a copy of their events. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { STRINGS } from '@/i18n/strings';
import { today } from '@/lib/dates';
import type { CalEvent } from '@/lib/events';
import { googleLayerId, mapGoogleEvent, syncWindow, type GoogleCalendar, type GoogleEvent } from '@/lib/google';
import { useStore, type Layer } from '@/store';

import { currentToken, requestToken, revokeToken } from './auth';

const API = 'https://www.googleapis.com/calendar/v3';

export type ConnectedCalendar = { id: string; name: string; color: string; shown: boolean };

type GoogleState = {
  /** The Google account's address, or null when not connected. */
  email: string | null;
  calendars: ConnectedCalendar[];
  /** A copy of the shown calendars' events, so they display offline and before a refresh. */
  events: CalEvent[];
  lastRefreshAt: number | null;
  status: 'idle' | 'refreshing' | 'error';
};

export const useGoogle = create<GoogleState>()(
  persist((): GoogleState => ({ email: null, calendars: [], events: [], lastRefreshAt: null, status: 'idle' }), {
    name: 'assistlife/google/v1',
    storage: createJSONStorage(() => AsyncStorage),
    partialize: ({ email, calendars, events, lastRefreshAt }) => ({ email, calendars, events, lastRefreshAt }),
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
  }));
  if (shown) void refreshGoogleIfPossible();
}

export async function disconnectGoogle(): Promise<void> {
  useGoogle.setState({ email: null, calendars: [], events: [], lastRefreshAt: null, status: 'idle' });
  await revokeToken();
}

/** The shown Google calendars, in the shape the calendar screen uses for its own layers. */
export function googleLayers(calendars: ConnectedCalendar[]): Layer[] {
  return calendars.filter((c) => c.shown).map((c) => ({ id: googleLayerId(c.id), name: c.name, color: c.color, visible: true, updatedAt: 0 }));
}
