import { Readable } from 'node:stream';
import { getStorage } from '../src/lib/storage';

async function main() {
  const storage = getStorage();
  const buf = Buffer.from('arham-ipd-smoke-test\n');
  process.stdout.write('Uploading test file…\n');
  const put = await storage.put(buf, { filename: 'smoke.txt', mime: 'text/plain' });
  process.stdout.write(`OK: ${put.key} (${put.size} bytes)\n`);

  process.stdout.write('Downloading back…\n');
  const { stream } = await storage.get(put.key);
  const chunks: Buffer[] = [];
  for await (const c of stream instanceof Readable ? stream : Readable.from(stream as never)) {
    chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c as string));
  }
  const got = Buffer.concat(chunks).toString('utf-8');
  process.stdout.write(`Round-trip body: ${JSON.stringify(got)}\n`);

  process.stdout.write('Deleting test file…\n');
  await storage.delete(put.key);
  process.stdout.write('Done.\n');
}

main().catch((e) => {
  process.stderr.write(`FAILED: ${e instanceof Error ? e.message : String(e)}\n`);
  if (e instanceof Error && e.stack) process.stderr.write(`${e.stack}\n`);
  process.exit(1);
});
