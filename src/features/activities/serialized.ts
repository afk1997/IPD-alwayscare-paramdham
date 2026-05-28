import type { ActivityType } from './schema';

export interface SerializedActivity {
  id: string;
  animalId: string;
  type: ActivityType;
  occurredAt: string;
  byName: string;
  remarks: string | null;
  editedAt: string | null;
  // biome-ignore lint/suspicious/noExplicitAny: server-erased data shape
  data: any;
  media: {
    id: string;
    assetId: string;
    kind: 'PHOTO' | 'VIDEO' | 'XRAY' | 'DOC';
    label: string | null;
    url: string;
  }[];
}

// biome-ignore lint/suspicious/noExplicitAny: prisma joined-row shape varies
export function serializeActivity(row: any, signUrl: (assetId: string) => string): SerializedActivity {
  return {
    id: row.id,
    animalId: row.animalId,
    type: row.type,
    occurredAt: row.occurredAt instanceof Date ? row.occurredAt.toISOString() : String(row.occurredAt),
    byName: row.byName,
    remarks: row.remarks ?? null,
    editedAt: row.editedAt
      ? row.editedAt instanceof Date
        ? row.editedAt.toISOString()
        : String(row.editedAt)
      : null,
    data: row.data,
    // biome-ignore lint/suspicious/noExplicitAny: prisma media row shape
    media: (row.media ?? []).map((m: any) => ({
      id: m.id,
      assetId: m.assetId,
      kind: m.asset.kind,
      label: m.label ?? null,
      url: signUrl(m.assetId),
    })),
  };
}
