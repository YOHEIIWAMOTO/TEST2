# デスクトップ版セッション履歴 修正

## 問題

デスクトップ版でセッション履歴がアプリ再起動後に消えてしまう問題。

**根本原因:** 履歴の書き込みが非同期（`fs.writeFile`）のみで実装されていたため、
アプリ終了時に非同期コールバックが完了する前にプロセスが終了し、データが失われていた。

## 修正内容

### `src/session/SessionHistoryManager.ts`

| 修正点 | 内容 |
|--------|------|
| `flushSync()` の追加 | プロセス終了時（`exit` / `SIGINT` / `SIGTERM`）に **同期書き込み** で確実に保存 |
| アトミックな書き込み | `.tmp` ファイル経由で `rename` することで書き込み中断時のファイル破損を防止 |
| ディレクトリ自動作成 | 保存先ディレクトリが存在しない場合に自動で作成 |
| デバウンス処理 | `setImmediate` で頻繁な I/O を抑制 |

## セットアップ

```bash
npm install
```

## テスト実行

```bash
npm test
```

## デモ実行

```bash
npx ts-node src/demo.ts
```

## ファイル構成

```
src/
├── session/
│   ├── SessionHistoryManager.ts       # セッション履歴管理クラス（修正済み）
│   └── SessionHistoryManager.test.ts  # テストコード
└── demo.ts                            # 動作確認デモ
```
