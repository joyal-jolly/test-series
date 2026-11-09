import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_UPLOADS_DIR = path.resolve(__dirname, '../uploads');

/**
 * Validates that a buffer starts with the PDF magic bytes (%PDF-).
 * Byte values: 0x25, 0x50, 0x44, 0x46
 */
export function isValidPdf(buffer) {
  if (!buffer || buffer.length < 4) return false;
  return (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  );
}

/**
 * Normalizes an object key to strip leading slashes or /uploads/ prefix.
 * e.g., "/uploads/papers/xyz.pdf" -> "papers/xyz.pdf"
 *       "/api/files/papers/xyz.pdf" -> "papers/xyz.pdf"
 */
export function normalizeStorageKey(rawKey) {
  if (!rawKey) return '';
  let key = String(rawKey).trim();
  // Strip url queries or hash
  key = key.split('?')[0].split('#')[0];
  // Strip leading prefixes
  if (key.startsWith('/api/files/')) {
    key = key.slice('/api/files/'.length);
  } else if (key.startsWith('/uploads/')) {
    key = key.slice('/uploads/'.length);
  } else if (key.startsWith('uploads/')) {
    key = key.slice('uploads/'.length);
  } else if (key.startsWith('/')) {
    key = key.slice(1);
  }
  return key;
}

/**
 * Unified Storage Service supporting Cloudflare R2 (S3-compatible API & Workers binding)
 * with graceful local filesystem fallback for development when R2 credentials are unset.
 */
class StorageService {
  constructor() {
    this.r2Client = null;
    this.bucketName = process.env.R2_BUCKET_NAME || '';
    this.accountId = process.env.R2_ACCOUNT_ID || '';
    this.workersBucket = null; // Populated in Cloudflare Workers environment via env.R2_BUCKET

    this._initS3Client();
  }

  /**
   * Set native Cloudflare Workers R2 Bucket binding if running inside Cloudflare Workers
   */
  setWorkersBinding(bucket) {
    this.workersBucket = bucket;
  }

  _initS3Client() {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const accountId = process.env.R2_ACCOUNT_ID;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (accessKeyId && secretAccessKey && accountId && bucketName) {
      this.bucketName = bucketName;
      this.accountId = accountId;
      this.r2Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      console.log(`[Storage] Cloudflare R2 initialized with bucket "${bucketName}".`);
    } else {
      console.log(
        '[Storage] Cloudflare R2 credentials not fully set in environment. Falling back to local filesystem storage.'
      );
    }
  }

  isR2Active() {
    return Boolean(this.workersBucket || this.r2Client);
  }

