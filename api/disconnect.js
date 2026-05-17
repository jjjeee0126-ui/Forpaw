import { Redis } from '@upstash/redis';

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userKey = req.method === 'GET'
    ? req.query.userKey
    : req.body?.userKey;

  if (!userKey) {
    return res.status(400).json({ error: 'userKey is required' });
  }

  // Redis에서 해당 유저의 세션 데이터 삭제
  if (redis) {
    const userSessionKey = `forpaw:user:${userKey}`;
    const sessionId = await redis.get(userSessionKey);
    if (sessionId) {
      await redis.del(`forpaw:session:${sessionId}`);
      await redis.del(userSessionKey);
    }
  }

  res.status(200).json({ success: true });
}
