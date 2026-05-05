import { useState, useCallback } from 'react';
import HomePage from './pages/HomePage';
import GeneratingPage from './pages/GeneratingPage';
import ResultPage from './pages/ResultPage';

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

  const handleGenerate = useCallback((photo: string, name: string) => {
    setPetPhoto(photo);
    setPetName(name);
    setStep('generating');
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
  }, []);

  switch (step) {
    case 'home':
      return (
        <HomePage
          onGenerate={handleGenerate}
          initialPhoto={petPhoto}
          initialName={petName}
        />
      );
    case 'generating':
      return (
        <GeneratingPage
          petPhoto={petPhoto}
          petName={petName}
          onComplete={handleComplete}
          onError={handleError}
        />
      );
    case 'result':
      return (
        <ResultPage
          result={result!}
          petName={petName}
          onBack={handleBackToHome}
        />
      );
  }
}
