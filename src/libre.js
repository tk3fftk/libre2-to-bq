import { createHash } from 'node:crypto';
import { fail } from './errors.js';

export async function connect(config, fetchImpl = fetch) {
  const headers = { product: 'llu.android', version: config.version };
  async function call(path, body) {
    let response;
    try {
      response = await fetchImpl(config.base + path, {
        method: body ? 'POST' : 'GET',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
        redirect: 'error'
      });
    } catch (error) {
      fail(
        ['TimeoutError', 'AbortError'].includes(error.name)
          ? 'UPSTREAM_TIMEOUT'
          : 'UPSTREAM_NETWORK'
      );
    }
    if (response.status === 429) fail('RATE_LIMITED');
    if (!response.ok) fail(`UPSTREAM_HTTP_${response.status}`);
    let result;
    try {
      result = await response.json();
    } catch (error) {
      fail(
        ['TimeoutError', 'AbortError'].includes(error.name)
          ? 'UPSTREAM_TIMEOUT'
          : 'UPSTREAM_INVALID_RESPONSE'
      );
    }
    if (!result || typeof result !== 'object') fail('UPSTREAM_INVALID_RESPONSE');
    if (result.status != null && result.status !== 0) {
      if (path === '/llu/auth/login' && result.status === 4) fail('LLU_AUTH_ACTION_REQUIRED');
      const stage =
        path === '/llu/auth/login'
          ? 'LOGIN'
          : path === '/llu/connections'
            ? 'CONNECTIONS'
            : 'GRAPH';
      const status = Number.isSafeInteger(result.status) ? result.status : 'UNKNOWN';
      fail(`UPSTREAM_REJECTED_${stage}_STATUS_${status}`);
    }
    return result;
  }

  const login = await call('/llu/auth/login', { email: config.email, password: config.password });
  if (login.data?.redirect === true) {
    const region = login.data.region;
    const regions = ['us', 'eu', 'eu2', 'de', 'fr', 'jp', 'ap', 'au', 'ae', 'ca'];
    fail(
      regions.includes(region)
        ? `LLU_REGION_REDIRECT_${region.toUpperCase()}`
        : 'LLU_REGION_REDIRECT'
    );
  }
  if (!login.data?.authTicket?.token || !login.data?.user?.id) fail('LLU_AUTH_ACTION_REQUIRED');
  headers.Authorization = `Bearer ${login.data.authTicket.token}`;
  headers['Account-Id'] = createHash('sha256').update(login.data.user.id).digest('hex');
  return {
    async connections() {
      const result = await call('/llu/connections');
      if (!Array.isArray(result.data)) fail('UPSTREAM_INVALID_RESPONSE');
      return result.data.map(({ patientId, firstName, lastName }) => ({
        patientId,
        name: [firstName, lastName].filter(Boolean).join(' ')
      }));
    },
    async readings() {
      const result = await call(`/llu/connections/${encodeURIComponent(config.patientId)}/graph`);
      const history = result.data?.graphData;
      const latest = result.data?.connection?.glucoseMeasurement;
      if (!Array.isArray(history)) fail('UPSTREAM_INVALID_RESPONSE');
      return [
        ...history.map((measurement) => ({ measurement, source: 'history' })),
        ...(latest ? [{ measurement: latest, source: 'latest' }] : [])
      ];
    }
  };
}
