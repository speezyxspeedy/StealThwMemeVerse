import * as THREE from 'three';

function createCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createConveyorBeltTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(256, 512);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 256, 512);

  // Subtle ribbed rubber treads
  for (let y = 0; y < 512; y += 32) {
    ctx.fillStyle = y % 64 === 0 ? '#273549' : '#1b2638';
    ctx.fillRect(10, y, 236, 22);
  }

  // Forward glowing directional chevrons
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let y = 32; y < 512; y += 128) {
    ctx.beginPath();
    ctx.moveTo(56, y);
    ctx.lineTo(128, y + 48);
    ctx.lineTo(200, y);
    ctx.stroke();
  }

  // Safety yellow edge stripes
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, 12, 512);
  ctx.fillRect(244, 0, 12, 512);
  ctx.fillStyle = '#0f172a';
  for (let y = 0; y < 512; y += 48) {
    ctx.fillRect(0, y, 12, 24);
    ctx.fillRect(244, y + 24, 12, 24);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 7);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createPlazaTileTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 512);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 512, 512);

  const step = 128;
  for (let x = 0; x < 512; x += step) {
    for (let y = 0; y < 512; y += step) {
      const checker = ((x + y) / step) % 2 === 0;
      ctx.fillStyle = checker ? '#cbd5e1' : '#dce4ee';
      ctx.fillRect(x + 3, y + 3, step - 6, step - 6);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, y + 2, step - 4, step - 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createGrassTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 512);
  ctx.fillStyle = '#38a169';
  ctx.fillRect(0, 0, 512, 512);

  // Stylized warm/cool turf blades & gentle meadow patches
  for (let i = 0; i < 420; i++) {
    const x = (i * 73) % 512;
    const y = (i * 137) % 512;
    const r = 10 + (i % 24);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(74, 222, 128, 0.2)' : 'rgba(22, 101, 52, 0.16)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 650; i++) {
    const x = (i * 97) % 512;
    const y = (i * 59) % 512;
    ctx.fillStyle = i % 3 === 0 ? '#4ade80' : '#2f855a';
    ctx.fillRect(x, y, 3, 9);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
  grad.addColorStop(0, 'rgba(10, 15, 30, 0.65)');
  grad.addColorStop(0.65, 'rgba(10, 15, 30, 0.28)');
  grad.addColorStop(1, 'rgba(10, 15, 30, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const labelSpriteCache = new Map<string, THREE.CanvasTexture>();

export function createBillboardLabelTexture(
  title: string,
  subtitle: string,
  accentHex: string,
  badgeText?: string,
): THREE.CanvasTexture {
  const key = `${title}|${subtitle}|${accentHex}|${badgeText ?? ''}`;
  const cached = labelSpriteCache.get(key);
  if (cached) return cached;

  const [canvas, ctx] = createCanvas(512, 156);
  ctx.clearRect(0, 0, 512, 156);

  // Dark rounded placard
  const r = 24;
  ctx.fillStyle = 'rgba(10, 15, 28, 0.88)';
  ctx.beginPath();
  ctx.roundRect(12, 14, 488, 128, r);
  ctx.fill();

  // Accent outer frame
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(12, 14, 488, 128, r);
  ctx.stroke();

  // Top rarity/tag bar
  if (badgeText) {
    ctx.fillStyle = accentHex;
    ctx.font = '700 24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText.toUpperCase(), 256, 48);
  }

  // Main title
  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 36px "Bricolage Grotesque", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title.slice(0, 22), 256, badgeText ? 88 : 74);

  // Subtitle (price / income / status)
  ctx.fillStyle = '#fde047';
  ctx.font = '700 26px "JetBrains Mono", monospace';
  ctx.fillText(subtitle.slice(0, 28), 256, badgeText ? 124 : 114);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (labelSpriteCache.size > 180) {
    const firstKey = labelSpriteCache.keys().next().value;
    if (firstKey) {
      labelSpriteCache.get(firstKey)?.dispose();
      labelSpriteCache.delete(firstKey);
    }
  }
  labelSpriteCache.set(key, tex);
  return tex;
}
