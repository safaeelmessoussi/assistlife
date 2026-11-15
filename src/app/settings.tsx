/** Layers (which calendars show, their names and colours) and app settings. */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Row, ScreenHeader, SectionTitle, Toggle } from '@/components/form';
import { Button, Confirm, IconButton, Segmented, Sheet, Txt } from '@/components/ui';
import { ANDROID_APP_URL } from '@/config';
import { useLocale, usePalette } from '@/hooks';
import { CITIES } from '@/data/cities';
import { LANGS, type StringKey } from '@/i18n/strings';
import { PRAYER_METHODS, type PrayerMethod } from '@/lib/prayer';
import { requestNotifications } from '@/notify';
import { today } from '@/lib/dates';
import { layerName, useStore, type Layer } from '@/store';
import { useAccount } from '@/sync/account';
import { FONT, LAYER_COLORS, RADIUS, SPACE } from '@/theme';

type Editing = { layer: Layer | null; name: string; color: string };

const METHOD_LABEL: Record<PrayerMethod, StringKey> = {
  morocco: 'methodMorocco',
  mwl: 'methodMwl',
  ummAlQura: 'methodUmmAlQura',
  egypt: 'methodEgypt',
  karachi: 'methodKarachi',
  northAmerica: 'methodNorthAmerica',
  turkey: 'methodTurkey',
};

