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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_UPLOADS_DIR = path.resolve(__dirname, '../uploads');

// ─── Key helpers ─────────────────────────────────────────────────────────────

/**
 * Strips leading path prefixes or full URLs so callers can pass raw DB values
 * ("/uploads/papers/x.pdf", "/api/files/papers/x.pdf", "https://pub-...r2.dev/answers/x.pdf", "papers/x.pdf")
 * and always get back "papers/x.pdf" or "answers/x.pdf".
 */
export function normalizeStorageKey(rawKey) {
  if (!rawKey) return '';
  let key = String(rawKey).trim().split('?')[0].split('#')[0];
  if (/^https?:\/\//i.test(key)) {
    try {
      key = new URL(key).pathname;
    } catch {
      key = key.replace(/^https?:\/\/[^/]+/i, '');
    }
  }
  if (key.startsWith('/api/files/')) key = key.slice('/api/files/'.length);
  else if (key.startsWith('/uploads/')) key = key.slice('/uploads/'.length);
  else if (key.startsWith('uploads/')) key = key.slice('uploads/'.length);
  else if (key.startsWith('/')) key = key.slice(1);
  return key;
}

/**
 * Returns true when the first four bytes match the PDF magic number (%PDF).
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
 * Parse standard HTTP Range header (e.g. "bytes=0-1023", "bytes=100-", "bytes=-500")
 */
export function parseRange(rangeHeader, totalSize) {
  if (!rangeHeader || typeof rangeHeader !== 'string') return null;
  const match = /bytes=(-?\d+)(?:-(-?\d+)?)?/.exec(rangeHeader.trim());
  if (!match) return null;

  // Suffix range: bytes=-500 (last 500 bytes)
  if (match[1].startsWith('-')) {
    const suffix = parseInt(match[1].slice(1), 10);
    if (isNaN(suffix) || suffix <= 0) return null;
    const offset = Math.max(0, totalSize - suffix);
    const length = totalSize - offset;
    return { offset, length, suffix, end: totalSize - 1 };
  }

  const offset = parseInt(match[1], 10);
  if (isNaN(offset) || offset < 0) return null;

  // Bounded range: bytes=0-499
  if (match[2] !== undefined && match[2] !== '') {
    const rawEnd = parseInt(match[2], 10);
    if (isNaN(rawEnd) || rawEnd < offset) return null;
    const end = Math.min(rawEnd, totalSize - 1);
    const length = end - offset + 1;
    return { offset, length, end };
  }

  // Open range: bytes=500- (from 500 to EOF)
  const length = Math.max(0, totalSize - offset);
  return { offset, length, end: totalSize - 1 };
}

// ─── Unified Storage Service ──────────────────────────────────────────────────

class StorageService {
  constructor() {
    this.r2Client = null;
    this.bucketName = process.env.R2_BUCKET_NAME || '';
    this.accountId = process.env.R2_ACCOUNT_ID || '';
    this.workersBucket = null;

    this._initS3Client();
  }

  setWorkersBinding(bucket) {
    if (bucket && typeof bucket.get === 'function') {
      this.workersBucket = bucket;
    }
  }

