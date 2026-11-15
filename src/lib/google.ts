/** Turning Google Calendar's event format into the app's own. Pure functions, no network. */
import { MIN_PER_DAY, formatTime, parseIso, toDayNum, toIso, weekday, type DayNum } from './dates';
import type { CalEvent, Repeat } from './events';

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
  /** Present on one occurrence of a repeating event. */
  recurringEventId?: string;
};

export type GoogleCalendar = {
  id: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  primary?: boolean;
  selected?: boolean;
  /** 'owner' and 'writer' may change events; 'reader' and 'freeBusyReader' may not. */
  accessRole?: string;
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
    ...(item.recurringEventId ? { series: true } : {}),
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


/** The Google calendar and event behind one of the app's Google event ids. */
export function splitGoogleId(id: string): { calendarId: string; eventId: string } {
  const body = id.slice(2);
  const cut = body.lastIndexOf(':');
  return { calendarId: body.slice(0, cut), eventId: body.slice(cut + 1) };
}

const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const RRULE_FREQ: Partial<Record<Repeat['freq'], string>> = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' };

/** Whether Google Calendar can express a repeat. It has no Hijri calendar. */
export const googleCanRepeat = (freq: Repeat['freq']) => freq in RRULE_FREQ;

function recurrenceRule(repeat: Repeat, first: DayNum, allDay: boolean): string | null {
  const freq = RRULE_FREQ[repeat.freq];
  if (!freq) return null;
  const parts = [`FREQ=${freq}`];
  if (repeat.interval > 1) parts.push(`INTERVAL=${Math.floor(repeat.interval)}`);
  if (repeat.freq === 'weekly') {
    const days = repeat.weekdays?.length ? repeat.weekdays : [weekday(first)];
    parts.push(`BYDAY=${[...days].sort().map((d) => RRULE_DAYS[d]).join(',')}`);
  }
  const until = parseIso(repeat.until);
  if (until !== null) {
    const compact = toIso(until).replace(/-/g, '');
    // For timed events Google wants an instant; the end of that day in UTC is close enough for a last day.
    parts.push(`UNTIL=${allDay ? compact : `${compact}T235959Z`}`);
  }
  return `RRULE:${parts.join(';')}`;
}

export type GoogleEventBody = {
  summary: string;
  location: string;
  description: string;
  start: GoogleEventTime;
  end: GoogleEventTime;
  recurrence?: string[];
};

type Writable = Pick<CalEvent, 'title' | 'date' | 'allDay' | 'spanDays' | 'startMin' | 'durationMin' | 'repeat' | 'location' | 'notes'>;

/**
 * An app event in Google Calendar's format. Times are written as wall-clock
 * values with the device's time zone name, so Google handles clock changes.
 * `withRepeat` is false when changing one existing occurrence.
 */
export function toGoogleBody(event: Writable, timeZone: string, withRepeat: boolean): GoogleEventBody {
  const first = parseIso(event.date) ?? 0;
  const body: GoogleEventBody = {
    summary: event.title,
    location: event.location ?? '',
    description: event.notes ?? '',
    start: {},
    end: {},
  };
  if (event.allDay) {
    body.start = { date: toIso(first) };
    body.end = { date: toIso(first + Math.max(1, event.spanDays)) };
  } else {
    const endMin = event.startMin + Math.max(0, event.durationMin);
    const stamp = (day: DayNum, minutes: number) => `${toIso(day)}T${formatTime(minutes)}:00`;
    body.start = { dateTime: stamp(first, event.startMin), timeZone };
    body.end = { dateTime: stamp(first + Math.floor(endMin / MIN_PER_DAY), endMin % MIN_PER_DAY), timeZone };
  }
  if (withRepeat && event.repeat) {
    const rule = recurrenceRule(event.repeat, first, event.allDay);
    if (rule) body.recurrence = [rule];
  }
  return body;
}
