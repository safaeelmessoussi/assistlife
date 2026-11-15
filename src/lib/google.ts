/** Turning Google Calendar's event format into the app's own. Pure functions, no network. */
import { parseIso, toDayNum, toIso, type DayNum } from './dates';
import type { CalEvent } from './events';

export type GoogleEventTime = { date?: string; dateTime?: string; timeZone?: string };

export type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
  updated?: string;
};

export type GoogleCalendar = {
  id: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  primary?: boolean;
  selected?: boolean;
};

export type LocalMoment = { day: DayNum; minutes: number };

/** An instant shown on the device's own clock. */
export function deviceLocal(instantMs: number): LocalMoment {
  const d = new Date(instantMs);
  return { day: toDayNum(d.getFullYear(), d.getMonth() + 1, d.getDate()), minutes: d.getHours() * 60 + d.getMinutes() };
}

export const googleLayerId = (calendarId: string) => `g:${calendarId}`;
export const isGoogleId = (id: string | undefined) => id?.startsWith('g:') === true;

/** Google descriptions may carry HTML; keep the words. */
function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * One Google event occurrence → one app event, or null when it should not be
 * shown (cancelled, or missing its times). Repeating Google events arrive
 * already expanded into occurrences, so the result never repeats.
 */
export function mapGoogleEvent(
  item: GoogleEvent,
  calendarId: string,
  untitled: string,
  toLocal: (instantMs: number) => LocalMoment = deviceLocal,
): CalEvent | null {
  if (item.status === 'cancelled' || !item.start || !item.end) return null;
  const stamp = item.updated ? Date.parse(item.updated) || 0 : 0;
  const base = {
    id: `${googleLayerId(calendarId)}:${item.id}`,
    title: item.summary?.trim() || untitled,
    layerId: googleLayerId(calendarId),
    location: item.location?.trim() || undefined,
    notes: item.description ? plainText(item.description) || undefined : undefined,
    link: item.htmlLink,
    createdAt: stamp,
    updatedAt: stamp,
  };

  if (item.start.date) {
    const first = parseIso(item.start.date);
    // Google's end date is the day after the last day.
    const after = parseIso(item.end.date);
    if (first === null) return null;
    return { ...base, date: toIso(first), allDay: true, spanDays: Math.max(1, (after ?? first + 1) - first), startMin: 0, durationMin: 0 };
  }

  const startMs = Date.parse(item.start.dateTime ?? '');
  const endMs = Date.parse(item.end.dateTime ?? '');
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  const start = toLocal(startMs);
  return {
    ...base,
    date: toIso(start.day),
    allDay: false,
    spanDays: 1,
    startMin: start.minutes,
    durationMin: Math.max(0, Math.round((endMs - startMs) / 60000)),
  };
}

/** The window of time kept on the device: a little of the past, a year ahead. */
export function syncWindow(today: DayNum): { timeMin: string; timeMax: string } {
  const iso = (day: DayNum) => `${toIso(day)}T00:00:00Z`;
  return { timeMin: iso(today - 62), timeMax: iso(today + 366) };
}

