'use client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { FileDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  animalId: string;
  canGenerate: boolean;
  admittedAt: string; // ISO; bounds the range picker
}

export function DownloadReportButton({ animalId, canGenerate, admittedAt }: Props) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<'all' | 'range'>('all');
  const minDate = admittedAt.slice(0, 10);
  const maxDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [from, setFrom] = useState(minDate);
  const [to, setTo] = useState(maxDate);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!canGenerate) return null;

  const generate = async () => {
    setBusy(true);
    try {
      const lo = from <= to ? from : to;
      const hi = from <= to ? to : from;
      const qs = scope === 'range' ? `?from=${lo}&to=${hi}` : '';
      const res = await fetch(`/api/patients/${animalId}/report${qs}`);
      if (!res.ok) {
        showToast({ message: 'Could not generate the report' });
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') ?? '';
      const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? 'patient-report.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch {
      showToast({ message: 'Could not generate the report' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <FileDown size={14} />
        Download report (PDF)
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center md:items-center"
          aria-modal="true"
          aria-label="Download report"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-black/45"
          />
          <div
            ref={dialogRef}
            className="relative z-10 w-full max-w-md rounded-t-lg bg-paper p-6 shadow-2xl md:rounded-lg"
          >
            <h2 className="font-display text-base font-bold">Download patient report</h2>
            <p className="mt-1 text-sm text-muted">A full clinical PDF with every activity and all photos.</p>
            <div className="mt-4 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />
                Whole stay
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'range'}
                  onChange={() => setScope('range')}
                />
                Date range
              </label>
              {scope === 'range' && (
                <div className="flex items-end gap-3 pl-6">
                  <label htmlFor="report-range-from" className="flex flex-col gap-1 text-[11px] text-muted">
                    From
                    <Input
                      id="report-range-from"
                      type="date"
                      min={minDate}
                      max={maxDate}
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className="w-auto"
                    />
                  </label>
                  <label htmlFor="report-range-to" className="flex flex-col gap-1 text-[11px] text-muted">
                    To
                    <Input
                      id="report-range-to"
                      type="date"
                      min={minDate}
                      max={maxDate}
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className="w-auto"
                    />
                  </label>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button size="sm" onClick={generate} disabled={busy}>
                {busy ? 'Generating…' : 'Generate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
