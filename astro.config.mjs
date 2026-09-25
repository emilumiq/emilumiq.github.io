// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
if (!env.PUBLIC_API_URL) {
  console.warn(
    '[build] PUBLIC_API_URL is not set — API calls will target the current origin and fail on GitHub Pages.',
  );
}

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://emily.arnelle.dev',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
