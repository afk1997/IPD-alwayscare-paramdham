'use client';
import { createContext, useContext, useMemo } from 'react';
import type { ActiveUserLite } from './queries';
import type { Role } from './schema';

interface ActiveUsersContextValue {
  users: ActiveUserLite[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: Role;
}

const ActiveUsersContext = createContext<ActiveUsersContextValue | null>(null);

interface ProviderProps {
  users: ActiveUserLite[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: Role;
  children: React.ReactNode;
}

// Surfaces the layout-level active-user list and the current actor's
// identity to every descendant.  Used by activity forms (Logged-by
// dropdown) and by any client component that needs to conditionally
// render write controls (hidden for VIEWER).  Mounted once in AppShell.
//
// currentUserId is carried alongside currentUserName because user names
// are not unique in the schema — id-based dedup in the activity dropdown
// prevents a SUPER_ADMIN's self-option from being silently absorbed by a
// name-colliding STAFF row.
export function ActiveUsersProvider({
  users,
  currentUserId,
  currentUserName,
  currentUserRole,
  children,
}: ProviderProps) {
  // Memoise the value object so the AppShell's drawer-toggle re-renders
  // don't churn every consumer of useActiveUsers().
  const value = useMemo(
    () => ({ users, currentUserId, currentUserName, currentUserRole }),
    [users, currentUserId, currentUserName, currentUserRole],
  );
  return <ActiveUsersContext.Provider value={value}>{children}</ActiveUsersContext.Provider>;
}

export function useActiveUsers(): ActiveUsersContextValue {
  const ctx = useContext(ActiveUsersContext);
  if (!ctx) {
    throw new Error('useActiveUsers must be used inside ActiveUsersProvider');
  }
  return ctx;
}

export const isWriteRole = (role: Role): boolean => role !== 'VIEWER';
