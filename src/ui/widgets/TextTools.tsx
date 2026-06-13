import { useEffect, useMemo, useState } from 'react';
import { CopyButton, Seg } from './common';

// ───────────────────────── Base64 ─────────────────────────

export function Base64Tool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [input, setInput] = useState('');
  const { out, error } = useMemo(() => {
    if (!input) return { out: '', error: null as string | null };
    try {
      if (mode === 'encode') {
        let bin = '';
        new TextEncoder().encode(input).forEach((b) => (bin += String.fromCharCode(b)));
        return { out: btoa(bin), error: null };
      }
      const bytes = Uint8Array.from(atob(input.trim()), (c) => c.charCodeAt(0));
      return { out: new TextDecoder().decode(bytes), error: null };
    } catch {
      return { out: '', error: mode === 'decode' ? 'Invalid Base64 input.' : 'Could not encode.' };
    }
  }, [mode, input]);

  return (
    <InOut
      mode={<Seg value={mode} onChange={setMode} options={[{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }]} />}
      input={input}
      setInput={setInput}
      output={out}
      error={error}
      placeholder={mode === 'encode' ? 'Text to encode…' : 'Base64 to decode…'}
    />
  );
}

// ───────────────────────── URL encode ─────────────────────────

export function UrlTool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [input, setInput] = useState('');
  const { out, error } = useMemo(() => {
    if (!input) return { out: '', error: null as string | null };
    try {
      return { out: mode === 'encode' ? encodeURIComponent(input) : decodeURIComponent(input), error: null };
    } catch {
      return { out: '', error: 'Invalid input.' };
    }
  }, [mode, input]);

  return (
    <InOut
      mode={<Seg value={mode} onChange={setMode} options={[{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }]} />}
      input={input}
      setInput={setInput}
      output={out}
      error={error}
      placeholder={mode === 'encode' ? 'Text or URL to encode…' : 'Encoded text to decode…'}
    />
  );
}

// ───────────────────────── JSON formatter ─────────────────────────

export function JsonTool() {
  const [mode, setMode] = useState<'pretty' | 'minify'>('pretty');
  const [input, setInput] = useState('');
  const { out, error } = useMemo(() => {
    if (!input.trim()) return { out: '', error: null as string | null };
    try {
      const parsed = JSON.parse(input);
      return { out: JSON.stringify(parsed, null, mode === 'pretty' ? 2 : 0), error: null };
    } catch (e) {
      return { out: '', error: e instanceof Error ? e.message : 'Invalid JSON.' };
    }
  }, [mode, input]);

  return (
    <InOut
      mode={<Seg value={mode} onChange={setMode} options={[{ value: 'pretty', label: 'Beautify' }, { value: 'minify', label: 'Minify' }]} />}
      input={input}
      setInput={setInput}
      output={out}
      error={error}
      placeholder='{"paste":"your JSON here"}'
      mono
    />
  );
}

// ───────────────────────── Hash ─────────────────────────

const ALGOS = ['SHA-256', 'SHA-1', 'SHA-384', 'SHA-512'] as const;
type Algo = (typeof ALGOS)[number];

export function HashTool() {
  const [algo, setAlgo] = useState<Algo>('SHA-256');
  const [input, setInput] = useState('');
  const [out, setOut] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!input) {
        setOut('');
        return;
      }
      const digest = await crypto.subtle.digest(algo, new TextEncoder().encode(input));
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
      if (alive) setOut(hex);
    })();
    return () => {
      alive = false;
    };
  }, [algo, input]);

  return (
    <InOut
      mode={<Seg value={algo} onChange={setAlgo} options={ALGOS.map((a) => ({ value: a, label: a }))} />}
      input={input}
      setInput={setInput}
      output={out}
      error={null}
      placeholder="Text to hash…"
      mono
    />
  );
}

// ───────────────────────── Case converter ─────────────────────────

const CASES = [
  { value: 'upper', label: 'UPPER' },
  { value: 'lower', label: 'lower' },
  { value: 'title', label: 'Title' },
  { value: 'sentence', label: 'Sentence' },
  { value: 'camel', label: 'camelCase' },
  { value: 'snake', label: 'snake_case' },
  { value: 'kebab', label: 'kebab-case' },
] as const;
type CaseMode = (typeof CASES)[number]['value'];

export function CaseTool() {
  const [mode, setMode] = useState<CaseMode>('title');
  const [input, setInput] = useState('');
  const out = useMemo(() => convertCase(input, mode), [input, mode]);
  return (
    <InOut
      mode={<Seg value={mode} onChange={setMode} options={CASES.map((c) => ({ value: c.value, label: c.label }))} />}
      input={input}
      setInput={setInput}
      output={out}
      error={null}
      placeholder="Text to convert…"
    />
  );
}

function convertCase(s: string, mode: CaseMode): string {
  const words = s.match(/[A-Za-z0-9]+/g) ?? [];
  switch (mode) {
    case 'upper':
      return s.toUpperCase();
    case 'lower':
      return s.toLowerCase();
    case 'title':
      return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
    case 'sentence':
      return s.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase());
    case 'camel':
      return words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('');
    case 'snake':
      return words.map((w) => w.toLowerCase()).join('_');
    case 'kebab':
      return words.map((w) => w.toLowerCase()).join('-');
  }
}

// ───────────────────────── Text counter ─────────────────────────

export function CountTool() {
  const [input, setInput] = useState('');
  const stats = useMemo(() => {
    const chars = input.length;
    const noSpaces = input.replace(/\s/g, '').length;
    const words = (input.match(/\S+/g) ?? []).length;
    const lines = input ? input.split(/\r\n|\r|\n/).length : 0;
    const bytes = new TextEncoder().encode(input).length;
    return { chars, noSpaces, words, lines, bytes };
  }, [input]);

  return (
    <div className="widget">
      <textarea className="widget-area" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste or type text…" />
      <div className="stat-grid">
        <Stat label="Words" value={stats.words} />
        <Stat label="Characters" value={stats.chars} />
        <Stat label="No spaces" value={stats.noSpaces} />
        <Stat label="Lines" value={stats.lines} />
        <Stat label="Bytes (UTF-8)" value={stats.bytes} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span className="stat-num">{value.toLocaleString()}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

// ───────────────────────── shared in/out layout ─────────────────────────

function InOut({
  mode,
  input,
  setInput,
  output,
  error,
  placeholder,
  mono,
}: {
  mode: React.ReactNode;
  input: string;
  setInput: (v: string) => void;
  output: string;
  error: string | null;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div className="widget">
      <div className="widget-bar">{mode}</div>
      <textarea
        className={`widget-area${mono ? ' mono' : ''}`}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
      />
      {error ? (
        <p className="job-error">{error}</p>
      ) : (
        <div className="widget-out">
          <textarea className={`widget-area${mono ? ' mono' : ''}`} value={output} readOnly placeholder="Result…" />
          <div className="widget-actions">
            <CopyButton text={output} />
          </div>
        </div>
      )}
    </div>
  );
}
