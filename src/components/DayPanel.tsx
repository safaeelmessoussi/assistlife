/** The selected day's dates and its list of events. */
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { IconButton, Txt } from '@/components/ui';
import { useLocale, usePalette } from '@/hooks';
import { formatTime, type DayNum } from '@/lib/dates';
import type { Occurrence } from '@/lib/events';
import { layerName, type Layer } from '@/store';
import { RADIUS, SPACE } from '@/theme';

type Props = {
  day: DayNum;
  occurrences: Occurrence[];
  layers: Map<string, Layer>;
  onAdd: () => void;
  onOpenEvent: (id: string) => void;
};

export function DayPanel({ day, occurrences, layers, onAdd, onOpenEvent }: Props) {
  const p = usePalette();
  const { t, lang, weekdayName, formatGregorian, formatHijri } = useLocale();

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
        </View>
        <IconButton icon="add-circle" label={t('addEvent')} onPress={onAdd} color={p.primary} size={32} testID="add-event" />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {occurrences.length === 0 && (
          <Txt color={p.muted} size={14} style={styles.empty}>
            {t('noEvents')}
          </Txt>
        )}
        {occurrences.map((occ) => {
          const layer = layers.get(occ.event.layerId);
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
  list: { padding: SPACE.md, gap: SPACE.sm },
  empty: { paddingHorizontal: SPACE.xs, paddingVertical: SPACE.sm },
  item: { flexDirection: 'row', gap: SPACE.md, padding: SPACE.md, borderRadius: RADIUS.md, alignItems: 'stretch' },
  bar: { width: 4, borderRadius: 2 },
});
