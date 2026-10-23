import { Monitor, Moon, Sun } from 'lucide-react';

import { useTheme, type Theme } from '@/lib/theme';
import { Button } from '@/components/ui/button';

const ORDER: readonly Theme[] = ['light', 'dark', 'system'];

const ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const LABELS: Record<Theme, string> = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'System theme',
};

/**
 * Cycles light -> dark -> system.
 * Reads the theme from context, so there is no hydration concern in this SPA.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = ICONS[theme];
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? 'system';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`${LABELS[theme]}. Switch to ${LABELS[next].toLowerCase()}.`}
      title={`${LABELS[theme]}. Click for ${LABELS[next].toLowerCase()}.`}
      onClick={() => {
        setTheme(next);
      }}
    >
      <Icon className="size-4.5" aria-hidden="true" />
    </Button>
  );
}
