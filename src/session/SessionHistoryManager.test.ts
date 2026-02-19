import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SessionHistoryManager, SessionEntry } from './SessionHistoryManager';

describe('SessionHistoryManager', () => {
  let tmpDir: string;
  let manager: SessionHistoryManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-history-test-'));
    manager = new SessionHistoryManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const makeEntry = (id: string): SessionEntry => ({
    id,
    title: `Session ${id}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        role: 'user',
        content: 'Hello',
        timestamp: new Date().toISOString(),
      },
      {
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date().toISOString(),
      },
    ],
  });

  it('セッションを追加して取得できる', () => {
    const entry = makeEntry('session-1');
    manager.upsertSession(entry);

    const sessions = manager.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe('session-1');
  });

  it('同じIDのセッションを更新できる', () => {
    const entry = makeEntry('session-1');
    manager.upsertSession(entry);

    const updated = { ...entry, title: 'Updated Title' };
    manager.upsertSession(updated);

    const sessions = manager.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.title).toBe('Updated Title');
  });

  it('セッションを削除できる', () => {
    manager.upsertSession(makeEntry('session-1'));
    manager.upsertSession(makeEntry('session-2'));

    manager.deleteSession('session-1');

    const sessions = manager.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe('session-2');
  });

  it('flushSync後にファイルに正しく保存される (バグ修正の核心)', () => {
    manager.upsertSession(makeEntry('session-1'));
    manager.upsertSession(makeEntry('session-2'));

    // アプリ終了をシミュレート
    manager.flushSync();

    // 新しいインスタンスでファイルをロード
    const manager2 = new SessionHistoryManager(tmpDir);
    const sessions = manager2.getSessions();

    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.id)).toContain('session-1');
    expect(sessions.map((s) => s.id)).toContain('session-2');
  });

  it('ディレクトリが存在しなくても自動作成される', () => {
    const nestedDir = path.join(tmpDir, 'deeply', 'nested', 'dir');
    const m = new SessionHistoryManager(nestedDir);
    m.upsertSession(makeEntry('session-x'));
    m.flushSync();

    expect(fs.existsSync(path.join(nestedDir, 'session-history.json'))).toBe(true);
  });

  it('壊れたJSONファイルがあっても空の履歴で初期化される', () => {
    const corruptPath = path.join(tmpDir, 'session-history.json');
    fs.writeFileSync(corruptPath, '{ this is not valid json }', 'utf-8');

    const m = new SessionHistoryManager(tmpDir);
    expect(m.getSessions()).toHaveLength(0);
  });
});
