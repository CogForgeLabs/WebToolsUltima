import { useMemo, useState } from 'react';

export function Calculators({ kind }: { kind: 'unit' | 'time' }) {
  return kind === 'unit' ? <UnitConverter /> : <TimeConverter />;
}

// ───────────────────────── Unit converter ─────────────────────────

interface UnitDef {
  id: string;
  label: string;
  /** Multiply value by `factor` to get the base unit. */
  factor: number;
}
interface UnitGroup {
  id: string;
  label: string;
  units: UnitDef[];
}

const UNIT_GROUPS: UnitGroup[] = [
  {
    id: 'length',
    label: 'Length',
    units: [
      { id: 'mm', label: 'Millimetre', factor: 0.001 },
      { id: 'cm', label: 'Centimetre', factor: 0.01 },
      { id: 'm', label: 'Metre', factor: 1 },
      { id: 'km', label: 'Kilometre', factor: 1000 },
      { id: 'in', label: 'Inch', factor: 0.0254 },
      { id: 'ft', label: 'Foot', factor: 0.3048 },
      { id: 'yd', label: 'Yard', factor: 0.9144 },
      { id: 'mi', label: 'Mile', factor: 1609.344 },
    ],
  },
  {
    id: 'mass',
    label: 'Weight',
    units: [
      { id: 'mg', label: 'Milligram', factor: 0.001 },
      { id: 'g', label: 'Gram', factor: 1 },
      { id: 'kg', label: 'Kilogram', factor: 1000 },
      { id: 't', label: 'Tonne', factor: 1_000_000 },
      { id: 'oz', label: 'Ounce', factor: 28.349523125 },
      { id: 'lb', label: 'Pound', factor: 453.59237 },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    units: [
      { id: 'B', label: 'Byte', factor: 1 },
      { id: 'KB', label: 'Kilobyte', factor: 1024 },
      { id: 'MB', label: 'Megabyte', factor: 1024 ** 2 },
      { id: 'GB', label: 'Gigabyte', factor: 1024 ** 3 },
      { id: 'TB', label: 'Terabyte', factor: 1024 ** 4 },
    ],
  },
  {
    id: 'speed',
    label: 'Speed',
    units: [
      { id: 'mps', label: 'Metre/second', factor: 1 },
      { id: 'kmh', label: 'Kilometre/hour', factor: 1000 / 3600 },
      { id: 'mph', label: 'Mile/hour', factor: 1609.344 / 3600 },
      { id: 'kn', label: 'Knot', factor: 1852 / 3600 },
    ],
  },
];

function UnitConverter() {
  const [groupId, setGroupId] = useState('length');
  const [fromU, setFromU] = useState('m');
  const [toU, setToU] = useState('ft');
  const [value, setValue] = useState('1');
  const [temp, setTemp] = useState({ from: 'c', to: 'f', value: '100' });

  const group = UNIT_GROUPS.find((g) => g.id === groupId)!;
  const result = useMemo(() => {
    const f = group.units.find((u) => u.id === fromU);
    const t = group.units.find((u) => u.id === toU);
    const v = Number(value);
    if (!f || !t || Number.isNaN(v)) return '';
    return trim((v * f.factor) / t.factor);
  }, [group, fromU, toU, value]);

  const onGroup = (id: string) => {
    setGroupId(id);
    const g = UNIT_GROUPS.find((x) => x.id === id)!;
    setFromU(g.units[0].id);
    setToU(g.units[1]?.id ?? g.units[0].id);
  };

  return (
    <div className="calc">
      <div className="calc-tabs">
        {UNIT_GROUPS.map((g) => (
          <button key={g.id} className={g.id === groupId ? 'active' : ''} onClick={() => onGroup(g.id)}>
            {g.label}
          </button>
        ))}
        <button className={groupId === 'temp' ? 'active' : ''} onClick={() => setGroupId('temp')}>
          Temperature
        </button>
      </div>

      {groupId === 'temp' ? (
        <div className="calc-row">
          <input type="number" value={temp.value} onChange={(e) => setTemp({ ...temp, value: e.target.value })} />
          <select value={temp.from} onChange={(e) => setTemp({ ...temp, from: e.target.value })}>
            <option value="c">Celsius</option>
            <option value="f">Fahrenheit</option>
            <option value="k">Kelvin</option>
          </select>
          <span className="calc-eq">=</span>
          <output>{trim(convertTemp(Number(temp.value), temp.from, temp.to))}</output>
          <select value={temp.to} onChange={(e) => setTemp({ ...temp, to: e.target.value })}>
            <option value="c">Celsius</option>
            <option value="f">Fahrenheit</option>
            <option value="k">Kelvin</option>
          </select>
        </div>
      ) : (
        <div className="calc-row">
          <input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          <select value={fromU} onChange={(e) => setFromU(e.target.value)}>
            {group.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
          <span className="calc-eq">=</span>
          <output>{result}</output>
          <select value={toU} onChange={(e) => setToU(e.target.value)}>
            {group.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function convertTemp(v: number, from: string, to: string): number {
  if (Number.isNaN(v)) return NaN;
  // to Celsius
  let c = v;
  if (from === 'f') c = ((v - 32) * 5) / 9;
  else if (from === 'k') c = v - 273.15;
  // from Celsius
  if (to === 'f') return (c * 9) / 5 + 32;
  if (to === 'k') return c + 273.15;
  return c;
}

// ───────────────────────── Time converter ─────────────────────────

const TIME_UNITS: UnitDef[] = [
  { id: 'ms', label: 'Milliseconds', factor: 0.001 },
  { id: 's', label: 'Seconds', factor: 1 },
  { id: 'min', label: 'Minutes', factor: 60 },
  { id: 'h', label: 'Hours', factor: 3600 },
  { id: 'd', label: 'Days', factor: 86400 },
  { id: 'wk', label: 'Weeks', factor: 604800 },
];

function TimeConverter() {
  const [value, setValue] = useState('90');
  const [fromU, setFromU] = useState('min');
  const [toU, setToU] = useState('h');
  const [unix, setUnix] = useState(String(Math.floor(Date.now() / 1000)));

  const dur = useMemo(() => {
    const f = TIME_UNITS.find((u) => u.id === fromU);
    const t = TIME_UNITS.find((u) => u.id === toU);
    const v = Number(value);
    if (!f || !t || Number.isNaN(v)) return '';
    return trim((v * f.factor) / t.factor);
  }, [value, fromU, toU]);

  const date = useMemo(() => {
    const n = Number(unix);
    if (Number.isNaN(n)) return '';
    return new Date(n * 1000).toUTCString();
  }, [unix]);

  return (
    <div className="calc">
      <h3>Duration</h3>
      <div className="calc-row">
        <input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
        <select value={fromU} onChange={(e) => setFromU(e.target.value)}>
          {TIME_UNITS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
        <span className="calc-eq">=</span>
        <output>{dur}</output>
        <select value={toU} onChange={(e) => setToU(e.target.value)}>
          {TIME_UNITS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </div>

      <h3>Unix timestamp</h3>
      <div className="calc-row">
        <input type="number" value={unix} onChange={(e) => setUnix(e.target.value)} />
        <span className="calc-eq">=</span>
        <output className="wide">{date}</output>
      </div>
    </div>
  );
}

function trim(n: number): string {
  if (!Number.isFinite(n)) return '';
  return String(Math.round(n * 1e6) / 1e6);
}
