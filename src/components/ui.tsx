/** Small shared building blocks. */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type TextProps, type ViewStyle } from 'react-native';

import { useLocale, usePalette } from '@/hooks';
import { FONT, RADIUS, SPACE } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type TxtProps = TextProps & {
  weight?: keyof typeof FONT;
  size?: number;
  color?: string;
};

export function Txt({ weight = 'regular', size = 15, color, style, ...rest }: TxtProps) {
  const p = usePalette();
  const { rtl } = useLocale();
  return (
    <Text
      {...rest}
      style={[
        // Follow the app's direction even for text made only of digits, such as a time.
        { fontFamily: FONT[weight], fontSize: size, lineHeight: Math.round(size * 1.5), color: color ?? p.text, writingDirection: rtl ? 'rtl' : 'ltr' },
        style,
      ]}
    />
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  color,
  size = 22,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  testID?: string;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: p.primarySoft }]}>
      <Ionicons name={icon} size={size} color={color ?? p.text} />
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  icon?: IconName;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const fg = kind === 'primary' ? p.onPrimary : kind === 'danger' ? p.danger : p.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: kind === 'primary' ? p.primary : 'transparent', opacity: pressed ? 0.75 : 1 },
        kind !== 'primary' && { borderWidth: 1, borderColor: kind === 'danger' ? p.danger : p.border },
        style,
      ]}>
      {icon && <Ionicons name={icon} size={18} color={fg} />}
      <Txt weight="semibold" color={fg}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}) {
  const p = usePalette();
  return (
    <View style={[styles.segmented, { backgroundColor: p.surfaceAlt, borderColor: p.border }]} testID={testID}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            testID={testID ? `${testID}-${o.value}` : undefined}
            style={[styles.segment, active && { backgroundColor: p.primary }]}>
            <Txt size={13} weight={active ? 'semibold' : 'medium'} color={active ? p.onPrimary : p.muted} numberOfLines={1}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A panel that rises over the screen: bottom sheet on phones, centred card on wide screens. */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  testID,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  testID?: string;
}) {
  const p = usePalette();
  const { t } = useLocale();
  const { width, height } = useWindowDimensions();
  const wide = width >= 700;
  return (
    <View style={[StyleSheet.absoluteFill, styles.sheetRoot, wide && { justifyContent: 'center' }]} testID={testID}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: p.overlay }]} onPress={onClose} accessibilityLabel={t('cancel')} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: p.surface, maxHeight: height * 0.85 },
          wide ? { width: 440, borderRadius: RADIUS.lg } : { width: '100%' },
        ]}>
        {title !== undefined && (
          <View style={styles.sheetHeader}>
            <Txt weight="semibold" size={17}>
              {title}
            </Txt>
            <IconButton icon="close" label={t('cancel')} onPress={onClose} />
          </View>
        )}
        <ScrollView contentContainerStyle={{ padding: SPACE.lg, paddingTop: title === undefined ? SPACE.lg : 0 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer && <View style={[styles.sheetFooter, { borderTopColor: p.border }]}>{footer}</View>}
      </View>
    </View>
  );
}

export function Confirm({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useLocale();
  return (
    <Sheet
      onClose={onCancel}
      testID="confirm"
      footer={
        <>
          <Button label={t('cancel')} kind="ghost" onPress={onCancel} style={{ flex: 1 }} />
          <Button label={confirmLabel} kind="danger" onPress={onConfirm} style={{ flex: 1 }} testID="confirm-yes" />
        </>
      }>
      <Txt size={16}>{message}</Txt>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 40, height: 40, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  button: {
    minHeight: 46,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    gap: SPACE.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmented: { flexDirection: 'row', borderRadius: RADIUS.md, borderWidth: 1, padding: 3, gap: 2 },
  segment: { flex: 1, minHeight: 34, paddingHorizontal: SPACE.md, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  sheetRoot: { justifyContent: 'flex-end', alignItems: 'center', zIndex: 50 },
  sheet: { borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, overflow: 'hidden' },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingStart: SPACE.lg,
    paddingEnd: SPACE.sm,
    paddingVertical: SPACE.sm,
  },
  sheetFooter: { flexDirection: 'row', gap: SPACE.md, padding: SPACE.lg, borderTopWidth: StyleSheet.hairlineWidth },
});
