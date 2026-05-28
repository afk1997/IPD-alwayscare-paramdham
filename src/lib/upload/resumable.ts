/**
 * Client-side helper: initiates a resumable upload session via our `/api/files/initiate`,
 * uploads the file directly to Google Drive in 8 MiB chunks (so we bypass Vercel's
 * 4.5MB request body limit), then calls `/api/files/finalize` so the server can stamp
 * width/height/duration and mark the MediaAsset ready.
 */

export type UploadContext =
  | { kind: 'staging'; sessionId: string }
  | { kind: 'activity'; animalId: string; activityType: string; occurredAt: string }
  | { kind: 'document'; animalId: string; category: string };

export interface InitiateResponse {
  assetId: string;
  uploadUrl: string;
  chunkSize: number;
}

export interface FinalizeResponse {
  id: string;
  status: 'PENDING' | 'READY' | 'FAILED';
  kind: 'PHOTO' | 'VIDEO' | 'DOC' | 'XRAY';
  filename: string;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  /** Pre-signed URL for the asset, ready to use in <img src>. */
  url: string;
}

export interface ResumableUploadProgress {
  uploaded: number;
  total: number;
  fraction: number;
}

export interface ResumableUploadOptions {
  file: File;
  context: UploadContext;
  signal?: AbortSignal;
  onProgress?: (p: ResumableUploadProgress) => void;
}

export async function resumableUpload(opts: ResumableUploadOptions): Promise<FinalizeResponse> {
  const { file, context, signal, onProgress } = opts;

  // 1. Mint a resumable session.
  const initRes = await fetch('/api/files/initiate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      context,
    }),
    signal: signal ?? null,
  });
  if (!initRes.ok) {
    const j = (await initRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(`initiate failed (${initRes.status}): ${j.error ?? 'unknown'}`);
  }
  const { assetId, uploadUrl, chunkSize } = (await initRes.json()) as InitiateResponse;

  // 2. Push the bytes to Drive.
  const driveFileId = await pushToDrive(file, uploadUrl, chunkSize, signal, onProgress);

  // 3. Finalize on our server.
  const finRes = await fetch('/api/files/finalize', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ assetId, driveFileId }),
    signal: signal ?? null,
  });
  if (!finRes.ok) {
    const j = (await finRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(`finalize failed (${finRes.status}): ${j.error ?? 'unknown'}`);
  }
  return (await finRes.json()) as FinalizeResponse;
}

async function pushToDrive(
  file: File,
  uploadUrl: string,
  chunkSize: number,
  signal: AbortSignal | undefined,
  onProgress: ((p: ResumableUploadProgress) => void) | undefined,
): Promise<string> {
  const total = file.size;

  // Small files: single PUT for speed.
  if (total <= chunkSize) {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'content-type': file.type || 'application/octet-stream',
      },
      body: file,
      signal: signal ?? null,
    });
    if (!res.ok) {
      throw new Error(`drive PUT failed: ${res.status} ${await res.text().catch(() => '')}`);
    }
    onProgress?.({ uploaded: total, total, fraction: 1 });
    const json = (await res.json()) as { id?: string };
    if (!json.id) throw new Error('drive PUT returned no file id');
    return json.id;
  }

  // Chunked upload. Drive requires chunk sizes that are multiples of 256 KiB
  // (except the final one). chunkSize is already 8 MiB so the alignment is fine.
  // We retry transient failures by querying Drive for how much it actually
  // received and resuming from there.
  let start = 0;
  let attemptsAtSamePosition = 0;
  const MAX_ATTEMPTS_PER_POSITION = 4;

  while (start < total) {
    const end = Math.min(start + chunkSize, total);
    const chunk = file.slice(start, end);
    let res: Response;
    try {
      res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'content-range': `bytes ${start}-${end - 1}/${total}` },
        body: chunk,
        signal: signal ?? null,
      });
    } catch (e) {
      attemptsAtSamePosition++;
      if (attemptsAtSamePosition > MAX_ATTEMPTS_PER_POSITION) throw e;
      // Network blip — ask Drive what it has and pick up from there.
      const resumed = await queryResumePosition(uploadUrl, total, signal);
      if (resumed === 'complete') {
        throw new Error('drive upload reported complete during retry but file id is unknown');
      }
      start = resumed;
      await backoff(attemptsAtSamePosition);
      continue;
    }

    if (res.status === 308) {
      // Drive accepted this chunk; the Range header tells us what bytes it has.
      const range = res.headers.get('range');
      const lastByte = range ? Number(range.split('-')[1] ?? end - 1) : end - 1;
      start = lastByte + 1;
      attemptsAtSamePosition = 0;
      onProgress?.({ uploaded: start, total, fraction: start / total });
      continue;
    }

    if (res.ok) {
      onProgress?.({ uploaded: total, total, fraction: 1 });
      const json = (await res.json()) as { id?: string };
      if (!json.id) throw new Error('drive final chunk returned no file id');
      return json.id;
    }

    // 5xx → retry with backoff; 4xx → fatal.
    if (res.status >= 500) {
      attemptsAtSamePosition++;
      if (attemptsAtSamePosition > MAX_ATTEMPTS_PER_POSITION) {
        throw new Error(`drive chunk PUT failed: ${res.status}`);
      }
      const resumed = await queryResumePosition(uploadUrl, total, signal);
      if (resumed === 'complete') {
        throw new Error('drive upload reported complete during retry but file id is unknown');
      }
      start = resumed;
      await backoff(attemptsAtSamePosition);
      continue;
    }

    throw new Error(
      `drive chunk PUT failed at byte ${start}: ${res.status} ${await res.text().catch(() => '')}`,
    );
  }

  throw new Error('drive upload did not produce a final response');
}

/**
 * Drive resumable protocol: send a PUT with `Content-Range: bytes star/<total>`
 * and an empty body. A 308 with a `Range:` header indicates how much Drive has;
 * a 2xx means it's already complete.
 */
async function queryResumePosition(
  uploadUrl: string,
  total: number,
  signal: AbortSignal | undefined,
): Promise<number | 'complete'> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-range': `bytes */${total}`, 'content-length': '0' },
    signal: signal ?? null,
  });
  if (res.ok) return 'complete';
  if (res.status !== 308) {
    throw new Error(`drive resume query failed: ${res.status}`);
  }
  const range = res.headers.get('range');
  if (!range) return 0;
  const lastByte = Number(range.split('-')[1] ?? '-1');
  return Number.isFinite(lastByte) ? lastByte + 1 : 0;
}

function backoff(attempt: number): Promise<void> {
  // 200ms, 400ms, 800ms, 1600ms with jitter.
  const base = 200 * 2 ** (attempt - 1);
  const jitter = Math.random() * base * 0.25;
  return new Promise((r) => setTimeout(r, base + jitter));
}

/** Generate a short, URL-safe session id (used during admission to group uploads). */
export function newUploadSessionId(): string {
  const rand = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(rand, (b) => b.toString(16).padStart(2, '0')).join('');
}
