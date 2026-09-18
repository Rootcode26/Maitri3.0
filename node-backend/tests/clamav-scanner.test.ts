import net from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { createMalwareScanner } from '../src/integrations/clamav/scanner.js';

let server: net.Server | undefined;

const startFakeClamd = (): Promise<number> =>
  new Promise((resolve) => {
    server = net.createServer((socket) => {
      const chunks: Buffer[] = [];
      socket.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        const all = Buffer.concat(chunks);
        if (all.length >= 4 && all.subarray(all.length - 4).equals(Buffer.alloc(4, 0))) {
          const infected = all.includes(Buffer.from('EICAR'));
          socket.end(infected ? 'stream: Eicar-Test-Signature FOUND\0' : 'stream: OK\0');
        }
      });
    });
    server.listen(0, '127.0.0.1', () => resolve((server!.address() as net.AddressInfo).port));
  });

afterEach(
  () => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())),
);

describe('clamd malware scanner', () => {
  it('reports a clean buffer', async () => {
    const port = await startFakeClamd();
    const scanner = createMalwareScanner({
      CLAMAV_HOST: '127.0.0.1',
      CLAMAV_PORT: port,
      CLAMAV_TIMEOUT_MS: 2_000,
    })!;
    expect(await scanner.scan(Buffer.from('a perfectly clean file'))).toEqual({ clean: true });
  });

  it('reports an infected buffer with its signature', async () => {
    const port = await startFakeClamd();
    const scanner = createMalwareScanner({
      CLAMAV_HOST: '127.0.0.1',
      CLAMAV_PORT: port,
      CLAMAV_TIMEOUT_MS: 2_000,
    })!;
    const result = await scanner.scan(Buffer.from('X5O!P%@AP EICAR-STANDARD-ANTIVIRUS-TEST'));
    expect(result.clean).toBe(false);
    expect(result.signature).toBe('Eicar-Test-Signature');
  });

  it('returns null when CLAMAV_HOST is not configured', () => {
    expect(createMalwareScanner({ CLAMAV_PORT: 3310, CLAMAV_TIMEOUT_MS: 1_000 })).toBeNull();
  });
});
