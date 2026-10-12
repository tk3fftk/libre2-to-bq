import { fail } from './errors.js';

// LibreLinkUp's offset-free wall clock timestamps use the configured Japan convention.
export function measurementTime(value) {
  if (!value) fail('MEASUREMENT_TIME_MISSING');
  if (typeof value !== 'string') fail('MEASUREMENT_TIME_INVALID');
  const iso =
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/i.exec(
      value
    );
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/i.exec(
    value
  );
  let year,
    month,
    day,
    hour,
    minute,
    second,
    fraction = '',
    offset = '+09:00';
  if (iso) {
    [, year, month, day, hour, minute, second] = iso;
    fraction = iso[7] || '';
    offset = iso[8] || offset;
  } else if (local) {
    [, month, day, year, hour, minute, second] = local;
    if (+hour < 1 || +hour > 12) fail('MEASUREMENT_TIME_INVALID');
    hour = String((+hour % 12) + (local[7].toUpperCase() === 'PM' ? 12 : 0));
  } else {
    fail('MEASUREMENT_TIME_INVALID');
  }
  const days = new Date(Date.UTC(+year, +month, 0)).getUTCDate();
  if (
    +year < 1000 ||
    +month < 1 ||
    +month > 12 ||
    +day < 1 ||
    +day > days ||
    +hour > 23 ||
    +minute > 59 ||
    +second > 59
  ) {
    fail('MEASUREMENT_TIME_INVALID');
  }
  const pad = (part) => String(part).padStart(2, '0');
  const date = new Date(
    `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}${fraction}${offset}`
  );
  if (Number.isNaN(date.getTime())) fail('MEASUREMENT_TIME_INVALID');
  return date.toISOString();
}

export function normalize({ measurement: x, source }, { patientId, runId, fetchedAt }) {
  const measuredAt = measurementTime(x.Timestamp || x.FactoryTimestamp || x.timestamp);
  const value = x.ValueInMgPerDl ?? x.valueInMgPerDl;
  if (value == null) fail('GLUCOSE_MISSING');
  if (
    !['number', 'string'].includes(typeof value) ||
    (typeof value === 'string' && !value.trim()) ||
    !Number.isFinite(Number(value))
  ) {
    fail('GLUCOSE_INVALID');
  }
  return {
    run_id: runId,
    patient_id: patientId,
    measured_at: measuredAt,
    glucose_mg_dl: Number(value),
    trend_arrow: x.TrendArrow ?? null,
    record_source: source,
    fetched_at: fetchedAt,
    raw_measurement: JSON.stringify(x),
    observation_key: `${patientId}|${measuredAt}`
  };
}
