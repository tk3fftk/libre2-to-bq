# RAID Log

<!-- Reconfirmed from the current feasibility summary. -->

| Type | Item | Owner | Response |
| --- | --- | --- | --- |
| Risk | 非公式APIの認証・地域・日時仕様が変更される | 本人 | 実接続前に再確認し、未確認状態を表示する。 [Q2] |
| Assumption | BigQueryのプロジェクト、データセット、権限は利用者が用意する | 本人 | READMEのセットアップ手順で確認する。 [assumption] |
| Issue | 実アカウントのLibreLinkUp共有状態は未確認 | 本人 | 公式アプリで共有状態を確認してからrunOnceする。 [Q2] |
| Dependency | GASのBigQuery高度なサービスとGCP APIが有効であること | 本人 | setupで確認する。 [Q1] |

## Assumptions & Open Questions

None.
