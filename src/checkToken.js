/**
 * freee アクセストークン有効性確認スクリプト
 *
 * 使い方:
 *   npm run check
 *
 * トークンが期限切れの場合、リフレッシュトークンで自動更新します。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLIENT_ID = process.env.FREEE_CLIENT_ID;
const CLIENT_SECRET = process.env.FREEE_CLIENT_SECRET;
const TOKEN_FILE = path.resolve(__dirname, '..', process.env.TOKEN_FILE || '.freee_tokens.json');

const FREEE_TOKEN_URL = 'https://accounts.freee.co.jp/oauth/token';
const FREEE_API_BASE = 'https://api.freee.co.jp';

/**
 * 保存済みトークンを読み込む
 */
function loadTokens() {
  if (!fs.existsSync(TOKEN_FILE)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * トークンをファイルに保存
 */
function saveTokens(tokens) {
  const data = {
    ...tokens,
    saved_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
  return data;
}

/**
 * トークンの有効期限を確認
 */
function isTokenExpired(tokens) {
  if (!tokens.expires_at) return true;
  const expiresAt = new Date(tokens.expires_at);
  // 5分のバッファを設ける
  return expiresAt.getTime() - 5 * 60 * 1000 < Date.now();
}

/**
 * リフレッシュトークンでアクセストークンを更新
 */
async function refreshAccessToken(refreshToken) {
  const response = await axios.post(FREEE_TOKEN_URL, {
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
  });
  return response.data;
}

/**
 * freee API でトークンの有効性を確認（ユーザー情報取得）
 */
async function verifyTokenWithApi(accessToken) {
  const response = await axios.get(`${FREEE_API_BASE}/api/1/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
}

/**
 * トークン状態をレポート表示
 */
function printTokenStatus(tokens) {
  console.log('\n=== freee トークン状態 ===');
  console.log(`保存日時    : ${new Date(tokens.saved_at).toLocaleString('ja-JP')}`);
  console.log(`有効期限    : ${new Date(tokens.expires_at).toLocaleString('ja-JP')}`);

  const expired = isTokenExpired(tokens);
  console.log(`期限切れ    : ${expired ? 'はい (要更新)' : 'いいえ (有効)'}`);

  if (tokens.refresh_token) {
    console.log(`リフレッシュ: あり`);
  } else {
    console.log(`リフレッシュ: なし`);
  }
}

// メイン処理
console.log('freee トークン有効性チェックを開始します...');

const tokens = loadTokens();

if (!tokens) {
  console.error(`\nエラー: トークンファイルが見つかりません (${TOKEN_FILE})`);
  console.error('先に認証を行ってください: npm run auth');
  process.exit(1);
}

printTokenStatus(tokens);

let currentTokens = tokens;

// トークンが期限切れの場合、リフレッシュを試みる
if (isTokenExpired(tokens)) {
  if (!tokens.refresh_token) {
    console.error('\nエラー: リフレッシュトークンがありません。再認証が必要です: npm run auth');
    process.exit(1);
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('\nエラー: FREEE_CLIENT_ID と FREEE_CLIENT_SECRET を .env に設定してください');
    process.exit(1);
  }

  console.log('\nアクセストークンを更新しています...');
  try {
    const newTokens = await refreshAccessToken(tokens.refresh_token);
    currentTokens = saveTokens(newTokens);
    console.log('トークンを更新しました。');
    console.log(`新しい有効期限: ${new Date(currentTokens.expires_at).toLocaleString('ja-JP')}`);
  } catch (err) {
    const status = err.response?.status;
    if (status === 401 || status === 400) {
      console.error('\nエラー: リフレッシュトークンが無効です。再認証が必要です: npm run auth');
    } else {
      console.error(`\nトークン更新エラー: ${err.message}`);
    }
    process.exit(1);
  }
}

// API でトークンの有効性を確認
console.log('\nfreee API でトークンを検証しています...');
try {
  const userData = await verifyTokenWithApi(currentTokens.access_token);
  const user = userData.user;

  console.log('\n=== 認証済みユーザー情報 ===');
  console.log(`ユーザーID  : ${user.id}`);
  console.log(`メール      : ${user.email}`);
  console.log(`氏名        : ${user.last_name} ${user.first_name}`);
  console.log('\n認証状態: 有効 (アクセストークンは正常です)');
} catch (err) {
  const status = err.response?.status;
  if (status === 401) {
    console.error('\n認証状態: 無効 (アクセストークンが拒否されました)');
    console.error('再認証が必要です: npm run auth');
  } else {
    console.error(`\nAPI エラー (${status}): ${err.message}`);
  }
  process.exit(1);
}
