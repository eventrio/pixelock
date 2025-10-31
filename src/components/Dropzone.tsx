'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SelectedImage = { file: File; url: string; liveWatermarked?: boolean };

export default function Dropzone({
  onSelect,
  inputId = 'pixelock-file',
  externalPreviewUrl, // ← NEW: controlled preview (e.g., from camera)
}: {
  onSelect: (img: SelectedImage | null) => void;
  inputId?: string;
  externalPreviewUrl?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  // whichever we should display
  const displayPreview = externalPreviewUrl ?? localPreview;

  const pick = () => inputRef.current?.click();

  const onFiles = useCallback(
    (files: FileList | null) => {
      if (!files || !files[0]) return;
      const f = files[0];
      const url = URL.createObjectURL(f);
      if (localPreview) URL.revokeObjectURL(localPreview);
      setLocalPreview(url);
      onSelect({ file: f, url });
    },
    [onSelect, localPreview]
  );

  // cleanup created blob URLs
  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  return (
    <div className="w-full">
      <div
        className="relative h-72 w-full cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50"
        onClick={pick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFiles(e.dataTransfer.files);
        }}
      >
        {displayPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayPreview}
            alt="preview"
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-center text-gray-500">
            <div>
              {/* Photo icon placeholder */}
              <svg
                aria-hidden
                className="mx-auto mb-3 h-14 w-14 opacity-70"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3.75 6.75A2.25 2.25 0 0 1 6 4.5h3l1.125 1.5H18A2.25 2.25 0 0 1 20.25 8.25v9A2.25 2.25 0 0 1 18 19.5H6a2.25 2.25 0 0 1-2.25-2.25v-10.5Z"/>
                <circle cx="8.75" cy="10.25" r="1.25" />
                <path d="M21 16l-5-5-5.5 5.5-2-2L3 18" />
              </svg>
              <div className="text-lg font-medium text-gray-600">Drop files here</div>
              <div className="mt-1 text-sm">or choose an option below</div>
            </div>
          </div>
        )}
      </div>

      {/* hidden input */}
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </div>
  );
}
