/**
 * Alerts at prayer and remembrance times while the app is open in a browser.
 * Alerts with the app closed need the phone app's scheduler and are not
 * handled here.
 */
import { Platform } from 'react-native';

import { ISLAMIC_CONTENT } from '@/content/islamic';
import { STRINGS, type StringKey } from '@/i18n/strings';
import { nowMinutes, today, weekday } from '@/lib/dates';
import { prayerTimes, resolveAnchor, type PrayerName } from '@/lib/prayer';
import { useStore } from '@/store';

const PRAYER_KEYS: [PrayerName, StringKey][] = [
  ['fajr', 'prayerFajr'],
  ['dhuhr', 'prayerDhuhr'],
  ['asr', 'prayerAsr'],
  ['maghrib', 'prayerMaghrib'],
  ['isha', 'prayerIsha'],
];

const supported = () => Platform.OS === 'web' && typeof Notification !== 'undefined';

/** Ask the browser for permission. Resolves true when alerts may be shown. */
export async function requestNotifications(): Promise<boolean> {
  if (!supported()) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

/** What is due at a given minute of a day: titles and bodies ready to show. */
export function dueNow(day: number, minutes: number): { key: string; title: string; body: string }[] {
  const { settings } = useStore.getState();
  const strings = STRINGS[settings.language];
  const times = prayerTimes(day, settings.place, settings.prayerMethod, settings.asrHanafi);
  const out: { key: string; title: string; body: string }[] = [];
  if (settings.showPrayers) {
    for (const [name, label] of PRAYER_KEYS) {
      if (times[name] === minutes) out.push({ key: `${day}:${name}`, title: `${strings.timeNow} ${strings[label]}`, body: settings.place.name });
    }
  }
  if (settings.showAthkar) {
    const routine = [
      ['morning', { prayer: 'fajr', offsetMin: 15 }],
      ['evening', { prayer: 'asr', offsetMin: 20 }],
      ['sleep', { prayer: 'isha', offsetMin: 90 }],
      ...(weekday(day) === 5 ? ([['fridayHour', { prayer: 'maghrib', offsetMin: -60 }]] as const) : []),
    ] as const;
    for (const [key, anchor] of routine) {
      if (resolveAnchor(anchor, times) === minutes) {
        const content = ISLAMIC_CONTENT[key];
        out.push({ key: `${day}:${key}`, title: content.title[settings.language], body: content.note[settings.language] });
      }
    }
  }
  return out;
}

let started = false;

export function startNotifier(): void {
  if (started || !supported()) return;
  started = true;
  const shown = new Set<string>();
  setInterval(() => {
    if (!useStore.getState().settings.notify || Notification.permission !== 'granted') return;
    for (const item of dueNow(today(), nowMinutes())) {
      if (shown.has(item.key)) continue;
      shown.add(item.key);
      new Notification(item.title, { body: item.body, tag: item.key });
    }
  }, 20_000);
}
