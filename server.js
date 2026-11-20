const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const VoteModeration = require('./moderation.js');

const ROOT = __dirname;
const DATA_DIR = path.resolve(process.env.VOTE_DATA_DIR || path.join(ROOT, 'data'));
const BOARD_FILE = path.join(DATA_DIR, 'board.json');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_ORIGIN = process.env.VOTE_PUBLIC_ORIGIN || '';
const MAX_REQUEST_SIZE = 16 * 1024;
const allowedFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/vote.html', ['vote.html', 'text/html; charset=utf-8']],
  ['/board.html', ['board.html', 'text/html; charset=utf-8']],
  ['/admin.html', ['admin.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/moderation.js', ['moderation.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']]
]);
const requestLimits = new Map();
let board = { posts: [] };
let saveQueue = Promise.resolve();

function sendJson(response, status, value, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  response.end(JSON.stringify(value));
}

function sendError(response, status, message) {
  sendJson(response, status, { error: message });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    let tooLarge = false;
    request.on('data', chunk => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body) > MAX_REQUEST_SIZE) {
        tooLarge = true;
        reject(Object.assign(new Error('요청 내용이 너무 큽니다.'), { status: 413 }));
      }
    });
    request.on('end', () => {
      if (tooLarge) return;
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error('요청 형식이 올바르지 않습니다.'), { status: 400 }));
      }
    });
    request.on('error', reject);
  });
}

function requireJson(request, response) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    sendError(response, 415, 'JSON 형식으로 요청해 주세요.');
    return false;
  }
  return true;
}

function hasSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const protocol = request.socket.encrypted ? 'https' : 'http';
  return origin === (PUBLIC_ORIGIN || `${protocol}://${request.headers.host}`);
}

function requireSameOrigin(request, response) {
  if (hasSameOrigin(request)) return true;
  sendError(response, 403, '허용되지 않은 요청입니다.');
  return false;
}

function getClientAddress(request) {
  return request.socket.remoteAddress || 'unknown';
}

function isRateLimited(request, key, limit, windowMs) {
  const now = Date.now();
  if (requestLimits.size > 10_000) {
    for (const [entryKey, entry] of requestLimits) {
      if (entry.resetAt <= now) requestLimits.delete(entryKey);
    }
  }
  if (requestLimits.size > 20_000) return true;
  const address = getClientAddress(request);
  const mapKey = `${key}:${address}`;
  const record = requestLimits.get(mapKey);
  if (!record || record.resetAt <= now) {
    requestLimits.set(mapKey, { count: 1, resetAt: now + windowMs });
    return false;
  }
  record.count += 1;
  return record.count > limit;
}

function requireAdmin(request, response) {
  return true;
}

