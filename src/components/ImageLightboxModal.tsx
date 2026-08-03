import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  title?: string;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  images,
  currentIndex,
  onIndexChange,
  title,
}) => {
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Keyboard navigation (Left, Right, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        if (images.length > 1) {
          onIndexChange(currentIndex === 0 ? images.length - 1 : currentIndex - 1);
        }
      } else if (e.key === 'ArrowRight') {
        if (images.length > 1) {
          onIndexChange(currentIndex === images.length - 1 ? 0 : currentIndex + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images, onClose, onIndexChange]);

  if (!isOpen || !images || images.length === 0) return null;

  const validIndex = Math.min(Math.max(0, currentIndex), images.length - 1);

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onIndexChange(validIndex === 0 ? images.length - 1 : validIndex - 1);
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onIndexChange(validIndex === images.length - 1 ? 0 : validIndex + 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 40 && images.length > 1) {
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
          onClick={onClose}
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
              {images.length > 1 && (
                <div className="bg-white/15 backdrop-blur-md text-white text-xs sm:text-sm font-extrabold px-3.5 py-1.5 rounded-full border border-white/20 shadow-md">
                  {validIndex + 1} / {images.length}
                </div>
              )}

              {/* Close Button */}
              <button
                onClick={onClose}
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
            {images.length > 1 && (
              <button
                onClick={handlePrev}
                aria-label="Previous photo"
                className="absolute left-2 sm:left-6 z-30 p-3 sm:p-4 bg-slate-900/70 hover:bg-slate-900/95 text-white rounded-full backdrop-blur-md transition-all shadow-2xl hover:scale-110 active:scale-95 cursor-pointer border border-white/20"
              >
                <ChevronLeft size={30} />
              </button>
            )}

            {/* Main Image */}
            <motion.div
              key={validIndex}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="relative max-w-full max-h-[75vh] sm:max-h-[80vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={images[validIndex]}
                alt={title ? `${title} - photo ${validIndex + 1}` : `Photo ${validIndex + 1}`}
                className="max-w-full max-h-[75vh] sm:max-h-[80vh] object-contain rounded-2xl shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </motion.div>

            {/* Next Arrow Button */}
            {images.length > 1 && (
              <button
                onClick={handleNext}
                aria-label="Next photo"
                className="absolute right-2 sm:right-6 z-30 p-3 sm:p-4 bg-slate-900/70 hover:bg-slate-900/95 text-white rounded-full backdrop-blur-md transition-all shadow-2xl hover:scale-110 active:scale-95 cursor-pointer border border-white/20"
              >
                <ChevronRight size={30} />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails Strip */}
          {images.length > 1 && (
            <div 
              className="z-20 w-full max-w-4xl mx-auto flex gap-2.5 overflow-x-auto py-2 px-4 justify-start sm:justify-center items-center scrollbar-thin"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => onIndexChange(i)}
                  className={`relative w-16 h-12 sm:w-20 sm:h-14 rounded-xl overflow-hidden shrink-0 transition-all border-2 cursor-pointer shadow-md ${
                    validIndex === i
                      ? 'border-sky-400 scale-105 opacity-100 ring-2 ring-sky-400/60'
                      : 'border-white/10 opacity-50 hover:opacity-90 hover:border-white/30'
                  }`}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
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
