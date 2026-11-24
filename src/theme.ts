// Design tokens: the SAME look as the web application (erp_frontend src/index.css): light slate surfaces, one blue primary (the blue of the
// N logo, hsl 221 83% 53%), Inter for type, slate neutrals and the web's radius. Every screen pulls from here rather than inventing hex values.
//
// `navy` and `amber`/`amberLight` are kept as names because ~60 places use them: navy is now the PRIMARY blue (buttons, active states, avatars),
// amberLight/amber are the logo's sky blue and a warning amber. Prefer `primary`, `accent` and `warning` in new code.
export const COLORS = {
  primary: '#2563EB',      // web --primary
  primaryDark: '#1D4ED8',  // pressed / on-light text emphasis
  primarySoft: '#EFF6FF',  // tinted background for selected rows and chips
  accent: '#0EA5E9',       // the lighter blue of the logo gradient, for small accents
  navy: '#2563EB',         // legacy name: now the primary blue
  navyLight: '#EFF6FF',    // legacy name: now the soft tint
  amber: '#D97706',        // warnings and "needs attention"
  amberLight: '#0EA5E9',   // legacy name: now the accent blue
  warning: '#D97706',
  ink: '#0F172A',          // web --foreground
  subtle: '#64748B',       // web --muted-foreground
  faint: '#94A3B8',
  border: '#E2E8F0',       // web --border
  background: '#F8FAFC',   // web --background
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  success: '#059669',
  successBg: '#ECFDF5',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  info: '#2563EB',
  infoBg: '#EFF6FF',
  violet: '#7C3AED',
  violetBg: '#F5F3FF',
} as const;

// Font family names as registered by useFonts() in App.tsx (Inter, the web application's font).
export const FONT = {
  display: 'Inter_800ExtraBold',
  displaySemibold: 'Inter_700Bold',
  heading: 'Inter_600SemiBold',
  body: 'Inter_500Medium',
  bodyRegular: 'Inter_400Regular',
} as const;

// The web uses a 0.5rem base radius with larger rounding on cards.
export const RADIUS = { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 } as const;

export const SHADOW = {
  card: {
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 1,
  },
  raised: {
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16, shadowRadius: 16, elevation: 6,
  },
} as const;
