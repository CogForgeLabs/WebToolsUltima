import { useEffect, useState } from 'react';
import { Home } from './Home';
import { ToolView } from './ToolView';
import { ActivityBar } from './components/ActivityBar';
import { PrivacyBadge } from './components/PrivacyBadge';
import { validateCatalog } from '../tools/registry';
import './ui.css';

export function App() {
  const [toolId, setToolId] = useState<string | null>(null);

  // CLAUDE rule 5: warn loudly in dev if any tool advertises something the engines can't do.
  useEffect(() => {
    if (import.meta.env.DEV) {
      const problems = validateCatalog();
      if (problems.length) console.warn('[WebToolsUltima] catalog problems:\n' + problems.join('\n'));
    }
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setToolId(null)} aria-label="Home">
          <span className="brand-mark">◆</span>
          <span className="brand-name">WebToolsUltima</span>
        </button>
        <div className="topbar-right">
          <a
            className="home-link"
            href="https://cognitive-industries.org"
            target="_blank"
            rel="noreferrer noopener"
          >
            <span className="home-link-arrow" aria-hidden="true">←</span>
            <span className="home-link-label">Cognitive Industries</span>
          </a>
          <PrivacyBadge />
        </div>
      </header>

      <main className="content">
        {toolId ? (
          <ToolView key={toolId} toolId={toolId} onBack={() => setToolId(null)} />
        ) : (
          <Home onOpen={setToolId} />
        )}
      </main>

      <footer className="footer">
        <span>WebToolsUltima — 100% local, runs in your browser.</span>
        <span className="footer-attr">
          Powered by or derived from software by{' '}
          <a href="https://cognitive-industries.org" target="_blank" rel="noreferrer noopener">
            Cognitive Industries
          </a>
          .
        </span>
      </footer>

      <ActivityBar />
    </div>
  );
}
