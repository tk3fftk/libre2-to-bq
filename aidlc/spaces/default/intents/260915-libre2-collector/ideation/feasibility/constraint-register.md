# Constraint Register

<!-- Reconfirmed from the current feasibility summary. -->

| Constraint | Impact | Mitigation | Source |
| --- | --- | --- | --- |
| 非公式APIで現行仕様が未保証 | 認証・地域・日時の変更で取得不能になりうる | 設定値化、許可済みホスト制限、モックと手動照合 | [Q2] |
| 秘密情報と健康データ | ログやrawデータからの漏えいを防ぐ必要 | Script Properties、ログの匿名化、認証情報をrawへ保存しない | [Q1] |
| GASの時間主導トリガー | 実行時刻は厳密でなく、同時実行も起こりうる | LockService、重複履歴、期限後の次回実行で停止 | [Q3] |
| BigQuery設定未指定 | 初回設定なしでは保存できない | 利用者がプロパティと権限を設定 | [assumption] |

## Assumptions & Open Questions

None.
