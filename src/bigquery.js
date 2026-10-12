import { fail } from './errors.js';

export async function createBigQuery(config) {
  const { BigQuery } = await import('@google-cloud/bigquery');
  return new BigQuery({ projectId: config.projectId });
}

export async function writeRows(client, config, rows) {
  if (!rows.length) return;
  try {
    await client
      .dataset(config.dataset)
      .table(config.table)
      .insert(
        rows.map((row) => ({ insertId: row.observation_key, json: row })),
        { raw: true }
      );
  } catch (error) {
    fail(
      error.name === 'PartialFailureError' ? 'BIGQUERY_PARTIAL_FAILURE' : 'BIGQUERY_WRITE_FAILED'
    );
  }
}
