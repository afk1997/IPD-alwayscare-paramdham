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
  | 'animal.restore'
  | 'animal.discharge'
  | 'animal.death'
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
  'animal.create': ['STAFF', 'DOCTOR', 'ADMIN'],
  'animal.read': ['STAFF', 'DOCTOR', 'ADMIN'],
  'animal.update': ['DOCTOR', 'ADMIN'],
  'animal.delete': ['ADMIN'],
  'animal.restore': ['ADMIN'],
  'animal.discharge': ['DOCTOR', 'ADMIN'],
  'animal.death': ['DOCTOR', 'ADMIN'],
  'activity.create': ['STAFF', 'DOCTOR', 'ADMIN'],
  'activity.create.clinical': ['DOCTOR', 'ADMIN'],
  'activity.update.any': ['DOCTOR', 'ADMIN'],
  'activity.delete': ['DOCTOR', 'ADMIN'],
  'activity.restore': ['ADMIN'],
  'document.create': ['STAFF', 'DOCTOR', 'ADMIN'],
  'document.delete': ['DOCTOR', 'ADMIN'],
  'document.restore': ['ADMIN'],
  'document.read.all': ['ADMIN'],
  'user.manage': ['ADMIN'],
  'audit.read.all': ['ADMIN'],
  'trash.read': ['ADMIN'],
};

export function can(actor: Actor, action: Action): boolean {
  const allowed = PERMISSIONS[action];
  return allowed.includes(actor.role);
}

export function assertCan(actor: Actor, action: Action): void {
  if (!can(actor, action)) throw new RbacError(action);
}
