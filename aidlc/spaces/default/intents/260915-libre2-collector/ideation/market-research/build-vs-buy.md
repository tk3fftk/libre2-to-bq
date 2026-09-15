# Build vs Buy Assessment

## Decision

個人の14日間限定の分析用途では、GAS＋BigQueryを実装する。本人のGoogle環境で秘密情報を管理し、BigQueryへ保存した測定値を分析できることを優先する。 [Q1] [Q2] [Q3]

## Rationale

- 既存Nightscout系OSSはLibreLinkUp取得の参考になるが、BigQueryへ蓄積して個人分析する目的には追加構成が必要である。 [Q1]
- 手動エクスポートは定期取得と自動停止の対象範囲に合わない。 [Q1] [Q2]
- GASのBigQuery高度なサービスと時間主導トリガーにより、予定する実行・保存構成を実現できる見込みがある。 [Google Apps Script BigQuery Service](https://developers.google.com/apps-script/advanced/bigquery) [Google Apps Script Installable Triggers](https://developers.google.com/apps-script/guides/triggers/installable)

## Guardrails

- LibreLinkUpの非公式API仕様が確認できない場合は、認証情報を任意のリダイレクト先へ送信せず、設定と診断で止める。 [assumption]
- Cloud Run、GitHub Actions、自作iOSアプリは対象外とする。 [Intent Statement](../../intent-capture/intent-statement.md)

## Assumptions & Open Questions

- BigQueryの料金、保存先、ロケーションは利用者のGoogle環境で確認する。 [assumption]
