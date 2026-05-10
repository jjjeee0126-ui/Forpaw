import { useState, useEffect } from 'react';
import styles from './AdModal.module.css';

const AD_DURATION = 5;

interface AdModalProps {
  purpose: 'free_generation' | 'credit_reward';
  onComplete: () => void;
  onClose: () => void;
}

export default function AdModal({ purpose, onComplete, onClose }: AdModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(AD_DURATION);
  const adFinished = secondsLeft <= 0;

  useEffect(() => {
    if (adFinished) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, adFinished]);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.adArea}>
          <div className={styles.adLabel}>광고</div>
          <div className={styles.adContent}>
            <div className={styles.adPlaceholder}>리워드 광고 영역</div>
          </div>
        </div>

        {!adFinished ? (
          <div className={styles.timer}>{secondsLeft}초 후 닫을 수 있어요</div>
        ) : (
          <button type="button" className={styles.completeButton} onClick={onComplete}>
            {purpose === 'free_generation' ? '생성 시작하기' : '크레딧 받기'}
          </button>
        )}

        {!adFinished && (
          <button type="button" className={styles.closeButton} onClick={onClose}>
            닫기 (보상 없음)
          </button>
        )}
      </div>
    </div>
  );
}
