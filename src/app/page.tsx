'use client';
import { useMemo, useState } from 'react';
import Dropzone, { SelectedImage } from '@/components/Dropzone';
import CameraCapture from '@/components/CameraCapture';
import DonateGrid from '@/components/DonateGrid';
import Modal from '@/components/Modal';

export default function Home() {
  const [img, setImg] = useState<SelectedImage | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [share, setShare] = useState<{ url: string; pin: string } | null>(null);
  const canUpload = useMemo(() => !!img, [img]);

  async function upload() {
    if (!img) return;
    const body = new FormData();
    body.append('file', img.file);
    body.append('live', String(img.liveWatermarked ?? false));
    const r = await fetch('/api/upload', { method: 'POST', body });
    if (!r.ok) { alert('Upload failed'); return; }
    const meta = await r.json();
    const t = await fetch('/api/create-ticket', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ object_path: meta.path }) });
    const j = await t.json();
    if (!t.ok) { alert(j.error || 'Ticket failed'); return; }
    setShare({ url: `${location.origin}/img/${j.token}`, pin: j.pin });
  }

  return (
    <div>
      <section className="mt-6">
        <p className="mb-4 text-lg text-gray-700">Share images privately with a timed reveal.</p>
        <Dropzone onSelect={(sel) => setImg(sel)} />
        <div className="mx-auto mt-3 flex max-w-3xl items-center gap-3">
          <button className="btn-ghost" onClick={() => setImg(null)} disabled={!img}>Clear</button>
          <button className="btn-ghost" onClick={() => setShowCamera(true)}>Camera</button>
          <button className="btn-primary" onClick={upload} disabled={!canUpload}>Upload</button>
        </div>
      </section>

      {showCamera && (
        <div className="mt-6">
          <CameraCapture onCapture={(f) => { setShowCamera(false); if (f) setImg({ file: f, url: URL.createObjectURL(f), liveWatermarked: true }); }} />
        </div>
      )}

      <section id="faq" className="prose mt-16 max-w-3xl">
        <h2>FAQ</h2>
        <h3>What makes PIXELock “private”?</h3>
        <p>Images are stored privately in Supabase Storage and delivered via one-time view tickets. Recipients must enter a 4-digit PIN to unlock, and the image only reveals while they press &amp; hold. When time is up, the image can’t be viewed again.</p>
        <h3>Can someone still screenshot?</h3>
        <p>We discourage screenshots by revealing only while pressed and overlaying a watermark if a capture attempt is detected, but no web app can guarantee total prevention on every device. Share only with people you trust.</p>
        <h3>How long is the reveal time?</h3>
        <p>The default is 15 seconds total per share. You can press &amp; hold in bursts; the countdown only ticks while revealed.</p>
        <h3>Do images expire from storage?</h3>
        <p>Yes—shares auto-expire based on server rules. After expiry, the link and ticket stop working and the stored file is purged.</p>
        <h3>What file types and sizes are supported?</h3>
        <p>Common image formats (JPEG/PNG/WebP/HEIC on supported browsers). For best results, keep uploads under ~10 MB.</p>
        <h3>Does PIXELock keep EXIF/location data?</h3>
        <p>Files are stored as-is. We don’t display EXIF, but if you’re concerned, remove metadata before uploading.</p>
        <h3>My link says “expired” or won’t load—why?</h3>
        <p>Tickets are one-use and time-bound. If the viewer reloads or the time runs out, the link becomes invalid. Ask the sender to share a new one.</p>
      </section>

      <DonateGrid />

      <Modal open={!!share} onClose={() => setShare(null)}>
        {share && (
          <div>
            <h3 className="mb-2 text-2xl font-bold">Share</h3>
            <p className="text-lg">An image has been shared with you!<br/>Follow the link:</p>
            <p className="mt-2 break-all text-brand-ink text-lg font-semibold">{share.url}</p>
            <p className="mt-2 text-lg">Pin: <span className="font-extrabold">{share.pin}</span></p>
            <div className="mt-4 flex justify-end gap-3">
              <button className="btn-ghost" onClick={() => setShare(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => navigator.clipboard.writeText(`${share.url}\nPin: ${share.pin}`)}>Copy to clipboard</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
