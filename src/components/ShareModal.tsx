'use client';

import { useEffect, useState } from 'react';

type Props = {
  open: boolean;
  link: string;     // e.g. https://pixelock.cc/img/abc123
  pin: string;      // e.g. 5521
  onClose: () => void;   // called only after a successful copy (Done)
  onCancel?: () => void; // optional: user cancels without copying
  lockUntilCopied?: boolean; // default true -> backdrop/ESC won’t close until copied
};

export default function ShareModal({
  open,
  link,
  pin,
  onClose,
  onCancel,
  lockUntilCopied = true,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payload = `An image has been shared with you!\nFollow the link:\n${link}\n\nPin: ${pin}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setError(null);
    } catch (e) {
      setError('Copy failed. Your browser may be blocking clipboard access.');
    }
  }

  // Optional: prevent accidental close/reload until copied
  useEffect(() => {
    if (!open || !lockUntilCopied) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!copied) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [open, copied, lockUntilCopied]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40"
      onClick={(e) => {
        if (!lockUntilCopied && e.target === e.currentTarget && onCancel) onCancel();
      }}
    >
      <div
        className="w-[560px] max-w-[95vw] rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-2xl font-bold">Share</h2>

        <p className="mb-4 text-gray-700 whitespace-pre-line">
          An image has been shared with you!{"\n"}
          Follow the link:
          {"\n"}
          <span className="select-all break-all font-medium text-gray-900">{link}</span>
          {"\n\n"}
          <span className="font-semibold">Pin:</span> <span className="font-bold">{pin}</span>
        </p>

        <div className="flex items-center gap-3">
          <button
            className="btn-ghost"
            onClick={() => (onCancel ? onCancel() : undefined)}
            disabled={lockUntilCopied && !copied}
            title={lockUntilCopied && !copied ? 'Copy to clipboard to enable closing' : 'Cancel'}
          >
            Cancel
          </button>

          <button
            className={`btn-primary ${copied ? '!bg-green-600' : ''}`}
            onClick={copy}
          >
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>

          <button
            className="btn-primary"
            disabled={!copied}
            onClick={onClose}
            title={!copied ? 'Copy to clipboard first' : 'Done'}
          >
            Done
          </button>
        </div>

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>
    </div>
  );
}
