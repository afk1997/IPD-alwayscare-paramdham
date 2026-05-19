import { CalendarRange, PawPrint } from 'lucide-react';
import Link from 'next/link';

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted">View activity logs and per-animal histories</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Link
          href="/reports/today"
          className="flex items-start gap-3 rounded-lg border border-line bg-paper p-5 hover:bg-paper-2"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
            <CalendarRange size={18} />
          </div>
          <div>
            <h2 className="font-display text-base font-bold">Daily activity report</h2>
            <p className="mt-1 text-sm text-muted">
              All activities for any chosen date, with animal name and time.
            </p>
          </div>
        </Link>
        <Link
          href="/reports/by-animal"
          className="flex items-start gap-3 rounded-lg border border-line bg-paper p-5 hover:bg-paper-2"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
            <PawPrint size={18} />
          </div>
          <div>
            <h2 className="font-display font-bold text-base">Per-animal report</h2>
            <p className="mt-1 text-muted text-sm">
              Pick an animal to see its full case history with activity totals.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
