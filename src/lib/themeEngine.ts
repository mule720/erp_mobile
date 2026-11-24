/**
 * Dark mode for the whole app without touching every screen.
 *
 * Every screen is written in the light palette (src/theme.ts). In dark mode this file rewrites the colours of every element AS IT IS CREATED:
 * it wraps React's JSX functions, and for each `style` (an object, or an array of them, from StyleSheet.create or written inline) it swaps the
 * light neutrals for their dark equivalents by property: page and card backgrounds, borders, and dark text. Accent colours (the blue, red,
 * green) stay, except where a lighter shade reads better on dark. Colour props such as an icon's `color` are mapped the same way.
 *
 * It must be imported FIRST (index.ts does), before any screen is loaded. The choice is remembered on the device and read synchronously at
 * start-up, so the first frame is already the right one. Switching re-creates the whole tree (App.tsx keys the root on the mode).
 */
import { Platform } from 'react-native';

type Mode = 'light' | 'dark';
const KEY = 'erp_theme';

function readStored(): Mode {
  try {
    if (Platform.OS === 'web') return (typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === 'dark') ? 'dark' : 'light';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SecureStore = require('expo-secure-store');
    return SecureStore.getItem?.(KEY) === 'dark' ? 'dark' : 'light';
  } catch { return 'light'; }
}

let mode: Mode = readStored();
export const getThemeMode = (): Mode => mode;
export const isDark = () => mode === 'dark';

export function storeThemeMode(next: Mode) {
  mode = next;
  try {
    if (Platform.OS === 'web') { localStorage.setItem(KEY, next); return; }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('expo-secure-store').setItem?.(KEY, next);
  } catch { /* the choice just is not remembered */ }
}

const norm = (c: string) => {
  const u = c.trim().toUpperCase();
  return u.length === 4 ? '#' + u[1] + u[1] + u[2] + u[2] + u[3] + u[3] : u;     // #FFF -> #FFFFFF
};

const BG: Record<string, string> = {
  '#FFFFFF': '#0F172A', '#F8FAFC': '#020617', '#E2E8F0': '#334155', '#334155': '#CBD5E1',
  '#EFF6FF': '#172554', '#DBEAFE': '#1E3A8A',
  '#FEE2E2': '#450A0A', '#FEF2F2': '#450A0A', '#FFF5F5': '#450A0A',
  '#FFFBEB': '#422006', '#FEF3C7': '#422006',
  '#ECFDF5': '#052E16', '#D1FAE5': '#052E16', '#DCFCE7': '#052E16', '#F0FDF4': '#052E16',
  '#EEF2FF': '#1E1B4B', '#EDE9FE': '#1E1B4B', '#F5F3FF': '#1E1B4B',
};
const BORDER: Record<string, string> = {
  '#E2E8F0': '#1E293B', '#F1F5F9': '#1E293B', '#EEF2F7': '#1E293B', '#CBD5E1': '#334155', '#FDE68A': '#713F12', '#FFFFFF': '#0F172A',
};
const TEXT: Record<string, string> = {
  '#0F172A': '#F1F5F9', '#111827': '#F1F5F9', '#1E293B': '#F1F5F9', '#334155': '#CBD5E1', '#475569': '#CBD5E1',
  '#2563EB': '#60A5FA', '#1D4ED8': '#93C5FD', '#B45309': '#FBBF24', '#92400E': '#FBBF24', '#4F46E5': '#818CF8', '#7C3AED': '#A78BFA',
  '#166534': '#4ADE80', '#047857': '#34D399',
};

function mapStyle(style: any): any {
  if (!style || typeof style !== 'object') return style;
  if (Array.isArray(style)) {
    let changed = false;
    const out = style.map(s => { const m = mapStyle(s); if (m !== s) changed = true; return m; });
    return changed ? out : style;
  }
  const hit = cache.get(style);
  if (hit) return hit;
  let out: any = null;
  for (const k of Object.keys(style)) {
    const v = style[k];
    if (typeof v !== 'string' || v[0] !== '#') continue;
    const c = norm(v);
    let n: string | undefined;
    if (k === 'backgroundColor') n = c === '#F1F5F9' ? (style.flex === 1 ? '#020617' : '#1E293B') : BG[c];
    else if (/^border.*Color$/.test(k)) n = BORDER[c];
    else if (k === 'color') n = TEXT[c];
    if (n) { out = out || { ...style }; out[k] = n; }
  }
  const res = out || style;
  cache.set(style, res);
  return res;
}
const cache = new WeakMap<object, any>();

/** A colour handed over as a prop (an icon's `color`, a spinner's `color`). */
function mapProp(v: any): any {
  if (typeof v !== 'string' || v[0] !== '#') return v;
  return TEXT[norm(v)] || v;
}

function patch(mod: any, names: string[]) {
  if (!mod) return;
  for (const name of names) {
    const orig = mod[name];
    if (typeof orig !== 'function') continue;
    try {
      mod[name] = function (type: any, props: any, ...rest: any[]) {
        if (mode === 'dark' && props) {
          let next = props;
          if (props.style !== undefined) { const m = mapStyle(props.style); if (m !== props.style) next = { ...next, style: m }; }
          if (props.contentContainerStyle !== undefined) { const m = mapStyle(props.contentContainerStyle); if (m !== props.contentContainerStyle) next = { ...next, contentContainerStyle: m }; }
          if (typeof type !== 'string' && typeof props.color === 'string') { const m = mapProp(props.color); if (m !== props.color) next = { ...next, color: m }; }
          if (next !== props) props = next;
        }
        return orig.call(this, type, props, ...rest);
      };
    } catch { /* a runtime that freezes the module: the app simply stays light */ }
  }
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
try { patch(require('react/jsx-runtime'), ['jsx', 'jsxs']); } catch { /* not available */ }
// eslint-disable-next-line @typescript-eslint/no-var-requires
try { patch(require('react/jsx-dev-runtime'), ['jsxDEV']); } catch { /* production build has no dev runtime */ }
