'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export default function CountdownHoldViewer({
  src,
  seconds = 15,
  onExpire,
}: {
  src: string;
  seconds?: number;
  onExpire: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [remaining, setRemaining] = useState(seconds);
  const startedRef = useRef(false); // once user reveals, countdown keeps ticking

  // Build a safe, encoded SVG "mosaic" overlay
  const BLOCK = 28; // px “block size”
  const mosaicUrl = useMemo(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${BLOCK}" height="${BLOCK}">
      <rect width="${BLOCK / 2}" height="${BLOCK / 2}" fill="#ddd"/>
      <rect x="${BLOCK / 2}" y="${BLOCK / 2}" width="${BLOCK / 2}" height="${BLOCK / 2}" fill="#ddd"/>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [BLOCK]);

  // Countdown: starts on first reveal and ticks regardless of holding
  useEffect(() => {
    if (!startedRef.current && revealed) {
      startedRef.current = true;
    }
  }, [revealed]);

  useEffect(() => {
    if (!startedRef.current) return;
    if (remaining <= 0) {
      onExpire();
      return;
    }
    const t = setInterval(() => setRemaining((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [remaining, onExpire]);

  // Pointer handlers for press & hold
  function holdStart() {
    setRevealed(true);
  }
  function holdEnd() {
    setRevealed(false);
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div
        className="relative mx-auto h-[70vh] w-full overflow-hidden rounded-2xl border bg-black"
        onMouseDown={holdStart}
        onMouseUp={holdEnd}
        onMouseLeave={holdEnd}
        onTouchStart={holdStart}
        onTouchEnd={holdEnd}
      >
        {/* image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="shared"
          className={`absolute inset-0 h-full w-full object-contain transition ${
            revealed ? '' : 'blur-[8px] contrast-125'
          }`}
        />

        {/* safe mosaic overlay via style instead of Tailwind arbitrary bg url */}
        {!revealed && (
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{ backgroundImage: `url(${mosaicUrl})` }}
          />
        )}
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
