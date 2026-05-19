'use client';
import { ChevronRight, type LucideIcon, Pill, Plus, SquareArrowOutUpRight, Upload } from 'lucide-react';
import type { QuickAddAction } from './types';

interface MenuItem {
  action: QuickAddAction;
  title: string;
  subtitle: string;
  icon: LucideIcon;
}

const ITEMS: MenuItem[] = [
  { action: 'admission', title: 'New admission', subtitle: 'Register an animal into IPD', icon: Plus },
  { action: 'activity', title: 'Log activity', subtitle: 'Treatment, round, food, surgery…', icon: Pill },
  { action: 'document', title: 'Upload document', subtitle: 'Reports, consent, ownership', icon: Upload },
  {
    action: 'lifecycle',
    title: 'Mark discharge / death',
    subtitle: 'End-of-stay flow',
    icon: SquareArrowOutUpRight,
  },
];

interface Props {
  onPick: (action: QuickAddAction) => void;
}

export function QuickAddMenu({ onPick }: Props) {
  return (
    <ul className="flex flex-col">
      {ITEMS.map((item, idx) => {
        const Icon = item.icon;
        return (
          <li key={item.action}>
            <button
              type="button"
              onClick={() => onPick(item.action)}
              className={`flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-paper-2 md:px-3 ${
                idx > 0 ? 'border-line border-t md:border-t-0' : ''
              }`}
            >
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent-ink">
                <Icon size={20} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display font-semibold text-[14.5px] text-text leading-tight">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-muted">{item.subtitle}</span>
              </span>
              <ChevronRight size={14} className="shrink-0 text-soft" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
