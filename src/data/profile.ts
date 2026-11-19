export const profile = {
	name: 'Emily',
	emoji: '🌺🐚',
	intro: [
		"Hi! I'm Emily Aoi",
		"I occasionally do releases on various torrent trackers (mostly RuTracker).",
		"I also maintain a few projects of my own:",
		"In my free time I watch anime, tv shows, cartoons, movies and more.",
	],
	spoiler: 'vibecoded 🥀',
};

export type LinkItem = {
	label: string;
	url: string;
	icon: string;
};

export const links: LinkItem[] = [
	{ label: 'Telegram blog', url: 'https://t.me/+1gd8fQTSZYAxYjhi', icon: 'telegram' },
	{ label: 'DM @emilumiq', url: 'https://t.me/emilumiq', icon: 'telegram' },
	{ label: 'GitHub', url: 'https://github.com/emilumiq', icon: 'github' },
	{ label: 'Forgejo', url: 'https://git.neome.uk/emilumiq', icon: 'forgejo', },
	{ label: 'Neo (open source)', url: 'https://t.me/neomovies_news', icon: 'telegram', },
];

export const projects: {
	name: string;
	stack: string;
	description: string;
	siteUrl: string;
	sourceUrl: string;
	tags: string[];
}[] = [
	{
		name: 'NeoWatch',
		stack: 'Next.js · TypeScript · Bun · ElysiaJS',
		description: 'movie & tv show catalog',
		siteUrl: 'https://w.neome.uk',
		sourceUrl: 'https://git.neome.uk/Neo/neowatch-web',
		tags: ['next.js', 'typescript', 'bun', 'elysia'],
	},
	{
		name: 'NeoID',
		stack: 'Next.js',
		description: 'unified authentication service for my projects.',
		siteUrl: 'https://id.neome.uk',
		sourceUrl: 'https://git.neome.uk/Neo/neo-id',
		tags: ['next.js', 'typescript'],
	},
	{
		name: 'Mailly',
		stack: 'Go · Vue',
		description: 'a mail client for Gmail.',
		siteUrl: 'https://mail.neome.uk',
		sourceUrl: 'https://git.neome.uk/emilumiq/mailly',
		tags: ['go', 'vue'],
	},
];

export const watchlist = {
	title: 'watching now',
	note: 'anime, from anilist',
	limit: 8,
};

export const reading = {
	title: 'reading now',
	note: 'manga, from anilist',
	limit: 8,
};
