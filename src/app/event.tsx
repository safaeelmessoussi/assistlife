/** Create or edit an event. */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Chip, Row, ScreenHeader, Toggle } from '@/components/form';
import { DatePickerSheet, TimePickerSheet } from '@/components/pickers';
import { Button, Confirm, IconButton, Sheet, Txt } from '@/components/ui';
import { useGoogle } from '@/google/store';
import { useLocale, usePalette } from '@/hooks';
import type { StringKey } from '@/i18n/strings';
import { MIN_PER_DAY, formatTime, parseIso, today, toIso, weekday, type DayNum } from '@/lib/dates';
import type { RepeatFreq } from '@/lib/events';
import { googleLayerId, isGoogleId } from '@/lib/google';
import { layerName, useStore, type EventDraft } from '@/store';
import { FONT, RADIUS, SPACE } from '@/theme';

const REPEAT_LABEL: Record<RepeatFreq | 'none', StringKey> = {
  none: 'repeatNone',
  daily: 'repeatDaily',
  weekly: 'repeatWeekly',
  monthly: 'repeatMonthly',
  yearly: 'repeatYearly',
  hijriMonthly: 'repeatHijriMonthly',
  hijriYearly: 'repeatHijriYearly',
};
const REPEAT_OPTIONS = Object.keys(REPEAT_LABEL) as (RepeatFreq | 'none')[];

type Picker = 'date' | 'endDate' | 'start' | 'end' | 'repeat' | 'until' | 'delete' | null;

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return isGoogleId(id) ? <GoogleEventView id={id!} /> : <EventForm />;
}

