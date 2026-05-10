import { useState, useCallback } from 'react';
import HomePage from './pages/HomePage';
import GeneratingPage from './pages/GeneratingPage';
import ResultPage from './pages/ResultPage';
import AdModal from './components/AdModal';
import CreditShop from './components/CreditShop';
import { isInFreePhase, canGenerate, spendForGeneration, getCreditStatus } from './utils/credits';
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
  const [creditStatus, setCreditStatus] = useState<CreditStatus>(getCreditStatus());

  // 크레딧 게이트: HomePage에서 생성 요청 시
  const handleGenerate = useCallback((photo: string, name: string) => {
    setPetPhoto(photo);
    setPetName(name);

    if (isInFreePhase()) {
      // 무료 기간: 광고 1회 필수
      setShowAd(true);
    } else if (canGenerate()) {
      // 크레딧 충분: 바로 진행
      spendForGeneration();
      setCreditStatus(getCreditStatus());
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
    setStep('result');
  }, []);

  const handleError = useCallback(() => {
    setStep('home');
  }, []);

  const handleBackToHome = useCallback(() => {
    setStep('home');
    setCreditStatus(getCreditStatus());
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
        />
      )}
      {step === 'generating' && (
        <GeneratingPage
          petPhoto={petPhoto}
          petName={petName}
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
