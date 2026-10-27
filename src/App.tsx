import { Fragment, useCallback, useEffect, useState } from 'react';
import './App.css';
import { CREDITS, LINKS, OBS_PLUGINS_REPO, PLUGIN_GUIDES, PLUGIN_MANAGER, SHORTS_PLAYLIST, TAGLINE, TOOLS, TWITCH_ID, TWITCH_LOGIN, TWITCH_URL, VIDEOS_PLAYLIST } from './data/site';
import { obsPlugins, type Plugin, type Tool } from './feeds/github';
import { nextStream, type Stream } from './feeds/twitch';
import { SceneCanvas } from './scene/SceneCanvas';

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

/** true while the channel is live; null until the answer is in */
function useLive() {
  const [live, setLive] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch(`https://decapi.me/twitch/uptime/${TWITCH_LOGIN}`)
        .then((r) => r.text())
        .then((text) => alive && setLive(!/offline|error|not found/i.test(text)))
        .catch(() => alive && setLive(false));
    check();
    const again = window.setInterval(check, 120_000);
    return () => {
      alive = false;
      window.clearInterval(again);
    };
  }, []);
  return live;
}

/** the next stream on the Twitch schedule; null when nothing is on it or it could not be read */
function useNextStream() {
  const [stream, setStream] = useState<Stream | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () =>
      nextStream(TWITCH_ID)
        .then((next) => alive && setStream(next))
        .catch(() => alive && setStream(null));
    read();
    const again = window.setInterval(read, 30 * 60_000);
    return () => {
      alive = false;
      window.clearInterval(again);
    };
  }, []);
  return stream;
}

/** the OBS plugins from their repository; empty until they are in, or when they could not be read */
function useObsPlugins() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  useEffect(() => {
    let alive = true;
    obsPlugins(OBS_PLUGINS_REPO)
      .then((found) => alive && setPlugins(found))
      .catch(() => alive && setPlugins([]));
    return () => {
      alive = false;
    };
  }, []);
  return plugins;
}

/**
 * The shelf: the Plugin Manager with how many plugins it has, the one plugin released most recently (opening its guide
 * when it has one), then the other tools. However many plugins there are, the shelf stays this long.
 */
function shelf(plugins: Plugin[]): Tool[] {
  const manager = { ...PLUGIN_MANAGER, blurb: `${PLUGIN_MANAGER.blurb}${plugins.length ? `, ${plugins.length} so far` : ''}.` };
  const newest = plugins.reduce<Plugin | null>((latest, p) => (!latest || p.released > latest.released ? p : latest), null);
  const guide = newest && PLUGIN_GUIDES[newest.name];
  const newestCard = newest && { ...newest, kind: 'Newest plugin', ...(guide ? { url: guide, action: 'How to set it up' } : {}) };
  return [manager, ...(newestCard ? [newestCard] : []), ...TOOLS];
}

function countdown(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${Math.max(1, m)}m`;
}

function StreamStatus() {
  const live = useLive();
  const stream = useNextStream();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  if (live) {
    return (
      <a className="status status--live" href={TWITCH_URL} target="_blank" rel="noreferrer">
        <span className="status__dot" />
        <span className="status__text">
          <strong>Live now</strong>
          <span>Watch on Twitch</span>
        </span>
      </a>
    );
  }
  if (!stream || now > stream.ends) return null;
  const { starts } = stream;
  const when = new Intl.DateTimeFormat(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(starts));
  return (
    <a className="status" href={TWITCH_URL} target="_blank" rel="noreferrer">
      <span className="status__text">
        <strong>
          Next stream {now < starts ? countdown(starts - now) : 'starting now'}
        </strong>
        {stream.title && <span>{stream.title}</span>}
        <span className="status__when">{when}</span>
      </span>
    </a>
  );
}

export function App() {
  const [ready, setReady] = useState(false);
  const plugins = useObsPlugins();
  const onReady = useCallback(() => setReady(true), []);

  return (
    <>
      <header className={`hero${ready ? ' hero--ready' : ''}`}>
        <SceneCanvas onReady={onReady} />
        <div className="hero__shade" />
        <div className="hero__panel">
          <div className="hero__title">
            <h1 className="wordmark">Sarxina</h1>
            <p className="tagline">{TAGLINE}</p>
          </div>
          <StreamStatus />
          <nav className="dock" aria-label="Where to find me">
            {LINKS.map((link) => (
              <a key={link.id} className={`dock__link dock__link--${link.id}`} href={link.url} target="_blank" rel="noreferrer">
                <Icon path={link.icon} />
                <span className="dock__name">{link.name}</span>
                <span className="dock__handle">{link.handle}</span>
              </a>
            ))}
            <a className="dock__more" href="#videos" aria-label="Videos, tools and credits below">
              <span />
            </a>
          </nav>
        </div>
      </header>

      <main className="below">
        <section id="videos" className="block block--videos">
          <div className="container">
            <h2>Latest videos</h2>
            <div className="videos">
              <iframe
                className="videos__long"
                title="Sarxina's latest video"
                src={`https://www.youtube-nocookie.com/embed/videoseries?list=${VIDEOS_PLAYLIST}`}
                loading="lazy"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
              <iframe
                className="videos__short"
                title="Sarxina's latest Short"
                src={`https://www.youtube-nocookie.com/embed/videoseries?list=${SHORTS_PLAYLIST}`}
                loading="lazy"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </section>

        <section id="tools" className="block block--tools">
          <div className="container split">
            <h2>Things I made that you can use</h2>
            <div className="tools">
              {shelf(plugins).map((tool) => (
                <a key={tool.name} className="tool" href={tool.url} target="_blank" rel="noreferrer">
                  <strong className="tool__name">{tool.name}</strong>
                  <span className="tool__kind">{tool.kind}</span>
                  {tool.blurb && <span className="tool__blurb">{tool.blurb}</span>}
                  <span className="tool__action">{tool.action}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <footer className="foot">
          <div className="container split">
            <h2>Credits</h2>
            <div className="colophon">
              <dl className="credits">
                {CREDITS.map(([role, name], i) => (
                  <Fragment key={role}>
                    {i > 0 && ' '}
                    <div>
                      <dt>{role}</dt>
                      <dd>{name}</dd>
                    </div>
                  </Fragment>
                ))}
              </dl>
              <div className="foot__links">
                <a href="/privacy/">Privacy Policy</a>
                <a href="/terms/">Terms of Service</a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
