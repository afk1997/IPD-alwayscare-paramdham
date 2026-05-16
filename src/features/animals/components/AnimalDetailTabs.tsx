'use client';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { useState } from 'react';

type Tab = 'feed' | 'info' | 'docs';

interface Props {
  activeCount: number;
  docCount: number;
  feed: React.ReactNode;
  info: React.ReactNode;
  docs: React.ReactNode;
}

export function AnimalDetailTabs({ activeCount, docCount, feed, info, docs }: Props) {
  const [tab, setTab] = useState<Tab>('feed');
  return (
    <div className="flex flex-col gap-4">
      <SegmentedTabs<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'feed', label: 'Activity', count: activeCount },
          { value: 'info', label: 'Details' },
          { value: 'docs', label: 'Documents', count: docCount },
        ]}
      />
      {tab === 'feed' && feed}
      {tab === 'info' && info}
      {tab === 'docs' && docs}
    </div>
  );
}
