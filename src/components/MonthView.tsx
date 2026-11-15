/** Month grid: seven columns at every width, both dates in every cell. */
import { useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui';
import { useLocale, usePalette } from '@/hooks';
import { fromDayNum, monthGrid, weekday, type DayNum } from '@/lib/dates';
import type { Occurrence } from '@/lib/events';
import type { Layer } from '@/store';
import { RADIUS, tint } from '@/theme';

const HEADER_H = 26;
const CHIP_H = 19;

type Props = {
  year: number;
  month: number;
  weekStart: number;
  selected: DayNum;
  todayDay: DayNum;
  byDay: Map<DayNum, Occurrence[]>;
  layers: Map<string, Layer>;
  onSelect: (day: DayNum) => void;
  onOpenDay: (day: DayNum) => void;
  onSwipe: (direction: 1 | -1) => void;
};

export function MonthView({ year, month, weekStart, selected, todayDay, byDay, layers, onSelect, onOpenDay, onSwipe }: Props) {
  const p = usePalette();
  const { weekdays, hijri, hijriMonths, rtl, formatGregorian, formatHijri } = useLocale();
  const weeks = useMemo(() => monthGrid(year, month, weekStart), [year, month, weekStart]);
  const [gridHeight, setGridHeight] = useState(0);
  const [cellWidth, setCellWidth] = useState(0);

  const rowHeight = gridHeight / weeks.length;
  const capacity = Math.max(0, Math.floor((rowHeight - HEADER_H - 4) / (CHIP_H + 2)));
  const compact = cellWidth > 0 && cellWidth < 64;

  // Swiping follows reading direction: in Arabic the next month lies to the left, so the finger moves right.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) < 48) return;
          onSwipe((rtl ? g.dx > 0 : g.dx < 0) ? 1 : -1);
        },
      }),
    [onSwipe, rtl],
  );

  return (
    <View style={styles.root}>
      <View style={[styles.weekdayRow, { borderBottomColor: p.border }]}>
        {weeks[0].map((day) => {
          const wd = weekday(day);
          return (
            <View key={wd} style={styles.weekdayCell}>
              <Txt size={12} weight="medium" color={wd === 5 ? p.gold : p.muted} numberOfLines={1}>
                {compact ? weekdays.short[wd] : weekdays.long[wd]}
              </Txt>
            </View>
          );
        })}
      </View>

      <View
        style={styles.grid}
        onLayout={(e) => {
          // A hidden screen reports zero; keep the last real size so chips do not flash away.
          const { width, height } = e.nativeEvent.layout;
          if (width === 0 || height === 0) return;
          setGridHeight(height);
          setCellWidth(width / 7);
        }}
        {...pan.panHandlers}>
        {weeks.map((week) => (
          <View key={week[0]} style={[styles.week, { borderBottomColor: p.border }]}>
            {week.map((day) => {
              const g = fromDayNum(day);
              const h = hijri(day);
              const inMonth = g.m === month;
              const isToday = day === todayDay;
              const isSelected = day === selected;
              const occurrences = byDay.get(day) ?? [];
              // A day with events always names at least one; the rest are counted.
              const shown = occurrences.length > capacity ? Math.max(1, capacity - 1) : occurrences.length;
              const hidden = occurrences.length - shown;
              // With room for a single line, the count moves up beside the dates.
              const countInHeader = hidden > 0 && capacity < 2;
              const count = hidden > 0 && (
                <View style={[styles.count, { backgroundColor: tint(p.primary, isSelected ? 0.28 : 0.16) }]}>
                  {/* The mark keeps the plus sign in front of the number in right-to-left text. */}
                  <Txt size={11} weight="bold" color={p.primary} style={styles.countText}>
                    {`\u200E+${hidden}`}
                  </Txt>
                </View>
              );
              return (
                <Pressable
                  key={day}
                  testID={`day-${g.y}-${g.m}-${g.d}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatGregorian(day)} — ${formatHijri(day)}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => (isSelected ? onOpenDay(day) : onSelect(day))}
                  style={[
                    styles.cell,
                    { borderEndColor: p.border, backgroundColor: isSelected ? p.primarySoft : inMonth ? p.surface : p.surfaceAlt },
                    isSelected && { borderColor: p.primary, borderEndColor: p.primary, borderWidth: 1.5, borderEndWidth: 1.5 },
                  ]}>
                  <View style={styles.cellHeader}>
                    <View style={[styles.dayBadge, isToday && { backgroundColor: p.primary }]}>
                      <Txt size={14} weight={isToday ? 'bold' : 'semibold'} color={isToday ? p.onPrimary : inMonth ? p.text : p.faint}>
                        {g.d}
                      </Txt>
                    </View>
                    {countInHeader && count}
                    <Txt size={11} weight="medium" color={inMonth ? p.gold : p.faint} numberOfLines={1} style={styles.hijri}>
                      {h.day === 1 && !compact ? `${h.day} ${hijriMonths[h.month - 1]}` : h.day}
                    </Txt>
                  </View>

                  {occurrences.slice(0, shown).map((occ) => {
                    const color = layers.get(occ.event.layerId)?.color ?? p.muted;
                    return (
                      <View
                        key={`${occ.event.id}:${occ.day}`}
                        style={[styles.chip, { backgroundColor: tint(color, inMonth ? 0.18 : 0.08), borderStartColor: color }]}>
                        <Txt size={11} weight="medium" numberOfLines={1} color={inMonth ? p.text : p.faint} style={styles.chipText}>
                          {occ.event.title}
                        </Txt>
                      </View>
                    );
                  })}
                  {!countInHeader && count && <View style={styles.countRow}>{count}</View>}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  weekdayRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  weekdayCell: { flex: 1, alignItems: 'center' },
  grid: { flex: 1 },
  week: { flex: 1, flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { flex: 1, minWidth: 0, borderEndWidth: StyleSheet.hairlineWidth, overflow: 'hidden', paddingHorizontal: 2 },
  cellHeader: { height: HEADER_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2 },
  dayBadge: { minWidth: 24, height: 24, paddingHorizontal: 4, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  hijri: { flexShrink: 1, paddingEnd: 2 },
  chip: { height: CHIP_H, marginBottom: 2, borderRadius: 4, borderStartWidth: 3, paddingHorizontal: 3, justifyContent: 'center' },
  chipText: { lineHeight: CHIP_H },
  count: { height: 16, minWidth: 22, paddingHorizontal: 4, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  countText: { lineHeight: 16 },
  countRow: { flexDirection: 'row' },
});
