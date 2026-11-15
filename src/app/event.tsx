/** Create or edit an event. */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Chip, Row, ScreenHeader, Toggle } from '@/components/form';
import { DatePickerSheet, TimePickerSheet } from '@/components/pickers';
import { Button, Confirm, IconButton, Sheet, Txt } from '@/components/ui';
import { deleteGoogleEvent, googleLayers, saveGoogleEvent, useGoogle } from '@/google/store';
import { ISLAMIC_CONTENT } from '@/content/islamic';
import { useLocale, usePalette, usePrayerTimes } from '@/hooks';
import type { StringKey } from '@/i18n/strings';
import { MIN_PER_DAY, formatTime, parseIso, today, toIso, weekday, type DayNum } from '@/lib/dates';
import type { RepeatFreq } from '@/lib/events';
import { googleCanRepeat, googleLayerId, isGoogleId } from '@/lib/google';
import { isSystemId, systemKey } from '@/lib/islamic';
import { coveredPrayers, PRAYERS, resolveAnchor, type Anchor } from '@/lib/prayer';
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

type Picker = 'date' | 'endDate' | 'start' | 'end' | 'anchor' | 'repeat' | 'until' | 'delete' | null;

const ANCHOR_MINUTES = [5, 10, 15, 20, 30, 45, 60, 90];

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const googleEvent = useGoogle((g) => (isGoogleId(id) ? g.events.find((e) => e.id === id) : undefined));
  const writable = useGoogle((g) => g.calendars.find((c) => googleLayerId(c.id) === googleEvent?.layerId)?.writable === true);
  if (isSystemId(id)) return <SystemEventView id={id!} />;
  // Events of a calendar the user may not change (holidays, shared read-only ones) are shown, not edited.
  return isGoogleId(id) && !writable ? <GoogleEventView id={id!} /> : <EventForm />;
}

