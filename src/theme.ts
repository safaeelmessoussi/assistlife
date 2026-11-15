/** Colour, type and spacing tokens. Components read these; they never hard-code a colour. */
export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  muted: string;
  faint: string;
  border: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  /** Hijri dates and other sacred-time accents. */
  gold: string;
  danger: string;
  overlay: string;
};

export const LIGHT: Palette = {
  bg: '#F5F2EA',
  surface: '#FFFFFF',
  surfaceAlt: '#FAF8F2',
  text: '#1B2925',
  muted: '#667470',
  faint: '#A3ADA9',
  border: '#E5E0D4',
  primary: '#0F5C4D',
  onPrimary: '#FFFFFF',
  primarySoft: '#E1EFEA',
  gold: '#9A6B14',
  danger: '#B3382C',
  overlay: 'rgba(15, 25, 22, 0.45)',
};

export const DARK: Palette = {
  bg: '#0E1513',
  surface: '#161F1C',
  surfaceAlt: '#121A17',
  text: '#EAF0EE',
  muted: '#96A39F',
  faint: '#5E6B67',
  border: '#25302C',
  primary: '#58C4A5',
  onPrimary: '#06221B',
  primarySoft: '#17332C',
  gold: '#E2B75F',
  danger: '#F0796C',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export const FONT = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
} as const;

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const RADIUS = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

/** Layer colours, chosen to stay distinct from each other in both themes. */
export const LAYER_COLORS = ['#0F8B6F', '#C08A1E', '#C2543C', '#7A5AC2', '#2F7EC4', '#B8477F', '#5C8A2E', '#6E7A86'];

/** Colours of the computed layers: fasting days, occasions, remembrance. */
export const SYSTEM_COLORS = { 'sys:fasting': '#B8862B', 'sys:occasions': '#0F8B6F', 'sys:athkar': '#7A5AC2' } as const;

/** Cell backgrounds of the cycle layer. */
export const CYCLE_COLORS = { period: 'rgba(226, 92, 133, 0.34)', expected: 'rgba(226, 92, 133, 0.14)', fertile: 'rgba(222, 180, 50, 0.18)', ovulation: 'rgba(222, 180, 50, 0.40)' } as const;

/** A translucent tint of a layer colour, for event backgrounds. */
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
