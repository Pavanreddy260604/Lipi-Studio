export interface AccentColor {
  id: string;
  name: string;
  oklch: string; // The primary OKLCH value
  hex: string;   // For backwards compat or specific needs
}

export const ACCENT_COLORS: Record<string, AccentColor> = {
  crimson: {
    id: 'crimson',
    name: 'Crimson Rose',
    oklch: '0.62 0.18 20',
    hex: '#E11D48',
  },
  amber: {
    id: 'amber',
    name: 'Solar Amber',
    oklch: '0.78 0.16 75',
    hex: '#F59E0B',
  },
  emerald: {
    id: 'emerald',
    name: 'Obsidian Emerald',
    oklch: '0.65 0.15 165',
    hex: '#10B981',
  },
  indigo: {
    id: 'indigo',
    name: 'Electric Indigo',
    oklch: '0.62 0.18 265',
    hex: '#6366F1',
  },
  violet: {
    id: 'violet',
    name: 'Royal Violet',
    oklch: '0.6 0.18 300',
    hex: '#8B5CF6',
  },
  cyan: {
    id: 'cyan',
    name: 'Deep Cyan',
    oklch: '0.68 0.15 210',
    hex: '#06B6D4',
  },
  terracotta: {
    id: 'terracotta',
    name: 'Muted Clay',
    oklch: '0.65 0.12 35',
    hex: '#EB644B',
  },
};

export const DEFAULT_ACCENT = 'terracotta';
