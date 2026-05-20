'use client';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { getPatientDailyShareTextAction } from '@/features/reports/actions';
import { copyToClipboard } from '@/lib/clipboard';
import { Share2 } from 'lucide-react';
import { useTransition } from 'react';

interface Props {
  animalId: string;
}

export function PatientShareButton({ animalId }: Props) {
  const { showToast } = useToast();
  const [pending, start] = useTransition();

  const onClick = () => {
    start(async () => {
      const result = await getPatientDailyShareTextAction(animalId);
      if (!result.ok || !result.text) {
        showToast({ message: result.error ?? 'Could not prepare share text' });
        return;
      }
      await copyToClipboard(result.text, {
        onSuccess: () => showToast({ message: "Patient's day copied — paste in WhatsApp / Slack / etc." }),
        onFallback: () => showToast({ message: "Patient's day copied (fallback)" }),
      });
    });
  };

  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={pending}>
      <Share2 size={14} />
      Share
    </Button>
  );
}