function persistBoard() {
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    const temporaryFile = `${BOARD_FILE}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temporaryFile, JSON.stringify(board, null, 2), { mode: 0o600 });
    await fs.rename(temporaryFile, BOARD_FILE);
  });
  return saveQueue;
}

async function handleApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/board/posts') {
    const posts = board.posts
      .map((post, index) => ({ post, index }))
      .filter(({ post }) => !post.deletedAt)
      .sort((a, b) => b.post.createdAt - a.post.createdAt || b.index - a.index)
      .map(({ post }) => ({ id: post.id, text: post.text, createdAt: post.createdAt }));
    sendJson(response, 200, { posts });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/board/posts') {
    if (!requireSameOrigin(request, response) || !requireJson(request, response)) return;
    if (isRateLimited(request, 'post', 5, 60_000)) {
      sendError(response, 429, '잠시 후 다시 등록해 주세요.');
      return;
    }
    let payload;
    try {
      payload = await readJson(request);
    } catch (error) {
      sendError(response, error.status || 400, error.message);
      return;
    }
    if (typeof payload.text !== 'string' || payload.text.trim().length === 0 || payload.text.trim().length > 240) {
      sendError(response, 400, '게시글은 1자 이상 240자 이하로 작성해 주세요.');
      return;
    }
    const moderation = VoteModeration.checkPost(payload.text);
    if (!moderation.allowed) {
      sendError(response, 422, moderation.reason);
      return;
    }
    const post = {
      id: crypto.randomUUID(),
      text: payload.text.trim(),
      createdAt: Date.now(),
      reports: [],
      deletedAt: null
    };
    board.posts.push(post);
    try {
      await persistBoard();
    } catch (error) {
      board.posts = board.posts.filter(item => item.id !== post.id);
      console.error('게시글 저장에 실패했습니다.', error);
      sendError(response, 500, '게시글을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    sendJson(response, 201, { post: { id: post.id, text: post.text, createdAt: post.createdAt } });
    return;
  }

  const reportMatch = url.pathname.match(/^\/api\/board\/posts\/([0-9a-f-]{36})\/report$/i);
  if (request.method === 'POST' && reportMatch) {
    if (!requireSameOrigin(request, response) || !requireJson(request, response)) return;
    if (isRateLimited(request, 'report', 10, 60 * 60_000)) {
      sendError(response, 429, '신고 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    const post = board.posts.find(item => item.id === reportMatch[1] && !item.deletedAt);
    if (!post) {
      sendError(response, 404, '게시글을 찾을 수 없습니다.');
      return;
    }
    post.reports.push({ createdAt: Date.now() });
    try {
      await persistBoard();
    } catch (error) {
      post.reports.pop();
      console.error('신고 저장에 실패했습니다.', error);
      sendError(response, 500, '신고를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    sendJson(response, 201, { message: '신고가 접수되었습니다.' });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/reports') {
    if (!requireAdmin(request, response)) return;
    const reported = board.posts
      .filter(post => !post.deletedAt && post.reports.length > 0)
      .sort((a, b) => b.reports.length - a.reports.length || b.createdAt - a.createdAt)
      .map(({ id, text }) => ({ id, text }));
    sendJson(response, 200, { posts: reported });
    return;
  }

  const deleteMatch = url.pathname.match(/^\/api\/admin\/posts\/([0-9a-f-]{36})$/i);
  if (request.method === 'DELETE' && deleteMatch) {
    if (!requireSameOrigin(request, response) || !requireAdmin(request, response)) return;
    const post = board.posts.find(item => item.id === deleteMatch[1] && !item.deletedAt);
    if (!post) {
      sendError(response, 404, '게시글을 찾을 수 없습니다.');
      return;
    }
    post.deletedAt = Date.now();
    try {
      await persistBoard();
    } catch (error) {
      post.deletedAt = null;
      console.error('게시글 삭제에 실패했습니다.', error);
      sendError(response, 500, '게시글을 삭제하지 못했습니다. 다시 시도해 주세요.');
      return;
    }
    sendJson(response, 200, { message: '게시글을 삭제했습니다.' });
    return;
  }

  sendError(response, 404, '요청한 API를 찾을 수 없습니다.');
}

async function serveFile(response, pathname) {
  const entry = allowedFiles.get(pathname);
  if (!entry) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('페이지를 찾을 수 없습니다.');
    return;
  }
  try {
    const content = await fs.readFile(path.join(ROOT, entry[0]));
    response.writeHead(200, {
      'Content-Type': entry[1],
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'self'; frame-ancestors 'none'"
    });
    response.end(content);
  } catch (error) {
    console.error('웹 파일을 읽지 못했습니다.', error);
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('페이지를 불러오지 못했습니다.');
  }
}

async function loadBoard() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const saved = JSON.parse(await fs.readFile(BOARD_FILE, 'utf8'));
    if (!saved || !Array.isArray(saved.posts) || saved.posts.some(post =>
      typeof post.id !== 'string'
      || typeof post.text !== 'string'
      || !Number.isFinite(post.createdAt)
      || !Array.isArray(post.reports)
      || (post.deletedAt !== null && !Number.isFinite(post.deletedAt))
    )) {
      throw new Error('게시판 데이터 형식이 올바르지 않습니다.');
    }
    board = saved;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    board = { posts: [] };
    await persistBoard();
  }
}

async function startServer() {
  await loadBoard();
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      handleApi(request, response, url).catch(error => {
        console.error('API 요청 처리에 실패했습니다.', error);
        if (!response.headersSent) sendError(response, 500, '요청을 처리하지 못했습니다.');
        else response.destroy();
      });
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendError(response, 405, '지원하지 않는 요청입니다.');
      return;
    }
    serveFile(response, url.pathname);
  });
  server.listen(PORT, HOST, () => {
    console.log(`VOTE 서버가 http://${HOST}:${PORT} 에서 실행 중입니다.`);
  });
}

if (require.main === module) {
  startServer().catch(error => {
    console.error('VOTE 서버를 시작하지 못했습니다.', error);
    process.exitCode = 1;
  });
}

module.exports = { loadBoard, startServer };
