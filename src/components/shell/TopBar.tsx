'use client';
import { useCommandPalette } from '@/features/search/CommandPalette';
import { Bell, Menu, Search } from 'lucide-react';
import { BrandMark } from './BrandMark';

interface Props {
  title?: string | undefined;
  onMenuClick?: (() => void) | undefined;
}

// Both mobile- and desktop-shaped headers live in the markup
// unconditionally; Tailwind responsive classes pick which is visible.
// The previous design branched on a client-side `narrow` flag, which
// caused a hydration mismatch on every mobile load (server default
// rendered the desktop variant).
export function TopBar({ title, onMenuClick }: Props) {
  const { open: openPalette } = useCommandPalette();
  return (
    <header className="sticky top-0 z-20 flex h-[52px] shrink-0 items-center gap-2 border-line border-b bg-paper px-3.5 md:h-[56px] md:px-6">
      {/* Mobile layout — hidden on md+ */}
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Menu"
        className="flex h-9 w-9 items-center justify-center rounded-md text-text md:hidden"
      >
        <Menu size={18} />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
        <BrandMark size={22} />
        <span className="truncate font-display font-bold text-sm tracking-tight">{title ?? 'Arham'}</span>
      </div>
      <button
        type="button"
        onClick={openPalette}
        aria-label="Search"
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted md:hidden"
      >
        <Search size={16} />
      </button>

      {/* Desktop layout — hidden on small screens */}
      <div className="hidden flex-1 items-center gap-2 md:flex">
        <span className="font-display font-semibold text-sm">{title ?? 'Today'}</span>
      </div>
      <button
        type="button"
        onClick={openPalette}
        className="hidden w-80 items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-left transition hover:bg-paper-2 md:flex"
      >
        <Search size={14} className="text-soft" />
        <span className="flex-1 truncate text-soft text-sm">Search patients, activities…</span>
        <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-soft">
          ⌘K
        </kbd>
      </button>

      <button
        type="button"
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-muted"
      >
        <Bell size={16} />
        <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-critical" />
      </button>
    </header>
  );
}
