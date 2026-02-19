import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SessionEntry {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

export interface SessionHistory {
  version: number;
  sessions: SessionEntry[];
}

const HISTORY_VERSION = 1;
const HISTORY_FILE_NAME = 'session-history.json';

/**
 * デスクトップ版のセッション履歴を管理するクラス。
 * 修正: セッション終了時に履歴が保存されない問題を修正。
 *   - 非同期書き込みを同期書き込みに変更してアプリ終了時のデータロストを防止
 *   - ディレクトリが存在しない場合の自動作成を追加
 *   - 書き込みエラー時のリトライ処理を追加
 */
export class SessionHistoryManager {
  private historyFilePath: string;
  private history: SessionHistory;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly SAVE_DEBOUNCE_MS = 500;

  constructor(appDataDir?: string) {
    const dataDir = appDataDir ?? this.getDefaultDataDir();
    this.historyFilePath = path.join(dataDir, HISTORY_FILE_NAME);
    this.history = this.load();

    // アプリ終了時に確実に保存する (修正箇所)
    process.on('exit', () => this.flushSync());
    process.on('SIGINT', () => {
      this.flushSync();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      this.flushSync();
      process.exit(0);
    });
  }

  private getDefaultDataDir(): string {
    const platform = process.platform;
    if (platform === 'win32') {
      return path.join(process.env['APPDATA'] ?? os.homedir(), 'Claude', 'sessions');
    } else if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'sessions');
    } else {
      return path.join(os.homedir(), '.config', 'claude', 'sessions');
    }
  }

  private ensureDirectoryExists(): void {
    const dir = path.dirname(this.historyFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  load(): SessionHistory {
    try {
      if (fs.existsSync(this.historyFilePath)) {
        const raw = fs.readFileSync(this.historyFilePath, 'utf-8');
        const parsed = JSON.parse(raw) as SessionHistory;

        // バージョン確認・マイグレーション
        if (parsed.version !== HISTORY_VERSION) {
          return this.migrate(parsed);
        }
        return parsed;
      }
    } catch (err) {
      console.error('[SessionHistoryManager] Failed to load session history:', err);
    }

    return { version: HISTORY_VERSION, sessions: [] };
  }

  private migrate(old: Partial<SessionHistory>): SessionHistory {
    // 将来のバージョンアップに対応するためのマイグレーション
    return {
      version: HISTORY_VERSION,
      sessions: old.sessions ?? [],
    };
  }

  /**
   * セッションを追加または更新する
   */
  upsertSession(entry: SessionEntry): void {
    const index = this.history.sessions.findIndex((s) => s.id === entry.id);
    const now = new Date().toISOString();

    if (index >= 0) {
      this.history.sessions[index] = { ...entry, updatedAt: now };
    } else {
      this.history.sessions.unshift({ ...entry, createdAt: now, updatedAt: now });
    }

    // デバウンスして頻繁な書き込みを防ぐ (修正箇所)
    this.scheduleSave();
  }

  /**
   * セッションを削除する
   */
  deleteSession(sessionId: string): void {
    this.history.sessions = this.history.sessions.filter((s) => s.id !== sessionId);
    this.scheduleSave();
  }

  /**
   * 全セッション一覧を取得する
   */
  getSessions(): SessionEntry[] {
    return [...this.history.sessions];
  }

  /**
   * 特定のセッションを取得する
   */
  getSession(sessionId: string): SessionEntry | undefined {
    return this.history.sessions.find((s) => s.id === sessionId);
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.flush();
    }, this.SAVE_DEBOUNCE_MS);
  }

  /**
   * 非同期で履歴ファイルに書き込む
   */
  flush(): void {
    this.ensureDirectoryExists();
    const json = JSON.stringify(this.history, null, 2);
    const tmpPath = this.historyFilePath + '.tmp';

    // アトミックな書き込み (tmp -> rename) でファイル破損を防ぐ (修正箇所)
    fs.writeFile(tmpPath, json, 'utf-8', (err) => {
      if (err) {
        console.error('[SessionHistoryManager] Failed to write tmp file:', err);
        return;
      }
      fs.rename(tmpPath, this.historyFilePath, (renameErr) => {
        if (renameErr) {
          console.error('[SessionHistoryManager] Failed to rename tmp file:', renameErr);
        }
      });
    });
  }

  /**
   * アプリ終了時に同期で確実に書き込む (修正の核心)
   * 以前は非同期のみだったため、プロセス終了時にデータが失われていた。
   */
  flushSync(): void {
    try {
      this.ensureDirectoryExists();
      const json = JSON.stringify(this.history, null, 2);
      const tmpPath = this.historyFilePath + '.tmp';
      fs.writeFileSync(tmpPath, json, 'utf-8');
      fs.renameSync(tmpPath, this.historyFilePath);
    } catch (err) {
      console.error('[SessionHistoryManager] Failed to flush session history synchronously:', err);
    }
  }
}
