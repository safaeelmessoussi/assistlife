/** The selected day's dates and its list of events. */
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { IconButton, Txt } from '@/components/ui';
import { useLocale, usePalette } from '@/hooks';
import { formatTime, type DayNum } from '@/lib/dates';
import type { CycleDay } from '@/lib/cycle/predict';
import { minutesOnDay, type Occurrence } from '@/lib/events';
import { isSystemId } from '@/lib/islamic';
import { coveredPrayers, nextPrayer, PRAYERS, type DayPrayers } from '@/lib/prayer';
import { layerName, type Layer } from '@/store';
import { CYCLE_COLORS, RADIUS, SPACE } from '@/theme';

type Props = {
  day: DayNum;
  occurrences: Occurrence[];
  layers: Map<string, Layer>;
  prayers: DayPrayers;
  showPrayers: boolean;
  /** Set when the day is today, to point out the next prayer. */
  nowMinutes?: number;
  /** The cycle layer's word on this day, when the layer is on. */
  cycle?: CycleDay;
  onAdd: () => void;
  onOpenEvent: (id: string) => void;
};

export function DayPanel({ day, occurrences, layers, prayers, showPrayers, nowMinutes, cycle, onAdd, onOpenEvent }: Props) {
  const p = usePalette();
  const { t, lang, weekdayName, formatGregorian, formatHijri, prayerName } = useLocale();
  const next = nowMinutes === undefined ? null : nextPrayer(prayers, nowMinutes);

  return (
    <View style={[styles.root, { backgroundColor: p.surface, borderColor: p.border }]} testID="day-panel">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Txt weight="semibold" size={16} testID="day-panel-date">
            {weekdayName(day)} {formatGregorian(day)}
          </Txt>
          <Txt size={13} weight="medium" color={p.gold} testID="day-panel-hijri">
            {formatHijri(day)}
          </Txt>
          {cycle && (cycle.kind || cycle.cycleDay) && (
            <View style={styles.cycle} testID="cycle-note">
              {cycle.kind && <View style={[styles.cycleDot, { backgroundColor: CYCLE_COLORS[cycle.kind] }]} />}
              <Txt size={12} color={p.muted}>
                {[
                  cycle.kind && t(({ period: 'cyclePeriod', expected: 'cycleExpected', fertile: 'cycleFertile', ovulation: 'cycleOvulation' } as const)[cycle.kind]),
                  cycle.cycleDay && `${t('cycleDayOf')} ${cycle.cycleDay} ${t('cycleOfCycle')}`,
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
              </Txt>
            </View>
          )}
        </View>
        <IconButton icon="add-circle" label={t('addEvent')} onPress={onAdd} color={p.primary} size={32} testID="add-event" />
      </View>

      {showPrayers && (
        <View style={[styles.prayers, { borderColor: p.border }]} testID="prayer-strip">
          {PRAYERS.map((name) => {
            const isNext = name === next;
            return (
              <View key={name} style={[styles.prayer, isNext && { backgroundColor: p.primarySoft }]} testID={`prayer-${name}`}>
                <Txt size={11} weight={isNext ? 'semibold' : 'regular'} color={isNext ? p.primary : name === 'sunrise' ? p.faint : p.muted} numberOfLines={1}>
                  {prayerName(name)}
                </Txt>
                <Txt size={13} weight={isNext ? 'bold' : 'medium'} color={isNext ? p.primary : name === 'sunrise' ? p.muted : p.text} style={styles.prayerTime}>
                  {prayers[name] < 0 ? '—' : formatTime(prayers[name])}
                </Txt>
              </View>
            );
          })}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.list}>
        {occurrences.length === 0 && (
          <Txt color={p.muted} size={14} style={styles.empty}>
            {t('noEvents')}
          </Txt>
        )}
        {occurrences.map((occ) => {
          const layer = layers.get(occ.event.layerId);
          // The user's own plans are checked against the prayer times; computed items are not.
          const span = minutesOnDay(occ, day);
          const covered = occ.event.allDay || isSystemId(occ.event.id) ? [] : coveredPrayers(prayers, span.start, span.end);
          return (
            <Pressable
              key={`${occ.event.id}:${occ.day}`}
              onPress={() => onOpenEvent(occ.event.id)}
              accessibilityRole="button"
              testID={`agenda-${occ.event.id}`}
              style={({ pressed }) => [styles.item, { backgroundColor: pressed ? p.primarySoft : p.surfaceAlt }]}>
              <View style={[styles.bar, { backgroundColor: layer?.color ?? p.muted }]} />
              <View style={{ flex: 1 }}>
                <Txt weight="medium" numberOfLines={2}>
                  {occ.event.title}
                </Txt>
                <Txt size={12} color={p.muted} numberOfLines={1}>
                  {occ.event.allDay
                    ? t('allDay')
                    : `${formatTime(occ.event.startMin)} – ${formatTime(occ.event.startMin + occ.event.durationMin)}`}
                  {layer ? `  ·  ${layerName(layer, lang)}` : ''}
                  {occ.event.location ? `  ·  ${occ.event.location}` : ''}
                </Txt>
                {covered.length > 0 && (
                  <Txt size={12} weight="medium" color={p.danger} testID="prayer-conflict">
                    {t('coversPrayer')} {covered.map(prayerName).join('، ')}
                  </Txt>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, borderStartWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center', paddingStart: SPACE.lg, paddingEnd: SPACE.sm, paddingTop: SPACE.sm },
  cycle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  cycleDot: { width: 12, height: 12, borderRadius: 6 },
  prayers: { flexDirection: 'row', marginHorizontal: SPACE.md, marginTop: SPACE.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.md, overflow: 'hidden' },
  prayer: { flex: 1, alignItems: 'center', paddingVertical: 5 },
  prayerTime: { lineHeight: 17 },
  list: { padding: SPACE.md, gap: SPACE.sm },
  empty: { paddingHorizontal: SPACE.xs, paddingVertical: SPACE.sm },
  item: { flexDirection: 'row', gap: SPACE.md, padding: SPACE.md, borderRadius: RADIUS.md, alignItems: 'stretch' },
  bar: { width: 4, borderRadius: 2 },
});
