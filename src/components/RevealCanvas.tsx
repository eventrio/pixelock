'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  ticketUrl: string;               // /api/render/<ticket>
  totalRevealMs: number;           // e.g., 15000
  holdColor?: string;              // e.g., '#008BF4'
};

export default function RevealCanvas({
  ticketUrl,
  totalRevealMs,
  holdColor = '#008BF4',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);

  // Single HTMLImageElement we draw from
  const imgRef = useRef<HTMLImageElement | null>(null);

  // UI state
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(Math.max(1, totalRevealMs));

  // reveal state (ref so draw() reacts immediately)
  const revealingRef = useRef(false);

  // RAF loop
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // ---------------- Load image (onload only) ----------------
  function loadImage() {
    setReady(false);
    setError(null);
    revealingRef.current = false;
    stopTick();
    setRemaining(Math.max(1, totalRevealMs));

    // cleanup previous
    const old = imgRef.current;
    if (old) {
      old.onload = null;
      old.onerror = null;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous'; // same-origin route; safe for canvas
    imgRef.current = img;

    img.onload = () => {
      setReady(true);
      draw(); // initial covered draw
    };
    img.onerror = () => {
      setError('Could not load image');
      setReady(false);
      draw(); // draw placeholder
    };

    // Cache-bust to avoid any stale caching quirks
    const bust = (ticketUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    img.src = ticketUrl + bust;
  }

  useEffect(() => {
    loadImage();
    return () => {
      stopTick();
      const img = imgRef.current;
      if (img) {
        img.onload = null;
        img.onerror = null;
        imgRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketUrl, totalRevealMs]);

  // ---------------- Resize / viewport fit ----------------
  useEffect(() => {
    const ro = new ResizeObserver(() => draw());
    if (containerRef.current) ro.observe(containerRef.current);
    if (controlsRef.current) ro.observe(controlsRef.current);

    const onVV = () => draw();
    window.addEventListener('resize', onVV);
    window.visualViewport?.addEventListener('resize', onVV);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onVV);
      window.visualViewport?.removeEventListener('resize', onVV);
    };
  }, []);

  // Pause if tab hidden
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && revealingRef.current) stopReveal();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ---------------- Timer loop ----------------
  function startTick() {
    stopTick();
    lastTsRef.current = performance.now();

    const step = (now: number) => {
      if (!revealingRef.current) return;
      const last = lastTsRef.current ?? now;
      const delta = now - last;
      lastTsRef.current = now;

      setRemaining((r) => {
        const next = Math.max(0, r - delta);
        if (next <= 0) {
          revealingRef.current = false;
          draw();
          stopTick();
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
  }

  function stopTick() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTsRef.current = null;
  }

  // ---------------- Drawing ----------------
  function viewportH(): number {
    return Math.floor(window.visualViewport?.height ?? window.innerHeight);
  }

  function draw() {
    const cvs = canvasRef.current;
    const wrap = containerRef.current;
    const controls = controlsRef.current;
    const img = imgRef.current;
    if (!cvs || !wrap) return;

    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const W = Math.floor(wrap.clientWidth);

    // Fit within viewport
    const rect = wrap.getBoundingClientRect();
    const controlsH = Math.ceil(controls?.getBoundingClientRect().height ?? 56);
    const MARGIN = 24;
    const maxH = Math.max(220, Math.floor(viewportH() - rect.top - controlsH - MARGIN));

    // Placeholder frame if not ready
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      cvs.width = W;
      cvs.height = maxH;
      ctx.fillStyle = '#e5e5e5';
      ctx.fillRect(0, 0, W, maxH);
      return;
    }

    // Keep aspect, clamp height
    const aspect = img.naturalWidth / img.naturalHeight;
    let targetW = W;
    let targetH = Math.round(targetW / aspect);
    if (targetH > maxH) {
      targetH = maxH;
      targetW = Math.round(targetH * aspect);
    }

    cvs.width = targetW;
    cvs.height = targetH;
    ctx.clearRect(0, 0, targetW, targetH);

    if (revealingRef.current) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, targetW, targetH);
    } else {
      // Pixelate using downsample + nearest-neighbor upsample
      const BLOCK_PX = Number(process.env.NEXT_PUBLIC_PIXEL_BLOCK_PX || 28);
      const w = Math.max(4, Math.floor(targetW / BLOCK_PX));
      const h = Math.max(4, Math.floor(targetH / BLOCK_PX));

      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const octx = off.getContext('2d')!;
      octx.imageSmoothingEnabled = true;
      octx.drawImage(img, 0, 0, w, h);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, w, h, 0, 0, targetW, targetH);

      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, 0, targetW, targetH);
    }
  }

  // ---------------- Interaction ----------------
  function startReveal() {
    if (!ready || remaining <= 0) return;
    revealingRef.current = true;
    draw();      // reveal immediately
    startTick(); // start countdown
  }

  function stopReveal() {
    if (!revealingRef.current) return;
    revealingRef.current = false;
    stopTick();
    draw();      // re-cover immediately
  }

  const secs = Math.ceil(remaining / 1000);

  return (
    <div className="w-full select-none">
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-xl bg-black/5"
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-auto touch-none"
          onMouseDown={startReveal}
          onMouseUp={stopReveal}
          onMouseLeave={stopReveal}
          onTouchStart={(e) => { e.preventDefault(); startReveal(); }}
          onTouchEnd={(e) => { e.preventDefault(); stopReveal(); }}
        />
      </div>

      <div ref={controlsRef} className="mt-3 flex items-center gap-3">
        <button
          className="px-4 py-2 rounded-xl font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: holdColor }}
          onMouseDown={startReveal}
          onMouseUp={stopReveal}
          onMouseLeave={stopReveal}
          onTouchStart={(e) => { e.preventDefault(); startReveal(); }}
          onTouchEnd={(e) => { e.preventDefault(); stopReveal(); }}
          disabled={!ready || remaining <= 0}
          title={
            error
              ? 'Image failed to load'
              : !ready
              ? 'Loading image…'
              : remaining <= 0
              ? 'View time exhausted'
              : 'Press & hold to reveal'
          }
        >
          Press &amp; Hold to View
        </button>

        <span className="text-sm text-neutral-600">
          {error ? 'Load failed' : ready ? `${secs}s remaining` : 'Loading image…'}
        </span>

        {error && (
          <button
            onClick={loadImage}
            className="ml-auto px-3 py-1.5 rounded-lg border text-sm"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