  _initS3Client() {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const accountId = process.env.R2_ACCOUNT_ID;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (accessKeyId && secretAccessKey && accountId && bucketName) {
      this.bucketName = bucketName;
      this.accountId = accountId;
      try {
        this.r2Client = new S3Client({
          region: 'auto',
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        console.log(`[Storage] Cloudflare R2 S3 client initialized with bucket "${bucketName}".`);
      } catch (err) {
        console.warn('[Storage] Failed to initialize R2 S3 client:', err.message);
      }
    }
  }

  isR2Active() {
    return Boolean(this.workersBucket || this.r2Client);
  }

  resolveBucket(explicitBucket) {
    if (explicitBucket && typeof explicitBucket.get === 'function') {
      return explicitBucket;
    }
    if (this.workersBucket && typeof this.workersBucket.get === 'function') {
      return this.workersBucket;
    }
    if (typeof globalThis !== 'undefined' && globalThis.env?.R2_BUCKET && typeof globalThis.env.R2_BUCKET.get === 'function') {
      return globalThis.env.R2_BUCKET;
    }
    return null;
  }

  async uploadFileInternal(cleanKey, body, contentType, metadata) {
    const buffer = Buffer.isBuffer(body)
      ? body
      : body instanceof Uint8Array
      ? Buffer.from(body)
      : typeof body?.arrayBuffer === 'function'
      ? Buffer.from(await body.arrayBuffer())
      : Buffer.from(body);

    // 1. S3 Client for R2
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

    // 2. Try R2 Public URL if configured (e.g. https://pub-xxxx.r2.dev or custom domain)
    const r2PublicBase = process.env.R2_PUBLIC_URL?.trim()?.replace(/\/+$/, '');
    if (r2PublicBase) {
      try {
        const fetchUrl = `${r2PublicBase}/${cleanKey}`;
        const headers = {};
        if (options.range) headers['Range'] = options.range;
        const res = await fetch(fetchUrl, { headers });
        if (res.ok || res.status === 206) {
          const contentType = res.headers.get('content-type') || 'application/pdf';
          const contentRange = res.headers.get('content-range') || undefined;
          const contentLengthStr = res.headers.get('content-length');
          const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : undefined;
          const lastModifiedStr = res.headers.get('last-modified');
          return {
            stream: res.body,
            contentType,
            contentLength,
            contentRange,
            status: res.status,
            lastModified: lastModifiedStr ? new Date(lastModifiedStr) : undefined,
          };
        }
      } catch (err) {
        console.warn(`[Storage] R2 public fetch failed for "${cleanKey}":`, err.message);
      }
    }

    // 3. Local filesystem fallback
    const localPath = path.join(LOCAL_UPLOADS_DIR, cleanKey);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, buffer);
    return { key: cleanKey, size: buffer.length, contentType };
  }

  async getFileInternal(cleanKey, options = {}) {
    // 1. Try S3 Client for R2
    if (this.r2Client) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: cleanKey,
          Range: options.range,
        });
        const res = await this.r2Client.send(command);
        const isRange = Boolean(res.ContentRange);
        return {
          stream: res.Body,
          contentType: res.ContentType || 'application/pdf',
          contentLength: res.ContentLength,
          contentRange: res.ContentRange,
          status: isRange ? 206 : 200,
          lastModified: res.LastModified,
        };
      } catch (err) {
        if (err.name !== 'NoSuchKey' && err.$metadata?.httpStatusCode !== 404) {
          console.warn(`[Storage] S3 get error for "${cleanKey}":`, err.message);
        }
      }
    }

    // 2. Try R2 Public URL if configured (e.g. https://pub-xxxx.r2.dev or custom domain)
    const r2PublicBase = process.env.R2_PUBLIC_URL?.trim()?.replace(/\/+$/, '');
    if (r2PublicBase) {
      try {
        const fetchUrl = `${r2PublicBase}/${cleanKey}`;
        const headers = {};
        if (options.range) headers['Range'] = options.range;
        const res = await fetch(fetchUrl, { headers });
        if (res.ok || res.status === 206) {
          const contentType = res.headers.get('content-type') || 'application/pdf';
          const contentRange = res.headers.get('content-range') || undefined;
          const contentLengthStr = res.headers.get('content-length');
          const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : undefined;
          const lastModifiedStr = res.headers.get('last-modified');
          return {
            stream: res.body,
            contentType,
            contentLength,
            contentRange,
            status: res.status,
            lastModified: lastModifiedStr ? new Date(lastModifiedStr) : undefined,
          };
        }
      } catch (err) {
        console.warn(`[Storage] R2 public fetch failed for "${cleanKey}":`, err.message);
      }
    }

    // 3. Local filesystem fallback
    const localPath = path.join(LOCAL_UPLOADS_DIR, cleanKey);
    if (!fs.existsSync(localPath)) return null;

    const stats = fs.statSync(localPath);
    let start = 0;
    let end = stats.size - 1;
    let contentRange;
    let contentLength = stats.size;
    let isRange = false;

    if (options.range) {
      const parsed = parseRange(options.range, stats.size);
      if (parsed) {
        isRange = true;
        start = parsed.offset;
        end = parsed.end !== undefined ? parsed.end : parsed.offset + parsed.length - 1;
        contentLength = parsed.length;
        contentRange = `bytes ${start}-${end}/${stats.size}`;
      }
    }

    const stream = fs.createReadStream(localPath, isRange ? { start, end } : undefined);
    const ext = path.extname(cleanKey).toLowerCase();
    const contentType =
      ext === '.pdf'
        ? 'application/pdf'
        : ext === '.json'
        ? 'application/json'
        : 'application/octet-stream';

    return {
      stream,
      contentType,
      contentLength,
      contentRange,
      status: isRange ? 206 : 200,
      lastModified: stats.mtime,
    };
  }

  async fileExistsInternal(cleanKey) {
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
        if (err.name !== 'NotFound' && err.$metadata?.httpStatusCode !== 404) {
          console.warn(`[Storage] S3 head error for "${cleanKey}":`, err.message);
        }
      }
    }

    const localPath = path.join(LOCAL_UPLOADS_DIR, cleanKey);
    return fs.existsSync(localPath);
  }

  async deleteFileInternal(cleanKey) {
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

    const localPath = path.join(LOCAL_UPLOADS_DIR, cleanKey);
    if (fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
      } catch {
        /* ignore */
      }
    }
  }

  // Adapter object implementing R2 bucket interface for Express apps
  asBucket() {
    return {
      get: (key, options) => getFile(this.workersBucket, key, options),
      put: (key, body, options) =>
        uploadFile(
          this.workersBucket,
          key,
          body,
          options?.httpMetadata?.contentType || 'application/pdf',
          options?.customMetadata || {}
        ),
      delete: (key) => deleteFile(this.workersBucket, key),
      head: async (key) => {
        const exists = await fileExists(this.workersBucket, key);
        return exists ? { key } : null;
      },
    };
  }
}

