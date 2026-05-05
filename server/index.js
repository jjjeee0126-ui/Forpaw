import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  /\.private-apps\.tossmini\.com$/,
  /\.apps\.tossmini\.com$/,
];

function isOriginAllowed(origin) {
  if (!origin) return true;
  return ALLOWED_ORIGINS.some((rule) =>
    typeof rule === 'string' ? rule === origin : rule.test(origin),
  );
}

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readJsonResponse(response) {
  const raw = await response.text();

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`OpenAI 응답을 해석하지 못했어요. status=${response.status}`);
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
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

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) throw new Error('반려동물 사진 데이터 형식이 올바르지 않아요');
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

async function generateImage(payload) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았어요. .env 파일을 확인해 주세요.');
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

  const result = await readJsonResponse(res);
  if (!res.ok) {
    throw new Error(result?.error?.message || 'OpenAI 이미지 생성 실패');
  }

  const b64 = result?.data?.[0]?.b64_json;
  if (!b64) throw new Error('생성된 이미지 데이터를 받지 못했어요');

  return {
    imageDataUrl: `data:image/png;base64,${b64}`,
    model: OPENAI_IMAGE_MODEL,
    quality: OPENAI_IMAGE_QUALITY,
    size,
  };
}

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

const server = http.createServer(async (req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/api/generate-image') {
    try {
      const payload = await readBody(req);
      const result = await generateImage(payload);
      json(res, 200, result);
    } catch (e) {
      json(res, 500, { error: e.message || '이미지 생성 실패' });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    json(res, 200, {
      ok: true,
      configured: Boolean(OPENAI_API_KEY),
      model: OPENAI_IMAGE_MODEL,
    });
    return;
  }

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
