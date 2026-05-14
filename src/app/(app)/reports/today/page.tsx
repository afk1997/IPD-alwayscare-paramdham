import { DailyReport } from '@/features/reports/components/DailyReport';
import { listActivitiesOnDate } from '@/features/reports/queries';
import { Suspense } from 'react';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function TodayReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayISO();
  const rows = await listActivitiesOnDate(new Date(date));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Daily activity report</h1>
        <p className="mt-1 text-sm text-muted">Activities on the selected date</p>
      </div>
      <Suspense>
        <DailyReport date={date} rows={rows} />
      </Suspense>
    </div>
  );
}
