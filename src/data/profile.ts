export const profile = {
	name: 'Emily',
	emoji: '🌺🐚',
	intro: [
		"Hi! I'm Emily Aoi",
		"I occasionally do releases on various torrent trackers (mostly RuTracker).",
		"I also maintain a few projects of my own —",
		"In my free time I watch anime, tv shows, cartoons, movies and more.",
	],
	interests: ['anime', 'tv shows', 'cartoons', 'movies', 'torrents', 'web dev'],
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
	{
		label: 'Disroot',
		url: 'https://git.disroot.org/emilumiq',
		icon: 'forgejo',
	},
	{
		label: 'RuTracker',
		url: 'https://rutracker.org/forum/profile.php?mode=viewprofile&u=51945983',
		icon: 'rutracker',
	},
	{
		label: 'NNM Club',
		url: 'https://nnmclub.to/forum/profile.php?mode=viewprofile&u=14390161',
		icon: 'nnmclub',
	},
	{
		label: 'Neo (open source)',
		url: 'https://t.me/neomovies_news',
		icon: 'telegram',
	},
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
		description:
			'movie & tv show catalog · <span class="text-muted/50">old</span> — new (alpha) version <a href="https://neowatch-web.vercel.app" target="_blank" rel="noopener noreferrer" class="text-accent hover:text-accent-strong">here</a>',
		siteUrl: 'https://w.neome.uk',
		sourceUrl: 'https://git.disroot.org/Neo/neomovies-web',
		tags: ['next.js', 'typescript', 'bun', 'elysia'],
	},
	{
		name: 'NeoID',
		stack: 'Next.js',
		description: 'unified authentication service for my projects.',
		siteUrl: 'https://id.neome.uk',
		sourceUrl: 'https://git.disroot.org/Neo/neo-id',
		tags: ['next.js', 'typescript'],
	},
	{
		name: 'Mailly',
		stack: 'Go · Vue',
		description: 'a mail client for Gmail.',
		siteUrl: 'https://mail.neome.uk',
		sourceUrl: 'https://git.disroot.org/emilumiq/mailly',
		tags: ['go', 'vue'],
	},
];

export const watchlist = {
	title: 'watching now',
	note: 'tv shows & movies, live from my tracker',
	limit: 8,
};
