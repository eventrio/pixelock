'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  src: string;
  seconds?: number;
  onExpire: () => void;
};

/**
 * Renders a pixelated version of the image in a <canvas> when concealed,
 * and the actual image when revealed. The countdown starts on first reveal
 * and keeps ticking regardless of hold state.
 */
export default function CountdownHoldViewer({ src, seconds = 15, onExpire }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  const [revealed, setRevealed] = useState(false);
  const [remaining, setRemaining] = useState(seconds);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Size of the blocks in the final display (px)
  const BLOCK = 28;

  // Load the image element once
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      imgElRef.current = img;
      setImgLoaded(true);
      drawPixelated(); // initial draw
    };
    img.onerror = () => {
      // Fall back to blank draw to avoid exceptions
      drawPixelated();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Redraw when concealed/revealed flips or when the container resizes
  useEffect(() => {
    if (!revealed) drawPixelated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, imgLoaded]);

  // Observe container size for responsive redraws
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

  // Start countdown on first reveal; keep ticking regardless of holding
  const startCountdownIfNeeded = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          window.clearInterval(intervalRef.current!);
          intervalRef.current = null;
          onExpire();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const holdStart = () => {
    setRevealed(true);
    startCountdownIfNeeded();
  };

  const holdEnd = () => {
    setRevealed(false);
  };

  // Core pixelation renderer
  function drawPixelated() {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = Math.max(1, Math.floor(container.clientWidth));
    const ch = Math.max(1, Math.floor(container.clientHeight));
    canvas.width = cw;
    canvas.height = ch;

    // Not loaded? fill with neutral background
    const img = imgElRef.current;
    if (!img) {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, cw, ch);
      return;
    }

    // Calculate target rect (object-contain)
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) return;

    // Downscale target to achieve ~BLOCK-size pixels when upscaled
    const scaledW = Math.max(1, Math.floor(cw / BLOCK));
    const scaledH = Math.max(1, Math.floor(ch / BLOCK));

    const ratio = Math.min(scaledW / iw, scaledH / ih);
    const tw = Math.max(1, Math.floor(iw * ratio));
    const th = Math.max(1, Math.floor(ih * ratio));
    const tx = Math.floor((scaledW - tw) / 2);
    const ty = Math.floor((scaledH - th) / 2);

    // Low-res offscreen buffer
    const off = document.createElement('canvas');
    off.width = scaledW;
    off.height = scaledH;
    const octx = off.getContext('2d');
    if (!octx) return;

    // Clear and draw low-res
    octx.fillStyle = '#000';
    octx.fillRect(0, 0, scaledW, scaledH);
    octx.imageSmoothingEnabled = false;
    octx.drawImage(img, tx, ty, tw, th);

    // Upscale to visible canvas without smoothing to get the blocky effect
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);

    // Compute upscale rect to object-contain inside the visible canvas
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
        // Allow pressing anywhere in the image area to reveal
        onMouseDown={holdStart}
        onMouseUp={holdEnd}
        onMouseLeave={holdEnd}
        onTouchStart={holdStart}
        onTouchEnd={holdEnd}
      >
        {/* Concealed view: pixelated canvas */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full ${revealed ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        />

        {/* Revealed view: the actual image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="shared"
          className={`absolute inset-0 h-full w-full object-contain ${revealed ? 'opacity-100' : 'opacity-0'} transition-opacity`}
          draggable={false}
        />
      </div>

      {/* Controls / countdown */}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          onMouseDown={holdStart}
          onMouseUp={holdEnd}
          onMouseLeave={holdEnd}
          onTouchStart={holdStart}
          onTouchEnd={holdEnd}
        >
          Press &amp; Hold to View
        </button>
        <span className="text-sm text-gray-600">{remaining}s</span>
      </div>
    </div>
  );
}
