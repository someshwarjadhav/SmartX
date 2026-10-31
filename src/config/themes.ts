export type ThemeId = 'ocean' | 'midnight' | 'indigo' | 'aurora' | 'saffron' | 'meadow';

export interface ThemeDef {
  id: ThemeId;
  name: string;
  note: string;
  mode: 'light' | 'dark';
  vars: Record<string, string>;
}

export const THEMES: ThemeDef[] = [
  {
    id: 'ocean',
    name: 'Ocean Blue',
    note: 'Bright blue on a clean white canvas',
    mode: 'light',
    vars: {
      bg: '237 242 252', panel: '255 255 255', soft: '226 235 251', line: '205 219 243',
      ink: '11 26 61', mute: '91 107 143',
      brand: '36 99 235', 'brand-ink': '255 255 255',
      deep: '27 55 113', 'deep-ink': '205 220 255', glow: '96 165 250',
      cow: '245 158 11', buffalo: '36 99 235', mix: '13 175 160',
      danger: '225 66 80', ok: '22 163 110', warn: '234 140 20',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight Navy',
    note: 'Deep navy for night shifts',
    mode: 'dark',
    vars: {
      bg: '17 26 52', panel: '27 39 72', soft: '37 52 92', line: '58 77 124',
      ink: '234 240 253', mute: '152 169 205',
      brand: '104 157 255', 'brand-ink': '8 16 42',
      deep: '13 21 48', 'deep-ink': '206 220 248', glow: '76 120 235',
      cow: '251 176 64', buffalo: '96 150 255', mix: '45 212 191',
      danger: '255 110 120', ok: '52 211 153', warn: '251 176 64',
    },
  },
  {
    id: 'indigo',
    name: 'Indigo Bloom',
    note: 'Violet-blue with a soft lilac base',
    mode: 'light',
    vars: {
      bg: '243 241 252', panel: '255 255 255', soft: '234 231 250', line: '218 213 244',
      ink: '28 20 70', mute: '107 98 150',
      brand: '99 76 232', 'brand-ink': '255 255 255',
      deep: '30 18 90', 'deep-ink': '222 215 255', glow: '167 139 250',
      cow: '236 111 168', buffalo: '99 76 232', mix: '56 189 248',
      danger: '225 66 80', ok: '22 163 110', warn: '234 140 20',
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    note: 'Dark teal with a cyan glow',
    mode: 'dark',
    vars: {
      bg: '13 26 38', panel: '20 40 56', soft: '29 55 74', line: '45 79 102',
      ink: '230 245 250', mute: '134 172 190',
      brand: '34 211 238', 'brand-ink': '3 20 28',
      deep: '10 21 33', 'deep-ink': '196 232 242', glow: '20 184 166',
      cow: '167 139 250', buffalo: '34 211 238', mix: '52 211 153',
      danger: '251 113 133', ok: '52 211 153', warn: '251 191 36',
    },
  },
  {
    id: 'saffron',
    name: 'Saffron Stone',
    note: 'Warm orange on neutral stone',
    mode: 'light',
    vars: {
      bg: '247 246 244', panel: '255 255 255', soft: '240 237 232', line: '226 221 213',
      ink: '36 30 26', mute: '120 110 100',
      brand: '214 94 6', 'brand-ink': '255 255 255',
      deep: '38 30 24', 'deep-ink': '240 226 208', glow: '251 146 60',
      cow: '214 94 6', buffalo: '37 99 235', mix: '22 163 110',
      danger: '220 53 69', ok: '22 163 110', warn: '202 138 4',
    },
  },
  {
    id: 'meadow',
    name: 'Meadow Green',
    note: 'Fresh pasture greens',
    mode: 'light',
    vars: {
      bg: '237 247 241', panel: '255 255 255', soft: '224 241 232', line: '200 227 212',
      ink: '10 46 33', mute: '82 120 100',
      brand: '4 120 87', 'brand-ink': '255 255 255',
      deep: '6 48 36', 'deep-ink': '200 240 220', glow: '52 211 153',
      cow: '245 158 11', buffalo: '4 120 87', mix: '14 165 233',
      danger: '225 66 80', ok: '22 163 110', warn: '234 140 20',
    },
  },
];

export const DEFAULT_THEME: ThemeId = 'ocean';

export function getTheme(id: string | null | undefined): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

export const rgb = (triplet: string, alpha?: number): string =>
  alpha === undefined ? `rgb(${triplet})` : `rgb(${triplet} / ${alpha})`;

export function applyTheme(theme: ThemeDef): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.vars)) root.style.setProperty(`--${key}`, value);
  root.dataset.theme = theme.id;
  root.classList.toggle('dark', theme.mode === 'dark');
  root.style.colorScheme = theme.mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', rgb(theme.vars.deep ?? '9 24 71'));
}
