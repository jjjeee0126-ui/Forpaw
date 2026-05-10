// === 크레딧 정책 상수 ===

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

// === 상태 타입 ===

interface CreditState {
  credits: number;
  freeGenerationsUsed: number;
  adsWatchedToday: number;
  lastAdDate: string | null;
}

export interface CreditStatus {
  credits: number;
  freeGenerationsUsed: number;
  freeRemaining: number;
  adsWatchedToday: number;
  adsRemainingToday: number;
  canGenerate: boolean;
}

// === 내부 스토리지 ===

const STORAGE_KEY = 'forpaw_credits';

const INITIAL_STATE: CreditState = {
  credits: 0,
  freeGenerationsUsed: 0,
  adsWatchedToday: 0,
  lastAdDate: null,
};

function getState(): CreditState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setState(INITIAL_STATE);
      return { ...INITIAL_STATE };
    }
    const parsed = JSON.parse(raw);
    // 필수 필드 검증
    if (typeof parsed.credits !== 'number' || typeof parsed.freeGenerationsUsed !== 'number') {
      setState(INITIAL_STATE);
      return { ...INITIAL_STATE };
    }
    return parsed;
  } catch {
    setState(INITIAL_STATE);
    return { ...INITIAL_STATE };
  }
}

function setState(state: CreditState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function withDailyAdsReset(state: CreditState): CreditState {
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastAdDate !== today) {
    return { ...state, adsWatchedToday: 0, lastAdDate: today };
  }
  return state;
}

// === Public API ===

export function isInFreePhase(): boolean {
  return getState().freeGenerationsUsed < CREDIT_POLICY.FREE_GENERATIONS;
}

export function canGenerate(): boolean {
  const state = getState();
  if (state.freeGenerationsUsed < CREDIT_POLICY.FREE_GENERATIONS) return true;
  if (state.credits >= CREDIT_POLICY.CREDITS_PER_GENERATION) return true;
  return false;
}

// 생성 시 크레딧 차감
export function spendForGeneration(): void {
  const state = getState();
  if (state.freeGenerationsUsed < CREDIT_POLICY.FREE_GENERATIONS) {
    state.freeGenerationsUsed += 1;
  } else {
    state.credits -= CREDIT_POLICY.CREDITS_PER_GENERATION;
  }
  setState(state);
}

// 생성 실패 시 크레딧 환불
export function refundGeneration(): void {
  const state = getState();
  if (state.freeGenerationsUsed > 0 &&
      state.freeGenerationsUsed <= CREDIT_POLICY.FREE_GENERATIONS) {
    state.freeGenerationsUsed -= 1;
  } else {
    state.credits += CREDIT_POLICY.CREDITS_PER_GENERATION;
  }
  setState(state);
}

// 광고 시청 보상
export function rewardAdWatch(): boolean {
  let state = getState();
  state = withDailyAdsReset(state);
  if (state.adsWatchedToday >= CREDIT_POLICY.MAX_DAILY_ADS) return false;
  state.credits += CREDIT_POLICY.AD_REWARD_CREDITS;
  state.adsWatchedToday += 1;
  setState(state);
  return true;
}

// 크레딧 구매
export function purchaseCredits(planId: PlanId): boolean {
  const plan = CREDIT_PLANS.find((p) => p.id === planId);
  if (!plan) return false;
  const state = getState();
  state.credits += plan.credits;
  setState(state);
  return true;
}

// 전체 상태 조회 (읽기 전용 — 상태 변경 없음)
export function getCreditStatus(): CreditStatus {
  const state = withDailyAdsReset(getState());
  const freeRemaining = Math.max(0, CREDIT_POLICY.FREE_GENERATIONS - state.freeGenerationsUsed);

  return {
    credits: state.credits,
    freeGenerationsUsed: state.freeGenerationsUsed,
    freeRemaining,
    adsWatchedToday: state.adsWatchedToday,
    adsRemainingToday: CREDIT_POLICY.MAX_DAILY_ADS - state.adsWatchedToday,
    canGenerate: freeRemaining > 0 || state.credits >= CREDIT_POLICY.CREDITS_PER_GENERATION,
  };
}
