/* exported setup, checkStatus, runOnce, startCollection, collectScheduled, stopCollection */
const P = PropertiesService.getScriptProperties();
const KEYS = [
  'LLU_EMAIL',
  'LLU_PASSWORD',
  'LLU_API_BASE',
  'LLU_VERSION',
  'LLU_PATIENT_ID',
  'LLU_TOKEN',
  'LLU_TOKEN_EXPIRES_AT',
  'LLU_ACCOUNT_ID_HASH',
  'BQ_PROJECT_ID',
  'BQ_DATASET',
  'BQ_TABLE',
  'BQ_LOCATION',
  'RUN_ID',
  'START_AT',
  'END_AT',
  'RUN_STATUS',
  'LAST_SUCCESS_AT',
  'LAST_MEASUREMENT_AT',
  'CONSECUTIVE_FAILURES',
  'LAST_ERROR_CODE',
  'NEXT_RETRY_AT'
];

function setup() {
  require_(['LLU_EMAIL', 'LLU_PASSWORD', 'BQ_PROJECT_ID', 'BQ_DATASET', 'BQ_TABLE']);
  if (!P.getProperty('LLU_API_BASE')) P.setProperty('LLU_API_BASE', 'https://api.libreview.io');
  if (!P.getProperty('LLU_VERSION')) P.setProperty('LLU_VERSION', '4.16.0');
  if (!P.getProperty('RUN_STATUS')) P.setProperty('RUN_STATUS', '未開始');
  return checkStatus();
}
function checkStatus() {
  const o = {};
  KEYS.forEach((k) => {
    if (!/PASSWORD|TOKEN|HASH/.test(k)) o[k] = P.getProperty(k) || null;
  });
  return o;
}
function runOnce() {
  const lock = LockService.getScriptLock();
  lock.waitLock(1000);
  try {
    setup();
    const data = fetchReadings_();
    const rows = data.map(normalize_);
    writeRows_(rows);
    P.setProperties({
      LAST_SUCCESS_AT: new Date().toISOString(),
      LAST_MEASUREMENT_AT: rows.reduce((m, r) => (r.measured_at > m ? r.measured_at : m), ''),
      CONSECUTIVE_FAILURES: '0',
      LAST_ERROR_CODE: ''
    });
    return { count: rows.length, lastMeasurement: P.getProperty('LAST_MEASUREMENT_AT') };
  } catch (e) {
    recordError_(e);
    throw e;
  } finally {
    lock.releaseLock();
  }
}
function startCollection() {
  if (P.getProperty('RUN_STATUS') === '稼働中') return checkStatus();
  runOnce();
  const now = new Date(),
    end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  P.setProperties({
    RUN_ID: Utilities.getUuid(),
    START_AT: now.toISOString(),
    END_AT: end.toISOString(),
    RUN_STATUS: '稼働中'
  });
  removeCollectorTriggers_();
  ScriptApp.newTrigger('collectScheduled').timeBased().everyMinutes(15).create();
  return checkStatus();
}
function collectScheduled() {
  const end = P.getProperty('END_AT');
  if (!end || P.getProperty('RUN_STATUS') !== '稼働中') return;
  if (new Date() >= new Date(end)) {
    try {
      runOnce();
      P.setProperty('RUN_STATUS', '停止');
    } catch (e) {
      P.setProperty('RUN_STATUS', '最終同期失敗');
    } finally {
      removeCollectorTriggers_();
    }
    return;
  }
  const retry = P.getProperty('NEXT_RETRY_AT');
  if (retry && new Date() < new Date(retry)) return;
  runOnce();
}
function stopCollection() {
  removeCollectorTriggers_();
  P.setProperty('RUN_STATUS', '停止');
  return checkStatus();
}
function fetchReadings_() {
  let token = P.getProperty('LLU_TOKEN');
  if (!token || Number(P.getProperty('LLU_TOKEN_EXPIRES_AT') || 0) <= Date.now() / 1000 + 60)
    token = login_();
  const h = {
    product: 'llu.android',
    version: P.getProperty('LLU_VERSION'),
    Authorization: 'Bearer ' + token,
    'Account-Id': P.getProperty('LLU_ACCOUNT_ID_HASH')
  };
  const base = P.getProperty('LLU_API_BASE');
  call_(base + '/llu/connections', h);
  const id = P.getProperty('LLU_PATIENT_ID');
  if (!id) throw Error('LLU_PATIENT_ID must be set after reviewing connections');
  const g = call_(base + '/llu/connections/' + encodeURIComponent(id) + '/graph', h);
  return [].concat(
    (g.data && g.data.graphData) || [],
    (g.data && g.data.connection && g.data.connection.glucoseMeasurement) || []
  );
}
function login_() {
  const base = P.getProperty('LLU_API_BASE');
  const r = call_(
    base + '/llu/auth/login',
    { product: 'llu.android', version: P.getProperty('LLU_VERSION') },
    { email: P.getProperty('LLU_EMAIL'), password: P.getProperty('LLU_PASSWORD') }
  );
  if (!r.data || !r.data.authTicket) throw Error('LibreLinkUp authentication requires action');
  const t = r.data.authTicket;
  P.setProperties({
    LLU_TOKEN: t.token,
    LLU_TOKEN_EXPIRES_AT: String(t.expires),
    LLU_ACCOUNT_ID_HASH: sha256_(r.data.user.id)
  });
  return t.token;
}
function call_(url, headers, body) {
  const o = {
    method: body ? 'post' : 'get',
    headers: headers,
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: body ? JSON.stringify(body) : undefined
  };
  const r = UrlFetchApp.fetch(url, o),
    code = r.getResponseCode(),
    text = r.getContentText();
  let j;
  try {
    j = JSON.parse(text);
  } catch (e) {
    throw Error('Invalid upstream response');
  }
  if (code === 429) {
    P.setProperty('NEXT_RETRY_AT', new Date(Date.now() + 15 * 60 * 1000).toISOString());
    throw Error('RATE_LIMITED');
  }
  if (code >= 400 || (j.status && j.status !== 0)) throw Error('UPSTREAM_' + code);
  return j;
}
function normalize_(x) {
  const t = x.Timestamp || x.FactoryTimestamp || x.timestamp;
  if (!t) throw Error('MEASUREMENT_TIME_MISSING');
  const d = new Date(t);
  if (isNaN(d)) throw Error('MEASUREMENT_TIME_INVALID');
  const v = x.ValueInMgPerDl ?? x.valueInMgPerDl;
  if (v == null) throw Error('GLUCOSE_MISSING');
  const measured = d.toISOString();
  return {
    run_id: P.getProperty('RUN_ID') || 'manual',
    patient_id: P.getProperty('LLU_PATIENT_ID'),
    measured_at: measured,
    glucose_mg_dl: Number(v),
    trend_arrow: x.TrendArrow ?? null,
    record_source: x.ValueInMgPerDl ? 'history' : 'latest',
    fetched_at: new Date().toISOString(),
    raw_measurement: JSON.stringify(x),
    observation_key: P.getProperty('LLU_PATIENT_ID') + '|' + measured
  };
}
function writeRows_(rows) {
  if (!rows.length) return;
  const req = { kind: 'json', rows: rows.map((r) => ({ insertId: r.observation_key, json: r })) };
  const out = BigQuery.Tabledata.insertAll(
    req,
    P.getProperty('BQ_PROJECT_ID'),
    P.getProperty('BQ_DATASET'),
    P.getProperty('BQ_TABLE')
  );
  if (out.insertErrors && out.insertErrors.length) throw Error('BIGQUERY_PARTIAL_FAILURE');
}
function removeCollectorTriggers_() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'collectScheduled')
    .forEach((t) => ScriptApp.deleteTrigger(t));
}
function recordError_(e) {
  const n = Number(P.getProperty('CONSECUTIVE_FAILURES') || 0) + 1;
  P.setProperties({
    CONSECUTIVE_FAILURES: String(n),
    LAST_ERROR_CODE: String(e.message).slice(0, 80)
  });
}
function require_(ks) {
  ks.forEach((k) => {
    if (!P.getProperty(k)) throw Error('Missing Script Property: ' + k);
  });
}
function sha256_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s)
    .map((b) => ('0' + (b & 255).toString(16)).slice(-2))
    .join('');
}
