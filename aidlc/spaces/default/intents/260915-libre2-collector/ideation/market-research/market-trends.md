# Market Trends

## Relevant Signals

- Apps ScriptのBigQuery高度なサービスは、BigQuery APIの機能をApps Scriptから利用するため、利用前にサービスと対応APIの有効化が必要である。 [Google Apps Script BigQuery Service](https://developers.google.com/apps-script/advanced/bigquery)
- Apps Scriptでは時間主導のインストール型トリガーを作成でき、`everyMinutes(n)` が提供されている。実行時刻の厳密性は別途扱う必要がある。 [Google Apps Script Trigger Reference](https://developers.google.com/apps-script/reference/script/clock-trigger-builder)
- LibreLinkUpの既存OSSは、地域、アプリバージョン、共有対象IDを設定値として扱っている。これは非公式連携であり、固定仕様の根拠にはしない。 [Nightscout LibreLinkUp Uploader](https://github.com/timoschlueter/nightscout-librelink-up)

## Implications

- 保存先・APIバージョン・接続先をソースへ固定せず、GASプロパティで設定可能にする。 [Q3]
- 実アカウント確認前は、モック検証と手動照合手順を提供し、接続済みとは表現しない。 [Q1] [Q3]

## Assumptions & Open Questions

- 日本版LibreLinkUpの現行レスポンスと日時解釈は未検証である。 [assumption]
