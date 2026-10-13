import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { CREDITS, LINKS, NEXT_STREAM, SHORTS_PLAYLIST, TAGLINE, TOOLS, TWITCH_LOGIN, TWITCH_URL } from './data/site';
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
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  const starts = new Date(NEXT_STREAM.starts).getTime();
  const over = now > starts + NEXT_STREAM.hours * 3_600_000;

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
  if (over) {
    return (
      <a className="status" href={TWITCH_URL} target="_blank" rel="noreferrer">
        <span className="status__text">
          <strong>Next stream soon</strong>
          <span>Follow on Twitch to catch it</span>
        </span>
      </a>
    );
  }
  const when = new Intl.DateTimeFormat(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(starts));
  return (
    <a className="status" href={TWITCH_URL} target="_blank" rel="noreferrer">
      <span className="status__text">
        <strong>
          Next stream {now < starts ? countdown(starts - now) : 'starting now'}
        </strong>
        <span>{NEXT_STREAM.title}</span>
        <span className="status__when">{when}</span>
      </span>
    </a>
  );
}

export function App() {
  const [ready, setReady] = useState(false);
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
            <a className="dock__more" href="#shorts" aria-label="Shorts, tools and credits below">
              <span />
            </a>
          </nav>
        </div>
      </header>

      <main className="below">
        <section id="shorts" className="block">
          <h2>Newest shorts</h2>
          <div className="shorts">
            <iframe
              title="Sarxina's newest Shorts"
              src={`https://www.youtube-nocookie.com/embed/videoseries?list=${SHORTS_PLAYLIST}`}
              loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
            <div className="shorts__side">
              <p className="shorts__line">A new short every day at 3 PM Eastern.</p>
              <div className="shorts__links">
                {LINKS.filter((link) => ['youtube', 'tiktok', 'instagram'].includes(link.id)).map((link) => (
                  <a key={link.id} className={`dock__link dock__link--${link.id}`} href={link.url} target="_blank" rel="noreferrer">
                    <Icon path={link.icon} />
                    <span className="dock__name">Watch on {link.name}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="tools" className="block">
          <h2>Things I made that you can use</h2>
          <div className="tools">
            {TOOLS.map((tool) => (
              <a key={tool.name} className="tool" href={tool.url} target="_blank" rel="noreferrer">
                <span className="tool__kind">{tool.kind}</span>
                <strong className="tool__name">{tool.name}</strong>
                <span className="tool__blurb">{tool.blurb}</span>
                <span className="tool__action">{tool.action}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="block block--credits">
          <h2>Credits</h2>
          <dl className="credits">
            {CREDITS.map(([role, name]) => (
              <div key={role}>
                <dt>{role}</dt>
                <dd>{name}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="foot">
          <a href="/privacy/">Privacy Policy</a>
          <a href="/terms/">Terms of Service</a>
        </footer>
      </main>
    </>
  );
}
