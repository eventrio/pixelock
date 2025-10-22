"use client";

import { useEffect, useMemo, useState } from 'react';
import ImageSourcePicker from '@/components/ImageSourcePicker';

type UploadResp = { token: string; pin: string; shareText: string };

export default function Home() {
  const [resp, setResp] = useState<UploadResp | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // ✅ Define the handler used by ImageSourcePicker
  function handleUploaded(data: UploadResp) {
    setResp(data);
    setShowModal(true);
    setCopied(false);
  }

  // Open modal automatically when an upload completes
  useEffect(() => {
    if (resp) {
      setShowModal(true);
      setCopied(false);
    }
  }, [resp]);

  // Absolute link text built from current origin (works in dev/prod)
  const shareHref = useMemo(() => {
    if (!resp) return '';
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL || '');
    return `${origin.replace(/\/+$/, '')}/img/${resp.token}`;
  }, [resp]);

  // Copy to clipboard (with fallback) + temporary “Copied!” state
  const copyShare = async () => {
    if (!resp) return;
    const text = `An image has been shared with you!
Follow the link: ${shareHref}
Pin: ${resp.pin}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Close modal on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-[#60CEF4]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="h-12 sm:h-14 flex items-center justify-between">
            <a href="#" className="inline-flex items-center gap-2">
              <img
                src="/pixelock_logo_text.png"
                alt="PIXELock"
                className="h-7 sm:h-8 w-auto"
              />
            </a>
            <nav className="flex items-center gap-6">
              <a href="#faq" className="text-[color:#050154] hover:underline">
                FAQ
              </a>
              <a href="#donate" className="text-[color:#050154] hover:underline">
                Donate
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-xl px-4 sm:px-6 py-6">
        {/* Keep the one-line tagline; title removed per request */}
        <p className="text-sm text-neutral-500 mb-2">
          Share images privately with a timed reveal.
        </p>

        {/* ✅ Uploader (no pin prop) */}
        <ImageSourcePicker onUploaded={handleUploaded} />

        {/* Inline Share box (kept) */}
        {resp && (
          <div className="mt-6 border rounded-xl p-4">
            <h2 className="font-semibold mb-2">Share</h2>
            <pre className="text-sm whitespace-pre-wrap">
{`An image has been shared with you!
Follow the link:
${shareHref}
Pin: ${resp.pin}`}
            </pre>
            <div className="mt-3">
              <button
                onClick={copyShare}
                className="px-3 py-2 rounded-lg border disabled:opacity-70"
                disabled={copied}
              >
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </button>
            </div>
          </div>
        )}

        {/* Spacer before sections */}
        <div className="h-16" />

        {/* ===================== FAQ ===================== */}
        <section id="faq" className="scroll-mt-20">
          <h3 className="text-xl font-semibold mb-4">FAQ</h3>

          <div className="space-y-5 text-[15px] leading-6 text-neutral-800">
            <div>
              <p className="font-medium">What makes PIXELock “private”?</p>
              <p className="text-neutral-600">
                Images are stored privately in Supabase Storage and delivered via one-time
                view tickets. Recipients must enter a 4-digit PIN to unlock, and the image
                only reveals while they press &amp; hold. When time is up, the image can’t be
                viewed again.
              </p>
            </div>

            <div>
              <p className="font-medium">Can someone still screenshot?</p>
              <p className="text-neutral-600">
                We discourage screenshots by revealing only while pressed and overlaying a
                watermark if a capture attempt is detected, but no web app can guarantee total
                prevention on every device. Share only with people you trust.
              </p>
            </div>

            <div>
              <p className="font-medium">How long is the reveal time?</p>
              <p className="text-neutral-600">
                The default is <code>{process.env.NEXT_PUBLIC_VIEW_SECONDS ?? process.env.VIEW_SECONDS ?? 15}</code> seconds total per share. You can press &amp; hold
                in bursts; the countdown only ticks while revealed.
              </p>
            </div>

            <div>
              <p className="font-medium">Do images expire from storage?</p>
              <p className="text-neutral-600">
                Yes—shares auto-expire based on server rules. After expiry, the link and ticket
                stop working and the stored file is purged.
              </p>
            </div>

            <div>
              <p className="font-medium">What file types and sizes are supported?</p>
              <p className="text-neutral-600">
                Common image formats (JPEG/PNG/WebP/HEIC on supported browsers). For best
                results, keep uploads under ~10&nbsp;MB.
              </p>
            </div>

            <div>
              <p className="font-medium">Does PIXELock keep EXIF/location data?</p>
              <p className="text-neutral-600">
                Files are stored as-is. We don’t display EXIF, but if you’re concerned, remove
                metadata before uploading.
              </p>
            </div>

            <div>
              <p className="font-medium">My link says “expired” or won’t load—why?</p>
              <p className="text-neutral-600">
                Tickets are one-use and time-bound. If the viewer reloads or the time runs out,
                the link becomes invalid. Ask the sender to share a new one.
              </p>
            </div>
          </div>
        </section>

        <div className="h-12" />

        {/* ===================== Donate (updated) ===================== */}
        <section id="donate" className="scroll-mt-20">
          <h3 className="text-xl font-semibold mb-3">Donate</h3>
          <p className="text-neutral-600 mb-4">
            PIXELock is a small indie project. If you’d like to support hosting and development, thank you! 🙏
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Buy Me a Coffee */}
            <a
              href="https://buymeacoffee.com/7pt5"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border p-4 hover:bg-neutral-50"
            >
              <div className="font-medium">Buy Me a Coffee</div>
              <div className="text-sm text-neutral-600">Quick one-time tip.</div>
            </a>

            {/* Bitcoin (QR) */}
            <div className="rounded-xl border p-4 hover:bg-neutral-50">
              <div className="font-medium mb-2">Bitcoin</div>
              <div className="flex items-center justify-center">
                <img
                  src="/pixelock_donate_btc_qr.png"
                  alt="Bitcoin donation QR"
                  className="h-24 w-24 sm:h-28 sm:w-28 object-contain"
                />
              </div>
              <div className="mt-2 text-xs break-all text-neutral-600">
                1M1zguCVH3846zE2LxFyNZ3EJLVg9qay1R
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText('1M1zguCVH3846zE2LxFyNZ3EJLVg9qay1R');
                    const btn = document.getElementById('btc-copy');
                    if (btn) {
                      const orig = btn.textContent;
                      btn.textContent = 'Copied!';
                      setTimeout(() => (btn.textContent = orig || 'Copy address'), 1200);
                    }
                  } catch {}
                }}
                id="btc-copy"
                className="mt-2 text-xs px-2 py-1 rounded-lg border"
              >
                Copy address
              </button>
            </div>

            {/* Follow on X */}
            <a
              href="https://x.com/returnEric"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border p-4 hover:bg-neutral-50"
            >
              <div className="font-medium">Follow on X</div>
              <div className="text-sm text-neutral-600">@returnEric</div>
            </a>

            {/* Contact */}
            <a
              href="mailto:hey@7pt5.com?subject=PIXELock%20Support"
              className="rounded-xl border p-4 hover:bg-neutral-50"
            >
              <div className="font-medium">Contact</div>
              <div className="text-sm text-neutral-600">Prefer another method? Email us.</div>
            </a>
          </div>

          {/* Primary donate button → BMC */}
          <div className="mt-5">
            <a
              href="https://buymeacoffee.com/7pt5"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-semibold text-white"
              style={{ backgroundColor: '#008BF4' }}
            >
              Donate now
            </a>
          </div>

          <p className="text-xs text-neutral-500 mt-3">
            Donations help cover storage, bandwidth, and privacy features. Thank you!
          </p>
        </section>
      </main>

      {/* Share Modal */}
      {showModal && resp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-xl mx-auto rounded-3xl bg-white p-6 shadow-xl" style={{ minHeight: 290 }}>
            <h3 className="text-2xl font-bold mb-4">Share</h3>

            <div className="space-y-4">
              <p className="text-base font-normal">
                An image has been shared with you!<br />
                Follow the link:
              </p>
              <a
                className="block text-lg font-medium break-all text-neutral-900 underline-offset-4 hover:underline"
                href={`/img/${resp.token}`}
              >
                {shareHref}
              </a>
              <p className="text-lg">
                <span className="font-medium">Pin:</span>{' '}
                <span className="font-bold">{resp.pin}</span>
              </p>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 rounded-xl border border-neutral-300 text-neutral-900 bg-transparent"
              >
                Close
              </button>
              <button
                type="button"
                onClick={copyShare}
                disabled={copied}
                className="ml-auto px-5 py-2.5 rounded-xl font-bold text-white disabled:opacity-70"
                style={{ backgroundColor: '#008BF4' }}
              >
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
