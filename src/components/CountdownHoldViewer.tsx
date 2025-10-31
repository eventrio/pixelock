'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  src: string;
  seconds?: number;
  onExpire: () => void;
};

export default function CountdownHoldViewer({ src, seconds = 15, onExpire }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  const [revealed, setRevealed] = useState(false);
  const [remaining, setRemaining] = useState(seconds);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Dual-hold state (mobile only)
  const [holdA, setHoldA] = useState(false);
  const [holdB, setHoldB] = useState(false);
  const [showSecond, setShowSecond] = useState(false);

  // Pixel block size
  const BLOCK = 28;

  // Detect mobile/coarse pointer
  useEffect(() => {
    const coarse = typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches ||
       /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    setIsMobile(!!coarse);
  }, []);

  // Load image once
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      imgElRef.current = img;
      setImgLoaded(true);
      drawPixelated();
    };
    img.onerror = () => drawPixelated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Redraw concealed state on changes
  useEffect(() => {
    if (!revealed) drawPixelated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, imgLoaded]);

  // Responsive redraw
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => {
      if (!revealed) drawPixelated();
    });
    ro.observe(node);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update reveal based on holds
  useEffect(() => {
    const shouldReveal = isMobile ? (holdA && holdB) : holdA;
    setRevealed(shouldReveal);

    if (shouldReveal && !startedRef.current) {
      startedRef.current = true;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(() => {
        setRemaining((n) => {
          if (n <= 1) {
            window.clearInterval(intervalRef.current!);
            intervalRef.current = null;
            onExpire();
            return 0;
          }
          return n - 1;
        });
      }, 1000);
    }
  }, [holdA, holdB, isMobile, onExpire]);

  function startHoldA() {
    setHoldA(true);
    if (isMobile) setShowSecond(true);
  }
  function endHoldA() { setHoldA(false); }
  function startHoldB() { setHoldB(true); }
  function endHoldB() { setHoldB(false); }

  // Pixelation renderer
  function drawPixelated() {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = Math.max(1, Math.floor(container.clientWidth));
    const ch = Math.max(1, Math.floor(container.clientHeight));
    canvas.width = cw; canvas.height = ch;

    const img = imgElRef.current;
    if (!img) {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, cw, ch);
      return;
    }

    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) return;

    const scaledW = Math.max(1, Math.floor(cw / BLOCK));
    const scaledH = Math.max(1, Math.floor(ch / BLOCK));

    const ratio = Math.min(scaledW / iw, scaledH / ih);
    const tw = Math.max(1, Math.floor(iw * ratio));
    const th = Math.max(1, Math.floor(ih * ratio));
    const tx = Math.floor((scaledW - tw) / 2);
    const ty = Math.floor((scaledH - th) / 2);

    const off = document.createElement('canvas');
    off.width = scaledW; off.height = scaledH;
    const octx = off.getContext('2d'); if (!octx) return;

    octx.fillStyle = '#000';
    octx.fillRect(0, 0, scaledW, scaledH);
    octx.imageSmoothingEnabled = false;
    octx.drawImage(img, tx, ty, tw, th);

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);

    const ratioUp = Math.min(cw / scaledW, ch / scaledH);
    const upW = Math.floor(scaledW * ratioUp);
    const upH = Math.floor(scaledH * ratioUp);
    const upX = Math.floor((cw - upW) / 2);
    const upY = Math.floor((ch - upH) / 2);

    ctx.drawImage(off, upX, upY, upW, upH);
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div
        ref={containerRef}
        className="relative mx-auto h-[70vh] w-full overflow-hidden rounded-2xl border bg-black"
      >
        {/* Concealed (pixelated) */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full ${revealed ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        />
        {/* Revealed */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="shared"
          className={`absolute inset-0 h-full w-full object-contain ${revealed ? 'opacity-100' : 'opacity-0'} transition-opacity`}
          draggable={false}
        />
      </div>

      {/* Controls */}
      <div className="mt-4 flex items-center gap-3">
        {/* Primary hold button (always shown) */}
        <button
          type="button"
          className="btn-primary select-none"
          onMouseDown={startHoldA}
          onMouseUp={endHoldA}
          onMouseLeave={endHoldA}
          onTouchStart={startHoldA}
          onTouchEnd={endHoldA}
        >
          Press &amp; Hold to View
        </button>

        {/* Secondary hold button (mobile only; appears after first is held) */}
        {isMobile && showSecond && (
          <button
            type="button"
            className="btn-primary select-none"
            onMouseDown={startHoldB}
            onMouseUp={endHoldB}
            onMouseLeave={endHoldB}
            onTouchStart={startHoldB}
            onTouchEnd={endHoldB}
          >
            Hold with other thumb
          </button>
        )}

        <span className="text-sm text-gray-600">{remaining}s</span>
      </div>
    </div>
  );
}
