import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { readConfig } from './config.js';
import { connect } from './libre.js';
import { normalize } from './normalize.js';
import { createBigQuery, writeRows } from './bigquery.js';
import { writeDump } from './dump.js';
import { readCsv } from './csv.js';
import { CollectorError, fail } from './errors.js';

function parseArgs(args) {
  if (args[0] === 'import-csv') {
    const [, inputPath, option, path] = args;
    if (
      inputPath?.trim() &&
      !inputPath.startsWith('--') &&
      (args.length === 2 ||
        (args.length === 4 && option === '--dump' && path?.trim() && !path.startsWith('--')))
    ) {
      return { command: 'import-csv', inputPath, dumpPath: path };
    }
    fail('USAGE: import-csv <path> [--dump <path>]');
  }
  const [command, option, path] = args;
  if (!['collect', 'connections'].includes(command))
    fail('USAGE: collect [--dump <path>] | connections');
  if (args.length === 1) return { command };
  if (
    command !== 'collect' ||
    args.length !== 3 ||
    option !== '--dump' ||
    !path?.trim() ||
    path.startsWith('--')
  ) {
    fail('USAGE: collect [--dump <path>] | connections');
  }
  return { command, dumpPath: path };
}

export async function runCli(args, dependencies = {}) {
  const {
    env = process.env,
    fetchImpl = fetch,
    makeBigQuery = createBigQuery,
    saveDump = writeDump,
    stdout = (line) => process.stdout.write(`${line}\n`),
    stderr = (line) => process.stderr.write(`${line}\n`)
  } = dependencies;
  try {
    const { command, dumpPath, inputPath } = parseArgs(args);
    const config = readConfig(env, command, { dumpPath });
    const api = command === 'import-csv' ? null : await connect(config, fetchImpl);
    if (command === 'connections') {
      stdout(JSON.stringify(await api.connections(), null, 2));
      return 0;
    }
    const context = {
      patientId: config.patientId,
      runId: randomUUID(),
      fetchedAt: new Date().toISOString()
    };
    let rows, skipped;
    if (command === 'import-csv') ({ rows, skipped } = await readCsv(inputPath, context));
    else rows = (await api.readings()).map((reading) => normalize(reading, context));
    let outputPath;
    if (dumpPath) outputPath = await saveDump(dumpPath, rows);
    else if (rows.length) await writeRows(await makeBigQuery(config), config, rows);
    const latest = rows.reduce(
      (time, row) => (row.measured_at > time ? row.measured_at : time),
      ''
    );
    stdout(
      JSON.stringify({
        count: rows.length,
        lastMeasurement: latest || null,
        ...(command === 'import-csv'
          ? {
              firstMeasurement:
                rows.reduce(
                  (first, row) => (!first || row.measured_at < first ? row.measured_at : first),
                  ''
                ) || null,
              skipped
            }
          : {}),
        ...(outputPath ? { outputPath } : {})
      })
    );
    return 0;
  } catch (error) {
    const message = error instanceof CollectorError ? error.message : 'COLLECTION_FAILED';
    if (message === 'RATE_LIMITED') stderr('RATE_LIMITED: 時間をおいて再実行してください。');
    else if (message === 'LLU_AUTH_ACTION_REQUIRED')
      stderr(`${message}: LibreLinkUpアプリでログインし、規約同意などの案内を確認してください。`);
    else if (/^LLU_REGION_REDIRECT_(US|EU|EU2|DE|FR|JP|AP|AU|AE|CA)$/.test(message)) {
      const region = message.slice('LLU_REGION_REDIRECT_'.length).toLowerCase();
      stderr(
        `${message}: .envのLLU_API_BASEをhttps://api-${region}.libreview.ioに設定してください。`
      );
    } else stderr(message);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli(process.argv.slice(2));
}
