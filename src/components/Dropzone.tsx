'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export type SelectedImage = { file: File; url: string; liveWatermarked?: boolean };

export default function Dropzone({ onSelect }: { onSelect: (img: SelectedImage | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const pick = () => inputRef.current?.click();

  const onFiles = useCallback((files: FileList | null) => {
    if (!files || !files[0]) return;
    const f = files[0];
    const url = URL.createObjectURL(f);
    setPreview(url);
    onSelect({ file: f, url });
  }, [onSelect]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <div className="card w-full max-w-3xl mx-auto p-4">
      <div
        className="grid place-items-center h-72 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 cursor-pointer"
        onClick={pick}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="preview" className="h-full w-full object-contain" />
        ) : (
          <div className="text-center text-gray-500">
            <div className="text-xl mb-2">Drop files here</div>
            <div className="text-sm">or choose an option below</div>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <div className="mt-4 flex items-center gap-3">
        <button className="btn-ghost" onClick={() => { setPreview(null); onSelect(null); }} disabled={!preview}>Clear</button>
        <button className="btn-ghost" onClick={pick} disabled={!!preview}>From device</button>
      </div>
    </div>
  );
}
