// Shared design tokens - same brand identity as the web app (erp_frontend's
// src/lib/brand.ts): near-black navy as the dark ground, one amber accent,
// Plus Jakarta Sans for display type. Centralising these here so every
// screen pulls from one system instead of each file inventing its own
// hex literals (the old NAVY '#1E3A5F' / GOLD '#C9A84C' in HomeScreen.tsx
// didn't even match the web's '#0B1120' navy or amber accent - two apps,
// two different brands by accident).
export const COLORS = {
  navy: '#0B1120',       // primary dark ground - matches web BRAND_DARK
  navyLight: '#16213A',  // one step up, for cards/rows sitting on navy
  amber: '#F59E0B',      // the one accent color, used sparingly
  amberLight: '#FBBF24',
  ink: '#0F172A',        // body text on light surfaces
  subtle: '#64748B',     // secondary text
  faint: '#94A3B8',      // tertiary text / placeholders
  border: '#E2E8F0',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  success: '#059669',
  successBg: '#ECFDF5',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  info: '#2563EB',
  infoBg: '#EFF6FF',
  violet: '#7C3AED',
  violetBg: '#F5F3FF',
} as const;

// Font family names as registered by useFonts() in App.tsx. Fall back to
// the platform system font until fonts finish loading (App.tsx gates
// first paint on that anyway, so in practice these are always ready).
export const FONT = {
  display: 'PlusJakartaSans_800ExtraBold',
  displaySemibold: 'PlusJakartaSans_700Bold',
  heading: 'PlusJakartaSans_600SemiBold',
  body: 'PlusJakartaSans_500Medium',
  bodyRegular: 'PlusJakartaSans_400Regular',
} as const;

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const SHADOW = {
  card: {
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  raised: {
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14, shadowRadius: 24, elevation: 8,
  },
} as const;
