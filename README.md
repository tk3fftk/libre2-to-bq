# Libre 2 → GAS → BigQuery

`Code.gs` はLibreLinkUpの非公式APIから履歴を取得し、BigQueryへ追記します。

1. Apps ScriptでBigQuery高度なサービスとGCP側APIを有効化する。
2. Script Propertiesへ `LLU_EMAIL`、`LLU_PASSWORD`、`BQ_PROJECT_ID`、`BQ_DATASET`、`BQ_TABLE` を設定する。秘密情報をチャットやソースへ貼らない。
3. `setup`、`runOnce` の順に実行し、公式アプリの値・時刻と照合する。複数接続がある場合は `LLU_PATIENT_ID` を明示設定する。
4. 確認後に `startCollection` を実行する。15分間隔で収集し、初回開始から14日後の次回実行で最終同期後に自動停止する。

`bigquery.sql` の `PROJECT` と `DATASET` を置換してテーブルと重複排除ビューを作成してください。API応答、日時規則、地域リダイレクトは未保証のため、未確認の接続成功を前提にしません。

## claspでデプロイ

1. `npm install` と `npm run lint` を実行する。
2. Apps Scriptプロジェクトを作成し、`.clasp.json` の `scriptId` を実際のIDへ置換する（または `clasp create --type standalone` を実行する）。
3. `clasp login` 後、`clasp push` でコードを反映し、Apps ScriptエディタでBigQuery高度なサービスを承認する。

`.claspignore` により、ローカルテスト・AI-DLC記録・SQL・READMEはGASへ送信しません。
