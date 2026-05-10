// === 크레딧 정책 상수 (UI 표시용) ===

export const CREDIT_POLICY = {
  FREE_GENERATIONS: 3,
  CREDITS_PER_GENERATION: 8,
  AD_REWARD_CREDITS: 1,
  MAX_DAILY_ADS: 10,
} as const;

export const CREDIT_PLANS = [
  { id: 'light', name: '라이트', credits: 16, price: 1200, badge: null },
  { id: 'basic', name: '베이직', credits: 40, price: 2900, badge: '인기' },
  { id: 'premium', name: '프리미엄', credits: 100, price: 5900, badge: '최저가' },
] as const;

export type PlanId = (typeof CREDIT_PLANS)[number]['id'];

export interface CreditStatus {
  credits: number;
  freeRemaining: number;
  adsToday: number;
  adsRemainingToday: number;
  canGenerate: boolean;
}

// === 세션 토큰 관리 ===

const TOKEN_KEY = 'forpaw_token';
const API_BASE = import.meta.env.VITE_API_BASE || '';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

async function ensureToken(): Promise<string> {
  let token = getToken();
  if (token) return token;

  const res = await fetch(`${API_BASE}/api/session`, { method: 'POST' });
  if (!res.ok) throw new Error('세션 생성 실패');
  const data = await res.json();
  token = data.token;
  setToken(token!);
  return token!;
}

function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// === Server API 호출 ===

export async function getCreditStatus(): Promise<CreditStatus> {
  const token = await ensureToken();
  const res = await fetch(`${API_BASE}/api/credits`, {
    headers: authHeaders(token),
  });
  if (res.status === 401) {
    // 토큰 만료 — 재발급
    localStorage.removeItem(TOKEN_KEY);
    const newToken = await ensureToken();
    const retry = await fetch(`${API_BASE}/api/credits`, {
      headers: authHeaders(newToken),
    });
    return retry.json();
  }
  if (!res.ok) throw new Error('크레딧 조회 실패');
  return res.json();
}

export async function purchaseCredits(planId: PlanId): Promise<{ credits: number }> {
  const token = await ensureToken();
  const res = await fetch(`${API_BASE}/api/credits/purchase`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ planId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '구매 실패' }));
    throw new Error(err.error);
  }
  return res.json();
}

export async function rewardAdWatch(): Promise<{ credits: number; adsToday: number }> {
  const token = await ensureToken();
  const res = await fetch(`${API_BASE}/api/credits/ad-reward`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '광고 보상 실패' }));
    throw new Error(err.error);
  }
  return res.json();
}

// 서버에서 크레딧을 차감하므로 클라이언트 spend/refund는 불필요
// generate-image API가 서버에서 크레딧 차감 + 실패 시 자동 환불 처리
