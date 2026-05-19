import Link from 'next/link';

interface Props {
  active: 'today' | 'by-animal';
}

const TABS = [
  { id: 'today', href: '/reports/today', label: 'Activity by date' },
  { id: 'by-animal', href: '/reports/by-animal', label: 'By animal' },
] as const;

export function ReportsNav({ active }: Props) {
  return (
    <div className="flex gap-1 rounded-xl bg-paper-2 p-1">
      {TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <Link
            key={t.id}
            href={t.href}
            className={`flex-1 rounded-lg px-3 py-1.5 text-center font-semibold text-[13px] transition ${
              isActive ? 'bg-paper text-accent-ink shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
