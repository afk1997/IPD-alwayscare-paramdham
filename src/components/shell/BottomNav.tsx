'use client';
import { CalendarRange, FileText, Home, PawPrint, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
}

const nav: NavItem[] = [
  { href: '/', label: 'Today', icon: Home },
  { href: '/patients', label: 'Patients', icon: PawPrint },
  { href: '/activity/new', label: 'Add', icon: Plus, primary: true },
  { href: '/reports', label: 'Reports', icon: CalendarRange },
  { href: '/documents', label: 'Docs', icon: FileText },
];

export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-[64px] items-stretch border-t border-line bg-paper">
      {nav.map((it) => {
        const Icon = it.icon;
        if (it.primary) {
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-label={it.label}
              className="-translate-y-2.5 mx-2 my-auto flex h-12 w-12 items-center justify-center self-center rounded-full bg-accent text-accent-fg shadow-md"
            >
              <Icon size={22} strokeWidth={2.4} />
            </Link>
          );
        }
        const active = isActive(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
              active ? 'text-accent' : 'text-muted'
            }`}
          >
            <Icon size={20} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
