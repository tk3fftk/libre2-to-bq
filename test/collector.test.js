import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../src/cli.js';
import { measurementTime, normalize } from '../src/normalize.js';
import { readConfig } from '../src/config.js';

const env = {
  LLU_EMAIL: 'test@example.invalid',
  LLU_PASSWORD: 'secret-password',
  LLU_PATIENT_ID: 'patient/1',
  BQ_PROJECT_ID: 'project',
  BQ_DATASET: 'dataset',
  BQ_TABLE: 'measurements'
};
const login = {
  status: 0,
  data: { authTicket: { token: 'secret-token' }, user: { id: 'account' } }
};
const reading = { Timestamp: '10/12/2026 1:30:00 PM', ValueInMgPerDl: 123, TrendArrow: 3 };
function response(data, status = 200) {
  return { ok: status < 400, status, json: async () => data };
}
function harness(replies, options = {}) {
  const calls = [],
    out = [],
    errors = [],
    inserted = [];
  const dependencies = {
    env,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      const next = replies.shift();
      if (next instanceof Error) throw next;
      assert.ok(next, 'Unexpected upstream call');
      return next;
    },
    makeBigQuery: async () => ({
      dataset: (dataset) => {
        assert.equal(dataset, 'dataset');
        return {
          table: (table) => {
            assert.equal(table, 'measurements');
            return {
              insert: async (rows, settings) => {
                inserted.push({ rows, settings });
                if (options.insertError) throw options.insertError;
              }
            };
          }
        };
      }
    }),
    stdout: (line) => out.push(line),
    stderr: (line) => errors.push(line),
    ...options.dependencies
  };
  return { dependencies, calls, out, errors, inserted };
}

test('collect authenticates and writes schema-compatible history and latest rows', async () => {
  const h = harness([
    response(login),
    response({
      status: 0,
      data: { graphData: [reading], connection: { glucoseMeasurement: reading } }
    })
  ]);
  assert.equal(await runCli(['collect'], h.dependencies), 0);
  assert.equal(h.calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(h.calls[0].init.body), {
    email: env.LLU_EMAIL,
    password: env.LLU_PASSWORD
  });
  assert.equal(h.calls[1].url, 'https://api.libreview.io/llu/connections/patient%2F1/graph');
  assert.equal(h.calls[1].init.headers.Authorization, 'Bearer secret-token');
  assert.equal(
    h.calls[1].init.headers['Account-Id'],
    createHash('sha256').update('account').digest('hex')
  );
  assert.equal(h.calls[0].init.redirect, 'error');
  assert.ok(h.calls[0].init.signal instanceof AbortSignal);
  const { rows, settings } = h.inserted[0];
  assert.deepEqual(settings, { raw: true });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].insertId, 'patient/1|2026-10-12T04:30:00.000Z');
  assert.equal(rows[0].json.record_source, 'history');
  assert.equal(rows[1].json.record_source, 'latest');
  assert.equal(rows[0].json.run_id, rows[1].json.run_id);
  assert.match(rows[0].json.run_id, /^[0-9a-f-]{36}$/);
  assert.equal(rows[0].json.glucose_mg_dl, 123);
  assert.deepEqual(JSON.parse(rows[0].json.raw_measurement), reading);
  assert.deepEqual(JSON.parse(h.out[0]), { count: 2, lastMeasurement: '2026-10-12T04:30:00.000Z' });
  assert.doesNotMatch(h.out.join(''), /secret|123/);
});

test('connections needs only Libre credentials and prints only ID and name', async () => {
  const h = harness(
    [
      response(login),
      response({
        data: [
          {
            patientId: 'p',
            firstName: 'First',
            lastName: 'Last',
            glucoseMeasurement: reading,
            token: 'secret'
          }
        ]
      })
    ],
    {
      dependencies: {
        env: { LLU_EMAIL: env.LLU_EMAIL, LLU_PASSWORD: env.LLU_PASSWORD },
        makeBigQuery: () => assert.fail('Must not authenticate BigQuery')
      }
    }
  );
  assert.equal(await runCli(['connections'], h.dependencies), 0);
  assert.deepEqual(JSON.parse(h.out[0]), [{ patientId: 'p', name: 'First Last' }]);
});

