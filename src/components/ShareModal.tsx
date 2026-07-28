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
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl mb-5">
            <p className="text-slate-450 text-[10px] uppercase font-black tracking-widest block mb-2">Generated message:</p>
            <div className="text-xs text-slate-700 leading-relaxed font-semibold max-h-36 overflow-y-auto whitespace-pre-wrap select-text pr-1">
              {text}
            </div>
            <div className="text-[10px] text-indigo-600 font-mono font-bold break-all mt-2.5">
              {url}
            </div>
          </div>

          {/* Share Grid Grid spacing */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {/* WhatsApp */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-[#e8fbf1] hover:bg-[#d1f7e3] text-[#0f5132] font-black py-3 px-4 rounded-2xl transition-all border border-[#d1f7e3] text-xs cursor-pointer"
            >
              <MessageCircle size={18} className="text-[#198754]" />
              WhatsApp
            </a>

            {/* Facebook */}
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-[#e8f4fd] hover:bg-[#d1e8fa] text-[#084298] font-black py-3 px-4 rounded-2xl transition-all border border-[#d1e8fa] text-xs cursor-pointer"
            >
              <Facebook size={18} className="text-[#0d6efd]" />
              Facebook
            </a>

            {/* Telegram */}
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-[#e8f7fd] hover:bg-[#d1f1fb] text-[#055160] font-black py-3 px-4 rounded-2xl transition-all border border-[#d1f1fb] text-xs cursor-pointer"
            >
              <Send size={18} className="text-[#0dcaf0]" />
              Telegram
            </a>

            {/* Copiar Link */}
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-3 font-brand font-black py-3 px-4 rounded-2xl transition-all border text-xs cursor-pointer ${
                copied
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/60'
              }`}
            >
              {copied ? (
                <>
                  <Check size={18} className="text-emerald-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={18} className="text-slate-500" />
                  Copy Link
                </>
              )}
            </button>
          </div>

          {/* Browser Native Share */}
          {navigator.share && (
            <button
              onClick={handleNativeShare}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-indigo-200 hover:border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black transition-all cursor-pointer"
            >
              <Share2 size={16} />
              Native Device Share
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
