import { cors, getSessionFromReq, resetDailyAds, CREDIT_POLICY } from '../_lib/shared.js';

export default function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: '인증이 필요해요' });

  resetDailyAds(session);
  const freeRemaining = Math.max(0, CREDIT_POLICY.FREE_GENERATIONS - session.freeUsed);

  res.status(200).json({
    credits: session.credits,
    freeRemaining,
    adsToday: session.adsToday,
    adsRemainingToday: CREDIT_POLICY.MAX_DAILY_ADS - session.adsToday,
    canGenerate: freeRemaining > 0 || session.credits >= CREDIT_POLICY.CREDITS_PER_GENERATION,
  });
}
