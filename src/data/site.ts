import { siInstagram, siTiktok, siTwitch, siX, siYoutube } from 'simple-icons';

export const TAGLINE = 'Librarian of the Celestial Archives';

export type SiteLink = {
  id: string;
  name: string;
  handle: string;
  url: string;
  icon: string; // an SVG path on a 24 x 24 grid
  book: string; // the floating book that also opens it
};

export const LINKS: SiteLink[] = [
  { id: 'twitch', name: 'Twitch', handle: 'sarxinavt', url: 'https://www.twitch.tv/sarxinavt', icon: siTwitch.path, book: 'Book 4' },
  { id: 'youtube', name: 'YouTube', handle: '@SarxinaVT', url: 'https://www.youtube.com/@SarxinaVT', icon: siYoutube.path, book: 'Book 3' },
  { id: 'tiktok', name: 'TikTok', handle: '@sarxinavt', url: 'https://www.tiktok.com/@sarxinavt', icon: siTiktok.path, book: 'Book 1' },
  { id: 'x', name: 'X', handle: '@SarxinaVT', url: 'https://x.com/SarxinaVT', icon: siX.path, book: 'Book 5' },
  { id: 'instagram', name: 'Instagram', handle: '@sarxinavt', url: 'https://www.instagram.com/sarxinavt', icon: siInstagram.path, book: 'Book 2' },
];

export const TWITCH_LOGIN = 'sarxinavt';
export const TWITCH_URL = 'https://www.twitch.tv/sarxinavt';

// The next stream. Change this once a week; a past date falls back to a plain "follow on Twitch" line.
export const NEXT_STREAM = {
  title: 'Final Fantasy X, but I enabled every mod',
  starts: '2026-10-16T16:00:00-04:00',
  hours: 4,
};

// The channel's own uploads playlists, newest first: one holds only the long videos, the other only the Shorts.
export const VIDEOS_PLAYLIST = 'UULFrkGtXHU44ZI-dR2tg9rJtQ';
export const SHORTS_PLAYLIST = 'UUSHrkGtXHU44ZI-dR2tg9rJtQ';

export type Tool = { name: string; kind: string; blurb: string; url: string; action: string };

export const TOOLS: Tool[] = [
  {
    name: 'SlingLive',
    kind: 'OBS plugin',
    blurb: 'Replaces the OBS Controls panel. To go live or record, you have to hit the right button with a slingshot.',
    url: 'https://github.com/Sarxina/sarxina-obs-plugins/releases/latest',
    action: 'Download',
  },
  {
    name: 'Plugin Manager',
    kind: 'App',
    blurb: 'One place to install and run my VTuber toys.',
    url: '/pluginmanager',
    action: 'Download',
  },
  {
    name: 'Random VTuber Toys',
    kind: 'Toys for your model',
    blurb: 'Small, silly programs for VTube Studio models. One of them lets chat buy and sell parts of your model.',
    url: 'https://github.com/Sarxina/Random-VTuber-Toys',
    action: 'See them all',
  },
  {
    name: 'OBS VN',
    kind: 'Stream toy',
    blurb: 'Turns your OBS stream into a visual novel that chat plays.',
    url: 'https://github.com/Sarxina/obs_vn',
    action: 'Get it',
  },
];

export const CREDITS: [string, string][] = [
  ['Design', 'Saruhiko / Wanilmith'],
  ['Model', 'Wanilmith'],
  ['Rigging', 'Nyanshua'],
  ['Emotes', 'Mier / Patella Coop'],
  ['Stream graphics', 'Kan / Patella Coop'],
  ['Background art', 'Meru'],
  ['Background animation', 'hinakusuo'],
];
