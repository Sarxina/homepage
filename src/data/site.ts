import { siInstagram, siTiktok, siTwitch, siX, siYoutube } from 'simple-icons';
import type { Tool } from '../feeds/github';

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
export const TWITCH_ID = '1030071813'; // the channel's id; the next stream comes from its Twitch schedule
export const TWITCH_URL = 'https://www.twitch.tv/sarxinavt';

// The channel's own uploads playlists, newest first: one holds only the long videos, the other only the Shorts.
export const VIDEOS_PLAYLIST = 'UULFrkGtXHU44ZI-dR2tg9rJtQ';
export const SHORTS_PLAYLIST = 'UUSHrkGtXHU44ZI-dR2tg9rJtQ';

// The OBS plugins come from this repository: one card per README section that has a release.
export const OBS_PLUGINS_REPO = 'Sarxina/sarxina-obs-plugins';

// The shelf leads with the Plugin Manager, the one install for every plugin. How many plugins it has comes from the
// plugins repository, so the count is added to this line on the page.
export const PLUGIN_MANAGER: Tool = {
  name: 'Plugin Manager',
  kind: 'App',
  blurb: 'One install for every plugin I make',
  url: '/pluginmanager',
  action: 'Download',
};

// The other things on the shelf, after the Plugin Manager and the newest plugin.
export const TOOLS: Tool[] = [
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
