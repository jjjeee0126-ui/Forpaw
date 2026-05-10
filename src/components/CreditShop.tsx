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
  const [showAd, setShowAd] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);

  const handlePurchase = (planId: PlanId) => {
    // TODO: 실제 결제 연동 (토스페이먼츠)
    purchaseCredits(planId);
    const plan = CREDIT_PLANS.find((p) => p.id === planId)!;
    setPurchaseSuccess(plan.name);
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
    <div className={styles.overlay}>
      <div className={styles.sheet}>
        <div className={styles.header}>
          <h2 className={styles.title}>크레딧 충전</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        <div className={styles.balance}>
          <span className={styles.balanceLabel}>보유 크레딧</span>
          <span className={styles.balanceValue}>{status.credits}</span>
        </div>
        <div className={styles.info}>
          생성 1회 = {CREDIT_POLICY.CREDITS_PER_GENERATION}크레딧
        </div>

        <div className={styles.plans}>
          {CREDIT_PLANS.map((plan) => (
            <div key={plan.id} className={styles.planCard}>
              {plan.badge && <span className={styles.badge}>{plan.badge}</span>}
              <div className={styles.planCredits}>{plan.credits}</div>
              <div className={styles.planName}>{plan.name}</div>
              <button
                type="button"
                className={styles.buyButton}
                onClick={() => handlePurchase(plan.id)}
              >
                {plan.price.toLocaleString()}원
              </button>
            </div>
          ))}
        </div>

        <div className={styles.adSection}>
          <div className={styles.adSectionTitle}>무료 크레딧 받기</div>
          <div className={styles.adSectionDesc}>
            광고 시청 1회 = 1크레딧 (오늘 {status.adsRemainingToday}회 남음)
          </div>
          <button
            type="button"
            className={styles.adButton}
            disabled={status.adsRemainingToday <= 0}
            onClick={() => setShowAd(true)}
          >
            광고 보고 크레딧 받기
          </button>
        </div>

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
