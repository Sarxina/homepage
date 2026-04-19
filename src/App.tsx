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
    </main>
  );
}
