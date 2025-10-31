'use client';
import { useEffect, useRef, useState } from 'react';

export default function CountdownHoldViewer({ src, seconds, onExpire }: { src: string; seconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (revealed && remaining > 0 && timerRef.current == null) {
      timerRef.current = window.setInterval(() => setRemaining((s) => s - 1), 1000);
    }
    if (remaining <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      onExpire();
    }
    return () => {};
  }, [revealed, remaining, onExpire]);

  function down() { setRevealed(true); }
  function up() { /* visual pixelate again handled by CSS */ }

  return (
    <div className="w-full">
      <div className="relative mx-auto mb-3 grid h-80 w-full max-w-3xl place-items-center overflow-hidden rounded-xl border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="shared" className={`h-full w-full object-contain ${revealed ? '' : 'blur-[8px] contrast-125'} transition`} />
        {!revealed && <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"8\" height=\"8\"><rect width=\"4\" height=\"4\" fill=\"%23ddd\"/><rect x=\"4\" y=\"4\" width=\"4\" height=\"4\" fill=\"%23ddd\"/></svg>')] opacity-60"/>}
      </div>
      <div className="flex items-center gap-3">
        <button
          className="btn-primary"
          onMouseDown={down}
          onMouseUp={up}
          onTouchStart={down}
          onTouchEnd={up}
          disabled={remaining <= 0}
        >
          Press & Hold to View
        </button>
        <div className="text-sm text-gray-700">{{Math.max(remaining, 0)}}s</div>
      </div>
    </div>
  );
}
