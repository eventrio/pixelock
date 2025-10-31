'use client';

import { useEffect, useRef, useState } from 'react';

type Facing = 'environment' | 'user';

export default function CameraCapture({
  onCapture,
  onCancel,
  onToast, // optional: use page-level toast
}: {
  onCapture: (file: File | null) => void;
  onCancel?: () => void;
  onToast?: (msg: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null); // visible after capture
  const workCanvasRef = useRef<HTMLCanvasElement | null>(null);    // offscreen full-res
  const streamRef = useRef<MediaStream | null>(null);

  const [facing, setFacing] = useState<Facing>('environment');
  const [ready, setReady] = useState(false);
  const [hasShot, setHasShot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  // local toast if parent doesn't provide one
  const [localToast, setLocalToast] = useState<string | null>(null);
  function toast(msg: string) {
    if (onToast) onToast(msg);
    else {
      setLocalToast(msg);
      setTimeout(() => setLocalToast(null), 1800);
    }
  }

  async function startCamera(mode: Facing) {
    stopCamera();
    setError(null);
    setReady(false);
    setHasShot(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      v.playsInline = true; // iOS
      v.muted = true;

      await new Promise<void>((resolve) => {
        const onMeta = () => {
          setReady(true);
          v.removeEventListener('loadedmetadata', onMeta);
          resolve();
        };
        if (v.readyState >= 1 && v.videoWidth && v.videoHeight) {
          setReady(true);
          resolve();
        } else {
          v.addEventListener('loadedmetadata', onMeta, { once: true });
        }
      });

      await v.play().catch(() => {});
    } catch (e: any) {
      setError(e?.message || 'Camera not available or permission denied.');
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await startCamera(facing);
    })();
    return () => {
      mounted = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  function toggleFacing() {
    setFacing((f) => (f === 'environment' ? 'user' : 'environment'));
  }

  async function takeShot() {
    const v = videoRef.current;
    const disp = displayCanvasRef.current;
    const work = workCanvasRef.current;
    if (!v || !disp || !work || !ready) return;

    // Ensure a painted frame (some browsers need a tick)
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r()))
    );

    const vw = v.videoWidth || 1280;
    const vh = v.videoHeight || 720;

    // Flash effect
    setFlash(true);
    setTimeout(() => setFlash(false), 120);

    // Offscreen full-res draw
    work.width = vw;
    work.height = vh;
    const wctx = work.getContext('2d');
    if (!wctx) return;
    wctx.drawImage(v, 0, 0, vw, vh);

    // Watermark
    const stamp = new Date().toLocaleString([], {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
    });
    const text = `pixelock.cc live photo ${stamp}`;
    const fontSize = Math.max(18, Math.floor(Math.min(vw, vh) / 20));
    wctx.save();
    wctx.translate(vw / 2, vh / 2);
    wctx.rotate((-22 * Math.PI) / 180);
    wctx.textAlign = 'center';
    wctx.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`;
    wctx.globalAlpha = 0.22; wctx.fillStyle = '#000'; wctx.fillText(text, 0, 0);
    wctx.globalAlpha = 0.12; wctx.fillStyle = '#fff'; wctx.fillText(text, 3, 3);
    wctx.restore();

    // Copy to visible canvas (same res; CSS scales)
    disp.width = vw;
    disp.height = vh;
    const dctx = disp.getContext('2d');
    if (!dctx) return;
    dctx.imageSmoothingEnabled = true;
    dctx.clearRect(0, 0, vw, vh);
    dctx.drawImage(work, 0, 0);

    setHasShot(true);
    toast('Captured');
  }

  function retake() {
    setHasShot(false);
  }

  async function usePhoto() {
    const work = workCanvasRef.current;
    if (!work) return;
    await new Promise<void>((r) => setTimeout(r, 0));
    work.toBlob(
      (blob) => {
        if (!blob) {
          onCapture(null);
          return;
        }
        const file = new File([blob], `pixelock_live_${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        stopCamera();
        onCapture(file);
      },
      'image/jpeg',
      0.92
    );
  }

  function cancel() {
    stopCamera();
    onCancel?.();
    onCapture(null);
  }

  return (
    <div className="rounded-2xl border p-4">
      {error && (
        <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Fixed-height container; both video & canvas are ALWAYS mounted */}
      <div className="relative mx-auto h-[60vh] w-full max-w-3xl overflow-hidden rounded-xl border bg-black">
        <video
          ref={videoRef}
          className={`absolute inset-0 block h-full w-full object-contain transition-opacity ${
            hasShot ? 'opacity-0' : 'opacity-100'
          }`}
          autoPlay
          playsInline
          muted
          style={{ transform: 'translateZ(0)' }}
        />
        <canvas
          ref={displayCanvasRef}
          className={`absolute inset-0 block h-full w-full object-contain bg-black transition-opacity ${
            hasShot ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ transform: 'translateZ(0)' }}
        />

        {/* Flash overlay */}
        <div
          className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-150 ${
            flash ? 'opacity-80' : 'opacity-0'
          }`}
        />

        {/* Offscreen work canvas */}
        <canvas ref={workCanvasRef} className="hidden" />
      </div>

      <div className="mx-auto mt-4 grid w-full max-w-3xl grid-cols-3 gap-3">
        {!hasShot ? (
          <>
            <button className="btn-ghost" onClick={cancel}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={takeShot}
              disabled={!ready}
              title={ready ? 'Capture photo' : 'Camera starting…'}
            >
              Capture
            </button>
            <button className="btn-ghost" onClick={toggleFacing} title="Switch camera">
              {facing === 'environment' ? 'Front camera' : 'Back camera'}
            </button>
          </>
        ) : (
          <>
            <button className="btn-ghost" onClick={retake}>
              Retake
            </button>
            <button className="btn-ghost" onClick={cancel}>
              Cancel
            </button>
            <button className="btn-primary" onClick={usePhoto}>
              Use photo
            </button>
          </>
        )}
      </div>

      {/* Local toast (used only if parent didn't pass onToast) */}
      {localToast && (
        <div className="fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div className="rounded-xl bg-[#05024E] px-4 py-2 text-sm font-medium text-white shadow-lg">
            {localToast}
          </div>
        </div>
      )}
    </div>
  );
}
