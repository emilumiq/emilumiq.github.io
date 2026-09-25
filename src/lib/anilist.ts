/**
 * Client-side AniList helpers.
 *
 * Talks to the Vercel proxy (`api/anilist.ts`) through the shared API
 * origin in `src/lib/api.ts`. The response is fetched once per page load
 * and reused everywhere.
 */

import type { Entry } from './cards';
import { apiUrl } from './api';

export type AniListRawEntry = {
  id: number;
  type: 'ANIME' | 'MANGA';
  title: string;
  titleEnglish: string | null;
  titleNative: string | null;
  format: string | null;
  status: string;
  listName: string;
  progress: number;
  maxProgress: number | null;
  score: number | null;
  updatedAt: string | null;
  cover: string | null;
  color: string | null;
  url: string;
};

export type AniListBundle = {
  generatedAt: string;
  username: string;
  anime: Entry[];
  manga: Entry[];
};

const STATUS_MAP: Record<string, string> = {
  CURRENT: 'In progress',
  REPEATING: 'In progress',
  COMPLETED: 'Completed',
  PLANNING: 'Planning',
  PAUSED: 'Paused',
  DROPPED: 'Dropped',
};

function baseUrl(): string {
  return apiUrl('/api/anilist');
}

function toEntry(raw: AniListRawEntry): Entry {
  return {
    title: raw.title,
    image: raw.cover,
    media_type: raw.type === 'MANGA' ? 'manga' : 'anime',
    score: raw.score,
    status: STATUS_MAP[raw.status] ?? null,
    progress: raw.progress,
    max_progress: raw.maxProgress,
    progressed_at: raw.updatedAt,
    url: raw.url,
  };
}

/** Normalize a title for cross-source deduplication. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Drop entries from `extra` whose title already appears in `primary`.
 * Used to skip AniList anime that Yamtrack already tracks (ids are not
 * comparable across sources).
 */
export function mergeUnique(primary: Entry[], extra: Entry[]): Entry[] {
  const seen = new Set(primary.map((e) => normalizeTitle(e.title)));
  const out = [...primary];
  for (const entry of extra) {
    const key = normalizeTitle(entry.title);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

let inflight: Promise<AniListBundle> | null = null;

/**
 * Fetch both lists from the proxy. Memoized per page load; pass
 * `force: true` from the live-refresh timer to bypass the memo.
 */
export function fetchAniList(options: { force?: boolean } = {}): Promise<AniListBundle> {
  if (!options.force && inflight) return inflight;

  const request = (async () => {
    const res = await fetch(baseUrl(), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`anilist proxy ${res.status}`);
    const data = (await res.json()) as {
      generatedAt?: string;
      username?: string;
      anime?: AniListRawEntry[];
      manga?: AniListRawEntry[];
    };
    return {
      generatedAt: data.generatedAt ?? new Date().toISOString(),
      username: data.username ?? '',
      anime: (data.anime ?? []).map(toEntry),
      manga: (data.manga ?? []).map(toEntry),
    };
  })();

  inflight = request;
  request.catch(() => {
    if (inflight === request) inflight = null;
  });

  return request;
}

/** Keep only the entries whose status matches, preserving order. */
export function filterByStatus(entries: Entry[], status: string): Entry[] {
  return status ? entries.filter((e) => e.status === status) : entries;
}
