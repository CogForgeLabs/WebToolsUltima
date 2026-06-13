import type { ParamSpec, Params, ParamValue } from '../../core/engines/types';

interface OptionsPanelProps {
  specs: ParamSpec[];
  values: Params;
  onChange: (key: string, value: ParamValue) => void;
}

export function OptionsPanel({ specs, values, onChange }: OptionsPanelProps) {
  if (specs.length === 0) return null;
  return (
    <div className="options">
      {specs.map((spec) => (
        <label className="option" key={spec.key}>
          <span className="option-label">
            {spec.label}
            {spec.type === 'range' && <span className="option-value">{String(values[spec.key] ?? spec.default)}{spec.unit ?? ''}</span>}
          </span>
          <Control spec={spec} value={values[spec.key] ?? spec.default} onChange={(v) => onChange(spec.key, v)} />
          {spec.help && <span className="option-help">{spec.help}</span>}
        </label>
      ))}
    </div>
  );
}

function Control({ spec, value, onChange }: { spec: ParamSpec; value: ParamValue | undefined; onChange: (v: ParamValue) => void }) {
  switch (spec.type) {
    case 'range':
      return (
        <input
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step ?? 1}
          value={Number(value ?? spec.default ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          min={spec.min}
          max={spec.max}
          step={spec.step ?? 1}
          value={Number(value ?? spec.default ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );
    case 'bool':
      return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
    case 'select':
      return (
        <select value={String(value ?? spec.default ?? '')} onChange={(e) => onChange(e.target.value)}>
          {spec.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'text':
    default:
      return <input type="text" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder={spec.help} />;
  }
}
