import '@/polyfills';

// Each weight comes from its own entry so only the four used are bundled.
import { IBMPlexSansArabic_400Regular } from '@expo-google-fonts/ibm-plex-sans-arabic/400Regular';
import { IBMPlexSansArabic_500Medium } from '@expo-google-fonts/ibm-plex-sans-arabic/500Medium';
import { IBMPlexSansArabic_600SemiBold } from '@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold';
import { IBMPlexSansArabic_700Bold } from '@expo-google-fonts/ibm-plex-sans-arabic/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform, View } from 'react-native';

import { refreshGoogleIfPossible } from '@/google/store';
import { useLocale, usePalette } from '@/hooks';
import { startNotifier } from '@/notify';
import { useStore } from '@/store';
import { startSync } from '@/sync/account';
import { DARK } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  const hydrated = useStore((s) => s.hydrated);
  const p = usePalette();
  const { lang, rtl, t } = useLocale();
  const ready = (fontsLoaded || fontError !== null) && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Sync starts only once the device's own data is loaded, so it never uploads an empty calendar.
  useEffect(() => {
    if (!hydrated) return;
    startSync();
    startNotifier();
    const focus = AppState.addEventListener('change', (status) => {
      if (status === 'active') void refreshGoogleIfPossible();
    });
    return () => focus.remove();
  }, [hydrated]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.title = t('appName');
  }, [lang, rtl, t]);

  if (!ready) return null;

  return (
    // The layout direction follows the app's language, not the device's.
    <View style={{ flex: 1, direction: rtl ? 'rtl' : 'ltr', backgroundColor: p.bg }}>
      <StatusBar style={p === DARK ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }} />
    </View>
  );
}
