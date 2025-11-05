'use client';

import { useState } from 'react';

export default function DashboardLoginPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Login failed');
        setLoading(false);
        return;
      }

      window.location.href = '/dashboard';
    } catch (err) {
      console.error(err);
      setError('Network error');
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-xl font-semibold text-brand-ink">
        PIXELock Dashboard
      </h1>
      <p className="mb-4 text-sm text-gray-600">
        Enter your 10-digit admin PIN to view usage stats.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          value={pin}
          onChange={(e) =>
            setPin(e.target.value.replace(/\D/g, '').slice(0, 10))
          }
          placeholder="Admin PIN"
          inputMode="numeric"
          className="w-full rounded-xl border px-3 py-2 text-center tracking-[0.2em]"
        />
        {error && (
          <div className="text-sm text-red-600">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading || pin.length < 4}
          className="btn-primary w-full disabled:opacity-60"
        >
          {loading ? 'Checking…' : 'Unlock dashboard'}
        </button>
      </form>
    </div>
  );
}
