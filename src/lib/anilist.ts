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
  completedAt: string | null;
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
  const status = STATUS_MAP[raw.status] ?? null;
  return {
    title: raw.title,
    image: raw.cover,
    media_type: raw.type === 'MANGA' ? 'manga' : 'anime',
    score: raw.score,
    status,
    progress: raw.progress,
    max_progress: raw.maxProgress,
    // Finished titles carry their real completion date; for everything else
    // the record's last-update time is the meaningful one.
    progressed_at: status === 'Completed' ? raw.completedAt : raw.updatedAt,
    url: raw.url,
  };
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

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

export function fetchAniList(): Promise<AniListBundle> {
  if (inflight) return inflight;

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
