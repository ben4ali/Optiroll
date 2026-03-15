// Color scheme presets — each provides 12 colors (one per pitch class: C, C#, D, ..., B)

export interface ColorScheme {
  label: string;
  value: string;
  colors: readonly string[];
}

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    label: 'Cool Blues',
    value: 'cool-blues',
    colors: [
      '#93c5fd',
      '#7db8fb',
      '#60a5fa',
      '#4b96f7',
      '#3b82f6',
      '#2f74e4',
      '#2563eb',
      '#1d58d8',
      '#1e4fd0',
      '#3a6fe8',
      '#5088f0',
      '#78b0fc',
    ],
  },
  {
    label: 'Warm Sunset',
    value: 'warm-sunset',
    colors: [
      '#fcd9b6',
      '#fdbe84',
      '#fba65a',
      '#f99037',
      '#f87c1f',
      '#f06a10',
      '#e25c0c',
      '#d44e09',
      '#e86822',
      '#f57d3a',
      '#fb9556',
      '#fcb17e',
    ],
  },
  {
    label: 'Neon',
    value: 'neon',
    colors: [
      '#ff0080',
      '#ff00ff',
      '#8b5cf6',
      '#6366f1',
      '#00ffff',
      '#00ff80',
      '#00ff00',
      '#80ff00',
      '#ffff00',
      '#ff8000',
      '#ff0040',
      '#ff00c0',
    ],
  },
  {
    label: 'Monochrome',
    value: 'monochrome',
    colors: [
      '#ffffff',
      '#f0f0f0',
      '#e0e0e0',
      '#d0d0d0',
      '#c4c4c4',
      '#b8b8b8',
      '#c0c0c0',
      '#cccccc',
      '#d8d8d8',
      '#e4e4e4',
      '#eeeeee',
      '#f8f8f8',
    ],
  },
  {
    label: 'Ocean Teal',
    value: 'ocean-teal',
    colors: [
      '#99f6e4',
      '#7be8d6',
      '#5eead4',
      '#45d9c3',
      '#2dd4bf',
      '#20c4af',
      '#14b8a6',
      '#0ea89a',
      '#0d9488',
      '#1aab9c',
      '#36c2b4',
      '#5ad8ca',
    ],
  },
  {
    label: 'Frost',
    value: 'frost',
    colors: [
      '#e0f2fe',
      '#cce8fb',
      '#bae6fd',
      '#a2dcfb',
      '#7dd3fc',
      '#63c8fa',
      '#38bdf8',
      '#28b0ec',
      '#0ea5e9',
      '#2cb4f0',
      '#4ec4f6',
      '#74d4fa',
    ],
  },
];

export const DEFAULT_COLOR_SCHEME = COLOR_SCHEMES[0];

// Pre-compute dim versions (with alpha suffix)
export function getDimColors(scheme: ColorScheme): string[] {
  return scheme.colors.map(c => c + 'cc');
}
