import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── .env 로드 ───

function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnv();

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '127.0.0.1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const OPENAI_IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE || '1024x1024';
const OPENAI_IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'medium';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// ─── 보안 상수 ───

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB
const RATE_LIMIT_WINDOW_MS = 60 * 1000;  // 1분
const RATE_LIMIT_MAX = 5;                 // 분당 5회
const MAX_CONCURRENT = 10;                // 동시 생성 상한
const CREDIT_POLICY = {
  FREE_GENERATIONS: 3,
  CREDITS_PER_GENERATION: 8,
  AD_REWARD_CREDITS: 1,
  MAX_DAILY_ADS: 10,
  PLANS: {
    light: { credits: 16, price: 1200 },
    basic: { credits: 40, price: 2900 },
    premium: { credits: 100, price: 5900 },
  },
};

// ─── CORS ───

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  /\.private-apps\.tossmini\.com$/,
  /\.apps\.tossmini\.com$/,
];

function isOriginAllowed(origin) {
  if (!origin) return false; // origin 없는 요청 거부
  return ALLOWED_ORIGINS.some((rule) =>
    typeof rule === 'string' ? rule === origin : rule.test(origin),
  );
}

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

// ─── Rate Limiter (IP 기반) ───

const rateLimitMap = new Map(); // ip → { count, resetAt }

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// 오래된 엔트리 정리 (5분마다)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);

// ─── 동시 요청 제어 ───

let activeGenerations = 0;

// ─── 세션 (서버 사이드 크레딧) ───

const sessions = new Map(); // sessionId → { credits, freeUsed, adsToday, lastAdDate, createdAt }
const SESSION_FILE = path.join(ROOT, 'runtime', 'sessions.json');

function loadSessions() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      for (const [k, v] of Object.entries(data)) sessions.set(k, v);
    }
  } catch { /* 깨진 파일 무시 */ }
}

function saveSessions() {
  try {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify(Object.fromEntries(sessions), null, 2));
  } catch { /* 저장 실패 무시 — 프로덕션에서는 DB 사용 */ }
}

loadSessions();
// 30초마다 디스크에 저장
setInterval(saveSessions, 30 * 1000);

function getOrCreateSession(sessionId) {
  if (!sessionId) return null;
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      credits: 0,
      freeUsed: 0,
      adsToday: 0,
      lastAdDate: null,
      createdAt: Date.now(),
    });
  }
  return sessions.get(sessionId);
}

function createSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

