import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SessionEntry {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

interface SessionHistory {
  version: number;
  sessions: SessionEntry[];
}

const HISTORY_VERSION = 1;
const HISTORY_FILE_NAME = 'session-history.json';

export class SessionHistoryManager {
  private historyFilePath: string;
  private history: SessionHistory;
  private pendingSave = false;

  constructor(dataDir?: string) {
    const dir = dataDir ?? SessionHistoryManager.defaultDataDir();
    this.historyFilePath = path.join(dir, HISTORY_FILE_NAME);
    this.history = this.loadFromDisk();

    // --- 修正: プロセス終了時に同期書き込みで確実に保存 ---
    process.on('exit', () => this.flushSync());
    process.on('SIGINT', () => { this.flushSync(); process.exit(0); });
    process.on('SIGTERM', () => { this.flushSync(); process.exit(0); });
  }

  static defaultDataDir(): string {
    switch (process.platform) {
      case 'win32':
        return path.join(process.env['APPDATA'] ?? os.homedir(), 'DesktopApp', 'sessions');
      case 'darwin':
        return path.join(os.homedir(), 'Library', 'Application Support', 'DesktopApp', 'sessions');
      default:
        return path.join(os.homedir(), '.config', 'desktop-app', 'sessions');
    }
  }

  // ---- 読み込み ----

  private loadFromDisk(): SessionHistory {
    try {
      if (fs.existsSync(this.historyFilePath)) {
        const raw = fs.readFileSync(this.historyFilePath, 'utf-8');
        const parsed = JSON.parse(raw) as SessionHistory;
        if (typeof parsed.version === 'number' && Array.isArray(parsed.sessions)) {
          return parsed;
        }
      }
    } catch {
      // 破損ファイルは無視して空で初期化
    }
    return { version: HISTORY_VERSION, sessions: [] };
  }

  // ---- 取得 ----

  getSessions(): SessionEntry[] {
    return [...this.history.sessions];
  }

  getSession(id: string): SessionEntry | undefined {
    return this.history.sessions.find((s) => s.id === id);
  }

  // ---- 更新 ----

  createSession(title?: string): SessionEntry {
    const now = new Date().toISOString();
    const entry: SessionEntry = {
      id: uuidv4(),
      title: title ?? `Session ${this.history.sessions.length + 1}`,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    this.history.sessions.unshift(entry);
    this.scheduleSave();
    return entry;
  }

  addMessage(sessionId: string, role: Message['role'], content: string): void {
    const session = this.history.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.messages.push({ role, content, timestamp: new Date().toISOString() });
    session.updatedAt = new Date().toISOString();
    this.scheduleSave();
  }

  deleteSession(sessionId: string): void {
    this.history.sessions = this.history.sessions.filter((s) => s.id !== sessionId);
    this.scheduleSave();
  }

  // ---- 書き込み ----

  private ensureDir(): void {
    const dir = path.dirname(this.historyFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  private scheduleSave(): void {
    if (this.pendingSave) return;
    this.pendingSave = true;
    // 非同期で書き込む（通常時はこちらを使用）
    setImmediate(() => {
      this.pendingSave = false;
      this.flush();
    });
  }

  /** 非同期書き込み（通常時）*/
  flush(): void {
    try {
      this.ensureDir();
      const tmp = this.historyFilePath + '.tmp';
      fs.writeFile(tmp, JSON.stringify(this.history, null, 2), 'utf-8', (err) => {
        if (err) { console.error('[History] write error:', err); return; }
        fs.rename(tmp, this.historyFilePath, (e) => {
          if (e) console.error('[History] rename error:', e);
        });
      });
    } catch (err) {
      console.error('[History] flush error:', err);
    }
  }

  /**
   * 同期書き込み — プロセス終了時に呼び出す。
   * これがないと非同期コールバックが完了する前にプロセスが終了し
   * セッション履歴が失われる（バグの根本原因）。
   */
  flushSync(): void {
    try {
      this.ensureDir();
      const tmp = this.historyFilePath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.history, null, 2), 'utf-8');
      fs.renameSync(tmp, this.historyFilePath);
    } catch (err) {
      console.error('[History] flushSync error:', err);
    }
  }
}
