import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

const Register = () => {
  const [step, setStep] = useState(1);
  const [petName, setPetName] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [base64Data, setBase64Data] = useState(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (selectedImage) {
      URL.revokeObjectURL(selectedImage);
    }

    const previewUrl = URL.createObjectURL(file);
    setSelectedImage(previewUrl);

    const reader = new FileReader();
    reader.onload = () => setBase64Data(reader.result);
    reader.readAsDataURL(file);
  };

  const analyzeAndGenerate = async () => {
    setStep(3);
    setError(null);

    try {
      // Step 1: GPT-4o Vision 털 분석
      setLoadingMessage('털 색상 분석 중...');

      const analysisRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: base64Data } },
                {
                  type: 'text',
                  text: 'Analyze this pet photo. Return JSON only: { "furColor": "hex color of main fur", "accentColor": "hex color of eyes or accent fur", "furType": "short|medium|long|curly", "bgColor1": "pastel hex for gradient start", "bgColor2": "pastel hex for gradient end" }. bgColors should be pastel versions of accentColor.',
                },
              ],
            },
          ],
          max_tokens: 200,
        }),
      });

      if (!analysisRes.ok) {
        throw new Error(`분석 실패 (${analysisRes.status})`);
      }

      const analysisData = await analysisRes.json();
      const raw = analysisData.choices[0].message.content;
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('분석 결과 파싱 실패');

      const colors = JSON.parse(jsonMatch[0]);
      setAnalysisResult(colors);

      // Step 2: DALL-E 3 이미지 생성
      setLoadingMessage('캐릭터 생성 중...');

      const imageRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: `A cute fluffy heart shape made of ${colors.furType} ${colors.furColor} fur, the pet name "${petName}" written in ${colors.accentColor} rounded bold font on the heart, soft pastel gradient background from ${colors.bgColor1} to ${colors.bgColor2}, kawaii illustration style, clean white background card, Instagram-worthy pet portrait`,
          size: '1024x1024',
          n: 1,
        }),
      });

      if (!imageRes.ok) {
        throw new Error(`이미지 생성 실패 (${imageRes.status})`);
      }

      const imageData = await imageRes.json();
      setGeneratedImageUrl(imageData.data[0].url);
      setStep(4);
    } catch (err) {
      setError(err.message);
      setStep(3); // 에러 상태 유지
    }
  };

  const handleSave = async () => {
    if (!generatedImageUrl) return;
    try {
      const res = await fetch(generatedImageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${petName}_furheart.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // 다운로드 fallback: 새 탭에서 열기
      window.open(generatedImageUrl, '_blank');
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div>
            <h2 style={styles.stepTitle}>1. 사진 업로드</h2>
            <div
              style={styles.uploadArea}
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedImage ? (
                <img src={selectedImage} alt="Preview" style={styles.previewImage} />
              ) : (
                <div style={styles.uploadPlaceholder}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>+</div>
                  <div>반려동물 사진을 선택해주세요</div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
            <button
              style={{ ...styles.button, opacity: selectedImage ? 1 : 0.4 }}
              disabled={!selectedImage}
              onClick={() => setStep(2)}
            >
              다음
            </button>
          </div>
        );

      case 2:
        return (
          <div>
            <h2 style={styles.stepTitle}>2. 이름 입력</h2>
            <input
              type="text"
              placeholder="반려동물 이름"
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              style={styles.input}
              autoFocus
            />
            <button
              style={{ ...styles.button, opacity: petName ? 1 : 0.4 }}
              disabled={!petName}
              onClick={analyzeAndGenerate}
            >
              분석 시작
            </button>
          </div>
        );

      case 3:
        return (
          <div style={styles.loadingContainer}>
            {error ? (
              <>
                <div style={styles.errorText}>{error}</div>
                <button style={styles.button} onClick={() => { setError(null); setStep(2); }}>
                  다시 시도
                </button>
              </>
            ) : (
              <>
                <div style={styles.loadingText}>{loadingMessage}</div>
                <div style={styles.spinner} />
              </>
            )}
          </div>
        );

      case 4:
        return (
          <div style={{
            ...styles.resultContainer,
            background: analysisResult
              ? `linear-gradient(180deg, ${analysisResult.bgColor1}, ${analysisResult.bgColor2})`
              : '#f5f5f5',
          }}>
            <img
              src={generatedImageUrl}
              alt={`${petName} FurHeart`}
              style={styles.generatedImage}
            />
            <div style={styles.petNameLabel}>{petName}</div>
            <div style={styles.buttonRow}>
              <button style={styles.actionButton} onClick={handleSave}>
                저장하기
              </button>
              <button
                style={{ ...styles.actionButton, ...styles.retryButton }}
                onClick={() => { setStep(2); setGeneratedImageUrl(null); }}
              >
                다시 만들기
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container">
      <div className="card" style={step === 4 ? { padding: 0, overflow: 'hidden' } : undefined}>
        {step !== 4 && <h1 className="card-title">새 친구 등록</h1>}
        {renderStep()}
      </div>
    </div>
  );
};

const styles = {
  stepTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    marginBottom: 16,
  },
  uploadArea: {
    width: '100%',
    aspectRatio: '1',
    borderRadius: 16,
    border: '2px dashed #ccc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    cursor: 'pointer',
    backgroundColor: '#fafafa',
  },
  uploadPlaceholder: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  input: {
    width: '100%',
    marginBottom: 16,
    padding: 12,
    fontSize: 16,
    borderRadius: 10,
    border: '1px solid #ddd',
  },
  button: {
    marginTop: 24,
    width: '100%',
    padding: '12px 24px',
    backgroundColor: '#3182F6',
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 384,
  },
  loadingText: {
    marginBottom: 16,
    fontSize: 18,
    color: '#555',
  },
  errorText: {
    marginBottom: 16,
    fontSize: 16,
    color: '#e53e3e',
    textAlign: 'center',
  },
  spinner: {
    width: 48,
    height: 48,
    border: '4px solid #e0e0e0',
    borderTop: '4px solid #3182F6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  resultContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 24px 32px',
  },
  generatedImage: {
    width: '100%',
    borderRadius: 12,
  },
  petNameLabel: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: 700,
    color: '#333',
  },
  buttonRow: {
    display: 'flex',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    padding: '12px 28px',
    backgroundColor: '#3182F6',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
  },
  retryButton: {
    backgroundColor: '#fff',
    color: '#3182F6',
    border: '1.5px solid #3182F6',
  },
};

export default Register;
