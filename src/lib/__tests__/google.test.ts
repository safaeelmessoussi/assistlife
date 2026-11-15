import { describe, expect, it } from 'vitest';
import { parseIso } from '../dates';
import { mapGoogleEvent, splitGoogleId, syncWindow, toGoogleBody, type LocalMoment } from '../google';

/** A device whose clock is one hour ahead of UTC all year (Morocco). */
const plusOne = (ms: number): LocalMoment => {
  const shifted = ms + 3600_000;
  return { day: Math.floor(shifted / 86400_000), minutes: Math.floor((shifted % 86400_000) / 60000) };
};
const map = (item: Parameters<typeof mapGoogleEvent>[0]) => mapGoogleEvent(item, 'me@example.com', '(no title)', plusOne);

describe('mapGoogleEvent', () => {
  it('maps a timed event onto the device clock', () => {
    const event = map({
      id: 'abc',
      summary: ' Sport ',
      location: 'Gym',
      htmlLink: 'https://calendar.google.com/x',
      updated: '2026-11-01T10:00:00Z',
      start: { dateTime: '2026-11-13T18:30:00+01:00' },
      end: { dateTime: '2026-11-13T19:45:00+01:00' },
    });
    expect(event).toMatchObject({
      id: 'g:me@example.com:abc',
      layerId: 'g:me@example.com',
      title: 'Sport',
      date: '2026-11-13',
      allDay: false,
      startMin: 18 * 60 + 30,
      durationMin: 75,
      location: 'Gym',
      link: 'https://calendar.google.com/x',
    });
  });

  it('moves an event written in another time zone to the right local day', () => {
    // 23:30 in New York on the 13th is 05:30 on the 14th at UTC+1.
    const event = map({ id: 'x', start: { dateTime: '2026-11-13T23:30:00-05:00' }, end: { dateTime: '2026-11-14T00:30:00-05:00' } });
    expect(event).toMatchObject({ date: '2026-11-14', startMin: 5 * 60 + 30, durationMin: 60, title: '(no title)' });
  });

  it('maps all-day events, whose end date is exclusive', () => {
    expect(map({ id: 'a', start: { date: '2026-11-01' }, end: { date: '2026-11-02' } })).toMatchObject({ allDay: true, date: '2026-11-01', spanDays: 1 });
    expect(map({ id: 'b', start: { date: '2026-11-23' }, end: { date: '2026-11-26' } })).toMatchObject({ allDay: true, spanDays: 3 });
  });

  it('drops cancelled and incomplete events', () => {
    expect(map({ id: 'c', status: 'cancelled', start: { date: '2026-11-01' }, end: { date: '2026-11-02' } })).toBeNull();
    expect(map({ id: 'd' })).toBeNull();
    expect(map({ id: 'e', start: { dateTime: 'garbage' }, end: { dateTime: 'garbage' } })).toBeNull();
  });

  it('turns an HTML description into plain text', () => {
    const event = map({ id: 'h', description: '<p>Bring <b>mat</b> &amp; water</p><br>Room 2', start: { date: '2026-11-01' }, end: { date: '2026-11-02' } });
    expect(event!.notes).toBe('Bring mat & water\n\nRoom 2');
  });
});

describe('toGoogleBody', () => {
  const base = { title: 'Sport', date: '2026-11-13', allDay: false, spanDays: 1, startMin: 18 * 60 + 30, durationMin: 75 };

  it('writes wall-clock times with the zone name', () => {
    expect(toGoogleBody({ ...base, location: 'Gym' }, 'Africa/Casablanca', true)).toEqual({
      summary: 'Sport',
      location: 'Gym',
      description: '',
      start: { dateTime: '2026-11-13T18:30:00', timeZone: 'Africa/Casablanca' },
      end: { dateTime: '2026-11-13T19:45:00', timeZone: 'Africa/Casablanca' },
    });
  });

  it('carries an event past midnight and all-day spans with an exclusive end', () => {
    const late = toGoogleBody({ ...base, startMin: 23 * 60, durationMin: 120 }, 'UTC', true);
    expect(late.end).toEqual({ dateTime: '2026-11-14T01:00:00', timeZone: 'UTC' });
    const days = toGoogleBody({ ...base, allDay: true, spanDays: 3, date: '2026-11-30' }, 'UTC', true);
    expect([days.start, days.end]).toEqual([{ date: '2026-11-30' }, { date: '2026-12-03' }]);
  });

  it('translates repeats, and leaves them out when changing one occurrence', () => {
    const weekly = { ...base, repeat: { freq: 'weekly' as const, interval: 2, weekdays: [5, 2], until: '2026-12-31' } };
    expect(toGoogleBody(weekly, 'UTC', true).recurrence).toEqual(['RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,FR;UNTIL=20261231T235959Z']);
    expect(toGoogleBody(weekly, 'UTC', false).recurrence).toBeUndefined();
    expect(toGoogleBody({ ...base, repeat: { freq: 'weekly', interval: 1 } }, 'UTC', true).recurrence).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=FR']);
    expect(toGoogleBody({ ...base, allDay: true, repeat: { freq: 'yearly', interval: 1, until: '2030-01-01' } }, 'UTC', true).recurrence).toEqual(['RRULE:FREQ=YEARLY;UNTIL=20300101']);
    // Google has no Hijri calendar: such a repeat is not sent.
    expect(toGoogleBody({ ...base, repeat: { freq: 'hijriYearly', interval: 1 } }, 'UTC', true).recurrence).toBeUndefined();
  });

  it('round-trips through the reader', () => {
    const body = toGoogleBody({ ...base, notes: 'Bring water' }, 'UTC', true);
    const back = mapGoogleEvent({ id: 'x', summary: body.summary, description: body.description, start: { dateTime: body.start.dateTime + 'Z' }, end: { dateTime: body.end.dateTime + 'Z' } }, 'c', '-', (ms) => ({ day: Math.floor(ms / 86400_000), minutes: Math.floor((ms % 86400_000) / 60000) }));
    expect(back).toMatchObject({ title: 'Sport', date: '2026-11-13', startMin: base.startMin, durationMin: 75, notes: 'Bring water' });
  });
});

describe('splitGoogleId', () => {
  it('finds the calendar and the event', () => {
    expect(splitGoogleId('g:me@example.com:abc_20261113T173000Z')).toEqual({ calendarId: 'me@example.com', eventId: 'abc_20261113T173000Z' });
    expect(map({ id: 'r', recurringEventId: 'series', start: { date: '2026-11-01' }, end: { date: '2026-11-02' } })!.series).toBe(true);
  });
});

describe('syncWindow', () => {
  it('covers two months back and a year ahead', () => {
    expect(syncWindow(parseIso('2026-11-14')!)).toEqual({ timeMin: '2026-09-13T00:00:00Z', timeMax: '2027-11-15T00:00:00Z' });
  });
});
