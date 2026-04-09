import React, { useRef, useEffect } from 'react';
import { parseRgb, lightenColor } from '../utils/colorUtils';

function drawHeartPath(ctx, cx, cy, size) {
  const w = size;
  const h = size;
  ctx.beginPath();
  ctx.moveTo(cx, cy + h * 0.25);
  ctx.bezierCurveTo(cx, cy, cx - w * 0.5, cy, cx - w * 0.5, cy + h * 0.25);
  ctx.bezierCurveTo(cx - w * 0.5, cy + h * 0.55, cx, cy + h * 0.8, cx, cy + h);
  ctx.bezierCurveTo(cx, cy + h * 0.8, cx + w * 0.5, cy + h * 0.55, cx + w * 0.5, cy + h * 0.25);
  ctx.bezierCurveTo(cx + w * 0.5, cy, cx, cy, cx, cy + h * 0.25);
  ctx.closePath();
}

function isInsideHeart(px, py, cx, cy, size) {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  drawHeartPath(ctx, cx, cy, size);
  return ctx.isPointInPath(px, py);
}

function varyColorRgba(r, g, b, brightnessShift, opacity) {
  const shift = (Math.random() - 0.5) * 2 * brightnessShift;
  return `rgba(${Math.max(0, Math.min(255, r + shift))}, ${Math.max(0, Math.min(255, g + shift))}, ${Math.max(0, Math.min(255, b + shift))}, ${opacity})`;
}

const FurHeart = ({ furColor, accentColor, petName, size = 500 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const heartSize = size * 0.72;
    const cx = size / 2;
    // 하트가 약간 위쪽에 위치
    const heartTopY = size * 0.08;
    const heartCenterY = heartTopY + heartSize * 0.5;

    const [r, g, b] = parseRgb(furColor);

    // === 1. 하트 내부 clip → 베이스 + 털 ===
    ctx.save();
    drawHeartPath(ctx, cx, heartTopY, heartSize);
    ctx.clip();

    // 베이스 컬러
    ctx.fillStyle = furColor;
    ctx.fillRect(0, 0, size, size);

    // === 2. 털 질감 (clipped) ===
    const furCount = 2500;
    const minLen = heartSize * 0.08;
    const maxLen = heartSize * 0.15;

    for (let i = 0; i < furCount; i++) {
      // 하트 바운딩 박스 내 랜덤 위치
      const fx = cx - heartSize * 0.5 + Math.random() * heartSize;
      const fy = heartTopY + Math.random() * heartSize;

      // 방사형 방향: 하트 중심 → 바깥
      const dx = fx - cx;
      const dy = fy - heartCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const dirX = dx / dist;
      const dirY = dy / dist;

      const len = minLen + Math.random() * (maxLen - minLen);
      const endX = fx + dirX * len;
      const endY = fy + dirY * len;

      // 곡선 제어점 (약간 랜덤 오프셋)
      const cpX = fx + dirX * len * 0.5 + (Math.random() - 0.5) * len * 0.4;
      const cpY = fy + dirY * len * 0.5 + (Math.random() - 0.5) * len * 0.4;

      // 조명: 상단 좌측 밝게, 하단 우측 어둡게
      const lightAngle = Math.atan2(fy - heartTopY, fx - cx);
      const lightFactor = Math.cos(lightAngle + Math.PI * 0.75); // 좌상단 방향
      const brightnessShift = 20 + lightFactor * 40; // -20 ~ +60

      const opacity = 0.4 + Math.random() * 0.5;
      const furR = Math.max(0, Math.min(255, r + brightnessShift));
      const furG = Math.max(0, Math.min(255, g + brightnessShift));
      const furB = Math.max(0, Math.min(255, b + brightnessShift));

      // 뿌리 (두꺼운 pass)
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      ctx.strokeStyle = `rgba(${furR}, ${furG}, ${furB}, ${opacity})`;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 끝 (얇은 pass)
      ctx.beginPath();
      ctx.moveTo(fx + dirX * len * 0.4, fy + dirY * len * 0.4);
      ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      ctx.strokeStyle = `rgba(${furR}, ${furG}, ${furB}, ${opacity * 0.6})`;
      ctx.lineWidth = 0.3;
      ctx.stroke();
    }

    // === 3. 하이라이트 (상단 좌측 빛 반사) ===
    const hlX = cx - heartSize * 0.15;
    const hlY = heartTopY + heartSize * 0.25;
    const hlGrad = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, heartSize * 0.45);
    hlGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
    hlGrad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
    hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hlGrad;
    ctx.fillRect(0, 0, size, size);

    // 하단 우측 그림자
    const shX = cx + heartSize * 0.15;
    const shY = heartTopY + heartSize * 0.75;
    const shGrad = ctx.createRadialGradient(shX, shY, 0, shX, shY, heartSize * 0.4);
    shGrad.addColorStop(0, 'rgba(0,0,0,0.12)');
    shGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shGrad;
    ctx.fillRect(0, 0, size, size);

    ctx.restore(); // clip 해제

    // === 4. 외곽 삐져나오는 털 (clip 밖) ===
    const edgeFurCount = 400;
    const edgeOverhang = 10;

    for (let i = 0; i < edgeFurCount; i++) {
      // 하트 외곽 근처 점 생성
      const angle = Math.random() * Math.PI * 2;
      const edgeR = heartSize * 0.42 + Math.random() * heartSize * 0.08;
      const startX = cx + Math.cos(angle) * edgeR * 0.8;
      const startY = heartCenterY + Math.sin(angle) * edgeR * 0.7;

      // 하트 안쪽 점인지 확인 (대략적)
      if (!isInsideHeart(startX, startY, cx, heartTopY, heartSize)) continue;

      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      const len = 6 + Math.random() * edgeOverhang;
      const endX = startX + dirX * len;
      const endY = startY + dirY * len;
      const cpX = startX + dirX * len * 0.5 + (Math.random() - 0.5) * 4;
      const cpY = startY + dirY * len * 0.5 + (Math.random() - 0.5) * 4;

      const opacity = 0.3 + Math.random() * 0.4;
      const shift = (Math.random() - 0.5) * 40;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      ctx.strokeStyle = varyColorRgba(r, g, b, 20, opacity);
      ctx.lineWidth = 0.8 + Math.random() * 0.7;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // === 5. 이름 텍스트 ===
    if (petName) {
      const textY = heartTopY + heartSize + size * 0.08;
      const textColor = accentColor || furColor;
      const outlineColor = lightenColor(textColor, 30);

      ctx.font = '800 32px Nunito, "Arial Rounded MT Bold", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 외곽선
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeText(petName, cx, textY);

      // 텍스트 채우기
      ctx.fillStyle = textColor;
      ctx.fillText(petName, cx, textY);
    }

  }, [furColor, accentColor, petName, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
    />
  );
};

export default FurHeart;
