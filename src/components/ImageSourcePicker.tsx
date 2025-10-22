'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Max preview box height (≈ 250px). The image is contained within.
const PREVIEW_BOX_PX = 250;

type UploadResp = { token: string; pin: string; shareText: string };
type Props = {
  onUploaded: (resp: UploadResp) => void;
  /** PIN to authorize the upload (pass from parent). */
  pin?: string;
};

export default function ImageSourcePicker({ onUploaded, pin }: Props) {
  const [mode, setMode] = useState<'idle' | 'camera' | 'link'>('idle');
  const [busy, setBusy] = useState(false);

  // current file / preview
  const [file, setFile] = useState<File | null>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(null);

  // unified hidden input for device picking
  const deviceInputRef = useRef<HTMLInputElement | null>(null);

  // ----- Camera bits -----
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // start camera when switching to camera mode
    (async () => {
      if (mode !== 'camera') return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          (videoRef.current as HTMLVideoElement).srcObject = stream;
          await (videoRef.current as HTMLVideoElement).play();
        }
      } catch {
        alert('Camera not available or permission denied.');
        setMode('idle');
      }
    })();

    // stop camera when leaving
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [mode]);

  // cleanup preview blobs
  useEffect(() => {
    return () => {
      if (previewURL) URL.revokeObjectURL(previewURL);
    };
  }, [previewURL]);

  // ----- Upload helpers -----
  const uploadBlob = useCallback(
    async (blob: Blob, filename = 'photo.jpg') => {
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append('file', blob, filename);

        // Belt + suspenders: put PIN in headers and in form (server accepts either)
        const headers: Record<string, string> = {};
        if (pin && pin.trim()) {
          headers['Authorization'] = `Bearer ${pin}`;
          headers['X-Pin'] = pin;
          fd.append('pin', pin); // also include as form field
        }

        const res = await fetch('/api/upload', { method: 'POST', headers, body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Upload failed');

        onUploaded(json);

        // reset after successful upload
        setFile(null);
        if (previewURL) URL.revokeObjectURL(previewURL);
        setPreviewURL(null);
        setMode('idle');
      } catch (err: any) {
        alert(err.message || 'Upload failed');
      } finally {
        setBusy(false);
      }
    },
    [onUploaded, previewURL, pin]
  );

  // device file selection / drop
  const acceptFile = useCallback(
    (f: File) => {
      if (!f.type.startsWith('image/')) {
        alert('Please choose an image file.');
        return;
      }
      setFile(f);
      if (previewURL) URL.revokeObjectURL(previewURL);
      setPreviewURL(URL.createObjectURL(f));
    },
    [previewURL]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
  };

  const [isDropping, setIsDropping] = useState(false);
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    if (f) acceptFile(f);
    setIsDropping(false);
  };

  // capture from camera
  const captureAndUpload = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    const w = (video as HTMLVideoElement).videoWidth || 1280;
    const h = (video as HTMLVideoElement).videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video as HTMLVideoElement, 0, 0, w, h);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92)
    );
    // show preview in the box before uploading
    if (previewURL) URL.revokeObjectURL(previewURL);
    setPreviewURL(URL.createObjectURL(blob));
    await uploadBlob(blob, 'camera.jpg');
  };

  // From link
  const [linkUrl, setLinkUrl] = useState('');
  const uploadFromLink = async () => {
    if (!linkUrl) return;
    try {
      setBusy(true);
      // Try to fetch the image client-side (may fail due to CORS).
      const r = await fetch(linkUrl, { mode: 'cors' });
      if (!r.ok) throw new Error('Could not fetch that URL.');
      const blob = await r.blob();
      if (!blob.type.startsWith('image/')) {
        throw new Error('That URL did not return an image.');
      }
      // show preview
      if (previewURL) URL.revokeObjectURL(previewURL);
      setPreviewURL(URL.createObjectURL(blob));
      await uploadBlob(blob, 'link.jpg');
    } catch (e: any) {
      alert(e.message || 'Fetch from link failed. Some hosts block direct downloads (CORS).');
    } finally {
      setBusy(false);
    }
  };

  // Perform actual upload if a device file is selected and user clicks Upload
  const onUploadClick = async () => {
    if (!file) return;
    await uploadBlob(file, file.name);
  };

  // reset
  const cancelAll = () => {
    setMode('idle');
    setFile(null);
    setLinkUrl('');
    if (previewURL) URL.revokeObjectURL(previewURL);
    setPreviewURL(null);
  };

  return (
    <div className="w-full">
      {/* Hidden device input (used by both the drop area and "From device") */}
      <input
        ref={deviceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onInputChange}
      />

      {/* Drop zone / preview box */}
      <div
        className={[
          'rounded-2xl border',
          'bg-violet-50/60',
          isDropping ? 'ring-2 ring-violet-400' : 'border-neutral-200',
          'p-3',
        ].join(' ')}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDropping(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setIsDropping(false)}
        onDrop={onDrop}
        style={{ minHeight: PREVIEW_BOX_PX + 20 }}
      >
        <div
          className="flex items-center justify-center w-full rounded-xl bg-white"
          style={{ height: PREVIEW_BOX_PX }}
        >
          {previewURL ? (
            <img
              src={previewURL}
              alt="preview"
              className="max-h-full max-w-full object-contain"
              style={{ height: PREVIEW_BOX_PX, width: '100%' }}
              draggable={false}
            />
          ) : mode === 'camera' ? (
            <video
              ref={videoRef}
              className="w-full h-full object-contain bg-black rounded-xl"
              playsInline
              muted
              autoPlay
            />
          ) : (
            // Empty state → clicking anywhere here opens file picker
            <div
              className="flex flex-col items-center justify-center text-neutral-500 cursor-pointer"
              onClick={() => deviceInputRef.current?.click()}
            >
              {/* Photo indicator icon */}
              <svg
                width="88"
                height="88"
                viewBox="0 0 96 96"
                aria-hidden="true"
                className="mb-3 drop-shadow-sm"
              >
                <rect x="8" y="16" width="80" height="64" rx="12" fill="#7A8AA3" />
                <circle cx="64" cy="32" r="10" fill="white" />
                <path d="M20 68 L40 44 L58 60 L70 52 L84 68 Z" fill="white" opacity="0.95" />
                <path d="M20 68 L36 52 L46 60 L52 56 L64 68 Z" fill="white" opacity="0.85" />
                <rect x="8" y="16" width="80" height="64" rx="12" fill="none" stroke="rgba(0,0,0,0.12)" />
              </svg>

              <div className="font-medium">Drop files here</div>
              <div className="text-xs text-neutral-400">or choose an option below</div>
            </div>
          )}
        </div>
      </div>

      {/* Action list */}
      <div className="mt-4 space-y-2">
        {/* From device — click triggers the same hidden input */}
        <label
          className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-neutral-100 cursor-pointer select-none"
          onClick={() => deviceInputRef.current?.click()}
        >
          <span>📁</span>
          <span className="flex-1">From device</span>
        </label>

        {/* From link */}
        <div className="rounded-xl px-3 py-2 hover:bg-neutral-100">
          <button
            type="button"
            className="flex items-center gap-3 w-full text-left"
            onClick={() => setMode((m) => (m === 'link' ? 'idle' : 'link'))}
          >
            <span>🔗</span>
            <span className="flex-1">From link</span>
          </button>
          {mode === 'link' && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                className="flex-1 border rounded-lg px-3 py-2"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
              <button
                type="button"
                onClick={uploadFromLink}
                className="px-3 py-2 rounded-lg bg-black text-white disabled:opacity-50"
                disabled={busy || !linkUrl}
              >
                {busy ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          )}
        </div>

        {/* Camera (left-justified, no subtext) */}
        <button
          type="button"
          className="flex items-center gap-3 w-full rounded-xl px-3 py-2 hover:bg-neutral-100 text-left"
          onClick={() => setMode((m) => (m === 'camera' ? 'idle' : 'camera'))}
        >
          <span>📷</span>
          <span className="flex-1">Camera</span>
        </button>

        {/* Footer actions */}
        <div className="pt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={cancelAll}
            className="flex-1 px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200"
          >
            Cancel
          </button>

          {/* Upload button only for device-selected file */}
          <button
            type="button"
            onClick={onUploadClick}
            className="px-4 py-2 rounded-xl bg-[#008BF4] hover:bg-[#4fc3ec] text-white disabled:opacity-50"
            disabled={!file || busy || mode === 'camera'}
          >
            {busy ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
