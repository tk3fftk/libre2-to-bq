import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runCli } from '../src/cli.js';
import { normalize } from '../src/normalize.js';
import { writeDump } from '../src/dump.js';

const env = { LLU_EMAIL: 'test@example.invalid', LLU_PASSWORD: 'secret', LLU_PATIENT_ID: 'p' };
const measurement = { Timestamp: '2026-10-12T13:30:00', ValueInMgPerDl: 123 };

async function temporaryDirectory(t) {
  const directory = await fs.mkdtemp(join(tmpdir(), 'libre2-dump-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

function harness(graphData = [measurement], overrides = {}) {
  const calls = [],
    out = [],
    errors = [];
  const dependencies = {
    env,
    fetchImpl: async (url) => {
      calls.push(url);
      const data =
        calls.length === 1
          ? { authTicket: { token: 'token' }, user: { id: 'account' } }
          : { graphData };
      return { ok: true, status: 200, json: async () => ({ status: 0, data }) };
    },
    makeBigQuery: () => {
      throw new Error('BigQuery must never be created in dump mode');
    },
    stdout: (line) => out.push(line),
    stderr: (line) => errors.push(line),
    ...overrides
  };
  return { calls, out, errors, dependencies };
}

test('dump writes all normalized columns as formatted JSON without BigQuery config', async (t) => {
  const directory = await temporaryDirectory(t);
  const path = join(directory, 'new', 'readings.json');
  const h = harness();
  assert.equal(await runCli(['collect', '--dump', path], h.dependencies), 0);
  assert.deepEqual(h.errors, []);
  assert.equal(h.calls.length, 2);
  const text = await fs.readFile(path, 'utf8');
  const rows = JSON.parse(text);
  assert.equal(rows.length, 1);
  const expected = normalize(
    { measurement, source: 'history' },
    {
      patientId: 'p',
      runId: rows[0].run_id,
      fetchedAt: rows[0].fetched_at
    }
  );
  assert.deepEqual(rows, [expected]);
  assert.equal(text, `${JSON.stringify(rows, null, 2)}\n`);
  assert.match(rows[0].run_id, /^[0-9a-f-]{36}$/);
  assert.equal(JSON.parse(rows[0].raw_measurement).ValueInMgPerDl, 123);
  assert.deepEqual(JSON.parse(h.out[0]), {
    count: 1,
    lastMeasurement: '2026-10-12T04:30:00.000Z',
    outputPath: resolve(path)
  });
  assert.doesNotMatch(h.out.join(''), /123|secret|token|raw_measurement/);
});

test('empty collection writes an empty JSON array and reports success', async (t) => {
  const directory = await temporaryDirectory(t);
  const path = join(directory, 'empty.json');
  const h = harness([]);
  assert.equal(await runCli(['collect', '--dump', path], h.dependencies), 0);
  assert.equal(await fs.readFile(path, 'utf8'), '[]\n');
  assert.deepEqual(JSON.parse(h.out[0]), { count: 0, lastMeasurement: null, outputPath: path });
});

test('existing files remain intact, including empty dumps', async (t) => {
  const directory = await temporaryDirectory(t);
  const path = join(directory, 'existing.json');
  await fs.writeFile(path, 'original contents');
  const h = harness([]);
  assert.equal(await runCli(['collect', '--dump', path], h.dependencies), 1);
  assert.deepEqual(h.errors, ['DUMP_FILE_EXISTS']);
  assert.deepEqual(h.out, []);
  assert.equal(await fs.readFile(path, 'utf8'), 'original contents');
});

test('invalid options fail before config, network or file operations', async (t) => {
  const directory = await temporaryDirectory(t);
  const path = join(directory, 'must-not-exist.json');
  for (const args of [
    ['collect', '--dump'],
    ['collect', '--dump', ''],
    ['collect', '--dump', '   '],
    ['collect', '--unknown', path],
    ['collect', '--dump', path, '--dump', path],
    ['collect', '--dump', '--other'],
    ['connections', '--dump', path]
  ]) {
    const h = harness([], { env: {}, saveDump: () => assert.fail('Must not write') });
    assert.equal(await runCli(args, h.dependencies), 1);
    assert.match(h.errors[0], /^USAGE:/);
    assert.equal(h.calls.length, 0);
  }
  await assert.rejects(fs.stat(path), { code: 'ENOENT' });
});

test('dump requires an explicit patient ID before network requests', async () => {
  const h = harness([], { env: { ...env, LLU_PATIENT_ID: '' } });
  assert.equal(await runCli(['collect', '--dump', 'unused.json'], h.dependencies), 1);
  assert.deepEqual(h.errors, ['CONFIG_MISSING_LLU_PATIENT_ID']);
  assert.equal(h.calls.length, 0);
});

test('normalization failure does not create output or parent directories', async (t) => {
  const directory = await temporaryDirectory(t);
  const path = join(directory, 'absent', 'invalid.json');
  const h = harness([measurement, { ...measurement, Timestamp: 'invalid' }]);
  assert.equal(await runCli(['collect', '--dump', path], h.dependencies), 1);
  assert.deepEqual(h.errors, ['MEASUREMENT_TIME_INVALID']);
  await assert.rejects(fs.stat(join(directory, 'absent')), { code: 'ENOENT' });
});

test('failed write closes the handle and removes its partially written file', async (t) => {
  const directory = await temporaryDirectory(t);
  const path = join(directory, 'partial.json');
  let closed = false;
  const filesystem = {
    ...fs,
    open: async (...args) => {
      const handle = await fs.open(...args);
      return {
        writeFile: async () => {
          await handle.writeFile('partial');
          throw Object.assign(new Error('secret measurement data'), { code: 'ENOSPC' });
        },
        close: async () => {
          await handle.close();
          closed = true;
        }
      };
    }
  };
  const h = harness([measurement], { saveDump: (file, rows) => writeDump(file, rows, filesystem) });
  assert.equal(await runCli(['collect', '--dump', path], h.dependencies), 1);
  assert.deepEqual(h.errors, ['DUMP_WRITE_FAILED']);
  assert.deepEqual(h.out, []);
  assert.equal(closed, true);
  await assert.rejects(fs.stat(path), { code: 'ENOENT' });
});

test('parent path that is a file produces a write error without removing it', async (t) => {
  const directory = await temporaryDirectory(t);
  const parent = join(directory, 'file');
  await fs.writeFile(parent, 'unchanged');
  const h = harness();
  assert.equal(await runCli(['collect', '--dump', join(parent, 'output.json')], h.dependencies), 1);
  assert.deepEqual(h.errors, ['DUMP_WRITE_FAILED']);
  assert.equal(await fs.readFile(parent, 'utf8'), 'unchanged');
});

test('concurrent writers cannot overwrite one another', async (t) => {
  const directory = await temporaryDirectory(t);
  const path = join(directory, 'race.json');
  const results = await Promise.allSettled([
    writeDump(path, [{ value: 1 }]),
    writeDump(path, [{ value: 2 }])
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(
    results.find((result) => result.status === 'rejected').reason.message,
    'DUMP_FILE_EXISTS'
  );
  const rows = JSON.parse(await fs.readFile(path, 'utf8'));
  assert.ok(rows[0].value === 1 || rows[0].value === 2);
});
