import React, { useState } from 'react';
import '../App.css';

const Detail = () => {
  const [selectedTheme, setSelectedTheme] = useState(0);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const themes = [
    { name: 'Sunset', gradient: 'linear-gradient(to right, #FF7F50, #FF4500)' },
    { name: 'Ocean', gradient: 'linear-gradient(to right, #1E90FF, #00BFFF)' },
    { name: 'Forest', gradient: 'linear-gradient(to right, #228B22, #006400)' },
    { name: 'Desert', gradient: 'linear-gradient(to right, #F4A460, #D2691E)' },
    { name: 'Night', gradient: 'linear-gradient(to right, #000000, #1B1464)' },
    { name: 'Spring', gradient: 'linear-gradient(to right, #98FB98, #32CD32)' },
    { name: 'Autumn', gradient: 'linear-gradient(to right, #DEB887, #B8860B)' },
    { name: 'Polar', gradient: 'linear-gradient(to right, #ADD8E6, #87CEFA)' }
  ];

  const lockedThemes = [3, 4, 7];

  const handleThemeClick = (index) => {
    if (lockedThemes.includes(index)) {
      setIsAdModalOpen(true);
      setCountdown(5);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev === 1) {
            clearInterval(timer);
            setSelectedTheme(index);
            setIsAdModalOpen(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }
    setSelectedTheme(index);
  };

  return (
    <div className="container">
      <div className="card">
        <h1 className="card-title">상세 정보</h1>
        <div className="mb-6">
          <div 
            className="w-64 h-64 mb-4 rounded-full flex items-center justify-center"
            style={{ background: themes[selectedTheme].gradient }}
          >
            <div className="w-48 h-48 bg-white rounded-full flex items-center justify-center">
              <div className="text-2xl font-bold">하트 캐릭터</div>
            </div>
          </div>
          <div className="text-center mb-4">이름: 털뭉치</div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {themes.map((theme, index) => (
            <div 
              key={index} 
              className={`w-16 h-16 rounded-md cursor-pointer ${lockedThemes.includes(index) ? 'opacity-50' : ''}`} 
              style={{ background: theme.gradient }}
              onClick={() => handleThemeClick(index)}
            />
          ))}
        </div>

        {isAdModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg text-center">
              <p>광고 시청 후 테마를 해제할 수 있습니다.</p>
              <p className="text-2xl font-bold my-4">{countdown}</p>
              <button 
                className="bg-blue-500 text-white py-2 px-4 rounded-lg"
                onClick={() => {
                  setIsAdModalOpen(false);
                  clearInterval();
                }}
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Detail;