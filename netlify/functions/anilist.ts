import {
  ANILIST_ENDPOINT,
  ANILIST_QUERY,
  ANILIST_USERNAME,
  normalizePayload,
  type AniListPayload,
  type RawResponse,
} from '../../shared/anilist';

const EDGE_TTL_SECONDS = 30;
const INSTANCE_TTL_MS = 8_000;
const UPSTREAM_TIMEOUT_MS = 10_000;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

let memoryCache: { at: number; payload: AniListPayload } | null = null;

function getUsername(): string {
  const raw = process.env.ANILIST_USERNAME ?? ANILIST_USERNAME;
  const trimmed = String(raw).trim();
  return /^[A-Za-z0-9_-]{1,40}$/.test(trimmed) ? trimmed : ANILIST_USERNAME;
}

async function fetchUpstream(): Promise<AniListPayload> {
  const username = getUsername();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'emilumiq-site/1.0 (https://emilumiq.github.io)',
      },
      body: JSON.stringify({ query: ANILIST_QUERY, variables: { userName: username } }),
      signal: controller.signal,
    });
    const json = (await res.json()) as RawResponse;
    if (!res.ok) {
      const message = json.errors?.map((e) => e.message).join('; ') || `upstream ${res.status}`;
      throw new Error(message);
    }
    return normalizePayload(json, username);
  } finally {
    clearTimeout(timer);
  }
}

async function getPayload(): Promise<{ payload: AniListPayload; stale: boolean }> {
  if (memoryCache && Date.now() - memoryCache.at < INSTANCE_TTL_MS) {
    return { payload: memoryCache.payload, stale: true };
  }
  try {
    const payload = await fetchUpstream();
    memoryCache = { at: Date.now(), payload };
    return { payload, stale: false };
  } catch (err) {
    if (memoryCache) {
      console.error('anilist upstream failed, serving cache:', err);
      return { payload: memoryCache.payload, stale: true };
    }
    throw err;
  }
}

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

export const config = { path: '/api/anilist' };

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'GET') {
    return json({ error: 'method not allowed' }, 405);
  }

  try {
    const { payload, stale } = await getPayload();
    const url = new URL(req.url);
    const rawType = url.searchParams.get('type');
    const type = rawType === 'ANIME' || rawType === 'MANGA' ? rawType : '';

    let { anime, manga } = payload;
    if (type === 'ANIME') manga = [];
    else if (type === 'MANGA') anime = [];

    return json(
      {
        generatedAt: payload.generatedAt,
        username: payload.username,
        count: anime.length + manga.length,
        anime,
        manga,
      },
      200,
      {
        'Cache-Control': `public, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=600, max-age=15`,
        ...(stale ? { 'X-Cache': 'stale' } : {}),
      },
    );
  } catch (err) {
    console.error('anilist proxy error:', err);
    return json({ error: 'upstream unavailable' }, 502);
  }
};
