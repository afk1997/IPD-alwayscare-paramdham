import { RbacError } from './errors';

export type Role = 'STAFF' | 'DOCTOR' | 'ADMIN';

export interface Actor {
  id: string;
  role: Role;
}

export type Action =
  | 'animal.create'
  | 'animal.read'
  | 'animal.update'
  | 'animal.delete'
  | 'animal.discharge'
  | 'animal.death'
  | 'activity.create'
  | 'activity.create.clinical'
  | 'activity.update.any'
  | 'activity.delete'
  | 'document.create'
  | 'document.delete'
  | 'user.manage'
  | 'audit.read.all';

const PERMISSIONS: Record<Action, Role[]> = {
  'animal.create': ['STAFF', 'DOCTOR', 'ADMIN'],
  'animal.read': ['STAFF', 'DOCTOR', 'ADMIN'],
  'animal.update': ['DOCTOR', 'ADMIN'],
  'animal.delete': ['ADMIN'],
  'animal.discharge': ['DOCTOR', 'ADMIN'],
  'animal.death': ['DOCTOR', 'ADMIN'],
  'activity.create': ['STAFF', 'DOCTOR', 'ADMIN'],
  'activity.create.clinical': ['DOCTOR', 'ADMIN'],
  'activity.update.any': ['DOCTOR', 'ADMIN'],
  'activity.delete': ['DOCTOR', 'ADMIN'],
  'document.create': ['STAFF', 'DOCTOR', 'ADMIN'],
  'document.delete': ['DOCTOR', 'ADMIN'],
  'user.manage': ['ADMIN'],
  'audit.read.all': ['ADMIN'],
};

export function can(actor: Actor, action: Action): boolean {
  const allowed = PERMISSIONS[action];
  return allowed.includes(actor.role);
}

export function assertCan(actor: Actor, action: Action): void {
  if (!can(actor, action)) throw new RbacError(action);
}
