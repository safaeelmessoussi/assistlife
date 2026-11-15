/** Layers (which calendars show, their names and colours) and app settings. */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Row, ScreenHeader, SectionTitle, Toggle } from '@/components/form';
import { Button, Confirm, IconButton, Segmented, Sheet, Txt } from '@/components/ui';
import { useLocale, usePalette } from '@/hooks';
import { LANGS } from '@/i18n/strings';
import { today } from '@/lib/dates';
import { layerName, useStore, type Layer } from '@/store';
import { useAccount } from '@/sync/account';
import { FONT, LAYER_COLORS, RADIUS, SPACE } from '@/theme';

type Editing = { layer: Layer | null; name: string; color: string };

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
          <Row icon="logo-google" label={t('googleCalendar')} value="" onPress={() => router.push('/google')} testID="open-google" last />
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
      </ScrollView>

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
