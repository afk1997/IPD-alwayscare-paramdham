import type { ActivityType } from '@/features/activities/schema';

export type QuickAddAction = 'admission' | 'activity' | 'document' | 'lifecycle';

export type QuickAddStep =
  | { kind: 'menu' }
  | { kind: 'pick-patient'; purpose: 'activity' | 'document' | 'lifecycle' }
  | { kind: 'activity-type'; animalId: string; animalName: string }
  | { kind: 'activity-form'; animalId: string; animalName: string; type: ActivityType }
  | { kind: 'document-form'; animalId: string; animalName: string }
  | { kind: 'lifecycle-form'; animalId: string; animalName: string };
