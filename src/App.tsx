import { useState, useCallback } from 'react';
import HomePage from './pages/HomePage';
import GeneratingPage from './pages/GeneratingPage';
import ResultPage from './pages/ResultPage';
import AdModal from './components/AdModal';
import CreditShop from './components/CreditShop';
import { isInFreePhase, canGenerate, spendForGeneration, refundGeneration, getCreditStatus } from './utils/credits';
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
  const [creditStatus, setCreditStatus] = useState<CreditStatus>(getCreditStatus());

  // 크레딧 게이트: HomePage에서 생성 요청 시
  const handleGenerate = useCallback((photo: string, name: string) => {
    setPetPhoto(photo);
    setPetName(name);
    setErrorMessage('');

    if (isInFreePhase()) {
      // 무료: 리워드 광고 모달 필수 + 배너
      setShowBannerAd(true);
      setShowAd(true);
    } else if (canGenerate()) {
      // 유료: 모달 없이 바로 생성 + 배너
      spendForGeneration();
      setCreditStatus(getCreditStatus());
      setShowBannerAd(true);
      setStep('generating');
    } else {
      // 크레딧 부족: 충전 모달
      setShowShop(true);
    }
  }, []);

  const handleAdComplete = useCallback(() => {
    setShowAd(false);
    spendForGeneration();
    setCreditStatus(getCreditStatus());
    setStep('generating');
  }, []);

  const handleShopClose = useCallback(() => {
    setShowShop(false);
    setCreditStatus(getCreditStatus());
  }, []);

  const handleComplete = useCallback((res: GenerationResult) => {
    setResult(res);
    setShowBannerAd(false);
    setStep('result');
  }, []);

  // 생성 실패: 크레딧 환불 + 에러 메시지 전달
  const handleError = useCallback((message: string) => {
    refundGeneration();
    setShowBannerAd(false);
    setErrorMessage(message);
    setCreditStatus(getCreditStatus());
    setStep('home');
  }, []);

  const handleBackToHome = useCallback(() => {
    setShowBannerAd(false);
    setCreditStatus(getCreditStatus());
    setStep('home');
  }, []);

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
          showBannerAd={showBannerAd}
          onComplete={handleComplete}
          onError={handleError}
        />
      )}
      {step === 'result' && (
        <ResultPage
          result={result!}
          petName={petName}
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
          onUpdate={() => setCreditStatus(getCreditStatus())}
        />
      )}
    </>
  );
}