  /**
   * Uploads a file buffer to storage.
   * @param {Object} params
   * @param {string} params.key - Key e.g. "papers/<uuid>.pdf", "answers/<uuid>.pdf", "drafts/<id>.json"
   * @param {Buffer|Uint8Array} params.buffer - File data
   * @param {string} [params.contentType='application/pdf']
   * @param {Object} [params.metadata={}]
   * @returns {Promise<{ key: string, size: number, contentType: string }>}
   */
  async uploadFile({ key, buffer, contentType = 'application/pdf', metadata = {} }) {
    const cleanKey = normalizeStorageKey(key);
    if (!cleanKey) throw new Error('Storage key is required');
    if (!buffer) throw new Error('File buffer is required');

    // 1. Cloudflare Workers native R2 binding
    if (this.workersBucket) {
      await this.workersBucket.put(cleanKey, buffer, {
        httpMetadata: { contentType },
        customMetadata: metadata,
      });
      return { key: cleanKey, size: buffer.length, contentType };
    }

    // 2. Node.js S3-compatible R2 Client
    if (this.r2Client) {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: cleanKey,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
      });
      await this.r2Client.send(command);
      return { key: cleanKey, size: buffer.length, contentType };
    }

    // 3. Local filesystem fallback
    const localPath = path.join(LOCAL_UPLOADS_DIR, cleanKey);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, buffer);
    return { key: cleanKey, size: buffer.length, contentType };
  }

  /**
   * Retrieves a file from storage.
   * @param {string} key
   * @param {Object} [options]
   * @param {string} [options.range] - HTTP Range header e.g. "bytes=0-1023"
   * @returns {Promise<{ stream?: any, buffer?: Buffer, contentType: string, contentLength: number, contentRange?: string, lastModified?: Date }>}
   */
  async getFile(key, options = {}) {
    const cleanKey = normalizeStorageKey(key);
    if (!cleanKey) throw new Error('Storage key is required');

    // 1. Cloudflare Workers native R2 binding
    if (this.workersBucket) {
      const r2Options = {};
      if (options.range) {
        // Parse "bytes=start-end"
        const match = /bytes=(\d+)-(\d+)?/.exec(options.range);
        if (match) {
          const offset = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : undefined;
          r2Options.range = { offset, length: end !== undefined ? end - offset + 1 : undefined };
        }
      }
      const object = await this.workersBucket.get(cleanKey, r2Options);
      if (!object) return null;

      const contentType = object.httpMetadata?.contentType || 'application/pdf';
      return {
        stream: object.body,
        contentType,
        contentLength: object.size,
        lastModified: object.uploaded,
      };
    }

    // 2. Node.js S3-compatible R2 Client
    if (this.r2Client) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: cleanKey,
          Range: options.range,
        });
        const res = await this.r2Client.send(command);
        return {
          stream: res.Body,
          contentType: res.ContentType || 'application/pdf',
          contentLength: res.ContentLength,
          contentRange: res.ContentRange,
          lastModified: res.LastModified,
        };
      } catch (err) {
        if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
          // If not in R2, check local disk before giving up (e.g. during migration)
          const fallback = this._getLocalFile(cleanKey, options);
          if (fallback) return fallback;
          return null;
        }
        throw err;
      }
    }

    // 3. Local filesystem fallback
    return this._getLocalFile(cleanKey, options);
  }

  _getLocalFile(cleanKey, options = {}) {
    const localPath = path.join(LOCAL_UPLOADS_DIR, cleanKey);
    if (!fs.existsSync(localPath)) return null;

    const stats = fs.statSync(localPath);
    let start = 0;
    let end = stats.size - 1;
    let contentRange;
    let contentLength = stats.size;
    let isRange = false;

    if (options.range) {
      const match = /bytes=(\d+)-(\d+)?/.exec(options.range);
      if (match) {
        isRange = true;
        start = parseInt(match[1], 10);
        if (match[2]) {
          end = parseInt(match[2], 10);
        }
        contentLength = end - start + 1;
        contentRange = `bytes ${start}-${end}/${stats.size}`;
      }
    }

    const stream = fs.createReadStream(localPath, isRange ? { start, end } : undefined);
    const ext = path.extname(cleanKey).toLowerCase();
    const contentType = ext === '.pdf' ? 'application/pdf' : ext === '.json' ? 'application/json' : 'application/octet-stream';

    return {
      stream,
      contentType,
      contentLength,
      contentRange,
      lastModified: stats.mtime,
    };
  }

  /**
   * Checks whether a file exists in storage.
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async fileExists(key) {
    const cleanKey = normalizeStorageKey(key);
    if (!cleanKey) return false;

    if (this.workersBucket) {
      const head = await this.workersBucket.head(cleanKey);
      return Boolean(head);
    }

    if (this.r2Client) {
      try {
        await this.r2Client.send(
          new HeadObjectCommand({
            Bucket: this.bucketName,
            Key: cleanKey,
          })
        );
        return true;
      } catch (err) {
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
          // Check local disk fallback
          const localPath = path.join(LOCAL_UPLOADS_DIR, cleanKey);
          return fs.existsSync(localPath);
        }
        throw err;
      }
    }

    const localPath = path.join(LOCAL_UPLOADS_DIR, cleanKey);
    return fs.existsSync(localPath);
  }

  /**
   * Deletes a file from storage.
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async deleteFile(key) {
    const cleanKey = normalizeStorageKey(key);
    if (!cleanKey) return false;

    if (this.workersBucket) {
      await this.workersBucket.delete(cleanKey);
      return true;
    }

    if (this.r2Client) {
      try {
        await this.r2Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: cleanKey,
          })
        );
      } catch (err) {
        console.warn(`[Storage] Failed to delete R2 key "${cleanKey}":`, err.message);
      }
    }

    // Also check and clean up local file if it exists
    const localPath = path.join(LOCAL_UPLOADS_DIR, cleanKey);
    if (fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
      } catch {
        /* ignore */
      }
    }

    return true;
  }

  /**
   * Replaces an existing file safely:
   * 1. Uploads new file first.
   * 2. Returns the new key.
   * 3. Deletes old file only when deleteOld() is called (after database commits).
   */
  async replaceFile({ oldKey, newKey, buffer, contentType = 'application/pdf', metadata = {} }) {
    // 1. Upload new file first
    const uploaded = await this.uploadFile({ key: newKey, buffer, contentType, metadata });

    // 2. Provide a callback to delete the old file once DB transaction/update is confirmed
    const cleanupOld = async () => {
      if (oldKey && oldKey !== newKey) {
        try {
          await this.deleteFile(oldKey);
        } catch (err) {
          console.warn(`[Storage] Non-fatal error cleaning up replaced file "${oldKey}":`, err.message);
        }
      }
    };

    // 3. Provide a rollback function if DB update fails
    const rollback = async () => {
      try {
        await this.deleteFile(newKey);
      } catch (err) {
        console.warn(`[Storage] Failed to rollback newly uploaded file "${newKey}":`, err.message);
      }
    };

    return {
      key: uploaded.key,
      cleanupOld,
      rollback,
    };
  }
}

export const storageService = new StorageService();
