/** Optional account: sign in, encrypted backup and sync between devices. */
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Row, ScreenHeader } from '@/components/form';
import { Button, Txt } from '@/components/ui';
import { accountsConfigured } from '@/config';
import { useLocale, usePalette } from '@/hooks';
import type { StringKey } from '@/i18n/strings';
import { formatTime } from '@/lib/dates';
import { authenticate, signOut, syncNow, useAccount, type AuthError } from '@/sync/account';
import { FONT, RADIUS, SPACE } from '@/theme';

const ERROR_TEXT: Record<AuthError | 'email', StringKey> = {
  invalid: 'errInvalid',
  exists: 'errExists',
  weak: 'errWeak',
  network: 'errNetwork',
  unknown: 'errUnknown',
  email: 'errEmail',
};

export default function AccountScreen() {
  const p = usePalette();
  const { t } = useLocale();
  const account = useAccount();

  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | 'email' | null>(null);
  const [notice, setNotice] = useState<StringKey | null>(null);

  const submit = async () => {
    setNotice(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('email');
    if (password.length < 8) return setError('weak');
    setError(null);
    setBusy(true);
    const result = await authenticate(email, password, creating);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setPassword('');
    if (result.confirmEmail) {
      setNotice('confirmEmail');
      setCreating(false);
    }
  };

  const lastSync = account.lastSyncAt ? new Date(account.lastSyncAt) : null;
  const input = [styles.input, { color: p.text, borderColor: p.border, backgroundColor: p.surface, fontFamily: FONT.regular }];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: p.bg }]}>
      <ScreenHeader title={t('account')} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Txt color={p.muted} style={styles.paragraph}>
          {t('accountIntro')}
        </Txt>
        <Txt color={p.muted} size={13} style={styles.paragraph}>
          {t('accountPrivacy')}
        </Txt>

        {!accountsConfigured ? (
          <Card>
            <Row icon="construct-outline" label={t('notConfigured')} testID="account-unconfigured" last />
          </Card>
        ) : !account.ready ? (
          <Txt color={p.muted}>{t('working')}</Txt>
        ) : account.email ? (
          <>
            <Card>
              <Row icon="person-circle-outline" label={t('signedInAs')} value={account.email} testID="account-email" />
              <Row
                icon="sync-outline"
                label={t('syncedAt')}
                testID="sync-status"
                value={
                  account.sync === 'syncing'
                    ? t('syncing')
                    : lastSync
                      ? formatTime(lastSync.getHours() * 60 + lastSync.getMinutes())
                      : t('syncNever')
                }
                last
              />
            </Card>
            {(account.sync === 'error' || account.sync === 'wrongPassword') && (
              <Txt size={13} color={p.danger} style={styles.message} testID="sync-error">
                {t(account.sync === 'error' ? 'syncError' : 'syncWrongPassword')}
              </Txt>
            )}
            <View style={styles.actions}>
              <Button label={t('syncNow')} icon="sync" onPress={() => void syncNow()} testID="sync-now" />
              <Button label={t('signOut')} kind="ghost" onPress={() => void signOut()} testID="sign-out" />
            </View>
            <Txt size={12} color={p.muted} style={styles.message}>
              {t('signOutHint')}
            </Txt>
          </>
        ) : (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('email')}
              placeholderTextColor={p.faint}
              accessibilityLabel={t('email')}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              testID="email-input"
              style={[input, styles.ltr]}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('password')}
              placeholderTextColor={p.faint}
              accessibilityLabel={t('password')}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={creating ? 'new-password' : 'current-password'}
              onSubmitEditing={() => void submit()}
              testID="password-input"
              style={[input, styles.ltr]}
            />
            {creating && (
              <Txt size={13} color={p.gold} style={styles.message} testID="password-warning">
                {t('passwordWarning')}
              </Txt>
            )}
            {error && (
              <Txt size={13} color={p.danger} style={styles.message} testID="auth-error">
                {t(ERROR_TEXT[error])}
              </Txt>
            )}
            {notice && (
              <Txt size={13} color={p.primary} style={styles.message} testID="auth-notice">
                {t(notice)}
              </Txt>
            )}
            <View style={styles.actions}>
              <Button
                label={busy ? t('working') : t(creating ? 'createAccount' : 'signIn')}
                onPress={() => {
                  if (!busy) void submit();
                }}
                testID="auth-submit"
              />
              <Button
                label={t(creating ? 'haveAccount' : 'noAccount')}
                kind="ghost"
                testID="auth-toggle"
                onPress={() => {
                  setCreating(!creating);
                  setError(null);
                  setNotice(null);
                }}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.lg, paddingTop: 0, width: '100%', maxWidth: 520, alignSelf: 'center' },
  paragraph: { marginBottom: SPACE.md },
  input: { minHeight: 52, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACE.lg, fontSize: 16, marginBottom: SPACE.md },
  // E-mail addresses and passwords are typed left to right in every language.
  ltr: { writingDirection: 'ltr', textAlign: 'left' },
  message: { marginBottom: SPACE.md, paddingHorizontal: SPACE.xs },
  actions: { gap: SPACE.md, marginTop: SPACE.sm, marginBottom: SPACE.md },
});
