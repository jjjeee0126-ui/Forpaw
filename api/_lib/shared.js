import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';

// ─── 환경변수 ───

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
export const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
export const OPENAI_IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE || '1024x1024';
export const OPENAI_IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'medium';

// ─── Redis ───

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

const SESSION_TTL = 60 * 60 * 24 * 30; // 30일
const SESSION_PREFIX = 'forpaw:session:';

// in-memory fallback (로컬 개발용)
const memSessions = new Map();

async function getSession(sessionId) {
  if (!sessionId) return null;
  if (redis) {
    const data = await redis.get(`${SESSION_PREFIX}${sessionId}`);
    return data || null;
  }
  return memSessions.get(sessionId) || null;
}

async function setSession(sessionId, data) {
  if (redis) {
    await redis.set(`${SESSION_PREFIX}${sessionId}`, data, { ex: SESSION_TTL });
  } else {
    memSessions.set(sessionId, data);
  }
}

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

// ─── Rate Limiter (Redis 기반 or in-memory) ───

const RATE_LIMIT_WINDOW = 60; // 초
const RATE_LIMIT_MAX = 5;
const memRateLimit = new Map();

export async function checkRateLimit(ip) {
  if (redis) {
    const key = `forpaw:ratelimit:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW);
    return count <= RATE_LIMIT_MAX;
  }
  // in-memory fallback
  const now = Date.now();
  let entry = memRateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW * 1000 };
    memRateLimit.set(ip, entry);
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

// ─── 세션 관리 ───

const DEFAULT_SESSION = {
  credits: 0,
  freeUsed: 0,
  adsToday: 0,
  lastAdDate: null,
};

export function createSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

export async function getOrCreateSession(sessionId) {
  if (!sessionId) return null;
  let session = await getSession(sessionId);
  if (!session) {
    session = { ...DEFAULT_SESSION };
    await setSession(sessionId, session);
  }
  return session;
}

export async function saveSession(sessionId, session) {
  await setSession(sessionId, session);
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

export function getSessionIdFromReq(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  return verifyToken(token);
}

export function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '0.0.0.0';
}
