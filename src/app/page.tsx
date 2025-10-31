'use client';

import { useMemo, useState } from 'react';
import Dropzone, { SelectedImage } from '@/components/Dropzone';
import CameraCapture from '@/components/CameraCapture';
import DonateGrid from '@/components/DonateGrid';
import Modal from '@/components/Modal';

export default function Home() {
  const [img, setImg] = useState<SelectedImage | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  // Share modal state + copy verification + toast
  const [share, setShare] = useState<{ url: string; pin: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const canUpload = useMemo(() => !!img && !uploading, [img, uploading]);

  function showToast(msg: string, ms = 2000) {
    setToast(msg);
    window.setTimeout(() => setToast(null), ms);
  }

  async function upload(selected?: SelectedImage) {
    const sel = selected ?? img;
    if (!sel || uploading) return;

    try {
      setUploading(true);
      showToast('Uploading…', 1200);

      const body = new FormData();
      body.append('file', sel.file);
      body.append('live', String(sel.liveWatermarked ?? false));

      const r = await fetch('/api/upload', { method: 'POST', body });
      if (!r.ok) throw new Error('Upload failed');
      const meta = await r.json();

      const t = await fetch('/api/create-ticket', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ object_path: meta.path }),
      });
      const j = await t.json();
      if (!t.ok) throw new Error(j.error || 'Ticket failed');

      setCopied(false);
      setShare({ url: `${location.origin}/img/${j.token}`, pin: j.pin });
      showToast('Ready to share');
    } catch (err: any) {
      alert(err?.message || 'Something went wrong');
    } finally {
      setUploading(false);
    }
  }

  async function copyShareToClipboard() {
    if (!share) return;
    const payload = `An image has been shared with you!
Follow the link:
${share.url}

Pin: ${share.pin}`;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      showToast('Copied to clipboard');
    } catch {
      showToast('Copy failed — check browser permissions');
    }
  }

  // NEW: unified clear/reset that wipes the modal + uploaded image
  function clearShareAndImage() {
    setShare(null);
    setImg(null);
    setCopied(false);
  }

  // Modal close now simply clears everything (no copy requirement)
  function handleModalClose() {
    clearShareAndImage();
  }

  // When the camera returns a file, show its preview AND immediately upload.
  async function handleCameraCapture(file: File | null) {
    setShowCamera(false);
    if (!file) return;
    const sel: SelectedImage = {
      file,
      url: URL.createObjectURL(file),
      liveWatermarked: true,
    };
    setImg(sel);          // show preview now
    await upload(sel);    // auto-upload → share modal
  }

  return (
    <div>
      {/* aligned tagline */}
      <section className="mt-6">
        <div className="mx-auto w-full max-w-3xl">
          <p className="mb-3 text-lg text-gray-700">
            Share images privately with a timed reveal.
          </p>
        </div>

        {/* Either camera OR dropzone stack */}
        <div className="mx-auto w-full max-w-3xl">
          {showCamera ? (
            <CameraCapture
              onCapture={handleCameraCapture}
              onCancel={() => setShowCamera(false)}
              onToast={(msg) => showToast(msg)}
            />
          ) : (
            <>
              <Dropzone
                onSelect={(sel) => setImg(sel)}
                inputId="pixelock-file"
                externalPreviewUrl={img?.url ?? null}
              />

              {/* Stacked source options */}
              <div className="mt-4 w-full space-y-3">
                <label
                  htmlFor="pixelock-file"
                  className="flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-left hover:bg-gray-50"
                >
                  <span aria-hidden className="inline-block h-5 w-5">📁</span>
                  <span className="select-none">From device</span>
                </label>

                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left hover:bg-gray-50"
                  onClick={() => setShowCamera(true)}
                >
                  <span aria-hidden className="inline-block h-5 w-5">📷</span>
                  <span>Camera</span>
                </button>
              </div>

              {/* Full width Cancel/Upload */}
              <div className="mt-4 w-full">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="btn-ghost w-full"
                    onClick={() => setImg(null)}
                    disabled={!img || uploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary w-full"
                    onClick={() => upload()}
                    disabled={!canUpload}
                  >
                    {uploading ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

{/* FAQ */}
<section id="faq" className="prose mx-auto mt-24 max-w-3xl">
  {/* Bigger, bold FAQ header */}
  <h2 className="!mt-0 !mb-6 !font-bold !text-[#05024E] !text-2xl md:!text-3xl">
    FAQ
  </h2>

  {/* keep questions semibold as before */}
  <h3 className="!mt-6 !mb-2 !font-semibold !text-[#05024E]">What makes PIXELock “private”?</h3>
  <p>Images are stored privately in Supabase Storage and delivered via one-time view tickets. Recipients must enter a 4-digit PIN to unlock, and the image only reveals while they press &amp; hold. When time is up, the image can’t be viewed again.</p>

  <h3 className="!mt-6 !mb-2 !font-semibold !text-[#05024E]">Can someone still screenshot?</h3>
  <p>We discourage screenshots by revealing only while pressed and overlaying a watermark if a capture attempt is detected, but no web app can guarantee total prevention on every device. Share only with people you trust.</p>

  <h3 className="!mt-6 !mb-2 !font-semibold !text-[#05024E]">How long is the reveal time?</h3>
  <p>The default is 15 seconds total per share. You can press &amp; hold in bursts; the countdown only ticks while revealed.</p>

  <h3 className="!mt-6 !mb-2 !font-semibold !text-[#05024E]">Do images expire from storage?</h3>
  <p>Yes—shares auto-expire based on server rules. After expiry, the link and ticket stop working and the stored file is purged.</p>

  <h3 className="!mt-6 !mb-2 !font-semibold !text-[#05024E]">What file types and sizes are supported?</h3>
  <p>Common image formats (JPEG/PNG/WebP/HEIC on supported browsers). For best results, keep uploads under ~10&nbsp;MB.</p>

  <h3 className="!mt-6 !mb-2 !font-semibold !text-[#05024E]">Does PIXELock keep EXIF/location data?</h3>
  <p>Files are stored as-is. We don’t display EXIF, but if you’re concerned, remove metadata before uploading.</p>

  <h3 className="!mt-6 !mb-2 !font-semibold !text-[#05024E]">My link says “expired” or won’t load—why?</h3>
  <p>Tickets are one-use and time-bound. If the viewer reloads or the time runs out, the link becomes invalid. Ask the sender to share a new one.</p>
</section>

      <DonateGrid />

      {/* Share modal */}
      <Modal open={!!share} onClose={handleModalClose}>
        {share && (
          <div>
            <h3 className="mb-2 text-2xl font-bold">Share</h3>
            <p className="text-lg">
              An image has been shared with you!
              <br />
              Follow the link:
            </p>
            <p className="mt-2 break-all text-brand-ink text-lg font-semibold">
              {share.url}
            </p>
            <p className="mt-2 text-lg">
              Pin: <span className="font-extrabold">{share.pin}</span>
            </p>

            <div className="mt-4 flex justify-end gap-3">
              {/* NEW: Cancel always available; clears modal + uploaded image */}
              <button
                type="button"
                className="btn-ghost"
                onClick={handleModalClose}
                title="Close and clear"
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn-primary"
                style={copied ? { backgroundColor: '#05024E', borderColor: '#05024E' } : undefined}
                onClick={copyShareToClipboard}
              >
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Toast */}
      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="rounded-xl bg-[#05024E] px-4 py-2 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
