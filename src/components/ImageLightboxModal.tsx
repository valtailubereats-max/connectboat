import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, X, Play, Video } from 'lucide-react';

export interface LightboxMediaItem {
  type: 'video' | 'image';
  url: string;
  thumbUrl?: string;
}

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  images?: string[];
  mediaItems?: LightboxMediaItem[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  title?: string;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  images,
  mediaItems,
  currentIndex,
  onIndexChange,
  title,
}) => {
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const lightboxVideoRef = useRef<HTMLVideoElement | null>(null);

  const items: LightboxMediaItem[] = (mediaItems && mediaItems.length > 0)
    ? mediaItems
    : (images || []).map(url => ({ type: 'image' as const, url }));

  // Keyboard navigation (Left, Right, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxVideoRef.current) lightboxVideoRef.current.pause();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        if (items.length > 1) {
          if (lightboxVideoRef.current) lightboxVideoRef.current.pause();
          onIndexChange(currentIndex === 0 ? items.length - 1 : currentIndex - 1);
        }
      } else if (e.key === 'ArrowRight') {
        if (items.length > 1) {
          if (lightboxVideoRef.current) lightboxVideoRef.current.pause();
          onIndexChange(currentIndex === items.length - 1 ? 0 : currentIndex + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, items, onClose, onIndexChange]);

  // Pause video when index changes
  useEffect(() => {
    if (lightboxVideoRef.current) {
      lightboxVideoRef.current.pause();
    }
  }, [currentIndex]);

  if (!isOpen || items.length === 0) return null;

  const validIndex = Math.min(Math.max(0, currentIndex), items.length - 1);
  const currentItem = items[validIndex];

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (lightboxVideoRef.current) lightboxVideoRef.current.pause();
    onIndexChange(validIndex === 0 ? items.length - 1 : validIndex - 1);
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (lightboxVideoRef.current) lightboxVideoRef.current.pause();
    onIndexChange(validIndex === items.length - 1 ? 0 : validIndex + 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 40 && items.length > 1) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    setTouchStartX(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[300] flex flex-col justify-between bg-slate-950/95 backdrop-blur-md p-3 sm:p-6 select-none"
          onClick={() => {
            if (lightboxVideoRef.current) lightboxVideoRef.current.pause();
            onClose();
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top Bar: Title, Counter & Close Button */}
          <div 
            className="flex items-center justify-between z-20 w-full max-w-7xl mx-auto pt-2 px-2 gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-white/80 text-sm font-semibold truncate max-w-[50%] sm:max-w-[65%]">
              {title && <span className="font-bold text-white text-base block truncate">{title}</span>}
            </div>

            <div className="flex items-center gap-3 ml-auto">
              {/* Counter Badge */}
              {items.length > 1 && (
                <div className="bg-white/15 backdrop-blur-md text-white text-xs sm:text-sm font-extrabold px-3.5 py-1.5 rounded-full border border-white/20 shadow-md">
                  {validIndex + 1} / {items.length}
                </div>
              )}

              {/* Close Button */}
              <button
                onClick={() => {
                  if (lightboxVideoRef.current) lightboxVideoRef.current.pause();
                  onClose();
                }}
                aria-label="Close photo view"
                className="p-2.5 text-white/90 hover:text-white bg-white/15 hover:bg-white/30 backdrop-blur-md rounded-full transition-all cursor-pointer shadow-lg active:scale-95 border border-white/20"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          {/* Main Display Area */}
          <div className="relative flex-1 w-full max-w-7xl mx-auto flex items-center justify-center my-2 overflow-hidden">
            {/* Previous Arrow Button */}
            {items.length > 1 && (
              <button
                onClick={handlePrev}
                aria-label="Previous media"
                className="absolute left-2 sm:left-6 z-30 p-3 sm:p-4 bg-slate-900/70 hover:bg-slate-900/95 text-white rounded-full backdrop-blur-md transition-all shadow-2xl hover:scale-110 active:scale-95 cursor-pointer border border-white/20"
              >
                <ChevronLeft size={30} />
              </button>
            )}

            {/* Main Media Item */}
            <motion.div
              key={validIndex}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="relative max-w-full max-h-[75vh] sm:max-h-[80vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {currentItem.type === 'video' ? (
                <video
                  ref={lightboxVideoRef}
                  src={currentItem.url}
                  controls
                  preload="metadata"
                  playsInline
                  className="max-w-full max-h-[75vh] sm:max-h-[80vh] object-contain rounded-2xl shadow-2xl bg-black"
                />
              ) : (
                <img
                  src={currentItem.url}
                  alt={title ? `${title} - photo ${validIndex + 1}` : `Photo ${validIndex + 1}`}
                  className="max-w-full max-h-[75vh] sm:max-h-[80vh] object-contain rounded-2xl shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              )}
            </motion.div>

            {/* Next Arrow Button */}
            {items.length > 1 && (
              <button
                onClick={handleNext}
                aria-label="Next media"
                className="absolute right-2 sm:right-6 z-30 p-3 sm:p-4 bg-slate-900/70 hover:bg-slate-900/95 text-white rounded-full backdrop-blur-md transition-all shadow-2xl hover:scale-110 active:scale-95 cursor-pointer border border-white/20"
              >
                <ChevronRight size={30} />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails Strip */}
          {items.length > 1 && (
            <div 
              className="z-20 w-full max-w-4xl mx-auto flex gap-2.5 overflow-x-auto py-2 px-4 justify-start sm:justify-center items-center scrollbar-thin"
              onClick={(e) => e.stopPropagation()}
            >
              {items.map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (lightboxVideoRef.current) lightboxVideoRef.current.pause();
                    onIndexChange(i);
                  }}
                  className={`relative w-16 h-12 sm:w-20 sm:h-14 rounded-xl overflow-hidden shrink-0 transition-all border-2 cursor-pointer shadow-md ${
                    validIndex === i
                      ? 'border-sky-400 scale-105 opacity-100 ring-2 ring-sky-400/60'
                      : 'border-white/10 opacity-50 hover:opacity-90 hover:border-white/30'
                  }`}
                >
                  {item.type === 'video' ? (
                    <>
                      {item.thumbUrl ? (
                        <img src={item.thumbUrl} alt="Video Thumbnail" className="w-full h-full object-cover brightness-75" />
                      ) : (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-400">
                          <Video size={18} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                          <Play size={12} className="fill-white ml-0.5" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img
                      src={item.url}
                      alt={`Thumbnail ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
};

export default ImageLightboxModal;
