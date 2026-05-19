// biome-ignore lint/suspicious/noExplicitAny: per-type create fields share a relaxed RHF form type
export type AnyForm = any;

export interface CreateFieldsProps {
  form: AnyForm;
}
