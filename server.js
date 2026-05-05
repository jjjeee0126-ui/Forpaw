const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT_DIR = __dirname;

function loadDotEnv() {
  const envPath = path.join(ROOT_DIR, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const envLines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const normalizedValue = rawValue.replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = normalizedValue;
    }
  }
}

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const OPENAI_IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE || "1024x1024";
const OPENAI_IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || "medium";
const LINEART_SERVICE_URL = process.env.LINEART_SERVICE_URL || "http://127.0.0.1:8008";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function serveStaticFile(requestPath, response) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.join(ROOT_DIR, safePath);

  if (!filePath.startsWith(ROOT_DIR)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(content);
  });
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(chunk);
    });

    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error("요청 본문을 읽지 못했습니다."));
      }
    });

    request.on("error", () => {
      reject(new Error("요청을 처리하지 못했습니다."));
    });
  });
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) {
    throw new Error("반려동물 사진 데이터 형식이 올바르지 않습니다.");
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

async function generateImage(payload) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다. .env.example을 참고해 환경 변수를 넣어 주세요.");
  }

  if (!payload.photoDataUrl) {
    throw new Error("생성 전에 반려동물 사진이 필요합니다.");
  }

  const { buffer, mimeType } = parseDataUrl(payload.photoDataUrl);
  const form = new FormData();
  const requestedSize = payload.outputSize || OPENAI_IMAGE_SIZE;

  form.append("model", OPENAI_IMAGE_MODEL);
  form.append("prompt", payload.prompt || "");
  form.append("size", requestedSize);
  form.append("quality", OPENAI_IMAGE_QUALITY);
  form.append("background", "transparent");
  form.append("image", new Blob([buffer], { type: mimeType }), "pet-photo.png");

  const openAiResponse = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: form,
  });

  const result = await openAiResponse.json();

  if (!openAiResponse.ok) {
    const message = result?.error?.message || "OpenAI 이미지 생성 요청이 실패했습니다.";
    throw new Error(message);
  }

  const imageBase64 = result?.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error("생성된 이미지 데이터를 받지 못했습니다.");
  }

  return {
    imageDataUrl: `data:image/png;base64,${imageBase64}`,
    model: OPENAI_IMAGE_MODEL,
    quality: OPENAI_IMAGE_QUALITY,
    size: requestedSize,
  };
}

async function proxyLineArt(endpoint, payload) {
  let upstreamResponse;

  try {
    upstreamResponse = await fetch(`${LINEART_SERVICE_URL}${endpoint}`, {
      method: payload ? "POST" : "GET",
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
  } catch (error) {
    throw new Error(
      "Python 라인드로잉 서비스에 연결하지 못했습니다. `npm start`와 별도로 `npm run start:lineart`를 실행해 주세요."
    );
  }

  const result = await upstreamResponse.json().catch(() => ({}));
  if (!upstreamResponse.ok) {
    throw new Error(result?.error || result?.detail || "라인드로잉 서비스 호출이 실패했습니다.");
  }

  return result;
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "POST" && requestUrl.pathname === "/api/generate-image") {
    try {
      const payload = await readRequestBody(request);
      const result = await generateImage(payload);
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 500, { error: error.message || "이미지 생성에 실패했습니다." });
    }
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/openai/health") {
    sendJson(response, 200, {
      ok: true,
      configured: Boolean(OPENAI_API_KEY),
      model: OPENAI_IMAGE_MODEL,
      quality: OPENAI_IMAGE_QUALITY,
      defaultSize: OPENAI_IMAGE_SIZE,
    });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/lineart") {
    try {
      const payload = await readRequestBody(request);
      const result = await proxyLineArt("/render", payload);
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 500, { error: error.message || "라인드로잉 생성에 실패했습니다." });
    }
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/lineart/health") {
    try {
      const result = await proxyLineArt("/health");
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 503, { ok: false, error: error.message || "라인드로잉 서비스를 확인하지 못했습니다." });
    }
    return;
  }

  if (request.method === "GET") {
    serveStaticFile(requestUrl.pathname, response);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
});

server.listen(PORT, HOST, () => {
  console.log(`ForPaw server running on http://${HOST}:${PORT}`);
});
