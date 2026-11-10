const API_BASE = import.meta.env.VITE_API_URL || '';

const DEFAULT_TTL = 60 * 1000;
const SESSION_PREFIX = 'mentaura_api_cache::';

// cacheKey -> { data, timestamp }
const cacheStore = new Map();
// cacheKey -> Promise (shared by concurrent callers)
const inflight = new Map();
// Bumped on every invalidation. Responses that started under an older
// generation are returned to their caller but never written to the cache.
let cacheGen = 0;

const getToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('ca_token') : null;

const makeKey = (path) => `${getToken() || 'anon'}::${path}`;

// Callers get their own copy, so mutating a result can't corrupt the cache.
function clone(data) {
  if (typeof structuredClone === 'function') {
    try { return structuredClone(data); } catch { /* fall through */ }
  }
  return JSON.parse(JSON.stringify(data));
}

// ── sessionStorage helpers ──────────────────────────────────────────────────
function saveToSession(key, data, timestamp) {
  try {
    sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify({ data, timestamp }));
  } catch { /* quota / private mode */ }
}

function readFromSession(key, ttl) {
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < ttl) return parsed;
    sessionStorage.removeItem(SESSION_PREFIX + key);
  } catch { /* ignore */ }
  return null;
}

function removeSessionKeys(match) {
  try {
    const toRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(SESSION_PREFIX) && match(k)) toRemove.push(k);
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}

// Drop expired entries so the Map doesn't grow across logins.
function pruneExpired(ttl) {
  const now = Date.now();
  for (const [k, v] of cacheStore) {
    if (now - v.timestamp >= ttl) cacheStore.delete(k);
  }
}

function readCache(cacheKey, ttl) {
  const item = cacheStore.get(cacheKey);
  if (item && Date.now() - item.timestamp < ttl) return item;

  const sessionItem = readFromSession(cacheKey, ttl);
  if (sessionItem) {
    cacheStore.set(cacheKey, sessionItem);
    return sessionItem;
  }
  return null;
}

/**
 * Synchronous read for initialising component state without a spinner.
 * Returns null on a miss, so callers must still fall back to api().
 */
export function getCachedData(path, ttl = DEFAULT_TTL) {
  const item = readCache(makeKey(path), ttl);
  return item ? clone(item.data) : null;
}

/**
 * Invalidate entries whose key contains `prefix` (all entries if empty).
 * Also bumps the generation and drops pending requests, so in-flight
 * responses can't repopulate the cache with stale data.
 */
export function invalidateApiCache(prefix = '') {
  cacheGen++;

  if (!prefix) {
    cacheStore.clear();
    inflight.clear();
    removeSessionKeys(() => true);
    return;
  }

  for (const key of [...cacheStore.keys()]) {
    if (key.includes(prefix)) cacheStore.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (key.includes(prefix)) inflight.delete(key);
  }
  removeSessionKeys((k) => k.includes(prefix));
}

/** Call this on logout. */
export function clearApiCache() {
  invalidateApiCache();
}

// Most specific rules first. Adjust prefixes to match your real routes.
function invalidateForMutation(path) {
  if (/\/(submit|assignments|evaluate)/.test(path)) {
    ['/api/student', '/api/reviewer', '/api/admin/submissions',
     '/api/admin/dashboard', '/api/admin/insights'].forEach(invalidateApiCache);
  } else if (path.startsWith('/api/admin/papers') || path.startsWith('/api/admin/groups')) {
    ['/api/papers', '/api/admin/groups', '/api/admin/papers',
     '/api/admin/dashboard', '/api/admin/insights'].forEach(invalidateApiCache);
  } else if (path.startsWith('/api/admin/users')) {
    ['/api/admin/users', '/api/admin/dashboard'].forEach(invalidateApiCache);
  } else {
    invalidateApiCache(); // unknown mutation: be safe
  }
}

async function request(path, options) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  // Strip internal options before passing to native fetch
  const { cache: _cache, cacheTtl: _cacheTtl, ...fetchOptions } = options;

  const res = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers });
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const text = await res.text();
    const snippet = text.slice(0, 100).replace(/\s+/g, ' ');
    throw new Error(
      `API endpoint "${path}" returned HTML instead of JSON. Ensure your API URL is configured (VITE_API_URL) or that run_worker_first is set for /api/* in wrangler.jsonc. Response preview: ${snippet}`
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/**
 * API client: cached + deduplicated GETs, auto-invalidating mutations.
 */
export async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const ttl = typeof options.cacheTtl === 'number' ? options.cacheTtl : DEFAULT_TTL;
  const useCache = isGet && options.cache !== false && ttl > 0;

  // ── Mutations ─────────────────────────────────────────────────────────────
  if (!isGet) {
    const opts = { ...options };           // never mutate the caller's object
    delete opts.cacheTtl;
    const headers = { ...(opts.headers || {}) };
    if (opts.body && !(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    opts.headers = headers;

    const data = await request(path, opts);
    invalidateForMutation(path);           // after success; bumps generation
    return data;
  }

  // ── Uncached GET ──────────────────────────────────────────────────────────
  if (!useCache) return request(path, options);

  // ── Cached GET ────────────────────────────────────────────────────────────
  const cacheKey = makeKey(path);

  const hit = readCache(cacheKey, ttl);
  if (hit) return clone(hit.data);

  const pending = inflight.get(cacheKey);
  if (pending) return pending.then(clone);

  const gen = cacheGen;
  const promise = request(path, options)
    .then((data) => {
      if (gen === cacheGen) {              // skip if invalidated mid-flight
        const timestamp = Date.now();
        pruneExpired(ttl);
        cacheStore.set(cacheKey, { data, timestamp });
        saveToSession(cacheKey, data, timestamp);
      }
      return data;
    })
    .finally(() => {
      if (inflight.get(cacheKey) === promise) inflight.delete(cacheKey);
    });

  inflight.set(cacheKey, promise);
  return promise.then(clone);
}

export function getAuthFileUrl(path) {
  if (!path) return '';
  const token = getToken();
  const url = (API_BASE && path.startsWith('/')) ? `${API_BASE}${path}` : path;
  if (!token) return url;
  if (url.includes('token=')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}
