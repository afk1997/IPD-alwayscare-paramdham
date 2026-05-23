'use client';
import { useCommandPalette } from '@/features/search/CommandPalette';
import { Bell, Menu, Search } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { BrandMark } from './BrandMark';

interface Props {
  title?: string | undefined;
  onMenuClick?: (() => void) | undefined;
}

// Map URL path → readable section title. Keeps the TopBar in sync with
// the page the user is on (was previously hard-coded to "Today").
function titleFromPath(path: string): string {
  if (path === '/' || path === '/today') return 'Today';
  if (path.startsWith('/patients/new')) return 'New admission';
  if (path.startsWith('/patients/')) return 'Patient';
  if (path === '/patients') return 'Patients';
  if (path.startsWith('/reports/today')) return 'Daily report';
  if (path.startsWith('/reports/by-animal')) return 'Per-animal report';
  if (path.startsWith('/reports')) return 'Reports';
  if (path.startsWith('/documents')) return 'Documents';
  if (path.startsWith('/activity/new')) return 'Log activity';
  if (path.startsWith('/admin/users')) return 'Users';
  if (path.startsWith('/admin/audit-log')) return 'Audit log';
  if (path.startsWith('/admin/trash')) return 'Trash';
  return 'Arham';
}

// Both mobile- and desktop-shaped headers live in the markup
// unconditionally; Tailwind responsive classes pick which is visible.
// The previous design branched on a client-side `narrow` flag, which
// caused a hydration mismatch on every mobile load (server default
// rendered the desktop variant).
export function TopBar({ title, onMenuClick }: Props) {
  const { open: openPalette } = useCommandPalette();
  const pathname = usePathname() ?? '/';
  const derivedTitle = title ?? titleFromPath(pathname);
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
        <span className="truncate font-display font-bold text-sm tracking-tight">{derivedTitle}</span>
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
        <span className="font-display font-semibold text-sm">{derivedTitle}</span>
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
