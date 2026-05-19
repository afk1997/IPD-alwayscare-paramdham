'use client';
import { ToastProvider } from '@/components/ui/Toast';
import { QuickAddProvider } from '@/features/quick-add/QuickAddProvider';
import { CommandPaletteProvider } from '@/features/search/CommandPalette';
import { Suspense, useState } from 'react';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { SideNavDrawer } from './SideNavDrawer';
import { TopBar } from './TopBar';
import { useViewport } from './useViewport';

interface Props {
  user: { name: string; role: string; isAdmin: boolean };
  title?: string | undefined;
  children: React.ReactNode;
}

export function AppShell({ user, title, children }: Props) {
  const { narrow } = useViewport();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Suspense fallback={null}>
      <ToastProvider>
        <CommandPaletteProvider>
          <QuickAddProvider>
            <div className="flex min-h-screen bg-bg text-text">
              {!narrow && <SideNav isAdmin={user.isAdmin} user={user} />}
              <SideNavDrawer
                open={narrow && drawerOpen}
                onClose={() => setDrawerOpen(false)}
                isAdmin={user.isAdmin}
                user={user}
              />

              <main className="flex h-screen min-w-0 flex-1 flex-col">
                <TopBar narrow={narrow} title={title} onMenuClick={() => setDrawerOpen(true)} />
                <div className={`flex-1 overflow-auto ${narrow ? 'pb-20' : ''}`}>
                  <div className="mx-auto max-w-[1040px] px-4 py-6 md:px-7">{children}</div>
                </div>
                {narrow && <BottomNav />}
              </main>
            </div>
          </QuickAddProvider>
        </CommandPaletteProvider>
      </ToastProvider>
    </Suspense>
  );
}
