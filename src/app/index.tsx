/** The calendar: month, week and day views over the same events. */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { DayPanel } from '@/components/DayPanel';
import { MonthView } from '@/components/MonthView';
import { TimeGrid } from '@/components/TimeGrid';
import { IconButton, Segmented, Txt } from '@/components/ui';
import { ISLAMIC_CONTENT } from '@/content/islamic';
import { useCycle } from '@/cycle/store';
import { googleLayers, useGoogle } from '@/google/store';
import { useLocale, useNow, usePalette, usePrayerTimes } from '@/hooks';
import { addMonths, daysInMonth, fromDayNum, monthGrid, parseIso, startOfWeek, toDayNum, toIso, type DayNum } from '@/lib/dates';
import { cycleDays } from '@/lib/cycle/predict';
import { expandEvents, groupByDay } from '@/lib/events';
import { islamicEvents } from '@/lib/islamic';
import { resolveAnchor } from '@/lib/prayer';
import { useStore, type Layer } from '@/store';
import { RADIUS, SPACE, SYSTEM_COLORS } from '@/theme';

type ViewMode = 'month' | 'week' | 'day';

export default function CalendarScreen() {
  const p = usePalette();
  const router = useRouter();
  const locale = useLocale();
  const { t, rtl, lang, months, hijriMonths, hijri, hijriCfg } = locale;
  const prayers = usePrayerTimes();
  const settings = useStore((s) => s.settings);
  const now = useNow();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const weekStart = useStore((s) => s.settings.weekStart);
  const ownEvents = useStore((s) => s.events);
  const ownLayers = useStore((s) => s.layers);
  const googleEvents = useGoogle((g) => g.events);
  const googleCalendars = useGoogle((g) => g.calendars);

  const cycleOn = useCycle((c) => c.enabled);
  const periods = useCycle((c) => c.periods);

  const [mode, setMode] = useState<ViewMode>('month');
  const [selected, setSelected] = useState<DayNum>(now.day);
  const focus = fromDayNum(selected);

  const days = useMemo<DayNum[]>(() => {
    if (mode === 'month') return monthGrid(focus.y, focus.m, weekStart).flat();
    if (mode === 'week') {
      const start = startOfWeek(selected, weekStart);
      return Array.from({ length: 7 }, (_, i) => start + i);
    }
    return [selected];
  }, [mode, selected, focus.y, focus.m, weekStart]);

  // The user's own layers, the Google calendars they chose to show, and the computed Islamic layers sit side by side.
  const layers = useMemo(() => {
    const system: Layer[] = [
      { id: 'sys:fasting', name: t('layerFasting'), color: SYSTEM_COLORS['sys:fasting'], visible: true, updatedAt: 0 },
      { id: 'sys:occasions', name: t('layerOccasions'), color: SYSTEM_COLORS['sys:occasions'], visible: true, updatedAt: 0 },
      { id: 'sys:athkar', name: t('layerAthkar'), color: SYSTEM_COLORS['sys:athkar'], visible: true, updatedAt: 0 },
    ];
    return new Map([...ownLayers, ...googleLayers(googleCalendars), ...system].map((l) => [l.id, l]));
  }, [ownLayers, googleCalendars, t]);

  const cycle = useMemo(
    () => (cycleOn ? cycleDays(periods, days[0], days[days.length - 1]) : undefined),
    [cycleOn, periods, days],
  );

  const byDay = useMemo(() => {
    const from = days[0];
    const to = days[days.length - 1];
    const islamic = islamicEvents(
      from,
      to,
      hijri,
      {
        fasting: settings.showFasting,
        occasions: settings.showOccasions,
        athkar: settings.showAthkar,
        monThu: settings.fastMonThu,
        whiteDays: settings.fastWhiteDays,
      },
      (key) => ISLAMIC_CONTENT[key].title[lang],
    );
    // No fast is suggested on a recorded period day.
    const suggested = islamic.filter((e) => !(e.layerId === 'sys:fasting' && cycle?.get(parseIso(e.date) ?? -1)?.kind === 'period'));
    const visible = [...ownEvents, ...googleEvents, ...suggested].filter((e) => layers.get(e.layerId)?.visible === true);
    // An event tied to a prayer starts when that prayer falls on its own day.
    const occurrences = expandEvents(visible, from, to, hijriCfg, (event, day) => resolveAnchor(event.anchor!, prayers(day)));
    return groupByDay(occurrences, from, to);
  }, [ownEvents, googleEvents, layers, days, hijri, hijriCfg, prayers, settings, lang, cycle]);

  // The month grid leaves out the daily remembrance times: they would fill every cell.
  const monthByDay = useMemo(
    () => new Map([...byDay].map(([day, list]) => [day, list.filter((o) => o.event.layerId !== 'sys:athkar' || o.event.allDay)])),
    [byDay],
  );

  const move = (direction: 1 | -1) => {
    if (mode === 'month') {
      const next = addMonths(focus.y, focus.m, direction);
      setSelected(toDayNum(next.y, next.m, Math.min(focus.d, daysInMonth(next.y, next.m))));
    } else {
      setSelected(selected + direction * (mode === 'week' ? 7 : 1));
    }
  };

  const createEvent = (day: DayNum, startMin?: number) =>
    router.push({ pathname: '/event', params: { date: toIso(day), ...(startMin === undefined ? {} : { start: String(startMin) }) } });
  const openEvent = (id: string) => router.push({ pathname: '/event', params: { id } });

  // Title: the Gregorian period on top, the Hijri months it covers beneath.
  const rangeStart = mode === 'month' ? toDayNum(focus.y, focus.m, 1) : days[0];
  const rangeEnd = mode === 'month' ? toDayNum(focus.y, focus.m, daysInMonth(focus.y, focus.m)) : days[days.length - 1];
  const h1 = hijri(rangeStart);
  const h2 = hijri(rangeEnd);
  const title = mode === 'day' ? `${locale.weekdayName(selected)} ${locale.formatGregorian(selected)}` : `${months[focus.m - 1]} ${focus.y}`;
  const hijriTitle =
    mode === 'day'
      ? locale.formatHijri(selected)
      : h1.month === h2.month
        ? `${hijriMonths[h1.month - 1]} ${h1.year}`
        : h1.year === h2.year
          ? `${hijriMonths[h1.month - 1]} / ${hijriMonths[h2.month - 1]} ${h1.year}`
          : `${hijriMonths[h1.month - 1]} ${h1.year} / ${hijriMonths[h2.month - 1]} ${h2.year}`;

  const switcher = (
    <Segmented<ViewMode>
      testID="view"
      value={mode}
      onChange={setMode}
      options={[
        { value: 'month', label: t('month') },
        { value: 'week', label: t('week') },
        { value: 'day', label: t('day') },
      ]}
    />
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: p.bg }]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Txt weight="bold" size={wide ? 24 : 20} numberOfLines={1} testID="title">
            {title}
          </Txt>
          <Txt weight="medium" size={13} color={p.gold} numberOfLines={1} testID="hijri-title">
            {hijriTitle}
          </Txt>
        </View>
        {wide && <View style={{ width: 300 }}>{switcher}</View>}
        <Pressable
          onPress={() => setSelected(now.day)}
          accessibilityRole="button"
          testID="today"
          style={[styles.todayButton, { borderColor: p.border, backgroundColor: p.surface }]}>
          <Txt size={13} weight="semibold" color={p.primary}>
            {t('today')}
          </Txt>
        </Pressable>
        <IconButton icon={rtl ? 'chevron-forward' : 'chevron-back'} label={t('previous')} onPress={() => move(-1)} testID="prev" />
        <IconButton icon={rtl ? 'chevron-back' : 'chevron-forward'} label={t('next')} onPress={() => move(1)} testID="next" />
        <IconButton icon="options-outline" label={t('settings')} onPress={() => router.push('/settings')} testID="settings" />
      </View>
      {!wide && <View style={styles.switcherRow}>{switcher}</View>}

      <View style={[styles.body, wide && { flexDirection: 'row' }]}>
        <View style={[styles.main, { backgroundColor: p.surface, borderColor: p.border }, wide ? { flex: 1 } : mode === 'month' ? { flex: 2.4, minHeight: 420 } : { flex: 1 }]}>
          {mode === 'month' ? (
            <MonthView
              year={focus.y}
              month={focus.m}
              weekStart={weekStart}
              selected={selected}
              todayDay={now.day}
              byDay={monthByDay}
              cycle={cycle}
              layers={layers}
              onSelect={setSelected}
              onOpenDay={(day) => {
                setSelected(day);
                setMode('day');
              }}
              onSwipe={move}
            />
          ) : (
            <TimeGrid
              days={days}
              selected={selected}
              now={now}
              prayers={settings.showPrayers ? prayers : undefined}
              byDay={byDay}
              layers={layers}
              onSelect={(day) => {
                setSelected(day);
                if (mode === 'week') setMode('day');
              }}
              onCreate={createEvent}
              onOpenEvent={openEvent}
            />
          )}
        </View>

        {(mode === 'month' || wide) && (
          <View style={wide ? { width: 340 } : { flex: 1 }}>
            <DayPanel
              day={selected}
              occurrences={byDay.get(selected) ?? []}
              layers={layers}
              prayers={prayers(selected)}
              showPrayers={settings.showPrayers}
              nowMinutes={selected === now.day ? now.minutes : undefined}
              cycle={cycle?.get(selected)}
              onAdd={() => createEvent(selected)}
              onOpenEvent={openEvent}
            />
          </View>
        )}
      </View>

      {mode !== 'month' && !wide && (
        <Pressable
          onPress={() => createEvent(selected)}
          accessibilityRole="button"
          accessibilityLabel={t('addEvent')}
          testID="fab"
          style={[styles.fab, rtl ? { left: SPACE.xl } : { right: SPACE.xl }, { backgroundColor: p.primary }]}>
          <Ionicons name="add" size={30} color={p.onPrimary} />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingStart: SPACE.lg, paddingEnd: SPACE.xs, paddingTop: SPACE.sm, paddingBottom: SPACE.xs },
  titleBlock: { flex: 1, minWidth: 0 },
  todayButton: { height: 34, paddingHorizontal: SPACE.md, borderRadius: RADIUS.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginEnd: 2 },
  switcherRow: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.sm },
  body: { flex: 1 },
  main: { borderTopWidth: StyleSheet.hairlineWidth },
  fab: {
    position: 'absolute',
    bottom: SPACE.xl,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
  },
});
