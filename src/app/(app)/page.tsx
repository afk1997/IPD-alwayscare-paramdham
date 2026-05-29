import { TodayDashboard } from '@/features/reports/components/TodayDashboard';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  return <TodayDashboard show={show ?? undefined} />;
}
