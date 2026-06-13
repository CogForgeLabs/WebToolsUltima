import { useMemo, useState } from 'react';
import { CATEGORIES, GROUPS } from '../tools/categories';
import { searchTools, toolsByCategory, type ToolDef } from '../tools/registry';

interface HomeProps {
  onOpen: (toolId: string) => void;
}

export function Home({ onOpen }: HomeProps) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchTools(query), [query]);
  const searching = query.trim().length > 0;

  return (
    <div className="home">
      <section className="hero">
        <h1>Every tool you need, running in your browser.</h1>
        <p>
          A growing library of fast, private tools — convert &amp; compress files, encode &amp; hash text,
          generate data, crunch numbers. Everything runs locally on your device: no uploads, no accounts,
          no servers.
        </p>
        <input
          className="search"
          type="search"
          placeholder="Search tools — “mp4 to mp3”, “base64”, “password”, “compress pdf”…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </section>

      {searching ? (
        <section className="tool-section">
          <h2>
            {results.length} result{results.length === 1 ? '' : 's'}
          </h2>
          <ToolGrid tools={results} onOpen={onOpen} />
        </section>
      ) : (
        GROUPS.map((group) => (
          <div className="tool-group" key={group}>
            <h3 className="group-head">{group}</h3>
            {CATEGORIES.filter((c) => c.group === group).map((cat) => (
              <section className="tool-section" key={cat.id}>
                <h2>
                  <span className="cat-icon">{cat.icon}</span> {cat.label}
                  <span className="cat-tagline">{cat.tagline}</span>
                </h2>
                <ToolGrid tools={toolsByCategory(cat.id)} onOpen={onOpen} />
              </section>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function ToolGrid({ tools, onOpen }: { tools: ToolDef[]; onOpen: (id: string) => void }) {
  if (tools.length === 0) return <p className="muted">No tools match.</p>;
  return (
    <div className="tool-grid">
      {tools.map((t) => (
        <button className="tool-card" key={t.id} onClick={() => onOpen(t.id)}>
          <span className="tool-name">{t.name}</span>
          <span className="tool-desc">{t.description}</span>
          {t.badge && <span className="tool-badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}
