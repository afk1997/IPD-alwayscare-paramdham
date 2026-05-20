// Modern browsers expose navigator.clipboard, but Safari inside iframes
// and non-https origins block it.  Fall back to the legacy textarea
// trick so the action still works in those contexts.
export interface ClipboardCallbacks {
  onSuccess: () => void;
  onFallback: () => void;
}

export async function copyToClipboard(text: string, cb: ClipboardCallbacks): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    cb.onSuccess();
    return;
  } catch {
    // fall through
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    cb.onFallback();
  } finally {
    document.body.removeChild(ta);
  }
}
