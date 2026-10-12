import { readFile } from 'node:fs/promises';
import { fail } from './errors.js';
import { normalize } from './normalize.js';

// Supports quoted commas, escaped quotes and newlines in LibreView exports.
export function parseCsv(text) {
  const rows = [];
  let row = [],
    value = '',
    quoted = false,
    closed = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else value += char;
    } else if (char === ',' || char === '\n' || char === '\r') {
      row.push(value);
      value = '';
      closed = false;
      if (char !== ',') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        rows.push(row);
        row = [];
      }
    } else if (char === '"' && value === '' && !closed) quoted = true;
    else {
      if (closed || char === '"') fail('CSV_INVALID_FORMAT');
      value += char;
    }
  }
  if (quoted) fail('CSV_INVALID_FORMAT');
  if (value !== '' || row.length || closed) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

export function importCsv(text, context) {
  const records = parseCsv(text);
  const columns = {
    time: 'タイムスタンプ測定器',
    type: '記録タイプ',
    history: '過去のグルコース値 mg/dL',
    scan: '血糖値をスキャンする mg/dL'
  };
  const headerIndex = records.findIndex((row) =>
    Object.values(columns).every((column) => row.includes(column))
  );
  if (headerIndex < 0) fail('CSV_UNSUPPORTED_COLUMNS');
  const header = records[headerIndex];
  if (new Set(header).size !== header.length) fail('CSV_INVALID_FORMAT');
  const rows = [];
  let skipped = 0;
  for (const record of records.slice(headerIndex + 1)) {
    if (record.every((value) => value === '')) continue;
    if (record.length !== header.length) fail('CSV_INVALID_FORMAT');
    const original = Object.fromEntries(header.map((column, index) => [column, record[index]]));
    const type = original[columns.type];
    if (!['0', '1'].includes(type)) {
      skipped++;
      continue;
    }
    const timestamp = original[columns.time].replace(
      /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/,
      '$1T$2:00'
    );
    const row = normalize(
      {
        measurement: {
          Timestamp: timestamp,
          ValueInMgPerDl: original[type === '0' ? columns.history : columns.scan]
        },
        source: type === '0' ? 'libreview_history' : 'libreview_scan'
      },
      context
    );
    row.raw_measurement = JSON.stringify(original);
    rows.push(row);
  }
  return { rows, skipped };
}

export async function readCsv(path, context) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    fail('CSV_READ_FAILED');
  }
  return importCsv(text, context);
}
