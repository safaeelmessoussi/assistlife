/** Date and time pickers shared by every platform, so both calendars show while choosing a date. */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, IconButton, Sheet, Txt } from '@/components/ui';
import { useLocale, usePalette } from '@/hooks';
import { addMonths, formatTime, fromDayNum, monthGrid, today, weekday, type DayNum } from '@/lib/dates';
import { useStore } from '@/store';
import { RADIUS, SPACE } from '@/theme';

export function DatePickerSheet({
  title,
  value,
  min,
  onPick,
  onClose,
}: {
  title: string;
  value: DayNum;
  min?: DayNum;
  onPick: (day: DayNum) => void;
  onClose: () => void;
}) {
  const p = usePalette();
  const { months, hijriMonths, hijri, weekdays, rtl, t } = useLocale();
  const weekStart = useStore((s) => s.settings.weekStart);
  const initial = fromDayNum(value);
  const [cursor, setCursor] = useState({ y: initial.y, m: initial.m });
  const weeks = monthGrid(cursor.y, cursor.m, weekStart);
  const first = hijri(weeks[1][0]);
  const todayDay = today();

  return (
    <Sheet title={title} onClose={onClose} testID="date-picker">
      <View style={styles.nav}>
        <IconButton icon={rtl ? 'chevron-forward' : 'chevron-back'} label={t('previous')} onPress={() => setCursor(addMonths(cursor.y, cursor.m, -1))} />
        <View style={{ alignItems: 'center' }}>
          <Txt weight="semibold">
            {months[cursor.m - 1]} {cursor.y}
          </Txt>
          <Txt size={12} color={p.gold}>
            {hijriMonths[first.month - 1]} {first.year}
          </Txt>
        </View>
        <IconButton icon={rtl ? 'chevron-back' : 'chevron-forward'} label={t('next')} onPress={() => setCursor(addMonths(cursor.y, cursor.m, 1))} testID="date-picker-next" />
      </View>

      <View style={styles.row}>
        {weeks[0].map((day) => (
          <Txt key={day} size={11} color={p.muted} style={styles.weekday} numberOfLines={1}>
            {weekdays.short[weekday(day)]}
          </Txt>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0]} style={styles.row}>
          {week.map((day) => {
            const g = fromDayNum(day);
            const disabled = min !== undefined && day < min;
            const selected = day === value;
            const inMonth = g.m === cursor.m;
            return (
              <Pressable
                key={day}
                disabled={disabled}
                onPress={() => onPick(day)}
                testID={`pick-${g.y}-${g.m}-${g.d}`}
                style={[
                  styles.day,
                  selected && { backgroundColor: p.primary },
                  !selected && day === todayDay && { borderWidth: 1, borderColor: p.primary },
                  disabled && { opacity: 0.3 },
                ]}>
                <Txt size={14} weight="semibold" color={selected ? p.onPrimary : inMonth ? p.text : p.faint} style={{ lineHeight: 18 }}>
                  {g.d}
                </Txt>
                <Txt size={10} color={selected ? p.onPrimary : inMonth ? p.gold : p.faint} style={{ lineHeight: 13 }}>
                  {hijri(day).day}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      ))}
    </Sheet>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export function TimePickerSheet({
  title,
  value,
  onPick,
  onClose,
}: {
  title: string;
  value: number;
  onPick: (minutes: number) => void;
  onClose: () => void;
}) {
  const p = usePalette();
  const { t } = useLocale();
  const [hour, setHour] = useState(Math.floor(value / 60) % 24);
  const [minute, setMinute] = useState(value % 60);

  const cell = (label: string, active: boolean, onPress: () => void, testID: string) => (
    <Pressable key={testID} onPress={onPress} testID={testID} style={[styles.timeCell, { borderColor: p.border }, active && { backgroundColor: p.primary, borderColor: p.primary }]}>
      <Txt size={14} weight={active ? 'bold' : 'medium'} color={active ? p.onPrimary : p.text}>
        {label}
      </Txt>
    </Pressable>
  );

  return (
    <Sheet
      title={`${title}  ·  ${formatTime(hour * 60 + minute)}`}
      onClose={onClose}
      testID="time-picker"
      footer={<Button label={t('done')} onPress={() => onPick(hour * 60 + minute)} style={{ flex: 1 }} testID="time-done" />}>
      <Txt size={12} color={p.muted} style={styles.timeLabel}>
        {t('hour')}
      </Txt>
      {/* Clock digits read left to right in every language. */}
      <View style={[styles.timeGrid, { direction: 'ltr' }]}>
        {HOURS.map((h) => cell(String(h).padStart(2, '0'), h === hour, () => setHour(h), `hour-${h}`))}
      </View>
      <Txt size={12} color={p.muted} style={styles.timeLabel}>
        {t('minute')}
      </Txt>
      <View style={[styles.timeGrid, { direction: 'ltr' }]}>
        {MINUTES.map((m) => cell(String(m).padStart(2, '0'), m === minute, () => setMinute(m), `minute-${m}`))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.sm },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center' },
  day: { flex: 1, height: 44, margin: 1, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  timeLabel: { marginBottom: SPACE.xs, marginTop: SPACE.sm },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timeCell: { width: '15%', flexGrow: 1, height: 40, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
