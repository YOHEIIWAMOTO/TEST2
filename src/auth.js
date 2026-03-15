/**
 * freee OAuth2 認証フロー
 *
 * 使い方:
 *   1. .env.example を .env にコピーして認証情報を設定
 *   2. npm install
 *   3. npm run auth
 */

import http from 'http';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import open from 'open';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLIENT_ID = process.env.FREEE_CLIENT_ID;
const CLIENT_SECRET = process.env.FREEE_CLIENT_SECRET;
const REDIRECT_URI = process.env.FREEE_REDIRECT_URI || 'http://localhost:8080/callback';
const TOKEN_FILE = path.resolve(__dirname, '..', process.env.TOKEN_FILE || '.freee_tokens.json');

const FREEE_AUTH_URL = 'https://accounts.freee.co.jp/oauth/authorize';
const FREEE_TOKEN_URL = 'https://accounts.freee.co.jp/oauth/token';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('エラー: FREEE_CLIENT_ID と FREEE_CLIENT_SECRET を .env に設定してください');
  process.exit(1);
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
  console.log(`トークンを保存しました: ${TOKEN_FILE}`);
}

/**
 * 認証コードをアクセストークンに交換
 */
async function exchangeCodeForToken(code) {
  const response = await axios.post(FREEE_TOKEN_URL, {
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: REDIRECT_URI,
  });
  return response.data;
}

/**
 * OAuth2 認証フローを開始
 */
async function startAuthFlow() {
  const callbackUrl = new URL(REDIRECT_URI);
  const port = parseInt(callbackUrl.port) || 8080;

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const reqUrl = new URL(req.url, `http://localhost:${port}`);

      if (reqUrl.pathname !== callbackUrl.pathname) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const code = reqUrl.searchParams.get('code');
      const error = reqUrl.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>認証エラー: ${error}</h1>`);
        server.close();
        reject(new Error(`OAuth2 エラー: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>認証コードが見つかりません</h1>');
        server.close();
        reject(new Error('認証コードが取得できませんでした'));
        return;
      }

      try {
        console.log('認証コードを取得しました。トークンを取得中...');
        const tokens = await exchangeCodeForToken(code);
        saveTokens(tokens);

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h1>認証成功!</h1>
              <p>アクセストークンを取得しました。このウィンドウを閉じてください。</p>
            </body>
          </html>
        `);
        server.close();
        resolve(tokens);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>トークン取得エラー: ${err.message}</h1>`);
        server.close();
        reject(err);
      }
    });

    server.listen(port, () => {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
      });
      const authUrl = `${FREEE_AUTH_URL}?${params.toString()}`;

      console.log('\n=== freee OAuth2 認証フロー ===');
      console.log(`ブラウザで以下の URL を開いて認証してください:`);
      console.log(`\n${authUrl}\n`);
      console.log(`コールバックサーバーを起動しました: http://localhost:${port}`);

      open(authUrl).catch(() => {
        console.log('ブラウザを自動で開けませんでした。上記 URL を手動でアクセスしてください。');
      });
    });

    server.on('error', (err) => {
      reject(new Error(`サーバーエラー: ${err.message}`));
    });
  });
}

// メイン処理
try {
  const tokens = await startAuthFlow();
  console.log('\n=== 認証完了 ===');
  console.log(`アクセストークン取得成功`);
  console.log(`有効期限: ${new Date(Date.now() + tokens.expires_in * 1000).toLocaleString('ja-JP')}`);
  console.log('\nトークンの状態を確認するには: npm run check');
} catch (err) {
  console.error('認証失敗:', err.message);
  process.exit(1);
}
