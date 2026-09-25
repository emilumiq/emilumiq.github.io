/**
 * Shared origin for the Vercel API host (the `api/` directory).
 *
 * The site itself is static on GitHub Pages, so every credentialed
 * request goes through this proxy instead of hitting upstream services
 * from the browser. Set PUBLIC_API_URL at build time — without it the
 * client falls back to the current origin (only useful when the page is
 * served by the same host that runs `api/`).
 */

export function apiOrigin(): string {
  const configured = (import.meta.env.PUBLIC_API_URL ?? '') as string;
  return configured.trim().replace(/\/+$/, '');
}

export function apiUrl(path: string): string {
  const base = apiOrigin();
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${suffix}` : suffix;
}
