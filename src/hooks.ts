import { useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { LANGS, STRINGS, WEEKDAYS, gregorianMonths, hijriMonths, type StringKey } from '@/i18n/strings';
import { fromDayNum, nowMinutes, today, weekday, type DayNum } from '@/lib/dates';
import { hijriFromDay, type HijriConfig, type HijriDate } from '@/lib/hijri/engine';
import type { Anchor, DayPrayers, PrayerName } from '@/lib/prayer';
import { prayerTimes } from '@/lib/prayer';
import { useStore } from '@/store';
import { DARK, LIGHT, type Palette } from '@/theme';

const PRAYER_LABEL: Record<PrayerName, StringKey> = {
  fajr: 'prayerFajr',
  sunrise: 'prayerSunrise',
  dhuhr: 'prayerDhuhr',
  asr: 'prayerAsr',
  maghrib: 'prayerMaghrib',
  isha: 'prayerIsha',
};

/** Prayer times for any day, for the place and method chosen in the settings. */
export function usePrayerTimes(): (day: DayNum) => DayPrayers {
  const place = useStore((s) => s.settings.place);
  const method = useStore((s) => s.settings.prayerMethod);
  const hanafi = useStore((s) => s.settings.asrHanafi);
  return useCallback((day: DayNum) => prayerTimes(day, place, method, hanafi), [place, method, hanafi]);
}

export function usePalette(): Palette {
  const system = useColorScheme();
  const theme = useStore((s) => s.settings.theme);
  return (theme === 'system' ? system : theme) === 'dark' ? DARK : LIGHT;
}

/** Texts, names and date formatting for the current language. */
export function useLocale() {
  const lang = useStore((s) => s.settings.language);
  const region = useStore((s) => s.settings.hijriRegion);
  const adjust = useStore((s) => s.settings.hijriAdjust);

  return useMemo(() => {
    const rtl = LANGS.find((l) => l.id === lang)?.rtl ?? false;
    const strings = STRINGS[lang];
    const months = gregorianMonths(lang, region === 'MA');
    const hMonths = hijriMonths(lang);
    const hijriCfg: HijriConfig = { region, adjust };
    const hijri = (day: DayNum): HijriDate => hijriFromDay(day, hijriCfg);
    return {
      lang,
      rtl,
      t: (key: StringKey) => strings[key],
      weekdays: WEEKDAYS[lang],
      months,
      hijriMonths: hMonths,
      hijriCfg,
      hijri,
      /** "14 نونبر 2026" */
      formatGregorian: (day: DayNum) => {
        const { y, m, d } = fromDayNum(day);
        return `${d} ${months[m - 1]} ${y}`;
      },
      /** "3 جمادى الآخرة 1448" */
      formatHijri: (day: DayNum) => {
        const h = hijri(day);
        return `${h.day} ${hMonths[h.month - 1]} ${h.year}`;
      },
      weekdayName: (day: DayNum) => WEEKDAYS[lang].long[weekday(day)],
      prayerName: (name: PrayerName) => strings[PRAYER_LABEL[name]],
      /** "بعد العصر بـ 15 د" / "15 min after Asr" */
      formatAnchor: (anchor: Anchor) => {
        const prayer = strings[PRAYER_LABEL[anchor.prayer]];
        const minutes = Math.abs(anchor.offsetMin);
        if (minutes === 0) return `${strings.anchorAt} ${prayer}`;
        const word = anchor.offsetMin > 0 ? strings.anchorAfter : strings.anchorBefore;
        return lang === 'ar' ? `${word} ${prayer} بـ ${minutes} ${strings.minutesShort}` : `${minutes} ${strings.minutesShort} ${word} ${prayer}`;
      },
    };
  }, [lang, region, adjust]);
}

export type Locale = ReturnType<typeof useLocale>;

/** Today's day number and the current minute, refreshed every minute. */
export function useNow(): { day: DayNum; minutes: number } {
  const read = useCallback(() => ({ day: today(), minutes: nowMinutes() }), []);
  const [now, setNow] = useState(read);
  useEffect(() => {
    const timer = setInterval(() => setNow(read()), 30_000);
    return () => clearInterval(timer);
  }, [read]);
  return now;
}
