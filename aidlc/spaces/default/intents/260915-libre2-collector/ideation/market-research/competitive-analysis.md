# Competitive Analysis

## Alternatives

| Alternative | Strength | Limitation for this project | Decision |
| --- | --- | --- | --- |
| Nightscout LibreLinkUp uploader | LibreLinkUpからの取得とNightscout連携の既存実装があり、Libre 2を対象としている。 | Nightscoutを運用する前提であり、BigQueryで個人分析する目的を直接満たさない。 | 参照実装として利用し、採用しない。 [Q1] |
| 手動エクスポート | 外部APIを呼ばずに済む。 | 15分間隔の履歴収集と14日間の自動停止を満たさない。 | 採用しない。 [Q1] [Q2] |
| GAS＋BigQuery | Googleアカウントの権限で実行し、保存済みデータをBigQueryで分析できる。 | LibreLinkUpは非公式APIであり、実データによる確認が必要である。 | 採用する。 [Q1] [Q3] |

## Sources

- [Nightscout LibreLinkUp Uploader](https://github.com/timoschlueter/nightscout-librelink-up)
- [Apps Script BigQuery Service](https://developers.google.com/apps-script/advanced/bigquery)
- [Intent Statement](../../intent-capture/intent-statement.md)

## Assumptions & Open Questions

- LibreLinkUpの現行認証・地域・応答仕様は実アカウントで未確認である。 [assumption]
