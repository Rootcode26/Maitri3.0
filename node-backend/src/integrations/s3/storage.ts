import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { logger } from '../../config/logger.js';

export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  signedGetUrl(
    key: string,
    fileName?: string,
    disposition?: 'attachment' | 'inline',
  ): Promise<string>;
}

export interface ObjectStorageConfig {
  S3_REGION: string;
  S3_BUCKET?: string | undefined;
  S3_ENDPOINT?: string | undefined;
  S3_ACCESS_KEY_ID?: string | undefined;
  S3_SECRET_ACCESS_KEY?: string | undefined;
  S3_FORCE_PATH_STYLE: boolean;
  S3_SIGNED_URL_TTL_SECONDS: number;
}

class S3ObjectStorage implements ObjectStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly signedUrlTtlSeconds: number,
  ) {}

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error(`Object ${key} returned no body`);
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async signedGetUrl(
    key: string,
    fileName?: string,
    disposition: 'attachment' | 'inline' = 'attachment',
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        // 'inline' lets the browser render the file in a preview iframe;
        // 'attachment' forces a download.
        ResponseContentDisposition: `${disposition}${fileName ? `; filename="${fileName}"` : ''}`,
      }),
      { expiresIn: this.signedUrlTtlSeconds },
    );
  }
}

export const createObjectStorage = (config: ObjectStorageConfig): ObjectStorage | null => {
  if (!config.S3_BUCKET || !config.S3_ACCESS_KEY_ID || !config.S3_SECRET_ACCESS_KEY) {
    logger.info('Object storage not configured; document uploads are disabled');
    return null;
  }

  const client = new S3Client({
    region: config.S3_REGION,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
    ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}),
  });

  return new S3ObjectStorage(client, config.S3_BUCKET, config.S3_SIGNED_URL_TTL_SECONDS);
};
