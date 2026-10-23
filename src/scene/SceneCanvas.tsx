import { useEffect, useRef, useState } from 'react';
import { LINKS } from '../data/site';
import { LibraryScene, type RigData } from './engine';

const BASE = '/scene/';

/** The living illustration behind the page. The floating books are real links laid over the canvas. */
export function SceneCanvas({ onReady }: { onReady: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const bookLinks = useRef(new Map<string, HTMLAnchorElement>());
  const scene = useRef<LibraryScene | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let lastX = 0;
    let watcher: IntersectionObserver | undefined;
    // a book near the edge of the screen keeps its label inside it: the labels' half widths, measured once per size
    const EDGE = 24;
    let viewWidth = canvas.current?.clientWidth ?? 0;
    const labelHalf = new Map<string, number>();
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const onMove = (e: PointerEvent) => {
      scene.current?.setPointer(e.clientX, e.clientY, e.clientX - lastX);
      lastX = e.clientX;
    };
    const onResize = () => {
      viewWidth = canvas.current?.clientWidth ?? 0;
      labelHalf.clear();
      scene.current?.resize();
    };
    const onScroll = () => scene.current?.setZoom(window.scrollY / window.innerHeight);
    const onVisible = () => (document.hidden ? scene.current?.pause() : scene.current?.resume());

    (async () => {
      try {
        const rig: RigData = await (await fetch(BASE + 'rig.json')).json();
        const made = new LibraryScene(canvas.current!, rig);
        await made.load(BASE);
        if (!alive) return;
        made.onBooks = (spots) => {
          for (const s of spots) {
            const el = bookLinks.current.get(s.name);
            if (!el) continue;
            el.style.transform = `translate(${s.x - s.r}px, ${s.y - s.r}px)`;
            el.style.width = el.style.height = `${s.r * 2}px`;
            let half = labelHalf.get(s.name);
            if (half === undefined) {
              half = ((el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0) / 2;
              if (half) labelHalf.set(s.name, half);
            }
            const nudge = Math.min(0, viewWidth - EDGE - (s.x + half)) + Math.max(0, EDGE - (s.x - half));
            el.style.setProperty('--nudge', `${Math.round(nudge)}px`);
          }
        };
        document.fonts?.ready.then(() => labelHalf.clear());
        scene.current = made;
        made.start(still);
        onReady();
        // nothing is drawn while the first screen is scrolled out of view
        watcher = new IntersectionObserver(([entry]) => (entry.isIntersecting ? made.resume() : made.pause()));
        watcher.observe(canvas.current!);
        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('resize', onResize);
        window.addEventListener('scroll', onScroll, { passive: true });
        document.addEventListener('visibilitychange', onVisible);
      } catch {
        if (alive) setFailed(true);
      }
    })();

    return () => {
      alive = false;
      watcher?.disconnect();
      scene.current?.pause();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [onReady]);

  if (failed) {
    return <video className="scene__fallback" src="/sarxina-animated.mp4" autoPlay loop muted playsInline />;
  }

  return (
    <div className="scene">
      <canvas ref={canvas} className="scene__canvas" onClick={() => scene.current?.poke()} aria-hidden="true" />
      {LINKS.map((link) => (
        <a
          key={link.id}
          ref={(el) => {
            if (el) bookLinks.current.set(link.book, el);
          }}
          className={`book book--${link.id}`}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`${link.name}, on a floating book`}
          onPointerEnter={() => scene.current?.setHovered(link.book)}
          onPointerLeave={() => scene.current?.setHovered('')}
          onFocus={() => scene.current?.setHovered(link.book)}
          onBlur={() => scene.current?.setHovered('')}
        >
          <span className="book__label">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={link.icon} />
            </svg>
            {link.name}
          </span>
        </a>
      ))}
    </div>
  );
}
