import { useMemo, useState } from 'react';
import { CopyButton, Seg } from './common';

// ───────────────────────── UUID ─────────────────────────

export function UuidTool() {
  const [count, setCount] = useState(5);
  const [list, setList] = useState<string[]>(() => Array.from({ length: 5 }, () => crypto.randomUUID()));
  const generate = () => setList(Array.from({ length: count }, () => crypto.randomUUID()));

  return (
    <div className="widget">
      <div className="widget-bar">
        <label className="inline-field">
          Count
          <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value))))} />
        </label>
        <button className="mini primary" onClick={generate}>
          Generate
        </button>
        <CopyButton text={list.join('\n')} label="Copy all" />
      </div>
      <textarea className="widget-area mono" readOnly value={list.join('\n')} />
    </div>
  );
}

// ───────────────────────── Password ─────────────────────────

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?',
};

export function PasswordTool() {
  const [length, setLength] = useState(20);
  const [sets, setSets] = useState({ lower: true, upper: true, digits: true, symbols: true });
  const [value, setValue] = useState('');

  const generate = () => {
    const pool = (Object.keys(SETS) as (keyof typeof SETS)[]).filter((k) => sets[k]).map((k) => SETS[k]).join('');
    if (!pool) {
      setValue('');
      return;
    }
    const bytes = new Uint32Array(length);
    crypto.getRandomValues(bytes);
    let out = '';
    for (let i = 0; i < length; i++) out += pool[bytes[i] % pool.length];
    setValue(out);
  };

  const toggle = (k: keyof typeof sets) => setSets((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div className="widget">
      <div className="widget-bar wrap">
        <label className="inline-field">
          Length <strong>{length}</strong>
          <input type="range" min={6} max={64} value={length} onChange={(e) => setLength(Number(e.target.value))} />
        </label>
        {(Object.keys(SETS) as (keyof typeof SETS)[]).map((k) => (
          <label key={k} className="check">
            <input type="checkbox" checked={sets[k]} onChange={() => toggle(k)} /> {k}
          </label>
        ))}
        <button className="mini primary" onClick={generate}>
          Generate
        </button>
      </div>
      <div className="widget-out">
        <input className="widget-line mono" readOnly value={value} placeholder="Click Generate…" />
        <div className="widget-actions">
          <CopyButton text={value} />
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Lorem Ipsum ─────────────────────────

const LOREM =
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(
    ' ',
  );

export function LoremTool() {
  const [unit, setUnit] = useState<'paragraphs' | 'sentences' | 'words'>('paragraphs');
  const [count, setCount] = useState(3);
  const [seed, setSeed] = useState(0);

  const text = useMemo(() => generateLorem(unit, count), [unit, count, seed]);

  return (
    <div className="widget">
      <div className="widget-bar wrap">
        <Seg
          value={unit}
          onChange={setUnit}
          options={[
            { value: 'paragraphs', label: 'Paragraphs' },
            { value: 'sentences', label: 'Sentences' },
            { value: 'words', label: 'Words' },
          ]}
        />
        <label className="inline-field">
          Count
          <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value))))} />
        </label>
        <button className="mini" onClick={() => setSeed((s) => s + 1)}>
          Shuffle
        </button>
        <CopyButton text={text} />
      </div>
      <textarea className="widget-area" readOnly value={text} />
    </div>
  );
}

const rand = (n: number) => Math.floor(Math.random() * n);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function sentence(): string {
  const len = 6 + rand(10);
  const words = Array.from({ length: len }, () => LOREM[rand(LOREM.length)]);
  return cap(words.join(' ')) + '.';
}
function paragraph(): string {
  return Array.from({ length: 3 + rand(4) }, sentence).join(' ');
}
function generateLorem(unit: 'paragraphs' | 'sentences' | 'words', count: number): string {
  if (unit === 'words') return cap(Array.from({ length: count }, () => LOREM[rand(LOREM.length)]).join(' ')) + '.';
  if (unit === 'sentences') return Array.from({ length: count }, sentence).join(' ');
  return Array.from({ length: count }, paragraph).join('\n\n');
}
