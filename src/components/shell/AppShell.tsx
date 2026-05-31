'use client';
import { InstallButton } from '@/components/pwa/InstallButton';
import { PwaController } from '@/components/pwa/PwaController';
import { ToastProvider } from '@/components/ui/Toast';
import { QuickAddProvider } from '@/features/quick-add/QuickAddProvider';
import { CommandPaletteProvider } from '@/features/search/CommandPalette';
import { ActiveUsersProvider } from '@/features/users/ActiveUsersContext';
import type { ActiveUserLite } from '@/features/users/queries';
import type { Role } from '@/features/users/schema';
import { Suspense, useState } from 'react';
import { BottomNav } from './BottomNav';
import { SideNav } from './SideNav';
import { SideNavDrawer } from './SideNavDrawer';
import { TopBar } from './TopBar';

interface Props {
  user: { id: string; name: string; role: string; isAdmin: boolean; rawRole: Role };
  activeUsers: ActiveUserLite[];
  title?: string | undefined;
  children: React.ReactNode;
}

export function AppShell({ user, activeUsers, title, children }: Props) {
  // We previously branched the JSX on viewport width (`useViewport.narrow`).
  // That caused a SSR/CSR hydration mismatch — the server rendered `<aside>`
  // (wide), the mobile client re-rendered `<dialog>` (narrow), and React
  // logged "rendered HTML didn't match the client" on every mobile load.
  //
  // Render both nav surfaces unconditionally and rely on Tailwind responsive
  // classes (`md:flex` / `md:hidden`) to swap them.  Server + client agree
  // on the markup; the browser's CSS decides which one is visible.
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Suspense fallback={null}>
      <ActiveUsersProvider
        users={activeUsers}
        currentUserId={user.id}
        currentUserName={user.name}
        currentUserRole={user.rawRole}
      >
        <ToastProvider>
          <PwaController />
          <CommandPaletteProvider>
            <QuickAddProvider>
              <div className="flex min-h-screen bg-bg text-text">
                <SideNav isAdmin={user.isAdmin} userRole={user.rawRole} user={user} />
                <SideNavDrawer
                  open={drawerOpen}
                  onClose={() => setDrawerOpen(false)}
                  isAdmin={user.isAdmin}
                  userRole={user.rawRole}
                  user={user}
                />

                <main className="flex h-screen min-w-0 flex-1 flex-col">
                  <TopBar title={title} onMenuClick={() => setDrawerOpen(true)} />
                  <div className="flex-1 overflow-auto pb-20 md:pb-0">
                    <div className="mx-auto max-w-[1040px] px-4 py-6 md:px-7">{children}</div>
                  </div>
                  <BottomNav />
                  <InstallButton />
                </main>
              </div>
            </QuickAddProvider>
          </CommandPaletteProvider>
        </ToastProvider>
      </ActiveUsersProvider>
    </Suspense>
  );
}
