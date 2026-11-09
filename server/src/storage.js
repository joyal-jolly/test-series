/**
 * storage.js — Pure Cloudflare R2 binding helpers.
 *
 * Every function takes the R2 bucket binding as its first argument so there is
 * no module-level singleton, no AWS SDK, and no local-disk fallback.
 *
 * In Cloudflare Workers the bucket is `env.R2_BUCKET`.
 * In Express routes it is retrieved with `req.app.get('r2')`.
 */

// ─── Key helpers ─────────────────────────────────────────────────────────────

/**
 * Strips leading path prefixes so callers can pass raw DB values
 * ("/uploads/papers/x.pdf", "/api/files/papers/x.pdf", "papers/x.pdf")
 * and always get back "papers/x.pdf".
 */
export function normalizeStorageKey(rawKey) {
  if (!rawKey) return '';
  let key = String(rawKey).trim().split('?')[0].split('#')[0];
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

// ─── R2 operations ───────────────────────────────────────────────────────────

/**
 * Upload a file to R2.
 *
 * @param {R2Bucket} bucket          - env.R2_BUCKET
 * @param {string}   key             - e.g. "papers/<uuid>.pdf"
 * @param {Uint8Array|ArrayBuffer|ReadableStream} body
 * @param {string}   [contentType]
 * @param {Record<string,string>} [metadata]
 * @returns {Promise<{ key: string, size: number, contentType: string }>}
 */
export async function uploadFile(bucket, key, body, contentType = 'application/pdf', metadata = {}) {
  const cleanKey = normalizeStorageKey(key);
  if (!cleanKey) throw new Error('Storage key is required');
  if (!body) throw new Error('File body is required');
  if (!bucket) throw new Error('R2 bucket binding is not available');

  await bucket.put(cleanKey, body, {
    httpMetadata: { contentType },
    customMetadata: metadata,
  });

  const size = body.byteLength ?? body.length ?? 0;
  return { key: cleanKey, size, contentType };
}

/**
 * Retrieve a file from R2, optionally with a byte-range.
 *
 * @param {R2Bucket} bucket
 * @param {string}   key
 * @param {{ range?: string }} [options]  range = HTTP "Range" header value
 * @returns {Promise<{ stream: ReadableStream, contentType: string, contentLength: number, contentRange?: string, lastModified?: Date } | null>}
 */
export async function getFile(bucket, key, options = {}) {
  const cleanKey = normalizeStorageKey(key);
  if (!cleanKey) throw new Error('Storage key is required');
  if (!bucket) throw new Error('R2 bucket binding is not available');

  const r2Opts = {};
  if (options.range) {
    const match = /bytes=(\d+)-(\d+)?/.exec(options.range);
    if (match) {
      const offset = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : undefined;
      r2Opts.range = { offset, length: end !== undefined ? end - offset + 1 : undefined };
    }
  }

  const object = await bucket.get(cleanKey, r2Opts);
  if (!object) return null;

  const contentType = object.httpMetadata?.contentType || 'application/pdf';
  const contentLength = object.size;
  const result = {
    stream: object.body,
    contentType,
    contentLength,
    lastModified: object.uploaded,
  };

  // Attach Content-Range when a range was requested
  if (options.range && r2Opts.range) {
    const { offset, length } = r2Opts.range;
    const end = length !== undefined ? offset + length - 1 : contentLength - 1;
    result.contentRange = `bytes ${offset}-${end}/${object.size}`;
    result.status = 206;
  }

  return result;
}

/**
 * Returns true if the key exists in R2.
 *
 * @param {R2Bucket} bucket
 * @param {string}   key
 * @returns {Promise<boolean>}
 */
export async function fileExists(bucket, key) {
  const cleanKey = normalizeStorageKey(key);
  if (!cleanKey || !bucket) return false;
  const head = await bucket.head(cleanKey);
  return head !== null;
}

/**
 * Delete a file from R2 (non-fatal: logs a warning on error).
 *
 * @param {R2Bucket} bucket
 * @param {string}   key
 */
export async function deleteFile(bucket, key) {
  const cleanKey = normalizeStorageKey(key);
  if (!cleanKey || !bucket) return;
  try {
    await bucket.delete(cleanKey);
  } catch (err) {
    console.warn(`[Storage] Failed to delete R2 key "${cleanKey}":`, err.message);
  }
}

/**
 * Atomically replace a file in R2:
 *   1. Upload the new file.
 *   2. Return { key, cleanupOld, rollback } to the caller.
 *   3. Caller calls cleanupOld() after the DB write succeeds,
 *      or rollback() if the DB write fails.
 *
 * @param {R2Bucket} bucket
 * @param {{ oldKey?: string, newKey: string, body: Uint8Array|ArrayBuffer|ReadableStream, contentType?: string, metadata?: object }} opts
 */
export async function replaceFile(bucket, { oldKey, newKey, body, contentType = 'application/pdf', metadata = {} }) {
  const uploaded = await uploadFile(bucket, newKey, body, contentType, metadata);

  const cleanupOld = async () => {
    if (oldKey && oldKey !== newKey) {
      await deleteFile(bucket, oldKey);
    }
  };

  const rollback = async () => {
    await deleteFile(bucket, newKey);
  };

  return { key: uploaded.key, cleanupOld, rollback };
}