test('empty graph succeeds without creating a BigQuery client', async () => {
  const h = harness([response(login), response({ data: { graphData: [] } })], {
    dependencies: { makeBigQuery: () => assert.fail('No insert for empty graph') }
  });
  assert.equal(await runCli(['collect'], h.dependencies), 0);
  assert.deepEqual(JSON.parse(h.out[0]), { count: 0, lastMeasurement: null });
});

test('required config is checked before network requests', async () => {
  for (const key of Object.keys(env)) {
    const h = harness([], { dependencies: { env: { ...env, [key]: '' } } });
    assert.equal(await runCli(['collect'], h.dependencies), 1);
    assert.equal(h.calls.length, 0);
    assert.equal(h.errors[0], `CONFIG_MISSING_${key}`);
  }
  assert.equal(readConfig(env, 'collect').version, '4.16.0');
  assert.throws(
    () => readConfig({ ...env, LLU_API_BASE: 'http://example.invalid' }, 'collect'),
    /CONFIG_INVALID/
  );
});

test('upstream failures produce safe errors and no inserts', async () => {
  for (const [reply, expected] of [
    [response({ secret: 'secret-password' }, 429), 'RATE_LIMITED'],
    [response({ secret: 'secret-token' }, 401), 'UPSTREAM_HTTP_401'],
    [Object.assign(new Error('secret-token'), { name: 'TimeoutError' }), 'UPSTREAM_TIMEOUT'],
    [new Error('secret-password'), 'UPSTREAM_NETWORK'],
    [
      {
        ok: true,
        status: 200,
        json: () => {
          throw new SyntaxError('secret-token');
        }
      },
      'UPSTREAM_INVALID_RESPONSE'
    ],
    [response({ status: 4, data: 'secret' }), 'LLU_AUTH_ACTION_REQUIRED'],
    [response({ status: 2, data: 'secret' }), 'UPSTREAM_REJECTED_LOGIN_STATUS_2'],
    [response({ status: 'secret-token' }), 'UPSTREAM_REJECTED_LOGIN_STATUS_UNKNOWN'],
    [response({ status: 0, data: { redirect: true, region: 'jp' } }), 'LLU_REGION_REDIRECT_JP'],
    [
      response({ status: 0, data: { redirect: true, region: 'secret-token' } }),
      'LLU_REGION_REDIRECT'
    ],
    [response({ data: {} }), 'LLU_AUTH_ACTION_REQUIRED']
  ]) {
    const h = harness([reply]);
    assert.equal(await runCli(['collect'], h.dependencies), 1);
    assert.ok(h.errors[0].startsWith(expected));
    assert.equal(h.inserted.length, 0);
    assert.doesNotMatch(h.errors.join(''), /secret/);
  }
});

test('partial and general BigQuery errors return nonzero without leaking row data', async () => {
  for (const name of ['PartialFailureError', 'Error']) {
    const h = harness([response(login), response({ data: { graphData: [reading] } })], {
      insertError: Object.assign(new Error('secret-token glucose 123'), { name })
    });
    assert.equal(await runCli(['collect'], h.dependencies), 1);
    assert.equal(h.out.length, 0);
    assert.equal(
      h.errors[0],
      name === 'PartialFailureError' ? 'BIGQUERY_PARTIAL_FAILURE' : 'BIGQUERY_WRITE_FAILED'
    );
  }
});

test('missing graph is not treated as zero readings', async () => {
  const h = harness([response(login), response({ data: {} })]);
  assert.equal(await runCli(['collect'], h.dependencies), 1);
  assert.equal(h.errors[0], 'UPSTREAM_INVALID_RESPONSE');
});

