import { afterEach, describe, expect, it, vi } from 'vitest';
import { resumableUpload } from '../resumable';

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone() {
      return this;
    },
    headers: { get: () => null },
  } as unknown as Response;
}

const UPLOAD_URL = 'https://drive.example/resumable-session?id=abc';
const FINALIZE_BODY = {
  id: 'asset1',
  status: 'READY',
  kind: 'PHOTO',
  filename: 'p.jpg',
  width: 10,
  height: 10,
  durationSec: null,
  url: 'https://app/api/files/asset1?sig=x',
};

/**
 * Stub global fetch for the resumable flow. initiate + finalize are answered
 * here; every PUT to the Drive upload URL is delegated to `onUpload` so each
 * test controls only the Drive behavior it cares about.
 */
function installFetchMock(onUpload: (init: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/files/initiate')) {
      return mockResponse({ assetId: 'asset1', uploadUrl: UPLOAD_URL, chunkSize: 8 * 1024 * 1024 });
    }
    if (u.includes('/api/files/finalize')) return mockResponse(FINALIZE_BODY);
    if (u.startsWith(UPLOAD_URL)) return onUpload(init ?? {});
    throw new Error(`unexpected fetch: ${u}`);
  });
  vi.stubGlobal('fetch', fetchMock);
}

const rangeOf = (init: RequestInit) =>
  ((init.headers ?? {}) as Record<string, string>)['content-range'] ?? '';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resumableUpload — Drive PUT request shape', () => {
  // Regression guard for the "photo upload: Load failed" bug. The old code had
  // a single-PUT fast path for files <= 8 MiB that sent a Content-Type header,
  // omitted Content-Range, and — critically — had no retry/resume, so a
  // transient network drop failed hard. Small files (photos) must now take the
  // same resumable path videos use: Content-Range present, NO Content-Type.
  it('uploads a sub-chunk file with Content-Range and without Content-Type', async () => {
    const puts: RequestInit[] = [];
    installFetchMock((init) => {
      puts.push(init);
      return mockResponse({ id: 'driveFile1' }, 200);
    });
    const file = new File([new Uint8Array(1234).fill(65)], 'p.jpg', { type: 'image/jpeg' });

    const result = await resumableUpload({
      file,
      context: { kind: 'staging', sessionId: 'sess-1234' },
    });

    expect(result.id).toBe('asset1');
    expect(puts).toHaveLength(1);
    const put = puts[0];
    if (!put) throw new Error('expected one PUT to the Drive upload URL');
    const headers = (put.headers ?? {}) as Record<string, string>;
    expect(put.method).toBe('PUT');
    // The resumable protocol header — proves we took the chunked path.
    expect(headers['content-range']).toBe('bytes 0-1233/1234');
    // The header whose presence marked the fragile single-PUT fast path.
    expect('content-type' in headers).toBe(false);
  });

  // The whole point of the fix: a small file (a photo) must now survive a
  // transient network drop. The old single-PUT path had no retry, so the same
  // thrown fetch ("Load failed") propagated and the upload failed hard.
  it('recovers a sub-chunk file when the first Drive PUT throws', async () => {
    let chunkPuts = 0;
    installFetchMock((init) => {
      // The resume-position probe (`bytes *​/<total>`, empty body): nothing yet.
      if (rangeOf(init).startsWith('bytes */')) {
        return { ok: false, status: 308, headers: { get: () => null } } as unknown as Response;
      }
      chunkPuts++;
      if (chunkPuts === 1) throw new TypeError('Load failed'); // the transient blip
      return mockResponse({ id: 'driveFile1' }, 200);
    });
    const file = new File([new Uint8Array(1234).fill(65)], 'p.jpg', { type: 'image/jpeg' });

    const result = await resumableUpload({
      file,
      context: { kind: 'staging', sessionId: 'sess-1234' },
    });

    expect(result.id).toBe('asset1');
    expect(chunkPuts).toBe(2); // threw once, resumed, succeeded
  });
});
