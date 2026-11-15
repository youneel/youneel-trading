import React, { useState, useCallback, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Language, translations } from '../lib/i18n';

interface ProtectedContentProps {
  lang: Language;
  children: React.ReactNode;
  className?: string;
  showBadge?: boolean;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

export const ProtectedContent: React.FC<ProtectedContentProps> = ({
  lang,
  children,
  className = '',
  showBadge = false,
}) => {
  const t = translations[lang];
  const [noticeVisible, setNoticeVisible] = useState(false);

  const triggerNotice = useCallback(() => {
    setNoticeVisible(true);
  }, []);

  useEffect(() => {
    if (!noticeVisible) return;
    const timer = setTimeout(() => setNoticeVisible(false), 2400);
    return () => clearTimeout(timer);
  }, [noticeVisible]);

  const handleCopyCut = (e: React.ClipboardEvent) => {
    if (isEditableElement(e.target)) return;
    e.preventDefault();
    triggerNotice();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isEditableElement(e.target)) return;
    // Allow normal right-click on explicit external reference links
    if ((e.target as HTMLElement)?.closest('a[href]')) return;
    e.preventDefault();
    triggerNotice();
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (isEditableElement(e.target)) return;
    e.preventDefault();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditableElement(e.target)) return;
    const isModifier = e.ctrlKey || e.metaKey;
    if (isModifier && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'x')) {
      e.preventDefault();
      triggerNotice();
    }
  };

  return (
    <div
      data-protected-content="true"
      onCopy={handleCopyCut}
      onCut={handleCopyCut}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
      onKeyDown={handleKeyDown}
      className={`relative protected-surface ${className}`}
    >
      {/* Subtle non-intrusive YOUNEEL TRADING proprietary watermark overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 protected-watermark rounded-xl z-0"
      />

      {showBadge && (
        <div className="relative z-10 flex items-center justify-end mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-black/5 dark:border-white/10 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>{t.proprietaryBadge}</span>
          </span>
        </div>
      )}

      <div className="relative z-10">{children}</div>

      {noticeVisible && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-16 lg:bottom-5 end-4 z-50 px-3.5 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold shadow-lg border border-white/10 dark:border-black/10 flex items-center gap-2 animate-fadeIn"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{t.copyNoticeToast}</span>
        </div>
      )}
    </div>
  );
};
