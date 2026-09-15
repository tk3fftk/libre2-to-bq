# Intent Statement

## Problem Statement

個人のLibreLinkUp上のグルコース測定値を、14日間に限ってGoogle BigQueryへ収集し、後から分析できるようにする。 [Q1]

## Target Customer

利用者・管理者・保存対象はいずれも本人であり、本人の測定データだけを扱う。 [Q2]

## Success Metrics

- 公式アプリの表示と値・時刻を照合できる。 [Q3]
- BigQueryの重複排除済みビューで測定データを分析できる。 [Q3]
- 手動の取得とBigQuery保存が成功した後にのみ、明示操作で収集を開始できる。 [Q4]

## Initiative Trigger

本人の測定値を後から分析できる形で残す必要がある。 [Q1]

## Initial Scope Signal

- Workflow-selected: `libre2-gas-bigquery`。 [scope]
- Confirmed product boundary: 単独のGoogle Apps ScriptとBigQueryで、14日間の収集、保存、手動開始・停止、運用確認を行う。Cloud Run、GitHub Actions、自作iOSアプリは含めない。 [Q5] [Q8]
- 未確認の非公式API仕様は、OSSと公開資料を基に実装し、未確認点を設定、診断、手動照合として明示する。 [Q7]

## Assumptions & Open Questions

- 実行前に必要なBigQueryプロジェクト、データセット、ロケーションは未指定である。利用者がGASプロパティへ設定する。 [assumption]
- LibreLinkUpの共有設定、実データの応答形、日時規則、および実アカウントでの接続結果は未確認である。 [assumption]
- 利用者は設定値を直接GASプロパティへ入力し、会話へ秘密情報を提供しない。 [Q6]
