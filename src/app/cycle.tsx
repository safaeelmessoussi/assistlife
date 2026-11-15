/** The optional cycle layer: switch it on, import a tracker's backup, record periods. */
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Row, ScreenHeader, SectionTitle, Toggle } from '@/components/form';
import { DatePickerSheet } from '@/components/pickers';
import { Button, Confirm, IconButton, Txt } from '@/components/ui';
import { addPeriods, removePeriod, setCycleEnabled, useCycle } from '@/cycle/store';
import { useLocale, usePalette } from '@/hooks';
import { parsePeriodBackup } from '@/lib/cycle/pcBackup';
import { cycleStats } from '@/lib/cycle/predict';
import { parseIso, today, toIso, type DayNum } from '@/lib/dates';
import { SPACE } from '@/theme';

/** Let the user pick a file in the browser and hand back its bytes; null when they cancel. */
function pickFile(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pc,application/octet-stream';
    input.setAttribute('data-testid', 'cycle-file');
    input.style.display = 'none';
    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      resolve(file ? new Uint8Array(await file.arrayBuffer()) : null);
    };
    input.oncancel = () => {
      input.remove();
      resolve(null);
    };
    document.body.appendChild(input);
    input.click();
  });
}

export default function CycleScreen() {
  const p = usePalette();
  const { t, weekdayName, formatGregorian, formatHijri } = useLocale();
  const enabled = useCycle((c) => c.enabled);
  const periods = useCycle((c) => c.periods);

  const [result, setResult] = useState<{ ok: boolean; added?: number } | null>(null);
  const [start, setStart] = useState<DayNum>(today());
  const [days, setDays] = useState(5);
  const [picking, setPicking] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const stats = cycleStats(periods);
  const newestFirst = [...periods].reverse();
  const listed = showAll ? newestFirst : newestFirst.slice(0, 6);

  const importBackup = async () => {
    setResult(null);
    const bytes = await pickFile();
    if (!bytes) return;
    try {
      setResult({ ok: true, added: addPeriods(parsePeriodBackup(bytes)) });
    } catch {
      setResult({ ok: false });
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: p.bg }]}>
      <ScreenHeader title={t('cycle')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Txt color={p.muted} style={styles.paragraph}>
          {t('cycleIntro')}
        </Txt>
        <Txt color={p.muted} size={13} style={styles.paragraph}>
          {t('cyclePrivacy')}
        </Txt>

        <Card>
          <Row icon="water-outline" label={t('cycleShow')} last>
            <Toggle value={enabled} onChange={setCycleEnabled} label={t('cycleShow')} testID="cycle-enabled" />
          </Row>
        </Card>

        <SectionTitle>{t('cycleImport')}</SectionTitle>
        {Platform.OS === 'web' ? (
          <Button label={t('cycleImport')} icon="download-outline" kind="ghost" onPress={() => void importBackup()} testID="cycle-import" />
        ) : (
          <Txt color={p.muted}>{t('cycleImportWebOnly')}</Txt>
        )}
        <Txt size={12} color={p.muted} style={styles.hint}>
          {t('cycleImportHint')}
        </Txt>
        {result && (
          <Txt size={14} weight="medium" color={result.ok ? p.primary : p.danger} style={styles.hint} testID="cycle-import-result">
            {result.ok ? `${t('cycleImported')} ${result.added}` : t('cycleImportError')}
          </Txt>
        )}

        <SectionTitle>{t('cycleAdd')}</SectionTitle>
        <Card>
          <Row icon="calendar-outline" label={t('cycleStart')} onPress={() => setPicking(true)} testID="cycle-start">
            <View style={styles.dual}>
              <Txt weight="medium" color={p.primary} numberOfLines={1}>
                {weekdayName(start)} {formatGregorian(start)}
              </Txt>
              <Txt size={12} color={p.gold} numberOfLines={1}>
                {formatHijri(start)}
              </Txt>
            </View>
          </Row>
          <Row icon="hourglass-outline" label={t('cycleDaysCount')} last>
            <IconButton icon="remove-circle-outline" label="-1" onPress={() => setDays(Math.max(1, days - 1))} testID="cycle-days-minus" />
            <Txt weight="semibold" style={styles.count} testID="cycle-days">
              {days}
            </Txt>
            <IconButton icon="add-circle-outline" label="+1" onPress={() => setDays(Math.min(15, days + 1))} testID="cycle-days-plus" />
          </Row>
        </Card>
        <View style={{ height: SPACE.md }} />
        <Button label={t('cycleAdd')} icon="add" onPress={() => addPeriods([{ start: toIso(start), days }])} testID="cycle-add" />

        {periods.length > 0 && (
          <>
            <SectionTitle>{t('cycleTypical')}</SectionTitle>
            <Card>
              <Row label={t('cycleEvery')} value={`${stats.cycleLength} ${t('days')}`} testID="cycle-length" />
              <Row label={t('cycleLasts')} value={`${stats.periodDays} ${t('days')}`} testID="cycle-period-days" last />
            </Card>

            <SectionTitle>{`${t('cycleHistory')} (${periods.length})`}</SectionTitle>
            <Card>
              {listed.map((period, i) => {
                const day = parseIso(period.start) ?? 0;
                return (
                  <Row key={period.start} label={formatGregorian(day)} last={i === listed.length - 1} testID={`period-${period.start}`}>
                    <Txt size={13} color={p.muted}>
                      {period.days} {t('days')}
                    </Txt>
                    <IconButton icon="trash-outline" label={t('delete')} color={p.muted} size={18} onPress={() => setDeleting(period.start)} testID={`period-delete-${period.start}`} />
                  </Row>
                );
              })}
            </Card>
            {!showAll && periods.length > listed.length && (
              <Button label={t('cycleShowAll')} kind="ghost" onPress={() => setShowAll(true)} style={{ marginTop: SPACE.md }} testID="cycle-show-all" />
            )}
          </>
        )}

        <Txt size={12} color={p.muted} style={{ marginTop: SPACE.xl }}>
          {t('cycleEstimateNote')}
        </Txt>
      </ScrollView>

      {picking && (
        <DatePickerSheet
          title={t('cycleStart')}
          value={start}
          onClose={() => setPicking(false)}
          onPick={(day) => {
            setStart(day);
            setPicking(false);
          }}
        />
      )}
      {deleting && (
        <Confirm
          message={t('deletePeriodConfirm')}
          confirmLabel={t('delete')}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            removePeriod(deleting);
            setDeleting(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.lg, paddingTop: 0, paddingBottom: SPACE.xl * 2, width: '100%', maxWidth: 560, alignSelf: 'center' },
  paragraph: { marginBottom: SPACE.md },
  hint: { marginTop: SPACE.sm, paddingHorizontal: SPACE.xs },
  dual: { alignItems: 'flex-end', flexShrink: 1 },
  count: { minWidth: 28, textAlign: 'center' },
});
