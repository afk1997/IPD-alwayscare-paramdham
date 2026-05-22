'use client';
import { useQuickAdd } from '@/features/quick-add/QuickAddProvider';
import { CalendarRange, FileText, Home, PawPrint, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const nav: NavItem[] = [
  { href: '/', label: 'Today', icon: Home },
  { href: '/patients', label: 'Patients', icon: PawPrint },
  { href: '/reports', label: 'Reports', icon: CalendarRange },
  { href: '/documents', label: 'Docs', icon: FileText },
];

// UI-5: hide the BottomNav when the soft keyboard is open on mobile.
// `visualViewport` shrinks by the keyboard height; treat anything >130px
// of vertical viewport loss as "keyboard open".
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const onResize = () => {
      const delta = window.innerHeight - vv.height;
      setOpen(delta > 130);
    };
    onResize();
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);
  return open;
}

export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const { open } = useQuickAdd();
  const keyboardOpen = useKeyboardOpen();

  const before = nav.slice(0, 2);
  const after = nav.slice(2);

  if (keyboardOpen) return null;

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-30 flex h-[64px] items-stretch border-line border-t bg-paper md:hidden">
      {before.map((it) => (
        <BottomLink key={it.href} item={it} active={isActive(it.href)} />
      ))}
      <button
        type="button"
        onClick={() => open()}
        aria-label="New entry"
        className="-translate-y-2.5 mx-2 my-auto flex h-12 w-12 items-center justify-center self-center rounded-full bg-accent text-accent-fg shadow-md"
      >
        <Plus size={22} strokeWidth={2.4} />
      </button>
      {after.map((it) => (
        <BottomLink key={it.href} item={it} active={isActive(it.href)} />
      ))}
    </nav>
  );
}

function BottomLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 font-medium text-[10px] ${
        active ? 'text-accent' : 'text-muted'
      }`}
    >
      <Icon size={20} />
      {item.label}
    </Link>
  );
}
