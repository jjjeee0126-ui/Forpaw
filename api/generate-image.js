import {
  cors,
  getSessionFromReq,
  getClientIp,
  checkRateLimit,
  acquireSlot,
  releaseSlot,
  CREDIT_POLICY,
  OPENAI_API_KEY,
  OPENAI_IMAGE_MODEL,
  OPENAI_IMAGE_SIZE,
  OPENAI_IMAGE_QUALITY,
} from './_lib/shared.js';

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) throw new Error('사진 데이터 형식이 올바르지 않아요');
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' },
  },
};

export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 인증
  const session = getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: '인증이 필요해요' });

  // Rate limit
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' });
  }

  // 동시 요청 제한
  if (!acquireSlot()) {
    return res.status(503).json({ error: '서버가 바빠요. 잠시 후 다시 시도해 주세요.' });
  }

  // 크레딧 확인 + 선차감
  const isFree = session.freeUsed < CREDIT_POLICY.FREE_GENERATIONS;
  if (!isFree && session.credits < CREDIT_POLICY.CREDITS_PER_GENERATION) {
    releaseSlot();
    return res.status(402).json({ error: '크레딧이 부족해요' });
  }

  if (isFree) {
    session.freeUsed += 1;
  } else {
    session.credits -= CREDIT_POLICY.CREDITS_PER_GENERATION;
  }

  try {
    if (!OPENAI_API_KEY) throw new Error('서버 설정 오류');

    const payload = req.body || {};
    if (!payload.photoDataUrl) throw new Error('반려동물 사진이 필요해요');

    const { buffer, mimeType } = parseDataUrl(payload.photoDataUrl);
    const size = payload.outputSize || OPENAI_IMAGE_SIZE;

    const form = new FormData();
    form.append('model', OPENAI_IMAGE_MODEL);
    form.append('prompt', payload.prompt || '');
    form.append('size', size);
    form.append('quality', OPENAI_IMAGE_QUALITY);
    form.append('image', new Blob([buffer], { type: mimeType }), 'pet-photo.png');

    const openaiRes = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });

    if (!openaiRes.ok) {
      console.error(`OpenAI error: status=${openaiRes.status}`);
      throw new Error('이미지 생성에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }

    const result = await openaiRes.json();
    const b64 = result?.data?.[0]?.b64_json;
    if (!b64) throw new Error('생성된 이미지를 받지 못했어요');

    res.status(200).json({
      imageDataUrl: `data:image/png;base64,${b64}`,
      model: OPENAI_IMAGE_MODEL,
      size,
    });
  } catch (e) {
    // 실패 시 환불
    if (isFree) {
      session.freeUsed -= 1;
    } else {
      session.credits += CREDIT_POLICY.CREDITS_PER_GENERATION;
    }
    res.status(500).json({ error: e.message || '이미지 생성에 실패했어요' });
  } finally {
    releaseSlot();
  }
}
