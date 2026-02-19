import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SessionHistoryManager } from './SessionHistoryManager';

describe('SessionHistoryManager', () => {
  let tmpDir: string;
  let manager: SessionHistoryManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-test-'));
    manager = new SessionHistoryManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('セッションを作成して取得できる', () => {
    const session = manager.createSession('テストセッション');
    expect(session.title).toBe('テストセッション');
    expect(manager.getSessions()).toHaveLength(1);
  });

  test('メッセージを追加できる', () => {
    const session = manager.createSession();
    manager.addMessage(session.id, 'user', 'こんにちは');
    manager.addMessage(session.id, 'assistant', 'はい、こんにちは！');

    const loaded = manager.getSession(session.id);
    expect(loaded?.messages).toHaveLength(2);
    expect(loaded?.messages[0]!.content).toBe('こんにちは');
  });

  test('セッションを削除できる', () => {
    const s1 = manager.createSession('Session 1');
    const s2 = manager.createSession('Session 2');

    manager.deleteSession(s1.id);

    const sessions = manager.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe(s2.id);
  });

  // ===== バグ修正の核心テスト =====
  test('flushSync後に再起動しても履歴が復元される (修正の検証)', () => {
    // セッションを作成してメッセージを追加
    const session = manager.createSession('重要なセッション');
    manager.addMessage(session.id, 'user', '忘れないでね');
    manager.addMessage(session.id, 'assistant', '覚えました！');

    // アプリ終了をシミュレート（同期書き込み）
    manager.flushSync();

    // アプリ再起動をシミュレート（新しいインスタンスで読み込み）
    const restarted = new SessionHistoryManager(tmpDir);
    const sessions = restarted.getSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.title).toBe('重要なセッション');
    expect(sessions[0]!.messages).toHaveLength(2);
    expect(sessions[0]!.messages[1]!.content).toBe('覚えました！');
  });

  test('保存先ディレクトリが存在しなくても自動作成される', () => {
    const nestedDir = path.join(tmpDir, 'deep', 'nested', 'dir');
    const m = new SessionHistoryManager(nestedDir);
    m.createSession('ディレクトリ自動作成テスト');
    m.flushSync();

    expect(fs.existsSync(path.join(nestedDir, 'session-history.json'))).toBe(true);
  });

  test('ファイルが壊れていても空の状態で起動できる', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'session-history.json'),
      '{ broken json !!!',
      'utf-8'
    );

    const m = new SessionHistoryManager(tmpDir);
    expect(m.getSessions()).toHaveLength(0);
  });

  test('複数セッションがすべて保存・復元される', () => {
    for (let i = 0; i < 5; i++) {
      const s = manager.createSession(`Session ${i}`);
      manager.addMessage(s.id, 'user', `Message ${i}`);
    }
    manager.flushSync();

    const restarted = new SessionHistoryManager(tmpDir);
    expect(restarted.getSessions()).toHaveLength(5);
  });
});
