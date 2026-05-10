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

function getState(): CreditState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const initial: CreditState = {
      credits: 0,
      freeGenerationsUsed: 0,
      adsWatchedToday: 0,
      lastAdDate: null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(raw);
}

function setState(state: CreditState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetDailyAdsIfNeeded(state: CreditState): CreditState {
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastAdDate !== today) {
    state.adsWatchedToday = 0;
    state.lastAdDate = today;
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

export function spendForGeneration(): void {
  const state = getState();
  if (state.freeGenerationsUsed < CREDIT_POLICY.FREE_GENERATIONS) {
    state.freeGenerationsUsed += 1;
  } else {
    state.credits -= CREDIT_POLICY.CREDITS_PER_GENERATION;
  }
  setState(state);
}

export function rewardAdWatch(): boolean {
  let state = getState();
  state = resetDailyAdsIfNeeded(state);
  if (state.adsWatchedToday >= CREDIT_POLICY.MAX_DAILY_ADS) return false;
  state.credits += CREDIT_POLICY.AD_REWARD_CREDITS;
  state.adsWatchedToday += 1;
  setState(state);
  return true;
}

export function purchaseCredits(planId: PlanId): boolean {
  const plan = CREDIT_PLANS.find((p) => p.id === planId);
  if (!plan) return false;
  const state = getState();
  state.credits += plan.credits;
  setState(state);
  return true;
}

export function getCreditStatus(): CreditStatus {
  let state = getState();
  state = resetDailyAdsIfNeeded(state);
  setState(state);

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
