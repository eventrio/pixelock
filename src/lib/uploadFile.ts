// src/lib/uploadFile.ts
export async function uploadFile(file: File, pin: string, meta?: unknown) {
  if (!pin || !pin.trim()) throw new Error("PIN required");

  const fd = new FormData();
  fd.append("file", file);
  if (meta !== undefined) fd.append("meta", JSON.stringify(meta));

  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${pin}` }, // ✅ send PIN securely
    body: fd,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Upload failed");
  return json;
}
