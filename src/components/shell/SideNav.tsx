'use client';
import { CalendarRange, FileText, Home, PawPrint, Plus, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandMark } from './BrandMark';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const nav: NavItem[] = [
  { href: '/', label: 'Today', icon: Home },
  { href: '/patients', label: 'Patients', icon: PawPrint },
  { href: '/reports', label: 'Reports', icon: CalendarRange },
  { href: '/documents', label: 'Documents', icon: FileText },
];

const adminNav: NavItem[] = [{ href: '/admin/users', label: 'Users', icon: Users }];

interface Props {
  isAdmin: boolean;
  user: { name: string; role: string };
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
        active ? 'bg-accent-soft font-semibold text-accent-ink' : 'font-medium text-text hover:bg-paper-2'
      }`}
    >
      <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}

export function SideNav({ isAdmin, user }: Props) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const initials = user.name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('');

  return (
    <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2.5 px-4 pb-6 pt-5">
        <BrandMark size={30} />
        <div className="flex flex-col leading-tight">
          <span className="font-display text-[15px] font-extrabold tracking-tight">Arham</span>
          <span className="mt-0.5 text-[11px] font-medium text-muted">Always Care · IPD</span>
        </div>
      </div>

      <Link
        href="/activity/new"
        className="mx-3.5 mb-4 flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-fg shadow-sm transition hover:opacity-90"
      >
        <Plus size={16} strokeWidth={2.4} />
        New entry
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5 px-2.5">
        <div className="px-3 pb-2 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-soft">
          Workspace
        </div>
        {nav.map((it) => (
          <NavLink key={it.href} item={it} active={isActive(it.href)} />
        ))}

        {isAdmin && (
          <>
            <div className="px-3 pb-2 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-soft">
              Admin
            </div>
            {adminNav.map((it) => (
              <NavLink key={it.href} item={it} active={isActive(it.href)} />
            ))}
          </>
        )}
      </nav>

      <div className="m-3 flex items-center gap-2.5 rounded-md border border-line bg-surface-2 p-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-xs font-bold text-accent-ink">
          {initials}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[12.5px] font-semibold">{user.name}</div>
          <div className="mt-px text-[11px] text-muted">{user.role}</div>
        </div>
      </div>
    </aside>
  );
}
