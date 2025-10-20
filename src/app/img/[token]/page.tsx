'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import RevealCanvas from '@/components/RevealCanvas';

type VerifyResp = { sessionId: string; error?: string };
type TicketResp = { ticket: string; error?: string };

export default function ViewPage() {
  const { token } = useParams<{ token: string }>();

  const [pin, setPin] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ticketUrl, setTicketUrl] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>('');

  // ---- API calls ----
  async function verify() {
    setStatusMsg('');
    const res = await fetch('/api/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, pin })
    });
    const json: VerifyResp = await res.json();
    if (!res.ok) {
      setStatusMsg(json.error || 'Incorrect PIN');
      return;
    }
    setSessionId(json.sessionId);
  }

  async function getTicket() {
    if (!sessionId) return;
    const res = await fetch('/api/view-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    const json: TicketResp = await res.json();
    if (!res.ok) {
      setStatusMsg(json.error || 'View expired');
      return;
    }
    // /api/render/<ticket> streams the image
    setTicketUrl(`/api/render/${json.ticket}`);
  }

  // After a successful unlock, automatically fetch a ticket
  useEffect(() => {
    if (!sessionId) return;
    setStatusMsg(
      'Hold the button to reveal. Releasing will re-cover instantly. Screenshots or recording will destroy image.'
    );
    getTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const totalMs =
    1000 *
    Number(
      (process.env.NEXT_PUBLIC_VIEW_SECONDS as any) ||
        (process.env.VIEW_SECONDS as any) ||
        15
    );

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Unlock Image</h1>

      {!sessionId ? (
        <div className="mt-4">
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="border rounded px-3 py-2 mr-2"
            maxLength={4}
            placeholder="4-digit PIN"
          />
          <button
            onClick={verify}
            className="px-4 py-2 rounded bg-[#008BF4] text-white"
          >
            Unlock
          </button>
          {statusMsg && (
            <p className="mt-3 text-sm text-red-600">{statusMsg}</p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-neutral-700 mb-2">{statusMsg}</p>

          {/* No more "Start Viewing" button — we show the pixelated image immediately.
              User presses & holds to reveal inside RevealCanvas. */}
          {ticketUrl && (
            <RevealCanvas
              ticketUrl={ticketUrl}
              totalRevealMs={totalMs}
              holdColor="#008BF4"
            />
          )}
        </div>
      )}
    </main>
  );
}
