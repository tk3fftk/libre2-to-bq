## Q1. データ保護

健康データと認証情報の保護について、今回の対象範囲を確認します。

- A. 個人利用として、秘密情報はGASプロパティだけに保存し、ログ・ソース・BigQueryのrawデータへ認証情報を入れない
- B. 追加の外部秘密管理サービスを使う
- C. Not yet defined
- D. Not applicable
- E. Other constraint
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- 非公式APIの実アカウント接続・地域・日時仕様は未確認として扱う。
- 認証情報はGASプロパティだけに保存し、ログ・rawデータへ出さない。
- 初回成功後に15分間隔で収集し、14日後に当該トリガーだけを停止する。

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct

## Q2. 実接続の前提

日本版LibreLinkUpの実応答や日時規則が未確認の間は、どのように進めますか？

- A. モック検証と手動照合手順を先に完成させ、実接続は設定後に明示的に確認する
- B. 実接続ができるまで実装を保留する
- C. Not yet defined
- D. Not applicable
- E. Other constraint
- X. Other (please specify)

[Answer]: A

## Q3. 運用上限

収集期間と自動化の上限を確認します。

- A. 手動の初回成功後に開始し、15分間隔、14日後に当該トリガーだけを停止する
- B. 継続収集する
- C. 手動実行だけにする
- D. Not yet defined
- E. Not applicable
- X. Other (please specify)

[Answer]: A
