'use client';
import { createContext, useContext } from 'react';
import type { ActiveUserLite } from './queries';

interface ActiveUsersContextValue {
  users: ActiveUserLite[];
  currentUserName: string;
}

const ActiveUsersContext = createContext<ActiveUsersContextValue | null>(null);

interface ProviderProps {
  users: ActiveUserLite[];
  currentUserName: string;
  children: React.ReactNode;
}

// Surfaces the layout-level active-user list to every descendant so
// activity forms can render their "Logged by" dropdown without an
// extra client fetch.  Mounted once in AppShell.
export function ActiveUsersProvider({ users, currentUserName, children }: ProviderProps) {
  return (
    <ActiveUsersContext.Provider value={{ users, currentUserName }}>{children}</ActiveUsersContext.Provider>
  );
}

export function useActiveUsers(): ActiveUsersContextValue {
  const ctx = useContext(ActiveUsersContext);
  if (!ctx) {
    throw new Error('useActiveUsers must be used inside ActiveUsersProvider');
  }
  return ctx;
}