/** A fasting day, an occasion or a remembrance time: what it is, and the evidence for it. */
function SystemEventView({ id }: { id: string }) {
  const p = usePalette();
  const { t, lang, weekdayName, formatGregorian, formatHijri } = useLocale();
  const content = ISLAMIC_CONTENT[systemKey(id)];
  const day = Number(id.split(':')[3]) || today();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: p.bg }]}>
      <ScreenHeader title={content?.title[lang] ?? ''} />
      {content && (
        <ScrollView contentContainerStyle={styles.content}>
          <Txt weight="medium" testID="system-date">
            {weekdayName(day)} {formatGregorian(day)}
          </Txt>
          <Txt size={13} color={p.gold} style={{ marginBottom: SPACE.lg }}>
            {formatHijri(day)}
          </Txt>
          <Txt size={16} style={{ marginBottom: SPACE.lg }} testID="system-note">
            {content.note[lang]}
          </Txt>
          {content.evidence && (
            <Card>
              <View style={styles.evidence}>
                {/* The verse or hadith is always shown in Arabic, whatever the app's language. */}
                <Txt size={18} weight="medium" style={styles.evidenceText} testID="system-evidence">
                  «{content.evidence.text}»
                </Txt>
                <Txt size={12} color={p.muted} style={styles.evidenceSource} testID="system-source">
                  {t('source')}: {content.evidence.source}
                </Txt>
              </View>
            </Card>
          )}
          <Txt size={11} color={p.faint} style={{ marginTop: SPACE.md }}>
            {t('pendingReview')}
          </Txt>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** An event from a read-only Google calendar: shown, not edited here. */
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
  const { t, lang, weekdays, weekdayName, formatGregorian, formatHijri, prayerName, formatAnchor } = useLocale();
  const prayers = usePrayerTimes();
  const params = useLocalSearchParams<{ id?: string; date?: string; start?: string }>();

  const ownLayers = useStore((s) => s.layers);
  const googleCalendars = useGoogle((g) => g.calendars);
  const weekStart = useStore((s) => s.settings.weekStart);
  const ownEvent = useStore((s) => s.events.find((e) => e.id === params.id));
  const googleEvent = useGoogle((g) => g.events.find((e) => e.id === params.id));
  const existing = ownEvent ?? googleEvent;
  const { addEvent, updateEvent, removeEvent } = useStore.getState();

  // A new event may go to one of the user's own calendars or to a Google calendar they may write to.
  // An existing event stays in the kind of calendar it lives in.
  const googleChoices = googleLayers(googleCalendars.filter((c) => c.writable));
  const layers = googleEvent ? googleChoices.filter((l) => l.id === googleEvent.layerId) : ownEvent ? ownLayers : [...ownLayers, ...googleChoices];

  const initialStart = existing?.startMin ?? (params.start ? Number(params.start) || 0 : 9 * 60);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [layerId, setLayerId] = useState(existing?.layerId ?? layers[0].id);
  const [date, setDate] = useState<DayNum>(parseIso(existing?.date ?? params.date) ?? today());
  const [allDay, setAllDay] = useState(existing?.allDay ?? false);
  const [spanDays, setSpanDays] = useState(existing?.spanDays ?? 1);
  const [fixedStart, setStartMin] = useState(initialStart);
  const [anchor, setAnchor] = useState<Anchor | null>(existing?.anchor ?? null);
  const [durationMin, setDurationMin] = useState(existing?.durationMin ?? 60);
  const [freq, setFreq] = useState<RepeatFreq | 'none'>(existing?.repeat?.freq ?? 'none');
  const [weekdaysOn, setWeekdaysOn] = useState<number[]>(existing?.repeat?.weekdays ?? []);
  const [until, setUntil] = useState<DayNum | null>(parseIso(existing?.repeat?.until));
  const [location, setLocation] = useState(existing?.location ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [picker, setPicker] = useState<Picker>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleError, setGoogleError] = useState(false);

  const inGoogle = isGoogleId(layerId);
  // Tied to a prayer, the start is whatever that prayer gives on the chosen day.
  const tied = anchor !== null && !allDay && !inGoogle;
  const startMin = tied ? resolveAnchor(anchor, prayers(date)) : fixedStart;
  const covered = allDay ? [] : coveredPrayers(prayers(date), startMin, startMin + durationMin);
  // Google has no Hijri calendar, and one occurrence of a Google series cannot carry its own repeat.
  const repeatOptions = REPEAT_OPTIONS.filter((option) => !inGoogle || option === 'none' || googleCanRepeat(option));
  const canRepeat = !googleEvent;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const chooseLayer = (id: string) => {
    setLayerId(id);
    if (isGoogleId(id) && freq !== 'none' && !googleCanRepeat(freq)) setFreq('none');
  };

  const save = async () => {
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
      anchor: tied ? anchor : undefined,
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
    if (inGoogle) {
      setBusy(true);
      setGoogleError(false);
      const ok = await saveGoogleEvent(draft, googleEvent?.id);
      setBusy(false);
      if (!ok) return setGoogleError(true);
    } else if (existing) updateEvent(existing.id, draft);
    else addEvent(draft);
    close();
  };

  const remove = async () => {
    if (!existing) return;
    setPicker(null);
    if (googleEvent) {
      setBusy(true);
      setGoogleError(false);
      const ok = await deleteGoogleEvent(googleEvent.id);
      setBusy(false);
      if (!ok) return setGoogleError(true);
    } else removeEvent(existing.id);
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

        {googleEvent?.series && (
          <Txt size={13} color={p.gold} style={styles.error} testID="occurrence-note">
            {t('googleOccurrence')}
          </Txt>
        )}

        <View style={styles.layers}>
          {layers.map((layer) => (
            <Chip
              key={layer.id}
              label={layerName(layer, lang)}
              color={layer.color}
              active={layer.id === layerId}
              onPress={() => chooseLayer(layer.id)}
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
              <Row
                icon="time-outline"
                label={t('starts')}
                value={formatTime(startMin)}
                onPress={tied ? undefined : () => setPicker('start')}
                testID="start-row"
              />
              {!inGoogle && (
                <Row
                  icon="moon-outline"
                  label={t('withPrayer')}
                  value={tied ? formatAnchor(anchor) : t('fixedTime')}
                  onPress={() => setPicker('anchor')}
                  testID="anchor-row"
                />
              )}
              <Row icon="time-outline" label={t('ends')} value={formatTime(endMin)} onPress={() => setPicker('end')} testID="end-row" last />
            </>
          )}
        </Card>

        {covered.length > 0 && (
          <Txt size={13} color={p.danger} style={styles.error} testID="form-conflict">
            {t('coversPrayer')} {covered.map(prayerName).join('، ')}. {t('coversPrayerHint')}
          </Txt>
        )}

        <View style={{ height: SPACE.lg }} />
        {canRepeat && (
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
        )}

        {canRepeat && <View style={{ height: SPACE.lg }} />}
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

      {googleError && (
        <Txt size={13} color={p.danger} style={styles.footerError} testID="google-save-error">
          {t('googleSaveError')}
        </Txt>
      )}
      <View style={[styles.footer, { borderTopColor: p.border, backgroundColor: p.surface }]}>
        <Button
          label={busy ? t('working') : t('save')}
          onPress={() => {
            if (!busy) void save();
          }}
          icon="checkmark"
          style={{ flex: 1 }}
          testID="save"
        />
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
      {picker === 'anchor' && (
        <Sheet
          title={t('withPrayer')}
          onClose={() => setPicker(null)}
          testID="anchor-sheet"
          footer={
            <>
              <Button
                label={t('fixedTime')}
                kind="ghost"
                style={{ flex: 1 }}
                testID="anchor-clear"
                onPress={() => {
                  // Keep the time the prayer gave today as the fixed time.
                  setStartMin(startMin);
                  setAnchor(null);
                  setPicker(null);
                }}
              />
              <Button
                label={t('done')}
                style={{ flex: 1 }}
                testID="anchor-done"
                onPress={() => {
                  setAnchor(anchor ?? { prayer: 'asr', offsetMin: 0 });
                  setPicker(null);
                }}
              />
            </>
          }>
          <View style={styles.chips}>
            {PRAYERS.map((name) => (
              <Chip
                key={name}
                label={prayerName(name)}
                active={(anchor?.prayer ?? 'asr') === name}
                testID={`anchor-${name}`}
                onPress={() => setAnchor({ prayer: name, offsetMin: anchor?.offsetMin ?? 0 })}
              />
            ))}
          </View>
          <View style={[styles.chips, { marginTop: SPACE.lg }]}>
            {([-1, 0, 1] as const).map((sign) => (
              <Chip
                key={sign}
                label={t(sign < 0 ? 'anchorBefore' : sign > 0 ? 'anchorAfter' : 'anchorAt')}
                active={Math.sign(anchor?.offsetMin ?? 0) === sign}
                testID={`anchor-sign-${sign}`}
                onPress={() => setAnchor({ prayer: anchor?.prayer ?? 'asr', offsetMin: sign * (Math.abs(anchor?.offsetMin ?? 0) || 15) })}
              />
            ))}
          </View>
          {(anchor?.offsetMin ?? 0) !== 0 && (
            <View style={[styles.chips, { marginTop: SPACE.lg }]}>
              {ANCHOR_MINUTES.map((minutes) => (
                <Chip
                  key={minutes}
                  label={`${minutes} ${t('minutesShort')}`}
                  active={Math.abs(anchor!.offsetMin) === minutes}
                  testID={`anchor-min-${minutes}`}
                  onPress={() => setAnchor({ prayer: anchor!.prayer, offsetMin: Math.sign(anchor!.offsetMin) * minutes })}
                />
              ))}
            </View>
          )}
        </Sheet>
      )}
      {picker === 'repeat' && (
        <Sheet title={t('repeat')} onClose={() => setPicker(null)} testID="repeat-sheet">
          <View style={{ gap: SPACE.sm }}>
            {repeatOptions.map((option) => (
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
          message={t(existing.series ? 'deleteOccurrenceConfirm' : existing.repeat ? 'deleteSeriesConfirm' : 'deleteEventConfirm')}
          confirmLabel={t('delete')}
          onCancel={() => setPicker(null)}
          onConfirm={() => void remove()}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  evidence: { padding: SPACE.lg, gap: SPACE.md },
  evidenceText: { lineHeight: 32, writingDirection: 'rtl', textAlign: 'right' },
  evidenceSource: { writingDirection: 'rtl', textAlign: 'right' },
  footerError: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, textAlign: 'center' },
  footer: { flexDirection: 'row', padding: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth },
});
