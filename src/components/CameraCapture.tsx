'use client';
import { useEffect, useRef, useState } from 'react';
import { formatNowStamp } from '@/lib/util';

export default function CameraCapture({ onCapture }: { onCapture: (file: File | null) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    let s: MediaStream;
    (async () => {
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current!.srcObject = s; setStreaming(true);
      } catch (e) { console.warn(e); }
    })();
    return () => { s && s.getTracks().forEach(t => t.stop()); };
  }, []);

  async function snap() {
    const v = videoRef.current!; if (!v) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(v, 0, 0);
    // watermark
    const ts = formatNowStamp();
    const wm = `Pixelock.cc live photo ${ts}`;
    ctx.rotate(-Math.atan(c.height / c.width));
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.font = '48px sans-serif';
    ctx.fillText(wm, 40, c.height * 0.8);
    const blob = await new Promise<Blob | null>(res => c.toBlob(res, 'image/jpeg', 0.92));
    if (!blob) return;
    onCapture(new File([blob], `live_${Date.now()}.jpg`, { type: 'image/jpeg' }));
  }

  return (
    <div className="card p-4">
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} autoPlay playsInline className="h-full w-full object-contain" />
      </div>
      <div className="mt-3 flex gap-3">
        <button className="btn-ghost" onClick={() => onCapture(null)}>Cancel</button>
        <button className="btn-primary" onClick={snap} disabled={!streaming}>Take photo</button>
      </div>
    </div>
  );
}
