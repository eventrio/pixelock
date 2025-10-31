'use client';

import { useState } from 'react';
import CountdownHoldViewer from '@/components/CountdownHoldViewer';

export default function UnlockClient({ token }: { token: string }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [secs, setSecs] = useState<number>(15);
  const [unlocking, setUnlocking] = useState(false);
  const [loading, setLoading] = useState(false);

  async function unlock() {
    if (!pin || loading) return;
    setError(null);
    setLoading(true);
    try {
      const r = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, pin }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || 'Unlock failed');
        return;
      }
      setSrc(j.signedUrl);
      setSecs(j.reveal_seconds ?? 15);
    } catch (e: any) {
      setError(e?.message || 'Unlock failed');
    } finally {
      setLoading(false);
      setUnlocking(false);
    }
  }

  function expired() {
    fetch('/api/expire', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    setSrc(null);
    setError('This share has expired.');
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <h1 className="mb-4 text-2xl font-bold">Unlock Image</h1>

      {!src ? (
        <div className="mb-4 flex items-center gap-3">
          <input
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
            }
            placeholder="Enter 4-digit PIN"
            className="w-44 rounded-xl border px-3 py-2"
            inputMode="numeric"
            maxLength={4}
          />
          <button
            type="button"
            className={`btn-primary transition-colors ${
              (unlocking || loading) ? 'bg-[#05024E] border-[#05024E]' : ''
            }`}
            onMouseDown={() => setUnlocking(true)}
            onMouseUp={() => setUnlocking(false)}
            onMouseLeave={() => setUnlocking(false)}
            onTouchStart={() => setUnlocking(true)}
            onTouchEnd={() => setUnlocking(false)}
            onClick={unlock}
            disabled={!pin || loading}
          >
            {loading ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      ) : (
        <CountdownHoldViewer src={src} seconds={secs} onExpire={expired} />
      )}

      {error && <div className="mt-4 text-red-600">{error}</div>}

      {src == null && (
        <div className="mt-8 rounded-xl border p-6 text-center text-gray-700">
          Start sharing your images with PIXELock for free.{' '}
          <a className="text-brand-blue underline" href="/">pixelock.cc</a>.
        </div>
      )}
    </div>
  );
}