test('timestamps use Japan convention and respect explicit offsets', () => {
  for (const [input, expected] of [
    ['2026-10-12T13:30:00', '2026-10-12T04:30:00.000Z'],
    ['2026-10-12T13:30:00+09:00', '2026-10-12T04:30:00.000Z'],
    ['2026-10-12T13:30:00Z', '2026-10-12T13:30:00.000Z'],
    ['10/12/2026 12:00:00 AM', '2026-10-11T15:00:00.000Z'],
    ['10/12/2026 12:00:00 PM', '2026-10-12T03:00:00.000Z'],
    ['2024-02-29T00:00:00.123', '2024-02-28T15:00:00.123Z']
  ])
    assert.equal(measurementTime(input), expected);
  for (const input of [
    '',
    'invalid',
    '2026-02-29T00:00:00',
    '2026-04-31T00:00:00',
    '2026-10-12T24:00:00',
    '10/12/2026 0:00:00 AM'
  ]) {
    assert.throws(() => measurementTime(input), /MEASUREMENT_TIME/);
  }
});

test('timestamp conversion is independent of host timezone', () => {
  for (const TZ of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "import {measurementTime} from './src/normalize.js'; process.stdout.write(measurementTime('10/12/2026 1:30:00 PM'));"
      ],
      { env: { ...process.env, TZ }, encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '2026-10-12T04:30:00.000Z');
  }
});

test('glucose validation preserves zero and rejects invalid/missing values', () => {
  const context = { patientId: 'p', runId: 'r', fetchedAt: '2026-10-12T00:00:00Z' };
  for (const value of [0, '100']) {
    const row = normalize(
      { measurement: { ...reading, ValueInMgPerDl: value }, source: 'latest' },
      context
    );
    assert.equal(row.glucose_mg_dl, Number(value));
    assert.equal(row.record_source, 'latest');
  }
  for (const value of [null, undefined, '', ' ', 'NaN', Infinity, true]) {
    assert.throws(
      () =>
        normalize(
          { measurement: { ...reading, ValueInMgPerDl: value }, source: 'history' },
          context
        ),
      /GLUCOSE_/
    );
  }
});

test('invalid row prevents the whole batch from being inserted', async () => {
  const h = harness([
    response(login),
    response({ data: { graphData: [reading, { ...reading, Timestamp: 'invalid' }] } })
  ]);
  assert.equal(await runCli(['collect'], h.dependencies), 1);
  assert.equal(h.inserted.length, 0);
  assert.equal(h.errors[0], 'MEASUREMENT_TIME_INVALID');
});

test('CLI process returns exit code 1 for missing configuration without a .env file', () => {
  const result = spawnSync(process.execPath, ['src/cli.js', 'collect'], {
    env: { ...process.env, LLU_EMAIL: '', LLU_PASSWORD: '' },
    encoding: 'utf8'
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.trim(), 'CONFIG_MISSING_LLU_EMAIL');
});

test('Node environment loader uses OS precedence and tolerates absent .env', () => {
  const directory = mkdtempSync(join(tmpdir(), 'libre2-env-test-'));
  try {
    const path = join(directory, '.env');
    writeFileSync(path, 'LIBRE2_TEST_SETTING=file-value\n');
    const result = spawnSync(
      process.execPath,
      [
        `--env-file-if-exists=${path}`,
        '-e',
        'process.stdout.write(process.env.LIBRE2_TEST_SETTING)'
      ],
      { env: { ...process.env, LIBRE2_TEST_SETTING: 'os-value' }, encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'os-value');
    const absent = spawnSync(
      process.execPath,
      [
        `--env-file-if-exists=${join(directory, 'missing.env')}`,
        '-e',
        'process.stdout.write("ok")'
      ],
      { encoding: 'utf8' }
    );
    assert.equal(absent.status, 0, absent.stderr);
    assert.equal(absent.stdout, 'ok');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('graph rate limit and body timeout are handled safely', async () => {
  for (const reply of [
    response({}, 429),
    {
      ok: true,
      status: 200,
      json: () => {
        throw Object.assign(new Error('secret'), { name: 'TimeoutError' });
      }
    }
  ]) {
    const h = harness([response(login), reply]);
    assert.equal(await runCli(['collect'], h.dependencies), 1);
    assert.match(h.errors[0], /RATE_LIMITED|UPSTREAM_TIMEOUT/);
    assert.equal(h.calls.length, 2);
    assert.equal(h.inserted.length, 0);
  }
});
