import type { Asset, EngineRuntime, RunContext } from '../../core/engines/types';
import { withExtension, baseName } from '../../core/util/bytes';
import { extOf } from '../../core/util/blob';

type JsonRecord = Record<string, unknown>;

/** Stringify a single field and quote it if the delimiter/quote/newline rules require. */
function escapeField(value: unknown, delimiter: string): string {
  let str: string;
  if (value === null || value === undefined) {
    str = '';
  } else if (typeof value === 'string') {
    str = value;
  } else if (typeof value === 'object') {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }
  if (
    str.includes(delimiter) ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function jsonToCsv(input: Asset, delimiter: string): string {
  const text = new TextDecoder().decode(input.data);
  const parsed: unknown = JSON.parse(text);
  const rows: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

  // Union of keys across all object rows, preserving first-seen order.
  const header: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row !== null && typeof row === 'object' && !Array.isArray(row)) {
      for (const key of Object.keys(row as JsonRecord)) {
        if (!seen.has(key)) {
          seen.add(key);
          header.push(key);
        }
      }
    }
  }

  const lines: string[] = [];
  lines.push(header.map((h) => escapeField(h, delimiter)).join(delimiter));
  for (const row of rows) {
    const record = (row !== null && typeof row === 'object' && !Array.isArray(row))
      ? (row as JsonRecord)
      : ({} as JsonRecord);
    const cells = header.map((key) => escapeField(record[key], delimiter));
    lines.push(cells.join(delimiter));
  }
  return lines.join('\r\n');
}

/** Stateful CSV parser honouring quoted fields, escaped "" and newlines inside quotes. */
function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let started = false; // whether the current record has any content

  const pushField = (): void => {
    row.push(field);
    field = '';
  };
  const pushRow = (): void => {
    pushField();
    rows.push(row);
    row = [];
    started = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      started = true;
    } else if (ch === delimiter) {
      started = true;
      pushField();
    } else if (ch === '\r') {
      // Swallow CRLF as a single line break; lone CR also ends the row.
      if (text[i + 1] === '\n') i++;
      pushRow();
    } else if (ch === '\n') {
      pushRow();
    } else {
      field += ch;
      started = true;
    }
  }

  // Flush trailing record (unless the file ended on a clean line break).
  if (started || field.length > 0 || row.length > 0) {
    pushRow();
  }
  return rows;
}

function csvToJson(input: Asset, delimiter: string): string {
  const text = new TextDecoder().decode(input.data);
  const table = parseCsv(text, delimiter);
  if (table.length === 0) return JSON.stringify([], null, 2);

  const headers = table[0];
  const out: JsonRecord[] = [];
  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    const obj: JsonRecord = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = c < cells.length ? cells[c] : '';
    }
    out.push(obj);
  }
  return JSON.stringify(out, null, 2);
}

export function createRuntime(): EngineRuntime {
  return {
    async run(inputs: Asset[], ctx: RunContext): Promise<Asset[]> {
      const input = inputs[0];
      if (!input) throw new Error('No input provided');
      ctx.onProgress(0.1);

      const delimiter = String(ctx.params.delimiter ?? ',');
      const target = ctx.target;
      if (!target) throw new Error('No target format specified');

      let str: string;
      let formatId: string;
      if (target === 'csv') {
        str = jsonToCsv(input, delimiter);
        formatId = 'csv';
      } else if (target === 'json') {
        str = csvToJson(input, delimiter);
        formatId = 'json';
      } else {
        throw new Error(`Unsupported data conversion target: ${target}`);
      }

      const data = new TextEncoder().encode(str);
      const name = withExtension(baseName(input.name), extOf(target));

      ctx.onProgress(1);
      return [{ name, formatId, data }];
    },
  };
}
