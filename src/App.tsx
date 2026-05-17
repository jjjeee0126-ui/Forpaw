import { useState, useCallback, useEffect } from 'react';
import HomePage from './pages/HomePage';
import GeneratingPage from './pages/GeneratingPage';
import ResultPage from './pages/ResultPage';
import AdModal from './components/AdModal';
import CreditShop from './components/CreditShop';
import { getCreditStatus } from './utils/credits';
import type { CreditStatus } from './utils/credits';

export type AppStep = 'home' | 'generating' | 'result';

export interface GenerationResult {
  imageDataUrl: string;
  model: string;
  size: string;
}

export default function App() {
  const [step, setStep] = useState<AppStep>('home');
  const [petPhoto, setPetPhoto] = useState<string>('');
  const [petName, setPetName] = useState<string>('');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [showAd, setShowAd] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showBannerAd, setShowBannerAd] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);

  // 첫 로드 시 서버에서 크레딧 가져오기
  const refreshCredits = useCallback(async () => {
    try {
      const status = await getCreditStatus();
      setCreditStatus(status);
    } catch {
      // 세션 생성 실패 — 일단 null 유지
    }
  }, []);

  useEffect(() => { refreshCredits(); }, [refreshCredits]);

  // 크레딧 게이트
  const handleGenerate = useCallback((photo: string, name: string) => {
    setPetPhoto(photo);
    setPetName(name);
    setErrorMessage('');

    if (!creditStatus) return;

    if (creditStatus.freeRemaining > 0) {
      // 무료: 리워드 광고 모달 필수 + 배너
      setShowBannerAd(true);
      setShowAd(true);
    } else if (creditStatus.canGenerate) {
      // 유료: 바로 생성 + 배너 (서버에서 크레딧 차감)
      setShowBannerAd(true);
      setStep('generating');
    } else {
      setShowShop(true);
    }
  }, [creditStatus]);

  const handleAdComplete = useCallback(() => {
    setShowAd(false);
    // 서버에서 크레딧 차감 — 바로 생성 진행
    setStep('generating');
  }, []);

  const handleShopClose = useCallback(() => {
    setShowShop(false);
    refreshCredits();
  }, [refreshCredits]);

  const handleComplete = useCallback((res: GenerationResult) => {
    setResult(res);
    // 배너 광고는 ResultPage에서 표시 (showBannerAd 유지)
    setStep('result');
    refreshCredits();
  }, [refreshCredits]);

  // 생성 실패 — 서버에서 자동 환불됨
  const handleError = useCallback((message: string) => {
    setShowBannerAd(false);
    setErrorMessage(message);
    refreshCredits();
    setStep('home');
  }, [refreshCredits]);

  // 생성 중 취소
  const handleCancel = useCallback(() => {
    setShowBannerAd(false);
    refreshCredits();
    setStep('home');
  }, [refreshCredits]);

  const handleBackToHome = useCallback(() => {
    setShowBannerAd(false);
    refreshCredits();
    setStep('home');
  }, [refreshCredits]);

  return (
    <>
      {step === 'home' && (
        <HomePage
          onGenerate={handleGenerate}
          initialPhoto={petPhoto}
          initialName={petName}
          creditStatus={creditStatus}
          onOpenShop={() => setShowShop(true)}
          errorMessage={errorMessage}
        />
      )}
      {step === 'generating' && (
        <GeneratingPage
          petPhoto={petPhoto}
          petName={petName}
          onComplete={handleComplete}
          onError={handleError}
          onCancel={handleCancel}
        />
      )}
      {step === 'result' && (
        <ResultPage
          result={result!}
          petName={petName}
          showBannerAd={showBannerAd}
          onBack={handleBackToHome}
        />
      )}

      {showAd && (
        <AdModal
          purpose="free_generation"
          onComplete={handleAdComplete}
          onClose={() => setShowAd(false)}
        />
      )}

      {showShop && (
        <CreditShop
          onClose={handleShopClose}
          onUpdate={refreshCredits}
        />
      )}
    </>
  );
}
