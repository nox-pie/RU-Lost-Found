import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef, type TouchEvent } from 'react';

interface PhotoLightboxProps {
  photos: string[];
  index: number;
  title: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/**
 * A photo at full size on a dark backdrop. Arrow keys or a swipe move between photos; Esc, the
 * close button or a tap outside the photo close it, and focus returns to where it was.
 */
export function PhotoLightbox({
  photos,
  index,
  title,
  onIndexChange,
  onClose,
}: PhotoLightboxProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);
  const count = photos.length;
  const go = (step: number) => onIndexChange((index + step + count) % count);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (count > 1 && event.key === 'ArrowRight') onIndexChange((index + 1) % count);
      if (count > 1 && event.key === 'ArrowLeft') onIndexChange((index - 1 + count) % count);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [count, index, onClose, onIndexChange]);

  const onTouchEnd = (event: TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    const end = event.changedTouches[0]?.clientX;
    if (start === null || end === undefined || count < 2) return;
    if (Math.abs(end - start) > 50) go(end < start ? 1 : -1);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title}: photo ${index + 1} of ${count}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-dialog-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={onTouchEnd}
    >
      <img
        src={photos[index]}
        alt={`${title}, photo ${index + 1} of ${count}`}
        className="max-h-[90vh] max-w-[94vw] select-none rounded-lg object-contain"
      />
      <button
        ref={closeButton}
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-6 w-6" />
      </button>
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
            {index + 1} / {count}
          </p>
        </>
      )}
    </div>
  );
}
