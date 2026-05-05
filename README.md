# ForPaw - 반려동물 키링 이미지 생성 미니앱

반려동물 사진과 이름(이니셜)을 입력하면, 동물의 털 색깔·질감·눈동자 색 등 특징을 반영한 폭신한 하트 키링 이미지를 생성하는 **앱인토스 미니앱**입니다.

## 기술 스택

- **프론트엔드**: Vite + React 19 + TypeScript
- **UI**: TDS Mobile (`@toss/tds-mobile`) + CSS Modules
- **앱인토스 SDK**: `@apps-in-toss/web-framework` (SDK 2.x)
- **백엔드**: Node.js HTTP 서버
- **AI**: OpenAI Image Edit API (`gpt-image-1`)

## 프로젝트 구조

```
ForPaw/
├── src/                    # React 프론트엔드
│   ├── main.tsx
│   ├── App.tsx             # 앱 상태 관리 (home → generating → result)
│   ├── pages/
│   │   ├── HomePage.tsx    # 사진 업로드 + 이름 입력
│   │   ├── GeneratingPage.tsx  # 생성 진행 화면
│   │   └── ResultPage.tsx  # 결과 표시 + 저장/공유
│   ├── api/
│   │   └── generate.ts     # OpenAI API 클라이언트 + 프롬프트 엔지니어링
│   └── styles/
│       └── global.css
├── server/
│   └── index.js            # API 서버 (OpenAI 프록시 + CORS)
├── granite.config.ts       # 앱인토스 설정
├── vite.config.ts
├── package.json
└── .env                    # API 키 설정
```

## 시작하기

### 1. 의존성 설치

```bash
npm install --legacy-peer-deps
```

### 2. 환경 변수 설정

`.env` 파일에 OpenAI API 키를 설정하세요:

```
OPENAI_API_KEY=sk-your-api-key-here
```

### 3. 개발 서버 실행

프론트엔드와 API 서버를 각각 실행합니다:

```bash
# 터미널 1: Vite 개발 서버 (포트 5173)
npm run dev

# 터미널 2: API 서버 (포트 3001)
npm run server
```

브라우저에서 http://localhost:5173 으로 접속하세요.

### 4. 빌드

```bash
npm run build
```

빌드 결과물은 `dist/` 폴더에 생성됩니다.

## 앱인토스 배포

### 샌드박스 테스트

1. 앱인토스 콘솔에서 앱을 등록하고 `appName`을 `granite.config.ts`에 설정
2. 샌드박스 앱 설치 후 `intoss://forpaw`로 접속

### 출시

```bash
npx ait build    # .ait 번들 생성
```

생성된 `.ait` 파일을 앱인토스 콘솔에 업로드하여 검수를 요청하세요.

## API 서버 배포

프로덕션 환경에서는 API 서버를 별도로 배포해야 합니다:

- `server/index.js`를 Vercel, Railway, Fly.io 등에 배포
- 환경 변수 `OPENAI_API_KEY` 설정
- 프론트엔드의 `VITE_API_BASE` 환경 변수에 API 서버 주소 설정
- CORS 설정에 `*.apps.tossmini.com` 도메인 추가 (이미 포함)
