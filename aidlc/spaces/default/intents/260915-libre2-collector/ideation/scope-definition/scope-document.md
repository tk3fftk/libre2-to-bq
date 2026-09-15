# Scope Document

<!-- Reconfirmed from the current scope summary. -->

## In Scope

- 本人のLibreLinkUp測定値をGASから取得する。[Q1]
- BigQueryへ保存し、重複排除済みビューを提供する。[Q1]
- 初回成功後に15分間隔で14日間収集し、期限後に収集トリガーを停止する。[Q1]
- 状態確認、手動停止、未確認API仕様の診断を提供する。[Q1]

## Out of Scope

- Cloud Run、GitHub Actions、自作iOSアプリ。[Q2]
- 複数利用者向け提供と14日を超える継続運用。[Q2]

## Delivery Order

1. 1回取得と値・日時照合。[Q3]
2. BigQuery保存と重複排除。[Q3]
3. 定期実行、開始・停止、状態確認。[Q3]

## Assumptions & Open Questions

None.
