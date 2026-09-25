/**
 * AniList proxy for emilumiq.github.io.
 *
 * GET /api/anilist?type=ANIME|MANGA
 *
 * Pulls the whole public list (all statuses) for both media types in a
 * single upstream GraphQL request, normalizes it and sorts it so that
 * CURRENT/REPEATING entries come first.
 *
 * Responses are cached on the Vercel edge (`s-maxage`) and in the warm
 * function instance, so all site visitors share one upstream request
 * instead of burning AniList's per-IP rate limit.
 */

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const EDGE_TTL_SECONDS = 30;
const INSTANCE_TTL_MS = 8_000;
const UPSTREAM_TIMEOUT_MS = 10_000;

const QUERY = `
query ($userName: String!) {
  anime: MediaListCollection(userName: $userName, type: ANIME) {
    lists { name entries { ...entryFields } }
  }
  manga: MediaListCollection(userName: $userName, type: MANGA) {
    lists { name entries { ...entryFields } }
  }
}
fragment entryFields on MediaList {
  id
  status
  progress
  score
  updatedAt
  media {
    id
    type
    format
    status
    episodes
    chapters
    volumes
    siteUrl
    coverImage { extraLarge large color }
    title { romaji english native }
  }
}
`;

export type AniListStatus =
  | 'CURRENT'
  | 'REPEATING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'PLANNING'
  | 'DROPPED';

export type AniListEntry = {
  id: number;
  type: 'ANIME' | 'MANGA';
  title: string;
  titleEnglish: string | null;
  titleNative: string | null;
  format: string | null;
  status: AniListStatus;
  listName: string;
  progress: number;
  maxProgress: number | null;
  score: number | null;
  updatedAt: string | null;
  cover: string | null;
  color: string | null;
  url: string;
};

type RawMedia = {
  id: number;
  type?: 'ANIME' | 'MANGA';
  format?: string | null;
  status?: string | null;
  episodes?: number | null;
  chapters?: number | null;
  siteUrl?: string | null;
  coverImage?: { extraLarge?: string | null; large?: string | null; color?: string | null } | null;
  title?: { romaji?: string | null; english?: string | null; native?: string | null } | null;
};

type RawEntry = {
  id: number;
  status?: AniListStatus | null;
  progress?: number | null;
  score?: number | null;
  updatedAt?: number | null;
  media?: RawMedia | null;
};

type RawGroup = { name?: string | null; entries?: RawEntry[] | null };
type RawCollection = { lists?: RawGroup[] | null };
type RawResponse = {
  data?: { anime?: RawCollection | null; manga?: RawCollection | null } | null;
  errors?: { message?: string }[];
};

/** Higher rank = later in the list. CURRENT/REPEATING float to the top. */
const STATUS_RANK: Record<AniListStatus, number> = {
  CURRENT: 0,
  REPEATING: 0,
  PAUSED: 1,
  COMPLETED: 2,
  PLANNING: 3,
  DROPPED: 4,
};

function getUsername(): string {
  const raw = process.env.ANILIST_USERNAME ?? process.env.PUBLIC_ANILIST_USERNAME ?? 'emilumiq';
  const trimmed = String(raw).trim();
  return /^[A-Za-z0-9_-]{1,40}$/.test(trimmed) ? trimmed : 'emilumiq';
}

/** The user's own score only — site averages are never included. */
function normalizeScore(score: number | null | undefined): number | null {
  const value = score && score > 0 ? score : null;
  if (value == null) return null;
  const scaled = value > 10 ? value / 10 : value;
  return Math.round(scaled * 10) / 10;
}

function mapEntry(entry: RawEntry, listName: string): AniListEntry | null {
  const media = entry.media;
  if (!media?.id) return null;
  const status = entry.status ?? 'PLANNING';
  const type = media.type ?? 'ANIME';
  const title =
    media.title?.romaji || media.title?.english || media.title?.native || null;
  if (!title) return null;

  const maxProgress =
    type === 'MANGA'
      ? media.chapters ?? null
      : media.episodes ?? null;
  const updatedAt =
    entry.updatedAt && entry.updatedAt > 0
      ? new Date(entry.updatedAt * 1000).toISOString()
      : null;

  return {
    id: media.id,
    type,
    title,
    titleEnglish: media.title?.english ?? null,
    titleNative: media.title?.native ?? null,
    format: media.format ?? null,
    status,
    listName,
    progress: entry.progress ?? 0,
    maxProgress,
    score: normalizeScore(entry.score),
    updatedAt,
    cover: media.coverImage?.extraLarge || media.coverImage?.large || null,
    color: media.coverImage?.color ?? null,
    url: media.siteUrl ?? `https://anilist.co/${type.toLowerCase()}/${media.id}`,
  };
}

function collect(collection: RawCollection | null | undefined): AniListEntry[] {
  const seen = new Set<number>();
  const out: AniListEntry[] = [];

  // `lists` also contains custom lists, which duplicate entries — dedupe by id.
  for (const group of collection?.lists ?? []) {
    for (const raw of group.entries ?? []) {
      if (seen.has(raw.id)) continue;
      seen.add(raw.id);
      const mapped = mapEntry(raw, group.name ?? '');
      if (mapped) out.push(mapped);
    }
  }

  out.sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rank !== 0) return rank;
    const at = a.updatedAt ?? '';
    const bt = b.updatedAt ?? '';
    if (at !== bt) return at < bt ? 1 : -1;
    return a.title.localeCompare(b.title);
  });

  return out;
}

type CacheEntry = { at: number; payload: AniListPayload };
type AniListPayload = {
  generatedAt: string;
  username: string;
  anime: AniListEntry[];
  manga: AniListEntry[];
};

let memoryCache: CacheEntry | null = null;

async function fetchUpstream(): Promise<AniListPayload> {
  const username = getUsername();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const res = await fetch(ANILIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { userName: username } }),
      signal: controller.signal,
    });

    const json = (await res.json()) as RawResponse;
    if (!res.ok || !json.data) {
      const message = json.errors?.map((e) => e.message).join('; ') || `upstream ${res.status}`;
      throw new Error(message);
    }

    return {
      generatedAt: new Date().toISOString(),
      username,
      anime: collect(json.data.anime),
      manga: collect(json.data.manga),
    };
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
      // AniList outage / 429 — serve the last snapshot instead of failing.
      console.error('anilist upstream failed, serving cache:', err);
      return { payload: memoryCache.payload, stale: true };
    }
    throw err;
  }
}

type HandlerRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
};

type HandlerResponse = {
  status(code: number): HandlerResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
  end(): void;
};

export default async function handler(req: HandlerRequest, res: HandlerResponse): Promise<void> {
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
    const { payload, stale } = await getPayload();
    const rawType = req.query?.type;
    const type = Array.isArray(rawType) ? rawType[0] : rawType;

    let { anime, manga } = payload;
    if (type === 'ANIME') manga = [];
    else if (type === 'MANGA') anime = [];

    res.setHeader(
      'Cache-Control',
      `public, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=600, max-age=15`,
    );
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (stale) res.setHeader('X-Cache', 'stale');

    res.json({
      generatedAt: payload.generatedAt,
      username: payload.username,
      count: anime.length + manga.length,
      anime,
      manga,
    });
  } catch (err) {
    console.error('anilist proxy error:', err);
    res.status(502).json({ error: 'upstream unavailable' });
  }
}
