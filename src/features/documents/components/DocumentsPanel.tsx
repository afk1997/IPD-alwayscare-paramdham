'use client';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import type { DocumentRow } from '../actions';
import { DocumentList } from './DocumentList';
import { DocumentUploadDialog } from './DocumentUploadDialog';

interface Props {
  animalId: string;
  initial: DocumentRow[];
  canWrite: boolean;
}

export function DocumentsPanel({ animalId, initial, canWrite }: Props) {
  const [documents, setDocuments] = useState<DocumentRow[]>(initial);

  return (
    <>
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-muted" />
          <h2 className="font-display font-bold text-base">Documents ({documents.length})</h2>
        </div>
        {canWrite && (
          <DocumentUploadDialog animalId={animalId} onCreated={(d) => setDocuments((prev) => [d, ...prev])} />
        )}
      </header>
      <DocumentList documents={documents} />
    </>
  );
}
