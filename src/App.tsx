import './App.css';

export function App() {
  return (
    <main className="stage">
      <video
        className="stage__video"
        src="/sarxina-animated.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
      />
      <div className="stage__overlay" />
      <div className="stage__content">
        <h1 className="title">Sarxina</h1>
        <p className="subtitle">Librarian of the Celestial Archives</p>
      </div>
      <footer className="links">
        <a href="https://www.youtube.com/@SarxinaVT">YouTube</a>
        <a href="https://www.twitch.tv/sarxinavt">Twitch</a>
        <a href="https://x.com/SarxinaVT">X</a>
        <a href="/privacy/">Privacy Policy</a>
        <a href="/terms/">Terms of Service</a>
      </footer>
    </main>
  );
}
