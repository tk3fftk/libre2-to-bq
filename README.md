# Libre 2 → Node.js → BigQuery

LibreLinkUpの非公式APIから履歴・最新値を取得し、BigQueryまたはローカルJSONへ保存する単発実行CLIです。
Node.js 22.15以上を使用します。実行ごとにログインし、取得・保存後に終了します。
定期実行・14日間の管理・永続的な実行状態はありません。

## 初期設定

```powershell
npm install
Copy-Item .env.template .env
```

`.env`にLibreLinkUpのメール・パスワードと保存先を設定します。秘密情報をソースやチャットへ貼らないでください。
`.env`はGit対象外で、`.env.template`だけをコミットします。
OS環境変数が優先され、環境変数ですべて設定すれば`.env`なしでも実行できます。

| 変数                                        | 用途                            |
| ------------------------------------------- | ------------------------------- |
| `LLU_EMAIL` / `LLU_PASSWORD`                | 認証。両コマンドで必須          |
| `LLU_PATIENT_ID`                            | 対象患者ID。collectで必須       |
| `LLU_API_BASE`                              | 既定 `https://api.libreview.io` |
| `LLU_VERSION`                               | 既定 `4.16.0`                   |
| `BQ_PROJECT_ID` / `BQ_DATASET` / `BQ_TABLE` | BigQuery保存先。dump時は不要    |

### Google Cloud認証

ローカルdumpだけを利用する場合、この認証とBigQueryの初期設定は不要です。

Google Cloud CLIをインストールし、BigQuery APIを有効にしてADCを設定します。

