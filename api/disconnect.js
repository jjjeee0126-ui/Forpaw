import crypto from 'node:crypto';
import { Redis } from '@upstash/redis';

const BASIC_AUTH = process.env.DISCONNECT_BASIC_AUTH || '';

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

function verifyBasicAuth(req) {
  if (!BASIC_AUTH) return true; // 미설정 시 스킵
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Basic ')) return false;
  const provided = auth.slice(6);
  return crypto.timingSafeEqual(
    Buffer.from(provided),
    Buffer.from(BASIC_AUTH),
  );
}

export default async function handler(req, res) {
  // GET, POST 둘 다 지원
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyBasicAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userKey = req.method === 'GET'
    ? req.query.userKey
    : req.body?.userKey;

  if (!userKey) {
    return res.status(400).json({ error: 'userKey is required' });
  }

  // Redis에서 해당 유저의 세션 데이터 삭제
  if (redis) {
    const keys = await redis.keys(`forpaw:session:*`);
    // userKey 기반 세션 삭제 — 현재는 세션 키로 관리하므로
    // userKey 매핑이 있다면 해당 키 삭제
    const userSessionKey = `forpaw:user:${userKey}`;
    const sessionId = await redis.get(userSessionKey);
    if (sessionId) {
      await redis.del(`forpaw:session:${sessionId}`);
      await redis.del(userSessionKey);
    }
  }

  res.status(200).json({ success: true });
}
