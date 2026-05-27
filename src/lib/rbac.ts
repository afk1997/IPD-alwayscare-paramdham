import { RbacError } from './errors';

export type Role = 'STAFF' | 'DOCTOR' | 'ADMIN' | 'SUPER_ADMIN' | 'VIEWER';

export interface Actor {
  id: string;
  role: Role;
}

export type Action =
  | 'animal.create'
  | 'animal.read'
  | 'animal.update'
  | 'animal.delete'
  | 'animal.restore'
  | 'animal.discharge'
  | 'animal.death'
  | 'cage.manage'
  | 'activity.create'
  | 'activity.create.clinical'
  | 'activity.update.any'
  | 'activity.delete'
  | 'activity.restore'
  | 'document.create'
  | 'document.delete'
  | 'document.restore'
  | 'document.read.all'
  | 'user.manage'
  | 'audit.read.all'
  | 'trash.read';

const PERMISSIONS: Record<Action, Role[]> = {
  'animal.create': ['STAFF', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'animal.read': ['STAFF', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN', 'VIEWER'],
  'animal.update': ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'animal.delete': ['ADMIN', 'SUPER_ADMIN'],
  'animal.restore': ['ADMIN', 'SUPER_ADMIN'],
  'animal.discharge': ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'animal.death': ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'cage.manage': ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'activity.create': ['STAFF', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'activity.create.clinical': ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'activity.update.any': ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'activity.delete': ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'activity.restore': ['ADMIN', 'SUPER_ADMIN'],
  'document.create': ['STAFF', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'document.delete': ['DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  'document.restore': ['ADMIN', 'SUPER_ADMIN'],
  'document.read.all': ['ADMIN', 'SUPER_ADMIN'],
  'user.manage': ['ADMIN', 'SUPER_ADMIN'],
  'audit.read.all': ['ADMIN', 'SUPER_ADMIN'],
  'trash.read': ['ADMIN', 'SUPER_ADMIN'],
};

export function can(actor: Actor, action: Action): boolean {
  const allowed = PERMISSIONS[action];
  return allowed.includes(actor.role);
}

export function assertCan(actor: Actor, action: Action): void {
  if (!can(actor, action)) throw new RbacError(action);
}