function signToken(sessionId) {
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(sessionId);
  return `${sessionId}.${hmac.digest('hex')}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [sessionId, sig] = parts;
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(sessionId);
  const expected = hmac.digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
  return sessionId;
}

function resetDailyAds(session) {
  const today = new Date().toISOString().slice(0, 10);
  if (session.lastAdDate !== today) {
    session.adsToday = 0;
    session.lastAdDate = today;
  }
}

// ─── 유틸 ───

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('요청이 너무 커요 (최대 10MB)'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('요청 본문을 읽지 못했어요'));
      }
    });
    req.on('error', () => reject(new Error('요청 처리 실패')));
  });
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
}

function getAuthToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

// ─── OpenAI 이미지 생성 ───

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) throw new Error('사진 데이터 형식이 올바르지 않아요');
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

async function generateImage(payload) {
  if (!OPENAI_API_KEY) {
    throw new Error('서버 설정 오류');
  }
  if (!payload.photoDataUrl) {
    throw new Error('반려동물 사진이 필요해요');
  }

  const { buffer, mimeType } = parseDataUrl(payload.photoDataUrl);
  const form = new FormData();
  const size = payload.outputSize || OPENAI_IMAGE_SIZE;

  form.append('model', OPENAI_IMAGE_MODEL);
  form.append('prompt', payload.prompt || '');
  form.append('size', size);
  form.append('quality', OPENAI_IMAGE_QUALITY);
  form.append('image', new Blob([buffer], { type: mimeType }), 'pet-photo.png');

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    console.error(`OpenAI error: status=${res.status}`);
    throw new Error('이미지 생성에 실패했어요. 잠시 후 다시 시도해 주세요.');
  }

  const raw = await res.text();
  let result;
  try { result = JSON.parse(raw); } catch {
    throw new Error('이미지 생성 응답을 처리하지 못했어요');
  }

  const b64 = result?.data?.[0]?.b64_json;
  if (!b64) throw new Error('생성된 이미지를 받지 못했어요');

  return {
    imageDataUrl: `data:image/png;base64,${b64}`,
    model: OPENAI_IMAGE_MODEL,
    size,
  };
}

// ─── 정적 파일 서빙 ───

function serveStatic(reqPath, res) {
  const distDir = path.join(ROOT, 'dist');
  const safePath = reqPath === '/' ? '/index.html' : reqPath;
  const filePath = path.join(distDir, safePath);

  if (!filePath.startsWith(distDir)) {
    json(res, 403, { error: 'Forbidden' });
    return;
  }

  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      fs.readFile(path.join(distDir, 'index.html'), (err2, fallback) => {
        if (err2) { json(res, 404, { error: 'Not found' }); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fallback);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ─── HTTP 서버 ───

const server = http.createServer(async (req, res) => {
  setCors(req, res);
  setSecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const ip = getClientIp(req);

  // ── POST /api/session — 세션 생성 ──
  if (req.method === 'POST' && url.pathname === '/api/session') {
    const sessionId = createSessionId();
    getOrCreateSession(sessionId);
    const token = signToken(sessionId);
    json(res, 200, { token });
    return;
  }

  // ── GET /api/credits — 크레딧 조회 ──
  if (req.method === 'GET' && url.pathname === '/api/credits') {
    const sessionId = verifyToken(getAuthToken(req));
    if (!sessionId) { json(res, 401, { error: '인증이 필요해요' }); return; }
    const session = getOrCreateSession(sessionId);
    resetDailyAds(session);
    const freeRemaining = Math.max(0, CREDIT_POLICY.FREE_GENERATIONS - session.freeUsed);
    json(res, 200, {
      credits: session.credits,
      freeRemaining,
      adsToday: session.adsToday,
      adsRemainingToday: CREDIT_POLICY.MAX_DAILY_ADS - session.adsToday,
      canGenerate: freeRemaining > 0 || session.credits >= CREDIT_POLICY.CREDITS_PER_GENERATION,
    });
    return;
  }

  // ── POST /api/credits/purchase — 크레딧 구매 (mock, 프로덕션에서는 결제 웹훅 사용) ──
  if (req.method === 'POST' && url.pathname === '/api/credits/purchase') {
    const sessionId = verifyToken(getAuthToken(req));
    if (!sessionId) { json(res, 401, { error: '인증이 필요해요' }); return; }
    const session = getOrCreateSession(sessionId);
    try {
      const body = await readBody(req);
      const plan = CREDIT_POLICY.PLANS[body.planId];
      if (!plan) { json(res, 400, { error: '유효하지 않은 플랜이에요' }); return; }
      // TODO: 토스페이먼츠 결제 검증 후 지급
      // 지금은 mock — 프로덕션에서는 결제 웹훅 콜백에서만 호출
      session.credits += plan.credits;
      json(res, 200, { credits: session.credits });
    } catch (e) {
      json(res, 400, { error: '요청을 처리하지 못했어요' });
    }
    return;
  }

  // ── POST /api/credits/ad-reward — 광고 보상 ──
  if (req.method === 'POST' && url.pathname === '/api/credits/ad-reward') {
    const sessionId = verifyToken(getAuthToken(req));
    if (!sessionId) { json(res, 401, { error: '인증이 필요해요' }); return; }
    const session = getOrCreateSession(sessionId);
    resetDailyAds(session);
    if (session.adsToday >= CREDIT_POLICY.MAX_DAILY_ADS) {
      json(res, 429, { error: '오늘 광고 보상 한도에 도달했어요' });
      return;
    }
    // TODO: 광고 SDK S2S 콜백 검증
    session.credits += CREDIT_POLICY.AD_REWARD_CREDITS;
    session.adsToday += 1;
    json(res, 200, { credits: session.credits, adsToday: session.adsToday });
    return;
  }

  // ── POST /api/generate-image — 이미지 생성 (인증 + 크레딧 필수) ──
  if (req.method === 'POST' && url.pathname === '/api/generate-image') {
    // 인증
    const sessionId = verifyToken(getAuthToken(req));
    if (!sessionId) { json(res, 401, { error: '인증이 필요해요' }); return; }

    // Rate limit
    if (!checkRateLimit(ip)) {
      json(res, 429, { error: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' });
      return;
    }

    // 동시 요청 제한
    if (activeGenerations >= MAX_CONCURRENT) {
      json(res, 503, { error: '서버가 바빠요. 잠시 후 다시 시도해 주세요.' });
      return;
    }

    // 크레딧 확인 + 차감
    const session = getOrCreateSession(sessionId);
    const isFree = session.freeUsed < CREDIT_POLICY.FREE_GENERATIONS;
    if (!isFree && session.credits < CREDIT_POLICY.CREDITS_PER_GENERATION) {
      json(res, 402, { error: '크레딧이 부족해요' });
      return;
    }

    // 선차감
    if (isFree) {
      session.freeUsed += 1;
    } else {
      session.credits -= CREDIT_POLICY.CREDITS_PER_GENERATION;
    }

    activeGenerations++;
    try {
      const payload = await readBody(req);
      const result = await generateImage(payload);
      json(res, 200, result);
    } catch (e) {
      // 실패 시 환불
      if (isFree) {
        session.freeUsed -= 1;
      } else {
        session.credits += CREDIT_POLICY.CREDITS_PER_GENERATION;
      }
      json(res, 500, { error: e.message || '이미지 생성에 실패했어요' });
    } finally {
      activeGenerations--;
    }
    return;
  }

  // ── GET /api/health ──
  if (req.method === 'GET' && url.pathname === '/api/health') {
    json(res, 200, { ok: true });
    return;
  }

  // ── 정적 파일 ──
  if (req.method === 'GET') {
    serveStatic(url.pathname, res);
    return;
  }

  json(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, HOST, () => {
  console.log(`ForPaw API server running on http://${HOST}:${PORT}`);
  console.log(`OpenAI configured: ${Boolean(OPENAI_API_KEY)}`);
});
