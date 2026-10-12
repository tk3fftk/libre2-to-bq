import { fail } from './errors.js';

export function readConfig(env, command, { dumpPath } = {}) {
  const required = command === 'import-csv' ? [] : ['LLU_EMAIL', 'LLU_PASSWORD'];
  if (command === 'collect' || command === 'import-csv') {
    required.push('LLU_PATIENT_ID');
    if (!dumpPath) required.push('BQ_PROJECT_ID', 'BQ_DATASET', 'BQ_TABLE');
  }
  for (const key of required) {
    if (!env[key]?.trim()) fail(`CONFIG_MISSING_${key}`);
  }
  const base = env.LLU_API_BASE || 'https://api.libreview.io';
  let url;
  try {
    url = new URL(command === 'import-csv' ? 'https://api.libreview.io' : base);
  } catch {
    fail('CONFIG_INVALID_LLU_API_BASE');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    fail('CONFIG_INVALID_LLU_API_BASE');
  }
  return {
    email: env.LLU_EMAIL,
    password: env.LLU_PASSWORD,
    patientId: env.LLU_PATIENT_ID,
    base: base.replace(/\/+$/, ''),
    version: env.LLU_VERSION || '4.16.0',
    projectId: env.BQ_PROJECT_ID,
    dataset: env.BQ_DATASET,
    table: env.BQ_TABLE
  };
}