```powershell
gcloud auth application-default login
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

公式BigQueryクライアントがADCを読み込みます。Googleの鍵・トークンを`.env`に書く必要はありません。
この手順のADCを使う場合、`GOOGLE_APPLICATION_CREDENTIALS`は設定しないでください。
ユーザーには保存先への`bigquery.tables.updateData`権限が必要です。
一般的には対象データセットに`roles/bigquery.dataEditor`を付与します。
クォータプロジェクトには`serviceusage.services.use`（`roles/serviceusage.serviceUsageConsumer`）が必要です。
テーブル・ビューの作成や確認クエリには別途対応する権限が必要です。

[ADCの公式手順](https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment)

新規環境では`bigquery.sql`の`PROJECT`・`DATASET`を置換してテーブル・重複排除ビューを作成してください。
`.env.template`の`BQ_TABLE=measurements`はSQLのテーブル名に対応しています。
CLIはテーブルを自動作成しません。既存テーブル・過去データも継続利用できます。

## 実行

```powershell
npm run connections
```

患者IDと名前だけを表示します。BigQuery設定・ADCは不要です。
対象IDを`.env`の`LLU_PATIENT_ID`に明示設定してください。接続数によらず自動選択は行いません。

```powershell
npm run collect
```

成功時は保存件数`count`と最新測定日時`lastMeasurement`（UTC）をJSONで表示します。
0件は`count: 0`・`lastMeasurement: null`で正常終了します。
`run_id`は実行ごとのUUIDです。認証トークンはメモリだけに保持します。
健康データはBigQueryへ保存しますが、通常ログには測定値・API応答全文を出しません。

### ローカルJSONへ保存

```powershell
npm run collect -- --dump ./dumps/readings.json
```

BigQueryへ送信せず、正規化済みの測定行をUTF-8・インデント付きJSON配列で保存します。
各行はBigQueryと同じ全列を含み、`raw_measurement`は元の測定データをJSON文字列にしたものです。
Libre認証と`LLU_PATIENT_ID`だけが必要で、BigQuery設定・ADCは不要です。
0件でも空配列`[]`を保存します。成功時のJSONには保存先の絶対パス`outputPath`も含まれます。

親ディレクトリを自動作成し、既存ファイルには上書きしません（`DUMP_FILE_EXISTS`）。
再実行時は別のファイル名を指定してください。
書き込み失敗は`DUMP_WRITE_FAILED`で終了コード1を返し、その実行で作成した不完全なファイルを削除します。
削除も失敗した場合は`DUMP_CLEANUP_FAILED`を返します。
`dumps/`はGit対象外です。任意の保存先を指定できますが、その場合は必要に応じてGit対象外にしてください。
dumpに含まれる測定データは通常ログには出しません。

`--dump`はcollect専用です。パス省略・重複指定・不明なオプションは通信前にエラーになります。

通信タイムアウトは30秒。失敗時はエラーコードを表示し、終了コード1を返します。
429では時間をおいて手動で再実行してください。自動待機・定期再試行はありません。
`BIGQUERY_PARTIAL_FAILURE`では一部の行が保存されている可能性があります。
挿入IDによる重複排除はベストエフォートのため、重複を除いた参照には`measurements_dedup`ビューを使用します。

日時はオフセット付き・なしのISO形式と`M/D/YYYY h:mm:ss AM/PM`形式を受け付けます。
オフセットなしの日時は`Asia/Tokyo`としてUTCへ変換します。初回は公式アプリの値・時刻と照合してください。
非公式APIの応答・地域リダイレクトは未保証です。地域切替は自動追従しません。
必要なら対象地域のHTTPS APIベースを設定してください。

## LibreView CSVの取り込み

過去の期間を取り込む場合は、LibreViewからダウンロードした日本語・mg/dL形式のCSVを使用します。
LibreLinkUpのgraph APIは直近約12時間の履歴を対象とし、過去2週間の一括取得には対応しません。

```powershell
node --env-file-if-exists=.env src/cli.js import-csv ./YOUR_glucose_2026-10-12.csv --dump ./dumps/libreview.json
```

`.env`の`LLU_PATIENT_ID`を対象者のIDに設定してください。Libre認証・ADCは不要です。
過去のグルコース値（記録タイプ0）とスキャン値（タイプ1）を取り込み、メモなどはスキップします。
CSVのオフセットなしの時刻は日本時間としてUTCへ変換します。
成功時は件数・最初と最後の測定日時・スキップ件数・出力先を表示します。
`record_source`は`libreview_history`または`libreview_scan`、`raw_measurement`は元のCSV行です。
同時刻の履歴とスキャンも保持します。BigQueryでの重複排除キーは従来どおり患者IDと日時です。

BigQuery設定とADCを設定したうえで`--dump`を省略すると、既存テーブルへ保存します。
元のCSVは変更しません。`*_glucose_*.csv`はGit対象外です。

## 接続エラーの確認

- `LLU_AUTH_ACTION_REQUIRED`: LibreLinkUpアプリに同じアカウントでログインし、利用規約やプライバシーポリシーなどの案内を確認してください。
- `LLU_REGION_REDIRECT_JP`など: 表示された地域のURLを`.env`の`LLU_API_BASE`へ設定して再実行してください。自動でログイン先を切り替えることはありません。
- `UPSTREAM_REJECTED_LOGIN_STATUS_<番号>`: ログイン時の拒否です。LibreLinkUpアプリで同じメール・パスワードが使えることを確認してください。
- `UPSTREAM_REJECTED_CONNECTIONS_STATUS_<番号>` / `UPSTREAM_REJECTED_GRAPH_STATUS_<番号>`: ログイン後の取得が拒否されています。

応答本文・トークン・認証情報はログに出さず、処理段階と数値ステータスだけで原因を切り分けます。

## GASからの切替

1. 旧Apps Scriptで`stopCollection`を実行するか、`collectScheduled`トリガーを削除する。
2. `.env`とADCを設定し、患者ID・保存先を確認する。
3. `npm run collect`で既存テーブルへの保存と公式アプリとの値・時刻の一致を確認する。

旧デプロイ済みGASはrepoの変更だけでは停止しません。Script Properties・トークン・実行状態の移行は不要です。
AI-DLCの既存記録は過去の設計記録として保持します。

## 開発・検証

```powershell
npm run check
```

ESLint・Prettier・`node:test`を実行します。モックテストに認証情報や外部サービス接続は不要です。
