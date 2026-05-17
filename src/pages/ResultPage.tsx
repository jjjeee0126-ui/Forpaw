import { useState, useCallback } from 'react';
import type { GenerationResult } from '../App';
import styles from './ResultPage.module.css';

interface ResultPageProps {
  result: GenerationResult;
  petName: string;
  showBannerAd?: boolean;
  onBack: () => void;
}

export default function ResultPage({ result, petName, showBannerAd = false, onBack }: ResultPageProps) {
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);

  const handleSave = useCallback(async () => {
    try {
      const response = await fetch(result.imageDataUrl);
      const blob = await response.blob();

      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: `forpaw-${petName.toLowerCase()}.png`,
          types: [{ accept: { 'image/png': ['.png'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        setSaved(true);
        return;
      }

      const a = document.createElement('a');
      a.href = result.imageDataUrl;
      a.download = `forpaw-${petName.toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setSaved(true);
    } catch {
      const a = document.createElement('a');
      a.href = result.imageDataUrl;
      a.download = `forpaw-${petName.toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setSaved(true);
    }
  }, [result.imageDataUrl, petName]);

  const handleShare = useCallback(async () => {
    try {
      const response = await fetch(result.imageDataUrl);
      const blob = await response.blob();
      const file = new File([blob], `forpaw-${petName.toLowerCase()}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${petName}의 ForPaw 키링`,
          text: `${petName}의 폭신한 하트 키링을 만들었어요!`,
          files: [file],
        });
        setShared(true);
      } else {
        handleSave();
      }
    } catch {
      // share 취소 시 무시
    }
  }, [result.imageDataUrl, petName, handleSave]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.name}>{petName}</span>의
          <br />키링이 완성됐어요!
        </h1>
      </div>

      <div className={styles.imageWrap}>
        <div className={styles.imageCard}>
          <img
            src={result.imageDataUrl}
            alt={`${petName}의 하트 키링`}
            className={styles.resultImage}
          />
        </div>
        <p className={styles.meta}>
          {result.model} · {result.size}
        </p>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryAction}
          onClick={handleSave}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/>
          </svg>
          {saved ? '저장 완료!' : '이미지 저장하기'}
        </button>

        <button
          type="button"
          className={styles.secondaryAction}
          onClick={handleShare}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" fill="currentColor"/>
          </svg>
          {shared ? '공유 완료!' : '공유하기'}
        </button>
      </div>

      <button type="button" className={styles.backButton} onClick={onBack}>
        돌아가기
      </button>

      {showBannerAd && (
        <div className={styles.bannerAd}>
          <span className={styles.bannerLabel}>AD</span>
          <div className={styles.bannerContent}>광고 배너 영역</div>
        </div>
      )}
    </div>
  );
}
