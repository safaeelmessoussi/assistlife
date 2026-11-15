/** Hour-by-hour grid for one day or a whole week. */
import { useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Txt } from '@/components/ui';
import { useLocale, usePalette } from '@/hooks';
import { formatTime, fromDayNum, weekday, type DayNum } from '@/lib/dates';
import { layoutColumns, minutesOnDay, type Occurrence } from '@/lib/events';
import { PRAYERS, type DayPrayers } from '@/lib/prayer';
import type { Layer } from '@/store';
import { RADIUS, tint } from '@/theme';

const HOUR_H = 52;
const GUTTER_W = 46;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

type Props = {
  days: DayNum[];
  selected: DayNum;
  now: { day: DayNum; minutes: number };
  /** When given, each day shows a fine line at every prayer time. */
  prayers?: (day: DayNum) => DayPrayers;
  byDay: Map<DayNum, Occurrence[]>;
  layers: Map<string, Layer>;
  onSelect: (day: DayNum) => void;
  onCreate: (day: DayNum, startMin?: number) => void;
  onOpenEvent: (id: string) => void;
};

export function TimeGrid({ days, selected, now, prayers, byDay, layers, onSelect, onCreate, onOpenEvent }: Props) {
  const p = usePalette();
  const { weekdays, hijri, hijriMonths, t, prayerName } = useLocale();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const single = days.length === 1;
  const { width } = useWindowDimensions();
  // Seven columns on a phone are too narrow for a readable time range.
  const showTimes = single || width >= 700;

  useEffect(() => {
    // Open on the working part of the day, not on midnight.
    const target = days.includes(now.day) ? now.minutes - 90 : 7 * 60;
    scroll.current?.scrollTo({ y: Math.max(0, (target / 60) * HOUR_H), animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0], days.length]);

  const allDay = days.map((day) => (byDay.get(day) ?? []).filter((o) => o.event.allDay));
  const hasAllDay = allDay.some((list) => list.length > 0);

  return (
    <View style={styles.root}>
      <View style={[styles.headRow, { borderBottomColor: p.border }]}>
        <View style={{ width: GUTTER_W }} />
        {days.map((day) => {
          const g = fromDayNum(day);
          const h = hijri(day);
          const isToday = day === now.day;
          const isSelected = day === selected && !single;
          return (
            <Pressable
              key={day}
              onPress={() => onSelect(day)}
              testID={`col-${g.y}-${g.m}-${g.d}`}
              style={[styles.headCell, isSelected && { backgroundColor: p.primarySoft }]}>
              <Txt size={11} weight="medium" color={weekday(day) === 5 ? p.gold : p.muted} numberOfLines={1}>
                {single ? weekdays.long[weekday(day)] : weekdays.short[weekday(day)]}
              </Txt>
              <View style={[styles.dayBadge, isToday && { backgroundColor: p.primary }]}>
                <Txt size={15} weight="bold" color={isToday ? p.onPrimary : p.text}>
                  {g.d}
                </Txt>
              </View>
              <Txt size={11} weight="medium" color={p.gold} numberOfLines={1}>
                {single ? `${h.day} ${hijriMonths[h.month - 1]}` : h.day}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      {hasAllDay && (
        <View style={[styles.allDayRow, { borderBottomColor: p.border }]}>
          <View style={[styles.allDayLabel, { width: GUTTER_W }]}>
            <Txt size={9} color={p.muted} numberOfLines={2} style={{ textAlign: 'center', lineHeight: 12 }}>
              {t('allDay')}
            </Txt>
          </View>
          {allDay.map((list, i) => (
            <View key={days[i]} style={[styles.allDayCell, { borderStartColor: p.border }]}>
              {list.map((occ) => {
                const color = layers.get(occ.event.layerId)?.color ?? p.muted;
                return (
                  <Pressable
                    key={`${occ.event.id}:${occ.day}`}
                    onPress={() => onOpenEvent(occ.event.id)}
                    style={[styles.allDayChip, { backgroundColor: tint(color, 0.2), borderStartColor: color }]}>
                    <Txt size={11} weight="medium" numberOfLines={1} style={{ lineHeight: 18 }}>
                      {occ.event.title}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}

      <ScrollView ref={scroll} style={styles.scroll} testID="time-grid">
        <View style={styles.body}>
          <View style={{ width: GUTTER_W }}>
            {HOURS.map((h) => (
              <View key={h} style={styles.hourLabel}>
                {h > 0 && (
                  <Txt size={10} color={p.muted} style={styles.hourText}>
                    {formatTime(h * 60)}
                  </Txt>
                )}
              </View>
            ))}
          </View>

          {days.map((day) => {
            const timed = (byDay.get(day) ?? []).filter((o) => !o.event.allDay);
            const placed = layoutColumns(timed, (o) => minutesOnDay(o, day));
            return (
              <View key={day} style={[styles.dayColumn, { borderStartColor: p.border }]}>
                {HOURS.map((h) => (
                  <Pressable
                    key={h}
                    accessibilityLabel={`${t('addEvent')} ${formatTime(h * 60)}`}
                    onPress={(e) => onCreate(day, h * 60 + (e.nativeEvent.locationY > HOUR_H / 2 ? 30 : 0))}
                    style={[styles.hourSlot, { borderTopColor: p.border }]}
                  />
                ))}

                {prayers &&
                  PRAYERS.map((name) => {
                    const at = prayers(day)[name];
                    if (at < 0) return null;
                    return (
                      <View key={name} pointerEvents="none" style={[styles.prayerLine, { top: (at / 60) * HOUR_H }]} testID={single ? `mark-${name}` : undefined}>
                        <View style={[styles.prayerRule, { backgroundColor: p.gold, opacity: name === 'sunrise' ? 0.35 : 0.7 }]} />
                        {showTimes && (
                          <Txt size={9} weight="medium" color={p.gold} style={[styles.prayerLabel, { backgroundColor: p.surface }]} numberOfLines={1}>
                            {single ? `${prayerName(name)} ${formatTime(at)}` : prayerName(name)}
                          </Txt>
                        )}
                      </View>
                    );
                  })}

                {placed.map(({ item: occ, column, columns }) => {
                  const { start, end } = minutesOnDay(occ, day);
                  const color = layers.get(occ.event.layerId)?.color ?? p.muted;
                  const height = Math.max(20, ((end - start) / 60) * HOUR_H - 2);
                  return (
                    <Pressable
                      key={`${occ.event.id}:${occ.day}`}
                      onPress={() => onOpenEvent(occ.event.id)}
                      testID={`event-${occ.event.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${occ.event.title} ${formatTime(occ.event.startMin)}`}
                      style={[
                        styles.event,
                        {
                          top: (start / 60) * HOUR_H + 1,
                          height,
                          left: `${(column / columns) * 100}%`,
                          width: `${100 / columns}%`,
                        },
                      ]}>
                      {/* Solid backing so the hour lines do not show through the tint. */}
                      <View style={[styles.eventBack, { backgroundColor: p.surface }]}>
                      <View style={[styles.eventCard, { backgroundColor: tint(color, 0.22), borderStartColor: color }]}>
                        <Txt size={single ? 13 : 11} weight="semibold" numberOfLines={Math.max(1, Math.floor((height - 4) / (single ? 18 : 15)) - (showTimes && height >= 38 ? 1 : 0))} style={{ lineHeight: single ? 18 : 15 }}>
                          {occ.event.title}
                        </Txt>
                        {showTimes && height >= 38 && (
                          <Txt size={10} color={p.muted} numberOfLines={1} style={{ lineHeight: 14 }}>
                            {formatTime(occ.event.startMin)} – {formatTime(occ.event.startMin + occ.event.durationMin)}
                          </Txt>
                        )}
                      </View>
                      </View>
                    </Pressable>
                  );
                })}

                {day === now.day && (
                  <View pointerEvents="none" style={[styles.nowLine, { top: (now.minutes / 60) * HOUR_H, backgroundColor: p.danger }]} />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  headCell: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 4, gap: 1 },
  dayBadge: { minWidth: 28, height: 28, paddingHorizontal: 4, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  allDayRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  allDayLabel: { alignItems: 'center', justifyContent: 'center' },
  allDayCell: { flex: 1, minWidth: 0, borderStartWidth: StyleSheet.hairlineWidth, padding: 2, gap: 2 },
  allDayChip: { borderRadius: 4, borderStartWidth: 3, paddingHorizontal: 3 },
  scroll: { flex: 1 },
  body: { flexDirection: 'row', height: HOUR_H * 24 },
  hourLabel: { height: HOUR_H, alignItems: 'center' },
  hourText: { marginTop: -8, lineHeight: 16 },
  dayColumn: { flex: 1, minWidth: 0, borderStartWidth: StyleSheet.hairlineWidth },
  hourSlot: { height: HOUR_H, borderTopWidth: StyleSheet.hairlineWidth },
  event: { position: 'absolute', paddingHorizontal: 1 },
  eventBack: { flex: 1, borderRadius: 5, overflow: 'hidden' },
  eventCard: { flex: 1, borderRadius: 5, borderStartWidth: 3, paddingHorizontal: 4, paddingVertical: 1, overflow: 'hidden' },
  prayerLine: { position: 'absolute', left: 0, right: 0, height: 12, marginTop: -6, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  prayerRule: { position: 'absolute', left: 0, right: 0, top: 6, height: 1 },
  prayerLabel: { paddingHorizontal: 3, lineHeight: 12 },
  nowLine: { position: 'absolute', left: 0, right: 0, height: 2 },
});
