import crypto from 'node:crypto';

// ─── 환경변수 ───

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
export const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
export const OPENAI_IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE || '1024x1024';
export const OPENAI_IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'medium';

// ─── 크레딧 정책 ───

export const CREDIT_POLICY = {
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
  /\.vercel\.app$/,
];

function isOriginAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((rule) =>
    typeof rule === 'string' ? rule === origin : rule.test(origin),
  );
}

export function cors(req, res) {
  const origin = req.headers.origin || '';
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

// ─── Rate Limiter ───

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

export function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// ─── 동시 요청 제어 ───

let activeGenerations = 0;
const MAX_CONCURRENT = 10;

export function acquireSlot() {
  if (activeGenerations >= MAX_CONCURRENT) return false;
  activeGenerations++;
  return true;
}

export function releaseSlot() {
  activeGenerations = Math.max(0, activeGenerations - 1);
}

// ─── 세션 (in-memory, serverless에서는 cold start 시 리셋됨) ───
// 프로덕션에서는 Vercel KV 또는 Upstash Redis로 교체 권장

const sessions = new Map();

export function getOrCreateSession(sessionId) {
  if (!sessionId) return null;
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      credits: 0,
      freeUsed: 0,
      adsToday: 0,
      lastAdDate: null,
    });
  }
  return sessions.get(sessionId);
}

export function createSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

export function signToken(sessionId) {
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(sessionId);
  return `${sessionId}.${hmac.digest('hex')}`;
}

export function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [sessionId, sig] = parts;
  try {
    const hmac = crypto.createHmac('sha256', SESSION_SECRET);
    hmac.update(sessionId);
    const expected = hmac.digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
    return sessionId;
  } catch {
    return null;
  }
}

export function resetDailyAds(session) {
  const today = new Date().toISOString().slice(0, 10);
  if (session.lastAdDate !== today) {
    session.adsToday = 0;
    session.lastAdDate = today;
  }
}

// ─── Auth 헬퍼 ───

export function getSessionFromReq(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const sessionId = verifyToken(token);
  if (!sessionId) return null;
  return getOrCreateSession(sessionId);
}

export function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '0.0.0.0';
}
