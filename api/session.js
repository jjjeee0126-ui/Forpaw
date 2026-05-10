import { cors, createSessionId, getOrCreateSession, signToken } from './_lib/shared.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sessionId = createSessionId();
  await getOrCreateSession(sessionId);
  const token = signToken(sessionId);
  res.status(200).json({ token });
}
