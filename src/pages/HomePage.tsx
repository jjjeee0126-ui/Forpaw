import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import styles from './HomePage.module.css';
import type { CreditStatus } from '../utils/credits';
import { CREDIT_POLICY } from '../utils/credits';

interface HomePageProps {
  onGenerate: (photo: string, name: string) => void;
  initialPhoto?: string;
  initialName?: string;
  creditStatus?: CreditStatus;
  onOpenShop?: () => void;
  errorMessage?: string;
}

const MAX_NAME_LENGTH = 10;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('사진을 읽지 못했어요'));
    reader.readAsDataURL(file);
  });
}

export default function HomePage({
  onGenerate,
  initialPhoto = '',
  initialName = '',
  creditStatus,
  onOpenShop,
  errorMessage,
}: HomePageProps) {
  const [photo, setPhoto] = useState<string>(initialPhoto);
  const [name, setName] = useState<string>(initialName);
  const [photoFileName, setPhotoFileName] = useState<string>('');
  const [isNameTipOpen, setIsNameTipOpen] = useState<boolean>(() => {
    const seen = localStorage.getItem('forpaw_name_tip_seen');
    return !seen;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameTipRef = useRef<HTMLDivElement>(null);

  const handlePhotoChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPhoto(dataUrl);
      setPhotoFileName(file.name);
    } catch {
      alert('사진을 불러올 수 없어요. 다시 시도해 주세요.');
    }
  }, []);

  const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^a-zA-Z가-힣ㄱ-ㅎㅏ-ㅣ]/g, '');
    setName(raw.slice(0, MAX_NAME_LENGTH));
  }, []);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  useEffect(() => {
    if (!isNameTipOpen) {
      return;
    }

    const closeTip = () => {
      setIsNameTipOpen(false);
      localStorage.setItem('forpaw_name_tip_seen', '1');
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!nameTipRef.current?.contains(event.target as Node)) {
        closeTip();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeTip();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNameTipOpen]);

  const canGenerate = photo && name.trim().length > 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.badgeRow}>
          <p className={styles.badge}>ForPaw</p>
          {creditStatus && (
            <button type="button" className={styles.creditBadge} onClick={onOpenShop}>
              {creditStatus.freeRemaining > 0
                ? `무료 ${creditStatus.freeRemaining}회`
                : `${creditStatus.credits} 크레딧`}
            </button>
          )}
        </div>
        <h1 className={styles.title}>
          우리 아이 사진으로
          <br />
          <span className={styles.highlight}>폭신한 키링</span> 만들기
        </h1>
        <p className={styles.subtitle}>
          반려동물 사진과 이름을 입력하면, 털 색깔과 특징을 반영한
          귀여운 하트 키링 이미지를 만들어 드려요
        </p>
      </div>

      <div className={styles.form}>
        <div className={styles.section}>
          <label className={styles.label}>반려동물 사진</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className={styles.hiddenInput}
          />

          {photo ? (
            <button
              type="button"
              className={styles.photoPreviewWrap}
              onClick={handleUploadClick}
            >
              <img src={photo} alt="업로드된 사진" className={styles.photoPreview} />
              <div className={styles.photoOverlay}>
                <span className={styles.photoOverlayText}>다시 선택</span>
              </div>
            </button>
          ) : (
            <button
              type="button"
              className={styles.uploadArea}
              onClick={handleUploadClick}
            >
              <div className={styles.uploadIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor"/>
                </svg>
              </div>
              <span className={styles.uploadText}>사진 선택하기</span>
              <span className={styles.uploadHint}>
                정면 또는 3/4 구도의 사진이 잘 나와요
              </span>
            </button>
          )}
          {photoFileName && (
            <p className={styles.fileInfo}>{photoFileName}</p>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.labelRow} ref={nameTipRef}>
            <label className={styles.label} htmlFor="nameInput">
              이름 또는 이니셜
            </label>
            <button
              type="button"
              className={styles.tipButton}
              aria-label="이름 입력 도움말 보기"
              aria-expanded={isNameTipOpen}
              aria-controls="name-input-popper"
              onClick={() => setIsNameTipOpen((prev) => !prev)}
            >
              ?
            </button>

            {isNameTipOpen && (
              <div
                id="name-input-popper"
                role="dialog"
                aria-label="이름 입력 도움말"
                className={styles.popper}
              >
                <div className={styles.popperHeader}>
                  <strong className={styles.popperTitle}>이름은 이렇게 넣으면 좋아요</strong>
                  <button
                    type="button"
                    className={styles.popperClose}
                    aria-label="도움말 닫기"
                    onClick={() => { setIsNameTipOpen(false); localStorage.setItem('forpaw_name_tip_seen', '1'); }}
                  >
                    닫기
                  </button>
                </div>
                <p className={styles.popperDescription}>
                  실명 대신 평소 부르는 이름이나 짧은 이니셜을 넣어도 괜찮아요.
                </p>
                <div className={styles.popperExamples}>
                  <span className={styles.popperChip}>밤이</span>
                  <span className={styles.popperChip}>Bam</span>
                  <span className={styles.popperChip}>Ari</span>
                </div>
              </div>
            )}
          </div>
          <div className={styles.inputWrap}>
            <input
              id="nameInput"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="예: Bam, 밤이, Ari"
              maxLength={MAX_NAME_LENGTH}
              className={styles.textInput}
              autoComplete="off"
              spellCheck={false}
            />
            {name && (
              <span className={styles.charCount}>
                {name.length}/{MAX_NAME_LENGTH}
              </span>
            )}
          </div>
          <p className={styles.inputHint}>
            키링 하트 위에 자수 패치로 들어가요
          </p>
        </div>

        {name && (
          <div className={styles.previewChip}>
            <div className={styles.previewHeart}>
              <span className={styles.previewName}>{name}</span>
            </div>
            <p className={styles.previewCaption}>이런 느낌으로 만들어져요</p>
          </div>
        )}
      </div>

      <div className={styles.ctaWrap}>
        {creditStatus && creditStatus.freeRemaining > 0 && canGenerate && (
          <p className={styles.ctaHint}>광고 1회 시청 후 무료로 생성돼요</p>
        )}
        {creditStatus && creditStatus.freeRemaining <= 0 && !creditStatus.canGenerate && canGenerate && (
          <p className={styles.ctaHint}>크레딧이 부족해요</p>
        )}
        <button
          type="button"
          className={`${styles.ctaButton} ${canGenerate ? styles.ctaActive : ''}`}
          disabled={!canGenerate}
          onClick={() => onGenerate(photo, name)}
        >
          {creditStatus && creditStatus.freeRemaining > 0
            ? '광고 보고 무료 생성하기'
            : creditStatus?.canGenerate
              ? `키링 이미지 만들기 (${CREDIT_POLICY.CREDITS_PER_GENERATION}크레딧)`
              : '크레딧 충전하고 만들기'}
        </button>
      </div>

      {errorMessage && (
        <div className={styles.errorToast} role="alert">
          {errorMessage} — 크레딧이 환불됐어요
        </div>
      )}
    </div>
  );
}
