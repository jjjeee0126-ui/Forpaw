import { cors, getSessionFromReq, resetDailyAds, CREDIT_POLICY } from '../_lib/shared.js';

export default function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: '인증이 필요해요' });

  resetDailyAds(session);

  if (session.adsToday >= CREDIT_POLICY.MAX_DAILY_ADS) {
    return res.status(429).json({ error: '오늘 광고 보상 한도에 도달했어요' });
  }

  // TODO: 광고 SDK S2S 콜백 검증
  session.credits += CREDIT_POLICY.AD_REWARD_CREDITS;
  session.adsToday += 1;

  res.status(200).json({ credits: session.credits, adsToday: session.adsToday });
}
