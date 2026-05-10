import { useState, useEffect } from 'react';
import {
  CREDIT_PLANS,
  CREDIT_POLICY,
  purchaseCredits,
  getCreditStatus,
  rewardAdWatch,
} from '../utils/credits';
import type { PlanId, CreditStatus } from '../utils/credits';
import AdModal from './AdModal';
import styles from './CreditShop.module.css';

interface CreditShopProps {
  onClose: () => void;
  onUpdate?: () => void;
}

export default function CreditShop({ onClose, onUpdate }: CreditShopProps) {
  const [status, setStatus] = useState<CreditStatus | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('basic');
  const [showAd, setShowAd] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  const activePlan = CREDIT_PLANS.find((p) => p.id === selectedPlan)!;

  useEffect(() => {
    getCreditStatus().then(setStatus).catch(() => {});
  }, []);

  const handlePurchase = async () => {
    if (purchasing) return;
    setPurchasing(true);
    setError('');
    try {
      await purchaseCredits(selectedPlan);
      setPurchaseSuccess(activePlan.name);
      const updated = await getCreditStatus();
      setStatus(updated);
      onUpdate?.();
      setTimeout(() => setPurchaseSuccess(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '구매 실패');
    } finally {
      setPurchasing(false);
    }
  };

  const handleAdReward = async () => {
    try {
      await rewardAdWatch();
      const updated = await getCreditStatus();
      setStatus(updated);
      onUpdate?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '광고 보상 실패');
    }
    setShowAd(false);
  };

  if (!status) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />

        <div className={styles.balance} aria-live="polite">
          <span className={styles.balanceLabel}>보유 크레딧</span>
          <span className={styles.balanceValue}>{status.credits}개</span>
        </div>

        <button
          type="button"
          className={`${styles.featuredCard} ${selectedPlan === 'basic' ? styles.selected : ''}`}
          onClick={() => setSelectedPlan('basic')}
        >
          <span className={styles.featuredBadge}>가장 인기</span>
          <div className={styles.featuredInfo}>
            <span className={styles.featuredCredits}>40 크레딧</span>
            <span className={styles.featuredDesc}>5회 생성</span>
          </div>
          <span className={styles.featuredPrice}>2,900원</span>
        </button>

        <div className={styles.subPlans}>
          <button
            type="button"
            className={`${styles.subCard} ${selectedPlan === 'light' ? styles.selected : ''}`}
            onClick={() => setSelectedPlan('light')}
          >
            <span className={styles.subCredits}>16 크레딧</span>
            <span className={styles.subDesc}>2회 생성</span>
            <span className={styles.subPrice}>1,200원</span>
          </button>
          <button
            type="button"
            className={`${styles.subCard} ${selectedPlan === 'premium' ? styles.selected : ''}`}
            onClick={() => setSelectedPlan('premium')}
          >
            <span className={styles.subBadge}>최저가</span>
            <span className={styles.subCredits}>100 크레딧</span>
            <span className={styles.subDesc}>12회 생성</span>
            <span className={styles.subPrice}>5,900원</span>
          </button>
        </div>

        <button
          type="button"
          className={styles.ctaButton}
          onClick={handlePurchase}
          disabled={purchasing}
        >
          {purchasing ? '처리 중...' : `${activePlan.price.toLocaleString()}원 결제하기`}
        </button>

        {error && <div className={styles.error}>{error}</div>}

        {status.adsRemainingToday > 0 && (
          <button
            type="button"
            className={styles.adLink}
            onClick={() => setShowAd(true)}
          >
            무료 크레딧이 필요하신가요? 광고 보기 →
          </button>
        )}

        {purchaseSuccess && (
          <div className={styles.toast}>{purchaseSuccess} 구매 완료!</div>
        )}

        {showAd && (
          <AdModal
            purpose="credit_reward"
            onComplete={handleAdReward}
            onClose={() => setShowAd(false)}
          />
        )}
      </div>
    </div>
  );
}
