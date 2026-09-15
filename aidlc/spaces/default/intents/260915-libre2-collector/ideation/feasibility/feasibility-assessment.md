# Feasibility Assessment

<!-- Reconfirmed from the current feasibility summary. -->

## Assessment

技術的には実装可能だが、LibreLinkUpが非公式APIであるため、実アカウント接続、地域切替、レスポンス形状、日時解釈を手動照合する必要がある。[Q2]

GASのScript Properties、LockService、UrlFetchApp、BigQuery高度なサービス、時間主導トリガーで、認証状態の保持、重複取得、15分実行、14日後停止を構成できる。[Q1][Q3]

## Assumptions & Open Questions

- BigQueryプロジェクトとデータセット権限は利用者の環境で確認する。[assumption]
- API利用規約と実応答は実接続前に確認する。[Q2]