/** An event that lives in Google Calendar: shown, not edited here. */
function GoogleEventView({ id }: { id: string }) {
  const p = usePalette();
  const { t, weekdayName, formatGregorian, formatHijri } = useLocale();
  const event = useGoogle((g) => g.events.find((e) => e.id === id));
  const calendar = useGoogle((g) => g.calendars.find((c) => googleLayerId(c.id) === event?.layerId));
  const day = parseIso(event?.date) ?? today();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: p.bg }]}>
      <ScreenHeader title={t('googleEvent')} />
      {event && (
        <ScrollView contentContainerStyle={styles.content}>
          <Txt weight="bold" size={22} style={{ marginBottom: SPACE.lg }} testID="google-event-title">
            {event.title}
          </Txt>
          <Card>
            <Row icon="calendar-outline" label={t('date')}>
              <View style={styles.dual}>
                <Txt weight="medium" numberOfLines={1}>
                  {weekdayName(day)} {formatGregorian(day)}
                </Txt>
                <Txt size={12} color={p.gold} numberOfLines={1}>
                  {formatHijri(day)}
                </Txt>
              </View>
            </Row>
            <Row
              icon="time-outline"
              label={event.allDay ? t('allDay') : t('starts')}
              value={event.allDay ? (event.spanDays > 1 ? `${event.spanDays} ${t('days')}` : '') : `${formatTime(event.startMin)} – ${formatTime(event.startMin + event.durationMin)}`}
            />
            {event.location && <Row icon="location-outline" label={t('location')} value={event.location} />}
            <Row icon="logo-google" label={t('layer')} value={calendar?.name ?? ''} last />
          </Card>
          {event.notes && (
            <Txt color={p.muted} style={{ marginTop: SPACE.lg }}>
              {event.notes}
            </Txt>
          )}
          <Txt size={13} color={p.muted} style={{ marginVertical: SPACE.lg }}>
            {t('googleReadOnly')}
          </Txt>
          {event.link && <Button label={t('openInGoogle')} icon="open-outline" kind="ghost" onPress={() => void Linking.openURL(event.link!)} testID="open-in-google" />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function EventForm() {
  const p = usePalette();
  const router = useRouter();
  const { t, lang, weekdays, weekdayName, formatGregorian, formatHijri } = useLocale();
  const params = useLocalSearchParams<{ id?: string; date?: string; start?: string }>();

  const layers = useStore((s) => s.layers);
  const weekStart = useStore((s) => s.settings.weekStart);
  const existing = useStore((s) => s.events.find((e) => e.id === params.id));
  const { addEvent, updateEvent, removeEvent } = useStore.getState();

  const initialStart = existing?.startMin ?? (params.start ? Number(params.start) || 0 : 9 * 60);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [layerId, setLayerId] = useState(existing?.layerId ?? layers[0].id);
  const [date, setDate] = useState<DayNum>(parseIso(existing?.date ?? params.date) ?? today());
  const [allDay, setAllDay] = useState(existing?.allDay ?? false);
  const [spanDays, setSpanDays] = useState(existing?.spanDays ?? 1);
  const [startMin, setStartMin] = useState(initialStart);
  const [durationMin, setDurationMin] = useState(existing?.durationMin ?? 60);
  const [freq, setFreq] = useState<RepeatFreq | 'none'>(existing?.repeat?.freq ?? 'none');
  const [weekdaysOn, setWeekdaysOn] = useState<number[]>(existing?.repeat?.weekdays ?? []);
  const [until, setUntil] = useState<DayNum | null>(parseIso(existing?.repeat?.until));
  const [location, setLocation] = useState(existing?.location ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [picker, setPicker] = useState<Picker>(null);
  const [error, setError] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const save = () => {
    if (!title.trim()) {
      setError(true);
      return;
    }
    const draft: EventDraft = {
      title: title.trim(),
      layerId,
      date: toIso(date),
      allDay,
      spanDays: allDay ? spanDays : 1,
      startMin: allDay ? 0 : startMin,
      durationMin: allDay ? 0 : durationMin,
      repeat:
        freq === 'none'
          ? undefined
          : {
              freq,
              interval: 1,
              ...(freq === 'weekly' && weekdaysOn.length ? { weekdays: weekdaysOn } : {}),
              ...(until !== null && until >= date ? { until: toIso(until) } : {}),
            },
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    if (existing) updateEvent(existing.id, draft);
    else addEvent(draft);
    close();
  };

  const dual = (day: DayNum) => `${weekdayName(day)} ${formatGregorian(day)}`;
  const endMin = (startMin + durationMin) % MIN_PER_DAY;
  const weekOrder = Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
  const activeWeekdays = weekdaysOn.length ? weekdaysOn : [weekday(date)];
  const input = [styles.input, { color: p.text, fontFamily: FONT.regular }];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: p.bg }]}>
      <ScreenHeader
        title={existing ? t('editEvent') : t('newEvent')}
        action={existing ? <IconButton icon="trash-outline" label={t('delete')} color={p.danger} onPress={() => setPicker('delete')} testID="delete" /> : undefined}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <TextInput
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              setError(false);
            }}
            placeholder={t('titlePlaceholder')}
            placeholderTextColor={p.faint}
            autoFocus={!existing}
            testID="title-input"
            accessibilityLabel={t('title')}
            style={[input, styles.titleInput, { fontFamily: FONT.semibold }]}
          />
        </Card>
        {error && (
          <Txt size={13} color={p.danger} style={styles.error} testID="title-error">
            {t('titleRequired')}
          </Txt>
        )}

        <View style={styles.layers}>
          {layers.map((layer) => (
            <Chip
              key={layer.id}
              label={layerName(layer, lang)}
              color={layer.color}
              active={layer.id === layerId}
              onPress={() => setLayerId(layer.id)}
              testID={`layer-${layer.id}`}
            />
          ))}
        </View>

        <Card>
          <Row icon="sunny-outline" label={t('allDay')}>
            <Toggle value={allDay} onChange={setAllDay} label={t('allDay')} testID="all-day" />
          </Row>
          <Row icon="calendar-outline" label={t('date')} onPress={() => setPicker('date')} testID="date-row">
            <View style={styles.dual}>
              <Txt weight="medium" color={p.primary} numberOfLines={1}>
                {dual(date)}
              </Txt>
              <Txt size={12} color={p.gold} numberOfLines={1}>
                {formatHijri(date)}
              </Txt>
            </View>
          </Row>
          {allDay ? (
            <Row icon="flag-outline" label={t('endDate')} value={dual(date + spanDays - 1)} onPress={() => setPicker('endDate')} testID="end-date-row" last />
          ) : (
            <>
              <Row icon="time-outline" label={t('starts')} value={formatTime(startMin)} onPress={() => setPicker('start')} testID="start-row" />
              <Row icon="time-outline" label={t('ends')} value={formatTime(endMin)} onPress={() => setPicker('end')} testID="end-row" last />
            </>
          )}
        </Card>

        <View style={{ height: SPACE.lg }} />
        <Card>
          <Row icon="repeat-outline" label={t('repeat')} value={t(REPEAT_LABEL[freq])} onPress={() => setPicker('repeat')} testID="repeat-row" last={freq === 'none'} />
          {freq === 'weekly' && (
            <View style={[styles.weekdays, { borderBottomColor: p.border }]}>
              {weekOrder.map((wd) => (
                <Chip
                  key={wd}
                  label={weekdays.short[wd]}
                  active={activeWeekdays.includes(wd)}
                  testID={`weekday-${wd}`}
                  onPress={() => {
                    const next = activeWeekdays.includes(wd) ? activeWeekdays.filter((d) => d !== wd) : [...activeWeekdays, wd];
                    setWeekdaysOn(next.length ? next.sort() : [weekday(date)]);
                  }}
                />
              ))}
            </View>
          )}
          {freq !== 'none' && (
            <Row icon="stop-circle-outline" label={t('repeatUntil')} value={until === null ? t('never') : formatGregorian(until)} onPress={() => setPicker('until')} testID="until-row" last>
              {until !== null && <IconButton icon="close-circle" label={t('clear')} color={p.muted} onPress={() => setUntil(null)} />}
            </Row>
          )}
        </Card>

        <View style={{ height: SPACE.lg }} />
        <Card>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder={t('location')}
            placeholderTextColor={p.faint}
            accessibilityLabel={t('location')}
            testID="location-input"
            style={[input, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.border }]}
          />
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t('notes')}
            placeholderTextColor={p.faint}
            accessibilityLabel={t('notes')}
            multiline
            testID="notes-input"
            style={[input, styles.notes]}
          />
        </Card>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: p.border, backgroundColor: p.surface }]}>
        <Button label={t('save')} onPress={save} icon="checkmark" style={{ flex: 1 }} testID="save" />
      </View>

      {picker === 'date' && (
        <DatePickerSheet
          title={t('date')}
          value={date}
          onClose={() => setPicker(null)}
          onPick={(day) => {
            setDate(day);
            setPicker(null);
          }}
        />
      )}
      {picker === 'endDate' && (
        <DatePickerSheet
          title={t('endDate')}
          value={date + spanDays - 1}
          min={date}
          onClose={() => setPicker(null)}
          onPick={(day) => {
            setSpanDays(day - date + 1);
            setPicker(null);
          }}
        />
      )}
      {picker === 'until' && (
        <DatePickerSheet
          title={t('repeatUntil')}
          value={until ?? date}
          min={date}
          onClose={() => setPicker(null)}
          onPick={(day) => {
            setUntil(day);
            setPicker(null);
          }}
        />
      )}
      {picker === 'start' && (
        <TimePickerSheet
          title={t('starts')}
          value={startMin}
          onClose={() => setPicker(null)}
          onPick={(minutes) => {
            setStartMin(minutes);
            setPicker(null);
          }}
        />
      )}
      {picker === 'end' && (
        <TimePickerSheet
          title={t('ends')}
          value={endMin}
          onClose={() => setPicker(null)}
          onPick={(minutes) => {
            // An end at or before the start means the event runs into the next day.
            setDurationMin(minutes > startMin ? minutes - startMin : minutes + MIN_PER_DAY - startMin);
            setPicker(null);
          }}
        />
      )}
      {picker === 'repeat' && (
        <Sheet title={t('repeat')} onClose={() => setPicker(null)} testID="repeat-sheet">
          <View style={{ gap: SPACE.sm }}>
            {REPEAT_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={t(REPEAT_LABEL[option])}
                active={option === freq}
                testID={`repeat-${option}`}
                onPress={() => {
                  setFreq(option);
                  setPicker(null);
                }}
              />
            ))}
          </View>
        </Sheet>
      )}
      {picker === 'delete' && existing && (
        <Confirm
          message={existing.repeat ? t('deleteSeriesConfirm') : t('deleteEventConfirm')}
          confirmLabel={t('delete')}
          onCancel={() => setPicker(null)}
          onConfirm={() => {
            removeEvent(existing.id);
            close();
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.lg, paddingTop: SPACE.xs, width: '100%', maxWidth: 640, alignSelf: 'center' },
  input: { minHeight: 52, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, fontSize: 15, borderRadius: RADIUS.md },
  titleInput: { fontSize: 19, minHeight: 60 },
  error: { marginTop: SPACE.xs, paddingHorizontal: SPACE.xs },
  layers: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginVertical: SPACE.lg },
  dual: { alignItems: 'flex-end', flexShrink: 1 },
  weekdays: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderBottomWidth: StyleSheet.hairlineWidth },
  notes: { minHeight: 96, textAlignVertical: 'top' },
  footer: { flexDirection: 'row', padding: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth },
});
