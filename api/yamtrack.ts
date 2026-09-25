/**
 * Yamtrack proxy for emilumiq.github.io.
 *
 * GET /api/yamtrack?media_type=tv&limit=100&offset=0&status=1
 *
 * Forwards to the Yamtrack media endpoint with YAMTRACK_TOKEN attached
 * server-side, so the token never reaches the browser bundle. Responses
 * are cached on the Vercel edge the same way as `api/anilist.ts`.
 */

const EDGE_TTL_SECONDS = 30;
const INSTANCE_TTL_MS = 8_000;
const UPSTREAM_TIMEOUT_MS = 10_000;

const ALLOWED_PARAMS = ['media_type', 'limit', 'offset', 'status'] as const;

type Query = Record<string, string | string[] | undefined>;
type HandlerRequest = { method?: string; query?: Query };
type HandlerResponse = {
  status(code: number): HandlerResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
  end(): void;
};

function upstreamOrigin(): string {
  const raw = process.env.YAMTRACK_URL ?? 'https://list.neome.uk';
  return String(raw).trim().replace(/\/+$/, '');
}

function token(): string | null {
  const raw = process.env.YAMTRACK_TOKEN ?? '';
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value || null;
}

function buildUpstreamUrl(query: Query | undefined): URL {
  const url = new URL('/api/media/', upstreamOrigin());

  for (const key of ALLOWED_PARAMS) {
    const raw = query?.[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) url.searchParams.set(key, value);
  }

  const limit = Number(url.searchParams.get('limit') ?? '100');
  if (!Number.isFinite(limit) || limit < 1) url.searchParams.set('limit', '100');
  else url.searchParams.set('limit', String(Math.min(Math.trunc(limit), 100)));

  const offset = Number(url.searchParams.get('offset') ?? '0');
  url.searchParams.set(
    'offset',
    Number.isFinite(offset) && offset > 0 ? String(Math.trunc(offset)) : '0',
  );

  return url;
}

type CacheEntry = { at: number; body: unknown };
const memoryCache = new Map<string, CacheEntry>();
const CACHE_LIMIT = 16;

let authScheme: 'Token' | 'Bearer' | null = null;

async function forward(url: URL): Promise<unknown> {
  const key = url.toString();
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.at < INSTANCE_TTL_MS) return cached.body;

  const secret = token();
  if (!secret) throw new Error('YAMTRACK_TOKEN is not configured');

  const schemes: ('Token' | 'Bearer')[] = authScheme ? [authScheme] : ['Token', 'Bearer'];

  for (const scheme of schemes) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { Authorization: `${scheme} ${secret}`, Accept: 'application/json' },
        signal: controller.signal,
      });

      if (res.ok) {
        authScheme = scheme;
        const body = await res.json();

        memoryCache.set(key, { at: Date.now(), body });
        if (memoryCache.size > CACHE_LIMIT) {
          const oldest = memoryCache.keys().next().value;
          if (oldest !== undefined) memoryCache.delete(oldest);
        }
        return body;
      }

      if (res.status !== 401) throw new Error(`yamtrack ${res.status}`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('yamtrack rejected the credentials');
}

export default async function handler(
  req: HandlerRequest,
  res: HandlerResponse,
): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  try {
    const body = await forward(buildUpstreamUrl(req.query));
    res.setHeader(
      'Cache-Control',
      `public, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=600, max-age=15`,
    );
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(body);
  } catch (err) {
    console.error('yamtrack proxy error:', err);
    res.status(502).json({ error: 'upstream unavailable' });
  }
}
