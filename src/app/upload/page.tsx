"use client";

import { useState } from "react";

export default function UploadPage() {
  const [pin, setPin] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");

  async function onUpload() {
    try {
      if (!file) throw new Error("Pick a file");
      if (!pin.trim()) throw new Error("Enter your PIN");

      setStatus("Uploading…");

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${pin}` }, // <- send PIN securely
        body: fd,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Upload failed");

      setStatus(`✅ Uploaded: ${json.path}`);
      setPin(""); // optional: clear PIN
      // Optionally clear file input:
      // setFile(null);
    } catch (e: any) {
      setStatus(`❌ ${e?.message || "Upload failed"}`);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-xl font-semibold">Upload</h1>

      <label className="block">
        <span className="text-sm">PIN</span>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="mt-1 w-full rounded border p-2"
          placeholder="Enter PIN"
          inputMode="numeric"
        />
      </label>

      <label className="block">
        <span className="text-sm">File</span>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 w-full"
        />
      </label>

      <button
        onClick={onUpload}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        disabled={!file || !pin}
      >
        Upload
      </button>

      {status && <div className="text-sm">{status}</div>}
    </main>
  );
}
