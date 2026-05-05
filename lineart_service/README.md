# LineArt Service

`app.py`는 FastAPI 서버입니다.

## 백엔드 우선순위

1. `controlnet_aux`의 `LineartDetector`
2. 설치되지 않았거나 모델 로드에 실패하면 XDoG 기반 클래식 라인 추출

## 빠른 실행

```bash
cd /Users/youngjin/Desktop/프로젝트/ForPaw
python3 -m venv .venv
source .venv/bin/activate
pip install -r lineart_service/requirements.txt
pip install torch torchvision
pip install -r lineart_service/requirements-ai.txt
python3 -m uvicorn lineart_service.app:app --host 127.0.0.1 --port 8008
```

## 모델 워밍업

```bash
python3 -m lineart_service.download_models
```

## API

### `GET /health`

현재 사용 가능한 백엔드를 반환합니다.

### `POST /render`

입력 예시:

```json
{
  "imageDataUrl": "data:image/jpeg;base64,...",
  "preset": "pet-portrait",
  "options": {
    "backend": "auto",
    "removeBackground": true,
    "cropSubject": true,
    "paperColor": "#f7dfbd",
    "detailBoost": 0.62,
    "strokeBoost": 0.38,
    "maxSide": 1280
  }
}
```
