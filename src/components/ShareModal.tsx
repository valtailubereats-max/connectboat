import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, MessageCircle, Facebook, Send, Share2 } from 'lucide-react';
import { generateShareText, ShareOptions } from '../utils/shareUtils';

export function ShareModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ShareOptions | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<ShareOptions>;
      if (customEvent.detail) {
        setOptions(customEvent.detail);
        setIsOpen(true);
        setCopied(false);
      }
    };

    window.addEventListener('open-share-modal', handleOpen);
    return () => {
      window.removeEventListener('open-share-modal', handleOpen);
    };
  }, []);

  if (!isOpen || !options) return null;

  const { text, url, title } = generateShareText(options);
  const fullMessage = text ? `${text}\n\n${url}` : url;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: text,
          url: url,
        });
        setIsOpen(false);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error during native sharing:', err);
        }
      }
    }
  };

  // Social URLs
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullMessage)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="relative bg-white rounded-3xl w-full max-w-md p-6 overflow-hidden shadow-2xl border border-slate-100 z-10"
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-5">
            <h3 className="font-brand font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Share2 size={18} className="text-indigo-600" />
              Share
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Subtitle / Details */}
          <div className="bg-slate-50/70 border border-slate-200/60 p-4 rounded-2xl mb-5 shadow-2xs">
            <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block mb-1.5">Generated Message</p>
            <div className="text-xs text-slate-700 leading-relaxed font-normal max-h-36 overflow-y-auto whitespace-pre-wrap select-text pr-1">
              {text}
            </div>
            <div className="text-[11px] text-indigo-600 font-mono font-medium break-all mt-2.5 pt-2.5 border-t border-slate-200/50">
              {url}
            </div>
          </div>

          {/* Share Grid Grid spacing */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* WhatsApp */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-3 px-4 rounded-2xl transition-all shadow-xs text-xs cursor-pointer active:scale-[0.98]"
            >
              <MessageCircle size={18} className="text-white shrink-0" />
              <span>WhatsApp</span>
            </a>

            {/* Facebook */}
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 bg-[#1877F2] hover:bg-[#166fe0] text-white font-bold py-3 px-4 rounded-2xl transition-all shadow-xs text-xs cursor-pointer active:scale-[0.98]"
            >
              <Facebook size={18} className="text-white shrink-0" />
              <span>Facebook</span>
            </a>

            {/* Telegram */}
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 bg-[#229ED9] hover:bg-[#1e8ec3] text-white font-bold py-3 px-4 rounded-2xl transition-all shadow-xs text-xs cursor-pointer active:scale-[0.98]"
            >
              <Send size={18} className="text-white shrink-0" />
              <span>Telegram</span>
            </a>

            {/* Copiar Link */}
            <button
              onClick={handleCopyLink}
              className={`flex items-center justify-center gap-2.5 font-bold py-3 px-4 rounded-2xl transition-all text-xs cursor-pointer active:scale-[0.98] ${
                copied
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 shadow-2xs'
              }`}
            >
              {copied ? (
                <>
                  <Check size={18} className="text-white shrink-0" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={18} className="text-slate-500 shrink-0" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>

          {/* Browser Native Share */}
          {navigator.share && (
            <button
              onClick={handleNativeShare}
              className="w-full inline-flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer active:scale-[0.99]"
            >
              <Share2 size={16} className="text-white shrink-0" />
              <span>Native Device Share</span>
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
