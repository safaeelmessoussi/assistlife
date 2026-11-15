/** Form rows shared by the event and settings screens. */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';

import { IconButton, Txt, type IconName } from '@/components/ui';
import { useLocale, usePalette } from '@/hooks';
import { RADIUS, SPACE } from '@/theme';

export function ScreenHeader({ title, action }: { title: string; action?: ReactNode }) {
  const router = useRouter();
  const { rtl, t } = useLocale();
  return (
    <View style={styles.header}>
      <IconButton
        icon={rtl ? 'arrow-forward' : 'arrow-back'}
        label={t('cancel')}
        testID="back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <Txt weight="bold" size={19} style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Txt>
      {action}
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>{children}</View>;
}

export function SectionTitle({ children }: { children: string }) {
  const p = usePalette();
  return (
    <Txt size={13} weight="semibold" color={p.muted} style={styles.sectionTitle}>
      {children}
    </Txt>
  );
}

/** A labelled row; pressable when `onPress` is given. */
export function Row({
  icon,
  label,
  value,
  onPress,
  children,
  testID,
  last,
}: {
  icon?: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  children?: ReactNode;
  testID?: string;
  last?: boolean;
}) {
  const p = usePalette();
  const content = (
    <>
      {icon && <Ionicons name={icon} size={20} color={p.muted} />}
      <Txt style={{ flexShrink: 0 }}>{label}</Txt>
      <View style={styles.rowValue}>
        {value !== undefined && (
          <Txt weight="medium" color={onPress ? p.primary : p.muted} numberOfLines={1}>
            {value}
          </Txt>
        )}
        {children}
      </View>
    </>
  );
  const style = [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.border }];
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" testID={testID} style={({ pressed }) => [style, pressed && { backgroundColor: p.primarySoft }]}>
      {content}
    </Pressable>
  ) : (
    <View style={style} testID={testID}>
      {content}
    </View>
  );
}

/** A small on/off control drawn in the app's own colours. */
export function Toggle({ value, onChange, label, testID }: { value: boolean; onChange: (value: boolean) => void; label: string; testID?: string }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      testID={testID}
      hitSlop={8}
      style={[styles.toggle, { backgroundColor: value ? p.primary : p.border, alignItems: value ? 'flex-end' : 'flex-start' }]}>
      <View style={[styles.knob, { backgroundColor: p.surface }]} />
    </Pressable>
  );
}

export function Chip({ label, active, onPress, color, testID }: { label: string; active: boolean; onPress: () => void; color?: string; testID?: string }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      testID={testID}
      style={[styles.chip, { borderColor: active ? p.primary : p.border, backgroundColor: active ? p.primarySoft : 'transparent' }]}>
      {color && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Txt size={13} weight={active ? 'semibold' : 'regular'} color={active ? p.primary : p.text}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.xs, paddingVertical: SPACE.sm },
  card: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  sectionTitle: { marginTop: SPACE.xl, marginBottom: SPACE.sm, paddingHorizontal: SPACE.xs },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm },
  rowValue: { flex: 1, minWidth: 0, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: SPACE.sm },
  toggle: { width: 46, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 11 },
  chip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACE.md, borderRadius: RADIUS.pill, borderWidth: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
