// Color scheme presets — each provides 12 colors (one per pitch class: C, C#, D, ..., B)

export interface ColorScheme {
  label: string;
  value: string;
  colors: readonly string[];
}

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    label: 'Rainbow',
    value: 'rainbow',
    colors: [
      '#f87171',
      '#fb923c',
      '#fbbf24',
      '#facc15',
      '#a3e635',
      '#4ade80',
      '#34d399',
      '#22d3ee',
      '#60a5fa',
      '#818cf8',
      '#a78bfa',
      '#c084fc',
    ],
  },
  {
    label: 'Cool Blues',
    value: 'cool-blues',
    colors: [
      '#93c5fd',
      '#60a5fa',
      '#3b82f6',
      '#2563eb',
      '#7dd3fc',
      '#38bdf8',
      '#0ea5e9',
      '#0284c7',
      '#a5b4fc',
      '#818cf8',
      '#6366f1',
      '#4f46e5',
    ],
  },
  {
    label: 'Warm Sunset',
    value: 'warm-sunset',
    colors: [
      '#fca5a5',
      '#f87171',
      '#ef4444',
      '#dc2626',
      '#fdba74',
      '#fb923c',
      '#f97316',
      '#ea580c',
      '#fcd34d',
      '#fbbf24',
      '#f59e0b',
      '#d97706',
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
      '#e5e5e5',
      '#d4d4d4',
      '#c0c0c0',
      '#a8a8a8',
      '#909090',
      '#b0b0b0',
      '#c8c8c8',
      '#d0d0d0',
      '#b8b8b8',
      '#9c9c9c',
      '#e0e0e0',
    ],
  },
  {
    label: 'Pastel',
    value: 'pastel',
    colors: [
      '#fca5a5',
      '#fdba74',
      '#fde68a',
      '#fef08a',
      '#d9f99d',
      '#bbf7d0',
      '#99f6e4',
      '#a5f3fc',
      '#bfdbfe',
      '#c7d2fe',
      '#ddd6fe',
      '#e9d5ff',
    ],
  },
];

export const DEFAULT_COLOR_SCHEME = COLOR_SCHEMES[0];

// Pre-compute dim versions (with alpha suffix)
export function getDimColors(scheme: ColorScheme): string[] {
  return scheme.colors.map(c => c + 'cc');
}
