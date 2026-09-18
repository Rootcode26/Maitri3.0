import net from 'node:net';

import { logger } from '../../config/logger.js';

export interface ScanResult {
  clean: boolean;
  signature?: string;
}

export interface MalwareScanner {
  scan(buffer: Buffer): Promise<ScanResult>;
}

export interface MalwareScannerConfig {
  CLAMAV_HOST?: string | undefined;
  CLAMAV_PORT: number;
  CLAMAV_TIMEOUT_MS: number;
}

class ClamdScanner implements MalwareScanner {
  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly timeoutMs: number,
  ) {}

  scan(buffer: Buffer): Promise<ScanResult> {
    return new Promise<ScanResult>((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port });
      socket.setTimeout(this.timeoutMs);
      const chunks: Buffer[] = [];

      socket.on('connect', () => {
        socket.write('zINSTREAM\0');
        const size = Buffer.allocUnsafe(4);
        size.writeUInt32BE(buffer.length, 0);
        socket.write(size);
        socket.write(buffer);
        const terminator = Buffer.alloc(4, 0);
        socket.write(terminator);
      });

      socket.on('data', (chunk: Buffer) => chunks.push(chunk));
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('clamd scan timed out'));
      });
      socket.on('error', reject);
      socket.on('end', () => {
        const reply = Buffer.concat(chunks).toString('utf8').replace(/\0+$/, '').trim();
        if (reply.endsWith('OK')) {
          resolve({ clean: true });
          return;
        }
        const found = reply.match(/^stream:\s+(.*)\s+FOUND$/);
        if (found) {
          resolve({ clean: false, ...(found[1] ? { signature: found[1] } : {}) });
          return;
        }
        reject(new Error(`Unexpected clamd reply: ${reply}`));
      });
    });
  }
}

export const createMalwareScanner = (config: MalwareScannerConfig): MalwareScanner | null => {
  if (!config.CLAMAV_HOST) {
    logger.info('Malware scanning not configured; uploads are not virus-scanned');
    return null;
  }
  return new ClamdScanner(config.CLAMAV_HOST, config.CLAMAV_PORT, config.CLAMAV_TIMEOUT_MS);
};
