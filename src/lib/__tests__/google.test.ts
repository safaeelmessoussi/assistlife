import { describe, expect, it } from 'vitest';
import { parseIso } from '../dates';
import { mapGoogleEvent, syncWindow, type LocalMoment } from '../google';

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

describe('syncWindow', () => {
  it('covers two months back and a year ahead', () => {
    expect(syncWindow(parseIso('2026-11-14')!)).toEqual({ timeMin: '2026-09-13T00:00:00Z', timeMax: '2027-11-15T00:00:00Z' });
  });
});
