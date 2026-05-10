import { cors, getSessionFromReq, CREDIT_POLICY } from '../_lib/shared.js';

export default function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: '인증이 필요해요' });

  const { planId } = req.body || {};
  const plan = CREDIT_POLICY.PLANS[planId];
  if (!plan) return res.status(400).json({ error: '유효하지 않은 플랜이에요' });

  // TODO: 토스페이먼츠 결제 검증 후 지급
  session.credits += plan.credits;
  res.status(200).json({ credits: session.credits });
}
