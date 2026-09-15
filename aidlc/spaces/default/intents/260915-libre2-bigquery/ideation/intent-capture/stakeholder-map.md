# Stakeholder Map

| Stakeholder | Interest | Authority | Communication requirement | Source |
| --- | --- | --- | --- | --- |
| 本人（利用者・管理者・データ対象者） | 14日間の測定データを保存・分析する | 実装範囲と収集開始を決定する | 設定、手動照合、開始・停止の手順をREADMEで確認する | [Q1] [Q2] [Q4] [Q6] [Q8] |
| LibreLinkUp／Abbott | 非公式の外部データ提供元であり、応答・認証・地域仕様が変更されうる | Unknown (open question) [assumption] | 未確認の応答や認証状態では安全に停止し、手動照合を促す | [Q7] |
| Google Apps Script／BigQuery | 実行と保存の基盤 | Unknown (open question) [assumption] | プロパティ、API有効化、権限、保存先を利用者が設定する | [Q5] [Q6] |

## Assumptions & Open Questions

- 本人以外に、承認、監視、通知を担当する関係者はいない。 [assumption]
- 定期的な報告やメール通知は必要ない。 [assumption]
- 外部サービスの仕様変更・利用規約上の制約は、実接続前に改めて確認する。 [Q7]
