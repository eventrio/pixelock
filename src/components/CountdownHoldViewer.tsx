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

  const [remaining, setRemaining] = useState(seconds);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Robust mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const coarse =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches ||
        (navigator as any).maxTouchPoints > 0 ||
        /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    setIsMobile(!!coarse);
  }, []);

  // Dual-hold flags
  const [holdA, setHoldA] = useState(false);
  const [holdB, setHoldB] = useState(false);

  // Pixel block size
  const BLOCK = 28;

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.src = src;
    img.onload = () => {
      imgElRef.current = img;
      setImgLoaded(true);
      draw(false);
    };
    img.onerror = () => draw(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Redraw when state/size changes
  useEffect(() => {
    if (!imgLoaded) return;
    draw(revealed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, imgLoaded]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => draw(revealed));
    ro.observe(node);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  // Compute reveal
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

  // Pointer helpers (cover mouse, touch, pen)
  function downA(e: React.PointerEvent | React.MouseEvent | React.TouchEvent) {
    // prevent text selection / context menu / scroll-while-pressing
    // @ts-ignore
    if (e.preventDefault) e.preventDefault();
    setHoldA(true);
  }
  function upA() { setHoldA(false); }
  function downB(e: React.PointerEvent | React.MouseEvent | React.TouchEvent) {
    // @ts-ignore
    if (e.preventDefault) e.preventDefault();
    setHoldB(true);
  }
  function upB() { setHoldB(false); }

  // Canvas renderer
  function draw(showOriginal: boolean) {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = Math.max(1, Math.floor(container.clientWidth));
    const ch = Math.max(1, Math.floor(container.clientHeight));
    canvas.width = cw; canvas.height = ch;

    const img = imgElRef.current;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);
    if (!img) return;

    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) return;

    if (showOriginal) {
      const ratio = Math.min(cw / iw, ch / ih);
      const dw = Math.floor(iw * ratio);
      const dh = Math.floor(ih * ratio);
      const dx = Math.floor((cw - dw) / 2);
      const dy = Math.floor((ch - dh) / 2);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      const scaledW = Math.max(1, Math.floor(cw / BLOCK));
      const scaledH = Math.max(1, Math.floor(ch / BLOCK));
      const ratioDown = Math.min(scaledW / iw, scaledH / ih);
      const tw = Math.max(1, Math.floor(iw * ratioDown));
      const th = Math.max(1, Math.floor(ih * ratioDown));
      const tx = Math.floor((scaledW - tw) / 2);
      const ty = Math.floor((scaledH - th) / 2);

      const off = document.createElement('canvas');
      off.width = scaledW; off.height = scaledH;
      const octx = off.getContext('2d'); if (!octx) return;
      octx.imageSmoothingEnabled = false;
      octx.fillStyle = '#000';
      octx.fillRect(0, 0, scaledW, scaledH);
      octx.drawImage(img, tx, ty, tw, th);

      const ratioUp = Math.min(cw / scaledW, ch / scaledH);
      const upW = Math.floor(scaledW * ratioUp);
      const upH = Math.floor(scaledH * ratioUp);
      const upX = Math.floor((cw - upW) / 2);
      const upY = Math.floor((ch - upH) / 2);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, upX, upY, upW, upH);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div
        ref={containerRef}
        className="relative mx-auto h-[70vh] w-full select-none overflow-hidden rounded-2xl border bg-black"
        onContextMenu={(e) => e.preventDefault()}
        style={{
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* Controls row: keep on one line; allow horizontal scroll on tiny screens */}
      <div className="mt-4 flex flex-nowrap items-center gap-3 overflow-x-auto">
        {/* Primary hold (desktop & mobile) */}
        <button
          type="button"
          className="btn-primary shrink-0 select-none px-4 py-3 text-sm sm:text-base"
          onPointerDown={downA}
          onPointerUp={upA}
          onPointerCancel={upA}
          onPointerLeave={upA}
          onMouseDown={downA as any}
          onMouseUp={upA as any}
          onMouseLeave={upA as any}
          onTouchStart={downA as any}
          onTouchEnd={upA as any}
          style={{ touchAction: 'none' }}
        >
          1. Press &amp; Hold to View
        </button>

        {/* Secondary hold (mobile only) — salmon accent & to the right */}
        {isMobile && (
          <button
            type="button"
            className="shrink-0 select-none rounded-xl px-4 py-3 text-sm font-semibold text-white sm:text-base
                       bg-[#ED6F74] hover:bg-[#d85f64] active:bg-[#c8565b]
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ED6F74]"
            onPointerDown={downB}
            onPointerUp={upB}
            onPointerCancel={upB}
            onPointerLeave={upB}
            onMouseDown={downB as any}
            onMouseUp={upB as any}
            onMouseLeave={upB as any}
            onTouchStart={downB as any}
            onTouchEnd={upB as any}
            style={{ touchAction: 'none' }}
          >
            2. Hold with other thumb
          </button>
        )}

        <span className="ml-1 shrink-0 whitespace-nowrap text-sm text-gray-600">
          {remaining}s
        </span>
      </div>
    </div>
  );
}
