import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCsv, importCsv } from '../src/csv.js';
import { runCli } from '../src/cli.js';

const header =
  'タイムスタンプ測定器,記録タイプ,過去のグルコース値 mg/dL,血糖値をスキャンする mg/dL,メモ';
const csv = `metadata\n${header}\n2026-09-15 00:15,0,100,,\n2026-09-29 00:15,1,,120,\n2026-10-06 21:38,6,,,note\n`;
const context = { patientId: 'p', runId: 'r', fetchedAt: '2026-10-12T00:00:00Z' };

test('imports history and scans with Japan dates and preserves original rows', () => {
  const { rows, skipped } = importCsv(csv, context);
  assert.equal(rows.length, 2);
  assert.equal(skipped, 1);
  assert.equal(rows[0].measured_at, '2026-09-14T15:15:00.000Z');
  assert.equal(rows[1].measured_at, '2026-09-28T15:15:00.000Z');
  assert.equal(rows[0].record_source, 'libreview_history');
  assert.equal(rows[1].record_source, 'libreview_scan');
  assert.equal(rows[0].glucose_mg_dl, 100);
  assert.equal(rows[1].glucose_mg_dl, 120);
  assert.equal(rows[0].observation_key, 'p|2026-09-14T15:15:00.000Z');
  assert.equal(JSON.parse(rows[0].raw_measurement)['記録タイプ'], '0');
});

test('CSV supports BOM, CRLF, quoted commas, escaped quotes and multiline notes', () => {
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"hello,there","a""b\nline"\r\n'), [
    ['a', 'b'],
    ['hello,there', 'a"b\nline']
  ]);
});

test('invalid CSV or invalid measurements fail rather than silently dropping data', () => {
  for (const value of ['"unfinished', 'a"b', '"closed"extra'])
    assert.throws(() => parseCsv(value), /CSV_INVALID_FORMAT/);
  assert.throws(() => importCsv('unsupported', context), /CSV_UNSUPPORTED_COLUMNS/);
  assert.throws(() => importCsv(`${header}\n2026-09-15 00:15,0,bad,,`, context), /GLUCOSE_INVALID/);
  assert.throws(() => importCsv(`${header}\n2026-09-15 00:15,0,,,`, context), /GLUCOSE_INVALID/);
  assert.throws(() => importCsv(`${header}\ninvalid,0,100,,`, context), /MEASUREMENT_TIME_INVALID/);
  assert.throws(() => importCsv(`${header}\nshort,0`, context), /CSV_INVALID_FORMAT/);
});

test('CSV import dumps without Libre credentials or network and preserves source', async (t) => {
  const directory = await fs.mkdtemp(join(tmpdir(), 'libre2-csv-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const input = join(directory, 'source.csv'),
    output = join(directory, 'out.json');
  await fs.writeFile(input, csv);
  const out = [],
    errors = [];
  const dependencies = {
    env: { LLU_PATIENT_ID: 'p' },
    fetchImpl: () => assert.fail('Must not fetch'),
    makeBigQuery: () => assert.fail('Must not use BigQuery'),
    stdout: (line) => out.push(line),
    stderr: (line) => errors.push(line)
  };
  assert.equal(await runCli(['import-csv', input, '--dump', output], dependencies), 0);
  assert.deepEqual(errors, []);
  assert.equal(JSON.parse(await fs.readFile(output, 'utf8')).length, 2);
  assert.equal(await fs.readFile(input, 'utf8'), csv);
  assert.equal(JSON.parse(out[0]).skipped, 1);
  assert.equal(JSON.parse(out[0]).firstMeasurement, '2026-09-14T15:15:00.000Z');
  assert.doesNotMatch(out.join(''), /120|raw_measurement/);
  assert.equal(
    await runCli(['import-csv', join(directory, 'missing.csv'), '--dump', output], dependencies),
    1
  );
  assert.equal(errors.at(-1), 'CSV_READ_FAILED');
});

test('CSV import without dump requires BigQuery configuration and bad arguments fail first', async () => {
  const errors = [];
  const dependencies = {
    env: { LLU_PATIENT_ID: 'p' },
    stderr: (line) => errors.push(line),
    fetchImpl: () => assert.fail('Must not fetch')
  };
  assert.equal(await runCli(['import-csv', 'unused.csv'], dependencies), 1);
  assert.equal(errors.at(-1), 'CONFIG_MISSING_BQ_PROJECT_ID');
  for (const args of [
    ['import-csv'],
    ['import-csv', 'file', '--dump'],
    ['import-csv', 'file', '--other', 'out']
  ]) {
    assert.equal(await runCli(args, dependencies), 1);
    assert.match(errors.at(-1), /^USAGE:/);
  }
});