export const storageService = new StorageService();

export function getStorageBucket() {
  return storageService.asBucket();
}

// ─── Standalone exported operations ──────────────────────────────────────────

/**
 * Upload a file to R2 (or fallback storage).
 * Supports both signatures:
 *   uploadFile(bucket, key, body, contentType, metadata)
 *   uploadFile({ key, buffer/body, contentType, metadata })
 */
export async function uploadFile(bucketOrOpts, key, body, contentType = 'application/pdf', metadata = {}) {
  let cleanKey = key;
  let dataBody = body;
  let targetBucket = bucketOrOpts;
  let cType = contentType;
  let meta = metadata;

  // Handle object argument shape: uploadFile({ key, buffer, contentType, metadata })
  if (bucketOrOpts && typeof bucketOrOpts === 'object' && !bucketOrOpts.put && bucketOrOpts.key) {
    cleanKey = bucketOrOpts.key;
    dataBody = bucketOrOpts.buffer || bucketOrOpts.body;
    cType = bucketOrOpts.contentType || 'application/pdf';
    meta = bucketOrOpts.metadata || {};
    targetBucket = null;
  }

  cleanKey = normalizeStorageKey(cleanKey);
  if (!cleanKey) throw new Error('Storage key is required');
  if (!dataBody) throw new Error('File body is required');

  const resolved = storageService.resolveBucket(targetBucket);
  if (resolved && typeof resolved.put === 'function') {
    await resolved.put(cleanKey, dataBody, {
      httpMetadata: { contentType: cType },
      customMetadata: meta,
    });
    const size = dataBody.byteLength ?? dataBody.length ?? 0;
    return { key: cleanKey, size, contentType: cType };
  }

  return storageService.uploadFileInternal(cleanKey, dataBody, cType, meta);
}

/**
 * Retrieve a file from R2, optionally with a byte-range.
 * Correctly computes Content-Range, Content-Length, and 206 status for range requests.
 *
 * Supports both:
 *   getFile(bucket, key, options)
 *   getFile(key, options)
 */
