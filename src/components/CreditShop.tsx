import { useState } from 'react';
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
  const [status, setStatus] = useState<CreditStatus>(getCreditStatus());
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('basic');
  const [showAd, setShowAd] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);

  const activePlan = CREDIT_PLANS.find((p) => p.id === selectedPlan)!;

  const handlePurchase = () => {
    // TODO: 실제 결제 연동 (토스페이먼츠)
    purchaseCredits(selectedPlan);
    setPurchaseSuccess(activePlan.name);
    setStatus(getCreditStatus());
    onUpdate?.();
    setTimeout(() => setPurchaseSuccess(null), 2000);
  };

  const handleAdReward = () => {
    rewardAdWatch();
    setStatus(getCreditStatus());
    onUpdate?.();
    setShowAd(false);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />

        <div className={styles.balance}>
          <span className={styles.balanceLabel}>보유 크레딧</span>
          <span className={styles.balanceValue}>{status.credits}개</span>
        </div>

        {/* 베이직: 풀 너비 강조 카드 */}
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

        {/* 라이트 / 프리미엄: 보조 카드 */}
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

        {/* CTA: 결제하기 */}
        <button type="button" className={styles.ctaButton} onClick={handlePurchase}>
          {activePlan.price.toLocaleString()}원 결제하기
        </button>

        {/* 광고: 텍스트 링크로 강등 */}
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
