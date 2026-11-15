/** Google Calendar: connect an account and choose which of its calendars to show. */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Row, ScreenHeader, SectionTitle, Toggle } from '@/components/form';
import { Button, Confirm, Txt } from '@/components/ui';
import { googleConfigured } from '@/config';
import { googleSignInAvailable } from '@/google/auth';
import { connectGoogle, disconnectGoogle, setCalendarShown, useGoogle } from '@/google/store';
import { useLocale, usePalette } from '@/hooks';
import { formatTime } from '@/lib/dates';
import { SPACE } from '@/theme';

export default function GoogleScreen() {
  const p = usePalette();
  const { t } = useLocale();
  const google = useGoogle();
  const [confirming, setConfirming] = useState(false);

  const refreshed = google.lastRefreshAt ? new Date(google.lastRefreshAt) : null;
  const busy = google.status === 'refreshing';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: p.bg }]}>
      <ScreenHeader title={t('googleCalendar')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Txt color={p.muted} style={styles.paragraph}>
          {t('googleIntro')}
        </Txt>

        {!googleConfigured || !googleSignInAvailable ? (
          <Card>
            <Row icon="construct-outline" label={t(googleConfigured ? 'googleWebOnly' : 'notConfigured')} testID="google-unavailable" last />
          </Card>
        ) : google.email === null ? (
          <>
            {google.status === 'error' && (
              <Txt size={13} color={p.danger} style={styles.paragraph} testID="google-error">
                {t('googleError')}
              </Txt>
            )}
            <Button label={busy ? t('working') : t('googleConnect')} icon="logo-google" onPress={() => void connectGoogle()} testID="google-connect" />
          </>
        ) : (
          <>
            <Card>
              <Row icon="logo-google" label={t('connected')} value={google.email} testID="google-email" />
              <Row
                icon="sync-outline"
                label={t('syncedAt')}
                testID="google-status"
                value={busy ? t('syncing') : refreshed ? formatTime(refreshed.getHours() * 60 + refreshed.getMinutes()) : t('syncNever')}
                last
              />
            </Card>
            {google.status === 'error' && (
              <Txt size={13} color={p.danger} style={styles.message} testID="google-error">
                {t('googleError')}
              </Txt>
            )}

            <SectionTitle>{t('googleCalendars')}</SectionTitle>
            <Card>
              {google.calendars.map((calendar, i) => (
                <Row key={calendar.id} label="" last={i === google.calendars.length - 1}>
                  <View style={styles.calendarRow}>
                    <View style={[styles.swatch, { backgroundColor: calendar.color }]} />
                    <Txt weight="medium" style={{ flex: 1 }} numberOfLines={1}>
                      {calendar.name}
                    </Txt>
                    <Toggle
                      value={calendar.shown}
                      onChange={(shown) => setCalendarShown(calendar.id, shown)}
                      label={calendar.name}
                      testID={`google-calendar-${i}`}
                    />
                  </View>
                </Row>
              ))}
            </Card>

            <View style={styles.actions}>
              {/* Asking again is done from this tap because Google's access lasts one hour in a browser. */}
              <Button label={t('googleRefresh')} icon="sync" onPress={() => void connectGoogle()} testID="google-refresh" />
              <Button label={t('googleDisconnect')} kind="ghost" onPress={() => setConfirming(true)} testID="google-disconnect" />
            </View>
          </>
        )}
      </ScrollView>

      {confirming && (
        <Confirm
          message={t('googleDisconnectHint')}
          confirmLabel={t('googleDisconnect')}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            void disconnectGoogle();
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.lg, paddingTop: 0, width: '100%', maxWidth: 520, alignSelf: 'center' },
  paragraph: { marginBottom: SPACE.lg },
  message: { marginTop: SPACE.sm, paddingHorizontal: SPACE.xs },
  calendarRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  swatch: { width: 18, height: 18, borderRadius: 9 },
  actions: { gap: SPACE.md, marginTop: SPACE.xl },
});
