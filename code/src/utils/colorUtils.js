export function getDominantColors(canvas, numColors = 2) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const colorMap = new Map();

  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 128) continue;
    const r = Math.round(pixels[i] / 16) * 16;
    const g = Math.round(pixels[i + 1] / 16) * 16;
    const b = Math.round(pixels[i + 2] / 16) * 16;
    const color = `rgb(${r}, ${g}, ${b})`;
    colorMap.set(color, (colorMap.get(color) || 0) + 1);
  }

  const sortedColors = Array.from(colorMap.entries()).sort((a, b) => b[1] - a[1]);
  return sortedColors.slice(0, numColors).map(([color]) => color);
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function parseRgb(color) {
  const m = color.match(/\d+/g);
  return m ? m.map(Number) : [180, 120, 80];
}

export function getComplementaryColor(rgb) {
  const [r, g, b] = parseRgb(rgb);
  let [h, s, l] = rgbToHsl(r, g, b);
  h = (h + 120) % 360; // 삼각 배색 (120도)
  s = Math.min(s + 15, 100);
  l = l > 50 ? Math.max(l - 15, 35) : Math.min(l + 15, 65);
  const [nr, ng, nb] = hslToRgb(h, s, l);
  return `rgb(${nr}, ${ng}, ${nb})`;
}

export function getGradientColors(dominantColor) {
  const [r, g, b] = parseRgb(dominantColor);
  let [h, s] = rgbToHsl(r, g, b);

  const pastelS = Math.min(s * 0.4, 35);
  const pastelL = 90;

  const [r1, g1, b1] = hslToRgb(h, pastelS, pastelL);
  const [r2, g2, b2] = hslToRgb((h + 40) % 360, pastelS, pastelL + 3);

  return [
    `rgba(${r1}, ${g1}, ${b1}, 0.6)`,
    `rgba(${r2}, ${g2}, ${b2}, 0.6)`
  ];
}

export function lightenColor(rgb, amount) {
  const [r, g, b] = parseRgb(rgb);
  let [h, s, l] = rgbToHsl(r, g, b);
  l = Math.min(l + amount, 95);
  const [nr, ng, nb] = hslToRgb(h, s, l);
  return `rgb(${nr}, ${ng}, ${nb})`;
}
