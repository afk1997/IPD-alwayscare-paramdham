'use client';
import type { EditFieldsProps } from '../shared';
import { type Med, MedicineEditor } from './MedicineEditor';

export function TreatmentEditFields({ value, setData }: EditFieldsProps) {
  const meds: Med[] = (value.data.meds as Med[] | undefined) ?? [];
  return <MedicineEditor meds={meds} onChange={(next) => setData({ meds: next })} />;
}
