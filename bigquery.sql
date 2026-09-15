CREATE TABLE IF NOT EXISTS `PROJECT.DATASET.measurements` (
  run_id STRING, patient_id STRING, measured_at TIMESTAMP, glucose_mg_dl FLOAT64,
  trend_arrow INT64, record_source STRING, fetched_at TIMESTAMP, raw_measurement JSON,
  observation_key STRING
);

CREATE OR REPLACE VIEW `PROJECT.DATASET.measurements_dedup` AS
SELECT * EXCEPT(row_number) FROM (
  SELECT m.*, ROW_NUMBER() OVER (PARTITION BY observation_key ORDER BY fetched_at DESC) row_number
  FROM `PROJECT.DATASET.measurements` m
) WHERE row_number=1;
