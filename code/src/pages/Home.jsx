import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';

const mockData = [
  { name: 'Sunshine', furColor: '#FFD700', accentColor: '#FF69B4', gradient: 'linear-gradient(to right, #4B0082, #800080)' },
  { name: 'Ari', furColor: '#4682B4', accentColor: '#FFA500', gradient: 'linear-gradient(to right, #FFD700, #FFFF00)' },
  { name: 'Gureum', furColor: '#F0FFF0', accentColor: '#0000FF', gradient: 'linear-gradient(to right, #FF69B4, #FFB6C1)' },
  { name: 'Sangsil', furColor: '#FFFFFF', accentColor: '#FF69B4', gradient: 'linear-gradient(to right, #98FB98, #00FA9A)' },
  { name: 'Bam', furColor: '#000000', accentColor: '#39FF14', gradient: 'linear-gradient(to right, #39FF14, #00FF00)' }
];

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="container">
      <div className="card">
        <h1 className="card-title">For Paw</h1>
        <div className="grid grid-cols-2 gap-4">
          {mockData.map((pet, index) => (
            <div key={index} className="border rounded-lg p-4 flex flex-col items-center">
              <div style={{ width: 100, height: 100, backgroundColor: pet.furColor, borderRadius: '50%' }} />
              <h3 className="mt-2 font-semibold">{pet.name}</h3>
            </div>
          ))}
        </div>
        <button 
          className="mt-6 w-full bg-blue-500 text-white py-3 rounded-lg font-medium"
          onClick={() => navigate('/register')}
        >
          새 친구 등록
        </button>
      </div>
    </div>
  );
};

export default Home;