# For Paw — 에이전트 인수인계 가이드

이 파일을 먼저 읽어. 어떤 에이전트든 여기서 시작.

---

## 프로젝트 파일 구조

```
~/.openclaw/workspace/projects/for-paw/
  HANDOFF.md      ← 지금 이 파일. 가장 먼저 읽기
  DECISIONS.md    ← 의사결정 로그 (D-001부터 순서대로)
  README.md       ← 앱 개요, 컨셉, 현황 요약
```

```
~/.openclaw/workspace/projects/for-paw/code/   ← 실제 코드 (React + Vite)
```

---

## 오케스트레이션 구조

| 역할 | 담당 | 이유 |
|------|------|------|
| 판단 / 파일관리 / 대화 정리 | 율이 (현재 에이전트) | 짧은 작업, 컨텍스트 유지 |
| 코드 생성 / 긴 문서 분석 | Ollama qwen3:32b | 토큰 절약, 긴 코드 생성 |
| 복잡한 디버깅 / 리팩토링 / 품질 | Claude Code (`claude --permission-mode bypassPermissions --print`) | 판단력 필요한 작업, Ollama가 못 풀 때 |
| 앱인토스 가이드라인 검수 | `scripts/appsintoss-mcp/query.py` | 앱인토스 llms.txt 캐시 활용 |

### 에이전트 선택 기준
- **Ollama 먼저:** 코드 신규 생성, 반복 작업, 긴 파일 → 토큰 절약
- **Claude Code로 전환:** 버그 추적, 복잡한 로직 개선, 앱인토스 가이드라인 반영 등 판단이 필요할 때
- **둘 다:** Ollama가 초안 → Claude Code가 검수/개선 (품질 최대화)

### Claude Code 호출 방법
```bash
cd ~/Projects/for-paw && claude --permission-mode bypassPermissions --print '작업 내용'
# 백그라운드로
cd ~/Projects/for-paw && claude --permission-mode bypassPermissions --print '작업 내용' &
```

### Ollama 호출 방법
```bash
curl -s http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen3:32b","stream":false,"think":false,"messages":[{"role":"user","content":"..."}]}' \
  | python3 -c "import sys,json; r=json.load(sys.stdin); print(r['message']['content'])"
```

### 앱인토스 문서 검색
```bash
python3 ~/.openclaw/workspace/scripts/appsintoss-mcp/query.py "네비게이션 바 구현"
python3 ~/.openclaw/workspace/scripts/appintos_search.py "토스 로그인"
```

---

## 개발 흐름

```
1. Ollama로 코드 생성 → /tmp/for_paw_code.txt
2. 율이가 파일 파싱해서 ~/Projects/for-paw/ 에 저장
3. npm install && npm run dev 테스트
4. 앱인토스 MCP로 가이드라인 검수
5. 결정사항 → DECISIONS.md 에 D-번호로 추가
```

---

## 현재 진행 상태 확인 방법

```bash
# 코드 있는지 확인
ls ~/Projects/for-paw/src/

# 실행 테스트
cd ~/Projects/for-paw && npm run dev

# Ollama 실행 중인지 확인
curl -s http://localhost:11434/api/tags | python3 -c "import sys,json; print([m['name'] for m in json.load(sys.stdin)['models']])"
```

---

## 채널 / 커뮤니케이션

- 그룹챗: `telegram:-5139070447` (수영님 + 영진님)
- 완성되면 그룹챗에 "For Paw 프로토타입 완성!" + 실행 방법 전달

---

## 절대 하지 말 것

- `~/.openclaw/workspace/` 에서 코딩에이전트 실행 금지
- AI 이미지 생성 API 연동 금지 (D-002 참고)
- 결정 번복 시 반드시 DECISIONS.md에 기록 후 진행