export default function SettingsScreen() {
  const p = usePalette();
  const { t, lang, weekdays, formatHijri } = useLocale();
  const settings = useStore((s) => s.settings);
  const layers = useStore((s) => s.layers);
  const { updateSettings, addLayer, updateLayer, removeLayer } = useStore.getState();

  const router = useRouter();
  const accountEmail = useAccount((a) => a.email);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<Layer | null>(null);
  const [sheet, setSheet] = useState<'city' | 'method' | null>(null);
  const [search, setSearch] = useState('');
  const [notifyDenied, setNotifyDenied] = useState(false);

  const query = search.trim().toLowerCase();
  const cities = CITIES.filter((c) => !query || c.ar.includes(search.trim()) || c.latin.toLowerCase().includes(query));

  const toggleNotify = async (on: boolean) => {
    setNotifyDenied(false);
    if (on && !(await requestNotifications())) return setNotifyDenied(true);
    updateSettings({ notify: on });
  };

  const saveLayer = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    if (editing.layer) {
      // A built-in layer keeps following the app language until it is renamed.
      const renamed = name !== layerName(editing.layer, lang);
      updateLayer(editing.layer.id, { color: editing.color, ...(renamed ? { name } : {}) });
    } else {
      addLayer(name, editing.color);
    }
    setEditing(null);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: p.bg }]}>
      <ScreenHeader title={t('settings')} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle>{t('sync')}</SectionTitle>
        <Card>
          <Row
            icon="cloud-outline"
            label={t('account')}
            value={accountEmail ?? t('notSignedIn')}
            onPress={() => router.push('/account')}
            testID="open-account"
          />
          <Row icon="logo-google" label={t('googleCalendar')} value="" onPress={() => router.push('/google')} testID="open-google" />
          <Row icon="water-outline" label={t('cycle')} value="" onPress={() => router.push('/cycle')} testID="open-cycle" last />
        </Card>

        <SectionTitle>{t('layers')}</SectionTitle>
        <Card>
          {layers.map((layer) => (
            <Row
              key={layer.id}
              label=""
              testID={`layer-row-${layer.id}`}
              onPress={() => setEditing({ layer, name: layerName(layer, lang), color: layer.color })}>
              <View style={styles.layerRow}>
                <View style={[styles.swatch, { backgroundColor: layer.color }]} />
                <Txt weight="medium" style={{ flex: 1 }} numberOfLines={1}>
                  {layerName(layer, lang)}
                </Txt>
                <Toggle
                  value={layer.visible}
                  onChange={(visible) => updateLayer(layer.id, { visible })}
                  label={layerName(layer, lang)}
                  testID={`layer-visible-${layer.id}`}
                />
              </View>
            </Row>
          ))}
          <Row
            icon="add"
            label={t('addLayer')}
            testID="add-layer"
            last
            onPress={() => setEditing({ layer: null, name: '', color: LAYER_COLORS[layers.length % LAYER_COLORS.length] })}
          />
        </Card>

        <SectionTitle>{t('language')}</SectionTitle>
        <Segmented testID="lang" value={settings.language} onChange={(language) => updateSettings({ language })} options={LANGS.map((l) => ({ value: l.id, label: l.label }))} />

        <SectionTitle>{t('weekStart')}</SectionTitle>
        <Segmented
          testID="week-start"
          value={settings.weekStart}
          onChange={(weekStart) => updateSettings({ weekStart })}
          options={[1, 6, 0].map((wd) => ({ value: wd, label: weekdays.long[wd] }))}
        />

        <SectionTitle>{t('hijri')}</SectionTitle>
        <Card>
          <Row label={t('today')} value={formatHijri(today())} testID="hijri-today" />
          {(['MA', 'MECCA'] as const).map((region) => (
            <Row
              key={region}
              icon={settings.hijriRegion === region ? 'radio-button-on' : 'radio-button-off'}
              label={t(region === 'MA' ? 'hijriRegionMA' : 'hijriRegionMECCA')}
              testID={`region-${region}`}
              onPress={() => updateSettings({ hijriRegion: region })}
            />
          ))}
          <Row label={t('hijriAdjust')} last>
            <IconButton icon="remove-circle-outline" label="-1" testID="adjust-minus" onPress={() => updateSettings({ hijriAdjust: Math.max(-2, settings.hijriAdjust - 1) })} />
            <Txt weight="semibold" style={styles.adjust} testID="adjust-value">
              {settings.hijriAdjust > 0 ? `+${settings.hijriAdjust}` : settings.hijriAdjust}
            </Txt>
            <IconButton icon="add-circle-outline" label="+1" testID="adjust-plus" onPress={() => updateSettings({ hijriAdjust: Math.min(2, settings.hijriAdjust + 1) })} />
          </Row>
        </Card>
        <Txt size={12} color={p.muted} style={styles.hint}>
          {t('hijriAdjustHint')}
        </Txt>

        <SectionTitle>{t('worship')}</SectionTitle>
        <Card>
          <Row icon="location-outline" label={t('place')} value={settings.place.name} onPress={() => setSheet('city')} testID="place-row" />
          <Row icon="calculator-outline" label={t('prayerMethod')} value={t(METHOD_LABEL[settings.prayerMethod])} onPress={() => setSheet('method')} testID="method-row" />
          <Row icon="partly-sunny-outline" label={t('asrSchool')} last>
            <View style={{ width: 190 }}>
              <Segmented
                testID="asr"
                value={settings.asrHanafi ? 'hanafi' : 'majority'}
                onChange={(v) => updateSettings({ asrHanafi: v === 'hanafi' })}
                options={[
                  { value: 'majority', label: t('asrMajority') },
                  { value: 'hanafi', label: t('asrHanafi') },
                ]}
              />
            </View>
          </Row>
        </Card>
        <Txt size={12} color={p.muted} style={styles.hint}>
          {t('prayerHint')}
        </Txt>
        <View style={{ height: SPACE.md }} />
        <Card>
          {(
            [
              ['showPrayers', 'showPrayers'],
              ['showFasting', 'showFasting'],
              ['fastMonThu', 'fastMonThuOpt'],
              ['fastWhiteDays', 'fastWhiteOpt'],
              ['showOccasions', 'showOccasions'],
              ['showAthkar', 'showAthkar'],
            ] as const
          )
            .filter(([key]) => settings.showFasting || (key !== 'fastMonThu' && key !== 'fastWhiteDays'))
            .map(([key, label]) => (
              <Row key={key} label={`${key === 'fastMonThu' || key === 'fastWhiteDays' ? '     ' : ''}${t(label)}`}>
                <Toggle value={settings[key]} onChange={(value) => updateSettings({ [key]: value })} label={t(label)} testID={`toggle-${key}`} />
              </Row>
            ))}
          <Row label={t('notify')} last>
            <Toggle value={settings.notify} onChange={(value) => void toggleNotify(value)} label={t('notify')} testID="toggle-notify" />
          </Row>
        </Card>
        <Txt size={12} color={notifyDenied ? p.danger : p.muted} style={styles.hint} testID="notify-hint">
          {t(notifyDenied ? 'notifyDenied' : 'notifyHint')}
        </Txt>

        <SectionTitle>{t('appearance')}</SectionTitle>
        <Segmented
          testID="theme"
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
          options={[
            { value: 'system', label: t('themeSystem') },
            { value: 'light', label: t('themeLight') },
            { value: 'dark', label: t('themeDark') },
          ]}
        />

        {Platform.OS === 'web' && (
          <>
            <SectionTitle>{t('androidApp')}</SectionTitle>
            <Card>
              <Row
                icon="logo-android"
                label={t('androidApp')}
                value={t('androidDownload')}
                onPress={() => void Linking.openURL(ANDROID_APP_URL)}
                testID="android-download"
                last
              />
            </Card>
            <Txt size={12} color={p.muted} style={styles.hint}>
              {t('androidHint')}
            </Txt>
          </>
        )}
      </ScrollView>

      {sheet === 'city' && (
        <Sheet title={t('place')} onClose={() => setSheet(null)} testID="city-sheet">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('searchCity')}
            placeholderTextColor={p.faint}
            accessibilityLabel={t('searchCity')}
            testID="city-search"
            style={[styles.input, { color: p.text, borderColor: p.border, fontFamily: FONT.regular, marginBottom: SPACE.md }]}
          />
          {cities.map((city) => {
            const name = lang === 'ar' ? city.ar : city.latin;
            return (
              <Row
                key={city.latin}
                icon={Math.abs(city.lat - settings.place.lat) < 0.001 && Math.abs(city.lon - settings.place.lon) < 0.001 ? 'radio-button-on' : 'radio-button-off'}
                label={name}
                testID={`city-${city.latin}`}
                onPress={() => {
                  updateSettings({ place: { name, lat: city.lat, lon: city.lon } });
                  setSearch('');
                  setSheet(null);
                }}
              />
            );
          })}
        </Sheet>
      )}

      {sheet === 'method' && (
        <Sheet title={t('prayerMethod')} onClose={() => setSheet(null)} testID="method-sheet">
          {PRAYER_METHODS.map((method) => (
            <Row
              key={method}
              icon={settings.prayerMethod === method ? 'radio-button-on' : 'radio-button-off'}
              label={t(METHOD_LABEL[method])}
              testID={`method-${method}`}
              onPress={() => {
                updateSettings({ prayerMethod: method });
                setSheet(null);
              }}
            />
          ))}
        </Sheet>
      )}

      {editing && (
        <Sheet
          title={editing.layer ? t('layer') : t('addLayer')}
          onClose={() => setEditing(null)}
          testID="layer-sheet"
          footer={
            <>
              {editing.layer && layers.length > 1 && (
                <Button
                  label={t('delete')}
                  kind="danger"
                  testID="layer-delete"
                  onPress={() => {
                    setDeleting(editing.layer);
                    setEditing(null);
                  }}
                />
              )}
              <Button label={t('save')} onPress={saveLayer} style={{ flex: 1 }} testID="layer-save" />
            </>
          }>
          <TextInput
            value={editing.name}
            onChangeText={(name) => setEditing({ ...editing, name })}
            placeholder={t('layerName')}
            placeholderTextColor={p.faint}
            accessibilityLabel={t('layerName')}
            autoFocus={!editing.layer}
            testID="layer-name"
            style={[styles.input, { color: p.text, borderColor: p.border, fontFamily: FONT.medium }]}
          />
          <Txt size={13} color={p.muted} style={{ marginTop: SPACE.lg, marginBottom: SPACE.sm }}>
            {t('color')}
          </Txt>
          <View style={styles.colors}>
            {LAYER_COLORS.map((color) => (
              <Pressable
                key={color}
                onPress={() => setEditing({ ...editing, color })}
                accessibilityRole="button"
                accessibilityLabel={color}
                accessibilityState={{ selected: color === editing.color }}
                style={[styles.color, { backgroundColor: color }, color === editing.color && { borderWidth: 3, borderColor: p.text }]}
              />
            ))}
          </View>
        </Sheet>
      )}

      {deleting && (
        <Confirm
          message={t('deleteLayerConfirm')}
          confirmLabel={t('delete')}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            removeLayer(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.lg, paddingTop: 0, paddingBottom: SPACE.xl * 2, width: '100%', maxWidth: 640, alignSelf: 'center' },
  layerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  swatch: { width: 18, height: 18, borderRadius: 9 },
  adjust: { minWidth: 28, textAlign: 'center' },
  hint: { marginTop: SPACE.sm, paddingHorizontal: SPACE.xs },
  input: { minHeight: 50, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, fontSize: 16 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md },
  color: { width: 40, height: 40, borderRadius: 20 },
});
