import React, { useState } from 'react';
import { usePWA } from '../hooks/usePWA';
import { Share, PlusSquare, X, Monitor, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PWAInstallButtonProps {
  variant?: 'button' | 'menu-item' | 'dropdown-item' | 'footer-link';
  onClickAction?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  variant = 'button',
  onClickAction
}) => {
  const { 
    isInstalled,
    isInstallable,
    isIOS,
    showIOSInstructions,
    setShowIOSInstructions,
    installApp
  } = usePWA();

  const [showGenericInstructions, setShowGenericInstructions] = useState(false);

  // Showing the option only when NOT installed (not in standalone/PWA mode)
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Close parent menus if needed
    if (onClickAction) {
      onClickAction();
    }

    if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      const success = await installApp();
      // If native promo flow wasn't active or didn't trigger, show the manual fallback instructions
      if (!success && !isInstallable) {
        setShowGenericInstructions(true);
      }
    }
  };

  // 1. Render for profile page or general buttons
  if (variant === 'button') {
    return (
      <>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-emerald-50/70 p-4 rounded-3xl border border-emerald-100 hover:border-emerald-200 transition-all">
          <div className="flex-1">
            <h4 className="text-sm font-black text-emerald-950 flex items-center gap-2">
              📱 Install ConnectBoat on Your Device
            </h4>
            <p className="text-xs text-emerald-800 mt-1">
              Access ConnectBoat directly from your home screen as a native App, fast, lightweight and without needing an app store.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="px-4 py-2 bg-[#046a38] text-white hover:bg-[#03522b] text-xs font-black rounded-xl shadow-md cursor-pointer transition-colors text-center whitespace-nowrap flex items-center justify-center gap-1.5"
            >
              📱 Install App
            </button>
          </div>
        </div>

        <IOSInstructionsDialog 
          isOpen={showIOSInstructions} 
          onClose={() => setShowIOSInstructions(false)} 
        />

        <GenericInstructionsDialog 
          isOpen={showGenericInstructions} 
          onClose={() => setShowGenericInstructions(false)} 
        />
      </>
    );
  }

  // 2. Render for Mobile Menu
  if (variant === 'menu-item') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className="text-lg font-black text-emerald-700 text-left flex items-center gap-2 w-full hover:bg-emerald-50 p-2 rounded-xl transition-colors cursor-pointer"
        >
          <span>📱 Install App</span>
        </button>

        <IOSInstructionsDialog 
          isOpen={showIOSInstructions} 
          onClose={() => setShowIOSInstructions(false)} 
        />

        <GenericInstructionsDialog 
          isOpen={showGenericInstructions} 
          onClose={() => setShowGenericInstructions(false)} 
        />
      </>
    );
  }

  // 3. Render for Dropdown Menu Items (Desktop Menu)
  if (variant === 'dropdown-item') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-2 px-4 py-2 hover:bg-emerald-50 text-emerald-600 transition-colors text-sm font-black w-full text-left cursor-pointer outline-none"
        >
          <span>📱 Install App</span>
        </button>

        <IOSInstructionsDialog 
          isOpen={showIOSInstructions} 
          onClose={() => setShowIOSInstructions(false)} 
        />

        <GenericInstructionsDialog 
          isOpen={showGenericInstructions} 
          onClose={() => setShowGenericInstructions(false)} 
        />
      </>
    );
  }

  // 4. Render for Footer
  if (variant === 'footer-link') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className="hover:text-[#046a38] active:text-[#046a38] transition-colors gap-1 text-slate-400 text-xs uppercase tracking-widest font-black flex items-center cursor-pointer"
        >
          📱 Install App
        </button>

        <IOSInstructionsDialog 
          isOpen={showIOSInstructions} 
          onClose={() => setShowIOSInstructions(false)} 
        />

        <GenericInstructionsDialog 
          isOpen={showGenericInstructions} 
          onClose={() => setShowGenericInstructions(false)} 
        />
      </>
    );
  }

  return null;
};

/* --- SUBCOMPONENT: iOS Instructions dialog for Safari --- */
interface IOSInstructionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const IOSInstructionsDialog: React.FC<IOSInstructionsDialogProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-150 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 p-6 z-10 text-slate-900"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📱</span>
                <div>
                  <h3 className="font-brand font-black text-base text-slate-900">Install on iPhone</h3>
                  <p className="text-xs text-slate-500 font-medium">Follow these simple steps in Safari</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Steps Container */}
            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex gap-3.5 items-start">
                <div className="w-7 h-7 shrink-0 rounded-full bg-sky-50 text-sky-800 text-xs font-black flex items-center justify-center border border-sky-100">
                  1
                </div>
                <div className="text-sm font-medium text-slate-700 pt-0.5 leading-relaxed">
                  Tap the <strong>Share</strong> button <span className="inline-flex"><Share size={15} className="text-sky-600 mx-1 pb-0.5 inline" /></span> in Safari toolbar.
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3.5 items-start">
                <div className="w-7 h-7 shrink-0 rounded-full bg-sky-50 text-sky-800 text-xs font-black flex items-center justify-center border border-sky-100">
                  2
                </div>
                <div className="text-sm font-medium text-slate-700 pt-0.5 leading-relaxed">
                  Scroll down and tap <strong>"Add to Home Screen"</strong> <span className="inline-flex"><PlusSquare size={15} className="text-sky-600 mx-1 pb-0.5 inline" /></span>.
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3.5 items-start">
                <div className="w-7 h-7 shrink-0 rounded-full bg-emerald-50 text-emerald-800 text-xs font-black flex items-center justify-center border border-emerald-100">
                  3
                </div>
                <div className="text-sm font-medium text-slate-700 pt-0.5 leading-relaxed">
                  Tap <strong>"Add"</strong> in the top right corner to confirm.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-[#046a38] text-white hover:bg-[#03522b] font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

/* --- SUBCOMPONENT: Generic/Android Fallback Instructions Dialog --- */
interface GenericInstructionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const GenericInstructionsDialog: React.FC<GenericInstructionsDialogProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-150 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 p-6 z-10 text-slate-900"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚡</span>
                <div>
                  <h3 className="font-brand font-black text-base text-slate-900">How to Install</h3>
                  <p className="text-xs text-slate-500 font-medium">Install on your Android or Desktop device</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Steps Container */}
            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex gap-3.5 items-start">
                <div className="w-7 h-7 shrink-0 rounded-full bg-emerald-50 text-emerald-800 text-xs font-black flex items-center justify-center border border-emerald-100">
                  1
                </div>
                <div className="text-sm font-medium text-slate-700 pt-0.5 leading-relaxed">
                  Open your browser menu (tap the three dots <strong>⋮</strong> in the top or bottom corner).
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3.5 items-start">
                <div className="w-7 h-7 shrink-0 rounded-full bg-emerald-50 text-emerald-800 text-xs font-black flex items-center justify-center border border-emerald-100">
                  2
                </div>
                <div className="text-sm font-medium text-slate-700 pt-0.5 leading-relaxed">
                  Select <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong>.
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3.5 items-start">
                <div className="w-7 h-7 shrink-0 rounded-full bg-emerald-50 text-emerald-800 text-xs font-black flex items-center justify-center border border-emerald-100">
                  3
                </div>
                <div className="text-sm font-medium text-slate-700 pt-0.5 leading-relaxed">
                  Confirm installation to enjoy ConnectBoat as a fast standalone App!
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-[#046a38] text-white hover:bg-[#03522b] font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
