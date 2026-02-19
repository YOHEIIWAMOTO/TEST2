/**
 * デモスクリプト: セッション履歴の保存・復元を実際に確認する
 * 実行: npx ts-node src/demo.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SessionHistoryManager } from './session/SessionHistoryManager';

const demoDir = path.join(os.tmpdir(), 'desktop-session-demo');

console.log('=== デスクトップ版セッション履歴 デモ ===\n');
console.log(`保存先: ${demoDir}\n`);

// 初回: セッションを作成して保存
console.log('--- [Step 1] セッションを作成 ---');
const manager = new SessionHistoryManager(demoDir);
const session = manager.createSession('最初の会話');
manager.addMessage(session.id, 'user', 'こんにちは！');
manager.addMessage(session.id, 'assistant', 'こんにちは！何かお手伝いできますか？');

const session2 = manager.createSession('2回目の会話');
manager.addMessage(session2.id, 'user', 'TypeScriptを教えて');
manager.addMessage(session2.id, 'assistant', 'TypeScriptはJavaScriptに型を追加した言語です。');

console.log(`✓ セッション作成: "${session.title}"`);
console.log(`✓ セッション作成: "${session2.title}"`);

// 同期書き込み（アプリ終了をシミュレート）
manager.flushSync();
console.log('✓ ディスクに保存完了\n');

// ファイルの内容を確認
const savedContent = JSON.parse(fs.readFileSync(path.join(demoDir, 'session-history.json'), 'utf-8'));
console.log(`保存されたセッション数: ${savedContent.sessions.length}`);
console.log(`保存されたセッション: ${savedContent.sessions.map((s: { title: string }) => s.title).join(', ')}\n`);

// アプリ再起動をシミュレート
console.log('--- [Step 2] アプリ再起動後に履歴を読み込み ---');
const restarted = new SessionHistoryManager(demoDir);
const sessions = restarted.getSessions();

console.log(`✓ 復元されたセッション数: ${sessions.length}`);
sessions.forEach((s) => {
  console.log(`  - "${s.title}" (メッセージ数: ${s.messages.length})`);
  s.messages.forEach((m) => {
    console.log(`      [${m.role}] ${m.content}`);
  });
});

// クリーンアップ
fs.rmSync(demoDir, { recursive: true, force: true });
console.log('\n✓ デモ完了 (一時ファイルを削除しました)');
