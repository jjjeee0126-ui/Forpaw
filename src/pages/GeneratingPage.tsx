import { useEffect, useRef, useState } from 'react';
import type { GenerationResult } from '../App';
import { generateKeyringImage } from '../api/generate';
import styles from './GeneratingPage.module.css';

interface GeneratingPageProps {
  petPhoto: string;
  petName: string;
  showBannerAd?: boolean;
  onComplete: (result: GenerationResult) => void;
  onError: (message: string) => void;
}

const TIPS = [
  '반려동물의 털 색깔을 분석하고 있어요',
  '눈동자 색과 포인트 컬러를 찾고 있어요',
  '폭신폭신한 하트 모양을 만들고 있어요',
  '자수 패치에 이름을 새기고 있어요',
  '마지막으로 다듬고 있어요',
];

export default function GeneratingPage({
  petPhoto,
  petName,
  showBannerAd = false,
  onComplete,
  onError,
}: GeneratingPageProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const calledRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => Math.min(prev + Math.random() * 8, 90));
    }, 600);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    generateKeyringImage(petPhoto, petName)
      .then((result) => {
        setProgress(100);
        setTimeout(() => onComplete(result), 400);
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : '이미지 생성에 실패했어요');
      });
  }, [petPhoto, petName, onComplete]);

  if (errorMsg) {
    return (
      <div className={styles.page}>
        <div className={styles.errorWrap}>
          <div className={styles.errorIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className={styles.errorTitle}>앗, 문제가 생겼어요</h2>
          <p className={styles.errorText}>{errorMsg}</p>
          <button type="button" className={styles.retryButton} onClick={() => onError(errorMsg)}>
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.petThumb}>
          <img src={petPhoto} alt={petName} className={styles.petImage} />
        </div>

        <h2 className={styles.title}>
          <span className={styles.name}>{petName}</span>의 키링을
          <br />
          만들고 있어요
        </h2>

        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className={styles.progressPercent}>{Math.round(progress)}%</span>
        </div>

        <p className={styles.tip} key={tipIndex}>{TIPS[tipIndex]}</p>

        <div className={styles.dots}>
          <span className={styles.dot} style={{ animationDelay: '0s' }} />
          <span className={styles.dot} style={{ animationDelay: '0.2s' }} />
          <span className={styles.dot} style={{ animationDelay: '0.4s' }} />
        </div>
      </div>

      {showBannerAd && (
        <div className={styles.bannerAd}>
          <span className={styles.bannerLabel}>AD</span>
          <div className={styles.bannerContent}>광고 배너 영역</div>
        </div>
      )}
    </div>
  );
}
