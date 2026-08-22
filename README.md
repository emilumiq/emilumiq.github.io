# Emily's info page 🌸

A little personal site built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com).

**Live at:** [emilumiq.github.io)](https://emilumiq.github.io)

## Getting started

```sh
git clone https://github.com/emilumiq/info-page.git
cd info-page
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:4321` and you're good to go.

## Environment

| Variable | What it does |
|---|---|
| `PUBLIC_YAMTRACK_URL` | Your Yamtrack instance URL |
| `PUBLIC_YAMTRACK_TOKEN` | API token from Yamtrack (Settings → Integrations) |

## Deploy

The site is fully static — pushes to `main` deploy to [GitHub Pages](https://pages.github.com) automatically via GitHub Actions.

```sh
npm run build   # outputs to dist/
```

## License

[MIT](LICENSE)
