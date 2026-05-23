'use client';
import { createContext, useContext } from 'react';
import type { ActiveUserLite } from './queries';
import type { Role } from './schema';

interface ActiveUsersContextValue {
  users: ActiveUserLite[];
  currentUserName: string;
  currentUserRole: Role;
}

const ActiveUsersContext = createContext<ActiveUsersContextValue | null>(null);

interface ProviderProps {
  users: ActiveUserLite[];
  currentUserName: string;
  currentUserRole: Role;
  children: React.ReactNode;
}

// Surfaces the layout-level active-user list and the current actor's
// role to every descendant.  Used by activity forms (Logged-by dropdown)
// and by any client component that needs to conditionally render write
// controls (hidden for VIEWER).  Mounted once in AppShell.
export function ActiveUsersProvider({ users, currentUserName, currentUserRole, children }: ProviderProps) {
  return (
    <ActiveUsersContext.Provider value={{ users, currentUserName, currentUserRole }}>
      {children}
    </ActiveUsersContext.Provider>
  );
}

export function useActiveUsers(): ActiveUsersContextValue {
  const ctx = useContext(ActiveUsersContext);
  if (!ctx) {
    throw new Error('useActiveUsers must be used inside ActiveUsersProvider');
  }
  return ctx;
}

export const isWriteRole = (role: Role): boolean => role !== 'VIEWER';
