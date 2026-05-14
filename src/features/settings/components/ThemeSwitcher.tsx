'use client';
import { THEMES, type Theme } from '@/lib/theme';
import { type LucideIcon, Moon, Palette, Sun } from 'lucide-react';
import { useTransition } from 'react';
import { setThemeAction } from '../actions';

const labels: Record<Theme, string> = {
  clinical: 'Clinical',
  warm: 'Warm',
  utility: 'Utility',
};

const icons: Record<Theme, LucideIcon> = {
  clinical: Palette,
  warm: Sun,
  utility: Moon,
};

interface Props {
  current: Theme;
}

export function ThemeSwitcher({ current }: Props) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-line bg-paper p-1">
      {THEMES.map((t) => {
        const Icon = icons[t];
        const isActive = t === current;
        return (
          <button
            key={t}
            type="button"
            disabled={pending}
            onClick={() => start(() => setThemeAction(t))}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition ${
              isActive ? 'bg-accent-soft text-accent-ink' : 'text-muted hover:bg-paper-2'
            }`}
          >
            <Icon size={14} />
            {labels[t]}
          </button>
        );
      })}
    </div>
  );
}
