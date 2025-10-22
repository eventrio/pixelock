"use client";

import { useRef, useState } from "react";

export default function UploadPage() {
  const [pin, setPin] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function onUpload() {
    try {
      if (!file) throw new Error("Pick a file");
      if (!pin.trim()) throw new Error("Enter your PIN");

      setBusy(true);
      setStatus("Uploading…");

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pin}`, // primary
          "X-Pin": pin,                   // fallback (if Authorization is stripped)
        },
        body: fd,
      });

      const json = (await res.json().catch(() => ({}))) as any;

      if (!res.ok) {
        const msg = typeof json?.error === "string" ? json.error : "Upload failed";
        throw new Error(msg);
      }

      // Success
      setStatus(`✅ Uploaded: ${json?.path ?? "OK"}`);
      setPin("");          // clear PIN from memory
      setFile(null);       // clear selected file
      if (fileInputRef.current) fileInputRef.current.value = ""; // reset input element
    } catch (e: any) {
      setStatus(`❌ ${e?.message || "Upload failed"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-xl font-semibold">Upload</h1>

      <label className="block space-y-1">
        <span className="text-sm">PIN</span>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="mt-1 w-full rounded border p-2"
          placeholder="Enter PIN"
          inputMode="numeric"
          autoComplete="off"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm">File</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 w-full"
        />
      </label>

      <button
        onClick={onUpload}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        disabled={busy || !file || !pin.trim()}
      >
        {busy ? "Uploading…" : "Upload"}
      </button>

      {status && <div className="text-sm">{status}</div>}
    </main>
  );
}