export async function getFile(bucketOrKey, keyOrOptions, maybeOptions = {}) {
  let cleanKey = keyOrOptions;
  let targetBucket = bucketOrKey;
  let options = maybeOptions;

  if (typeof bucketOrKey === 'string') {
    cleanKey = bucketOrKey;
    targetBucket = null;
    options = keyOrOptions || {};
  }

  cleanKey = normalizeStorageKey(cleanKey);
  if (!cleanKey) throw new Error('Storage key is required');

  const resolved = storageService.resolveBucket(targetBucket);

  if (resolved && typeof resolved.get === 'function') {
    let r2Opts = undefined;
    if (options.range) {
      const match = /bytes=(-?\d+)(?:-(-?\d+)?)?/.exec(String(options.range).trim());
      if (match) {
        if (match[1].startsWith('-')) {
          const suffix = parseInt(match[1].slice(1), 10);
          if (!isNaN(suffix) && suffix > 0) r2Opts = { range: { suffix } };
        } else {
          const offset = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : undefined;
          const length = end !== undefined ? end - offset + 1 : undefined;
          r2Opts = { range: { offset, length } };
        }
      }
    }

    try {
      const object = await resolved.get(cleanKey, r2Opts);
      if (object) {
        const contentType = object.httpMetadata?.contentType || 'application/pdf';
        const totalSize = object.size;
        let contentLength = totalSize;
        let contentRange = undefined;
        let status = 200;

        if (object.range) {
          const offset = object.range.offset;
          const length = object.range.length;
          const end = offset + length - 1;
          contentLength = length;
          contentRange = `bytes ${offset}-${end}/${totalSize}`;
          status = 206;
        } else if (r2Opts?.range) {
          const offset = r2Opts.range.offset ?? Math.max(0, totalSize - (r2Opts.range.suffix ?? 0));
          const length = r2Opts.range.length ?? (totalSize - offset);
          const end = offset + length - 1;
          contentLength = length;
          contentRange = `bytes ${offset}-${end}/${totalSize}`;
          status = 206;
        }

        return {
          stream: object.body,
          contentType,
          contentLength,
          contentRange,
          status,
          lastModified: object.uploaded,
        };
      }
    } catch (err) {
      console.warn(`[Storage] Native R2 get failed for "${cleanKey}":`, err.message);
    }
  }

  // Fallback to S3 client or local disk
  return storageService.getFileInternal(cleanKey, options);
}

/**
 * Returns true if the key exists in R2 or storage.
 */
export async function fileExists(bucketOrKey, maybeKey) {
  let cleanKey = maybeKey;
  let targetBucket = bucketOrKey;
  if (typeof bucketOrKey === 'string') {
    cleanKey = bucketOrKey;
    targetBucket = null;
  }
  cleanKey = normalizeStorageKey(cleanKey);
  if (!cleanKey) return false;

  const resolved = storageService.resolveBucket(targetBucket);
  if (resolved && typeof resolved.head === 'function') {
    try {
      const head = await resolved.head(cleanKey);
      if (head) return true;
    } catch {}
  }

  return storageService.fileExistsInternal(cleanKey);
}

/**
 * Delete a file from R2 or storage.
 */
export async function deleteFile(bucketOrKey, maybeKey) {
  let cleanKey = maybeKey;
  let targetBucket = bucketOrKey;
  if (typeof bucketOrKey === 'string') {
    cleanKey = bucketOrKey;
    targetBucket = null;
  }
  cleanKey = normalizeStorageKey(cleanKey);
  if (!cleanKey) return;

  const resolved = storageService.resolveBucket(targetBucket);
  if (resolved && typeof resolved.delete === 'function') {
    try {
      await resolved.delete(cleanKey);
    } catch (err) {
      console.warn(`[Storage] Failed to delete R2 key "${cleanKey}":`, err.message);
    }
  }

  await storageService.deleteFileInternal(cleanKey);
}

/**
 * Atomically replace a file in R2 or storage.
 */
export async function replaceFile(bucketOrOpts, maybeOpts) {
  let options = maybeOpts;
  let targetBucket = bucketOrOpts;
  if (bucketOrOpts && !bucketOrOpts.put && (bucketOrOpts.newKey || bucketOrOpts.oldKey)) {
    options = bucketOrOpts;
    targetBucket = null;
  }
  const { oldKey, newKey, body, buffer, contentType = 'application/pdf', metadata = {} } = options;
  const data = body || buffer;
  const uploaded = await uploadFile(targetBucket, newKey, data, contentType, metadata);

  const cleanupOld = async () => {
    if (oldKey && oldKey !== newKey) {
      await deleteFile(targetBucket, oldKey);
    }
  };

  const rollback = async () => {
    await deleteFile(targetBucket, newKey);
  };

  return { key: uploaded.key, cleanupOld, rollback };
}
