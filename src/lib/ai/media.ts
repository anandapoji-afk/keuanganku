// Helper media sisi browser (kompres foto, rekaman suara -> WAV).
// fileToBase64 dipindah dari transaksi/page.tsx supaya dipakai ulang oleh input AI.

export function fileToBase64(file: File, maxSide = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_WIDTH = maxSide;
      const MAX_HEIGHT = maxSide;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Gagal memuat canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const quality = 0.8;
      const dataUrl = canvas.toDataURL(mimeType, quality);
      resolve(dataUrl.split(',')[1]);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}

// Rekaman browser (webm/mp4) -> WAV mono 16kHz base64. Gemini resmi mendukung
// WAV, sedangkan format MediaRecorder berbeda tiap browser (Chrome webm, Safari mp4).
export async function audioKeWavBase64(blob: Blob): Promise<string> {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  await ctx.close();

  const SR = 16000;
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * SR)), SR);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const pcm = (await off.startRendering()).getChannelData(0);

  const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const tulis = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  tulis(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  tulis(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SR, true);
  view.setUint32(28, SR * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tulis(36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  }

  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(new Blob([view], { type: 'audio/wav' }));
  });
}
