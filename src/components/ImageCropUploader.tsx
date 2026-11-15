import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { Upload, ZoomIn, Move, Check, AlertCircle, Image as ImageIcon, X } from 'lucide-react';
import { Language, translations } from '../lib/i18n';
import { ImageCropConfig } from '../lib/giveawayTemplates';

export interface ImageCropUploaderHandle {
  hasPendingUpload: () => boolean;
  uploadPendingImage: () => Promise<string | null>;
}

interface ImageCropUploaderProps {
  lang: Language;
  bucket: 'giveaway-media' | 'competition-banners';
  imageUrl: string;
  crop: ImageCropConfig;
  accessToken: string | null;
  ownerSessionToken: string | null;
  onChangeImageUrl: (url: string) => void;
  onChangeCrop: (crop: ImageCropConfig) => void;
}

export const ImageCropUploader = forwardRef<ImageCropUploaderHandle, ImageCropUploaderProps>(({
  lang,
  bucket,
  imageUrl,
  crop,
  accessToken,
  ownerSessionToken,
  onChangeImageUrl,
  onChangeCrop,
}, ref) => {
  const t = translations[lang];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('banner.webp');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; origX: number; origY: number } | null>(null);

  const activePreview = localPreviewUrl || imageUrl;

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadSuccess(null);

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
      setUploadError(t.uploadMimeError);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(t.uploadSizeError);
      return;
    }

    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLocalPreviewUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const renderCroppedAndUpload = async (): Promise<string | null> => {
    if (!activePreview || !accessToken || !ownerSessionToken) return null;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Unable to load image for cropping. Use a local file or CORS-enabled image URL.'));
        img.src = activePreview;
      });

      const targetW = crop.aspect === '1:1' ? 1024 : 1280;
      const targetH = crop.aspect === '1:1' ? 1024 : crop.aspect === '4:3' ? 960 : 720;

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');

      // Compute cover scale + user zoom + focal point offset
      const baseScale = Math.max(targetW / img.width, targetH / img.height);
      const scale = baseScale * Math.max(1, crop.zoom || 1);
      const drawW = img.width * scale;
      const drawH = img.height * scale;

      const maxShiftX = Math.max(0, drawW - targetW);
      const maxShiftY = Math.max(0, drawH - targetH);
      const dx = -((crop.x / 100) * maxShiftX);
      const dy = -((crop.y / 100) * maxShiftY);

      ctx.drawImage(img, dx, dy, drawW, drawH);

      const dataUrl = canvas.toDataURL('image/webp', 0.9);
      const res = await fetch('/api/owner/storage/upload', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'X-Owner-Session': ownerSessionToken,
        },
        body: JSON.stringify({
          bucket,
          filename: selectedFileName,
          mimeType: 'image/webp',
          dataBase64: dataUrl,
          cropMetadata: crop,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      onChangeImageUrl(data.url);
      setLocalPreviewUrl(null);
      setUploadSuccess(t.imageUploadedSuccess);
      return data.url as string;
    } catch (err: any) {
      const msg = err?.message || t.uploadFailedFallback;
      setUploadError(msg);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    hasPendingUpload: () => Boolean(localPreviewUrl),
    uploadPendingImage: async () => {
      if (!localPreviewUrl) return imageUrl || null;
      return renderCroppedAndUpload();
    },
  }));

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!activePreview) return;
    setDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origX: crop.x,
      origY: crop.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStartRef.current) return;
    const dx = (dragStartRef.current.clientX - e.clientX) * 0.25;
    const dy = (dragStartRef.current.clientY - e.clientY) * 0.25;
    onChangeCrop({
      ...crop,
      x: Math.min(100, Math.max(0, Math.round(dragStartRef.current.origX + dx))),
      y: Math.min(100, Math.max(0, Math.round(dragStartRef.current.origY + dy))),
    });
  };

  const handlePointerUp = () => {
    setDragging(false);
    dragStartRef.current = null;
  };

  const aspectClass =
    crop.aspect === '1:1' ? 'aspect-square max-w-[260px]' : crop.aspect === '4:3' ? 'aspect-[4/3]' : 'aspect-video';

  return (
    <div className="space-y-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-black/5 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5" />
          <span>{t.mediaUploadHeading}</span>
        </span>
        <div className="flex items-center gap-1.5">
          {(['16:9', '4:3', '1:1'] as const).map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => onChangeCrop({ ...crop, aspect: ratio })}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                crop.aspect === ratio
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                  : 'bg-black/5 dark:bg-white/10 text-zinc-500'
              }`}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Crop & Reposition Frame */}
      {activePreview ? (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className={`relative w-full ${aspectClass} mx-auto rounded-xl overflow-hidden bg-zinc-950 border border-white/10 cursor-move select-none`}
        >
          <img
            src={activePreview}
            alt="Preview"
            referrerPolicy="no-referrer"
            draggable={false}
            style={{
              objectPosition: `${crop.x}% ${crop.y}%`,
              transform: `scale(${crop.zoom || 1})`,
              transformOrigin: `${crop.x}% ${crop.y}%`,
            }}
            className="w-full h-full object-cover transition-transform duration-75"
          />
          <div className="absolute bottom-2 start-2 px-2 py-1 rounded bg-black/70 text-[10px] text-white/90 flex items-center gap-1 pointer-events-none">
            <Move className="w-3 h-3" />
            <span>{t.dragToReposition}</span>
          </div>
          {localPreviewUrl && (
            <button
              type="button"
              onClick={() => setLocalPreviewUrl(null)}
              aria-label={t.closeBtn}
              className="absolute top-2 end-2 p-1 rounded-full bg-black/70 text-white hover:bg-black"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-8 rounded-xl border border-dashed border-zinc-400/50 dark:border-zinc-700 hover:border-zinc-500 flex flex-col items-center justify-center gap-2 text-xs text-zinc-500 transition-colors"
        >
          <Upload className="w-5 h-5" />
          <span>{t.selectImageFromComputer}</span>
        </button>
      )}

      {/* Controls: Upload, Crop & Save, Zoom */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={handleFileSelected}
        className="hidden"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-semibold flex items-center gap-1.5 hover:bg-black/10 dark:hover:bg-white/15"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{t.chooseImageFileBtn}</span>
        </button>

        {localPreviewUrl && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => {
              renderCroppedAndUpload().catch(() => {});
            }}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{uploading ? t.uploadingImageLabel : t.cropAndUploadBtn}</span>
          </button>
        )}

        <div className="flex items-center gap-2 flex-1 min-w-[140px]">
          <ZoomIn className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            type="range"
            min={1}
            max={2.4}
            step={0.05}
            value={crop.zoom || 1}
            onChange={(e) => onChangeCrop({ ...crop, zoom: parseFloat(e.target.value) })}
            className="w-full accent-emerald-500"
          />
          <span className="text-[11px] font-mono text-zinc-400 tabular-nums w-9 text-end" dir="ltr">
            {(crop.zoom || 1).toFixed(1)}x
          </span>
        </div>
      </div>

      {/* URL Input */}
      <div>
        <label className="block text-[11px] text-zinc-500 mb-1">{t.fieldImageUrl}</label>
        <input
          type="url"
          dir="ltr"
          value={imageUrl}
          onChange={(e) => onChangeImageUrl(e.target.value)}
          placeholder="https://..."
          className="w-full p-2 rounded-lg border border-black/10 dark:border-white/15 bg-white dark:bg-zinc-950 text-xs"
        />
      </div>

      {uploadError && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}
      {uploadSuccess && (
        <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{uploadSuccess}</span>
        </div>
      )}
    </div>
  );
});
ImageCropUploader.displayName = 'ImageCropUploader';
