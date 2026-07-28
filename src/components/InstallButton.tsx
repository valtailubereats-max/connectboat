import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share, PlusSquare, X, Smartphone, HelpCircle, Laptop } from 'lucide-react';

interface InstallButtonProps {
  variant?: 'button' | 'menu-item' | 'dropdown-item' | 'footer-link';
  onClickAction?: () => void;
}

export const InstallButton: React.FC<InstallButtonProps> = ({
  variant = 'button',
  onClickAction
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showAlreadyInstalledModal, setShowAlreadyInstalledModal] = useState(false);

  useEffect(() => {
    // 1. Check if already installed
    const checkStandalone = () => {
      const isStandalone = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true ||
        localStorage.getItem('pwa-installed') === 'true';
      setIsInstalled(isStandalone);
    };

    checkStandalone();

    // 2. iOS detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /ipad|iphone|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    // 3. Before Install Prompt listener
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log('[PWA] beforeinstallprompt captured inside InstallButton.tsx.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. App Installed listener
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      localStorage.setItem('pwa-installed', 'true');
      console.log('[PWA] Application installed.');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleCloseAlreadyInstalled = () => {
    setShowAlreadyInstalledModal(false);
    if (onClickAction) {
      onClickAction();
    }
  };

  const handleCloseManual = () => {
    setShowManualModal(false);
    if (onClickAction) {
      onClickAction();
    }
  };

  const handleInstallClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true ||
      localStorage.getItem('pwa-installed') === 'true';

    if (isInstalled || isStandalone) {
      setShowAlreadyInstalledModal(true);
      return;
    }

    // Android/Chrome/Desktop Chrome/Edge: If native install is available, trigger directly and instantly!
    if (deferredPrompt) {
      triggerNativeInstall();
    } else {
      // If we are on Safari/iOS or other non-Chrome browsers, show the manual instruction dialog
      setShowManualModal(true);
    }
  };

  const triggerNativeInstall = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] Install outcome: ${outcome}`);
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        setShowManualModal(false);
        localStorage.setItem('pwa-installed', 'true');
      }
      if (onClickAction) {
        onClickAction();
      }
    } catch (err) {
      console.error('[PWA] Error starting trigger prompt:', err);
    }
  };

  const renderAlreadyInstalledModal = () => (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleCloseAlreadyInstalled}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        id="already-installed-modal-backdrop"
      />

      {/* Modal Body */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl border border-slate-100 p-6 z-10 text-slate-800 text-center"
        id="already-installed-modal-content"
      >
        {/* Confetti / Success emoji */}
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mb-4 shadow-inner">
          🎉
        </div>

        <h3 className="font-black text-lg text-slate-900 mb-2">
          Already Installed!
        </h3>
        
        <p className="text-sm font-medium text-slate-600 leading-relaxed mb-6">
          <strong>ConnectBoat</strong> is already installed on your device. You can access it quickly and directly from your home screen or apps list!
        </p>

        {/* Footer */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleCloseAlreadyInstalled}
            className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-black text-sm rounded-2xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            Great!
          </button>
        </div>
      </motion.div>
    </div>
  );

  const renderManualModal = () => (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleCloseManual}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        id="install-modal-backdrop"
      />

      {/* Modal Body */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl border border-slate-100 p-5 z-10 text-slate-800"
        id="install-modal-content"
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-lg shrink-0">
              💡
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">How to Install App</h3>
              <p className="text-[9px] text-slate-500 font-bold tracking-wide uppercase">Quick Guide</p>
            </div>
          </div>
          <button
            onClick={handleCloseManual}
            className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            id="close-manual-modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Instructions Sections */}
        <div className="space-y-4">
          {isIOS ? (
            <div className="p-3 bg-sky-50/60 rounded-2xl border border-sky-100 space-y-2">
              <h4 className="font-extrabold text-sky-800 text-[11px] uppercase tracking-wider flex items-center gap-1">
                <Smartphone size={12} className="text-sky-700" />
                Safari on iOS (iPhone / iPad)
              </h4>
              <div className="space-y-2.5 text-xs text-slate-700 font-bold leading-relaxed">
                <div className="flex gap-2 items-start">
                  <span className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[9px] shrink-0 font-black">1</span>
                  <span>Tap the <strong>Share</strong> button <span className="inline-flex"><Share size={11} className="text-sky-600 inline pb-0.5 mx-0.5" /></span> in Safari.</span>
                </div>
                <div className="flex gap-2 items-start">
                  <span className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[9px] shrink-0 font-black">2</span>
                  <span>Select <strong>Add to Home Screen</strong> <span className="inline-flex"><PlusSquare size={11} className="text-sky-600 inline pb-0.5" /></span>.</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* General Mobile Chrome/Android */}
              <div className="p-3 bg-sky-50/35 rounded-2xl border border-sky-100/50 space-y-2">
                <h4 className="font-extrabold text-sky-900 text-[11px] uppercase tracking-wider flex items-center gap-1">
                  <Smartphone size={12} />
                  Mobile Device (Android / Chrome)
                </h4>
                <div className="space-y-2 text-xs text-slate-700 font-bold leading-relaxed">
                  <div className="flex gap-2 items-start">
                    <span className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[9px] shrink-0 font-black">1</span>
                    <span>Tap the <strong>⋮</strong> menu on the browser toolbar.</span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[9px] shrink-0 font-black">2</span>
                    <span>Select <strong>Add to Home Screen</strong> or <strong>Install App</strong>.</span>
                  </div>
                </div>
              </div>

              {/* PC Desktop Option */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <h4 className="font-extrabold text-sky-900 text-[11px] uppercase tracking-wider flex items-center gap-1">
                  <Laptop size={12} />
                  Desktop (Chrome / Edge)
                </h4>
                <div className="space-y-2 text-xs text-slate-700 font-bold leading-relaxed">
                  <div className="flex gap-2 items-start">
                    <span className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[9px] shrink-0 font-black">1</span>
                    <span>Click the install icon ⊕ in the browser address bar.</span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[9px] shrink-0 font-black">2</span>
                    <span>Or open the <strong>⋮</strong> menu and select <strong>Install App</strong>.</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer CTA */}
        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          {(!isIOS && deferredPrompt) && (
            <button
              type="button"
              onClick={triggerNativeInstall}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1"
            >
              🚀 Install Now
            </button>
          )}
          <button
            type="button"
            onClick={handleCloseManual}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
            id="manual-modal-confirm-button"
          >
            Got It
          </button>
        </div>
      </motion.div>
    </div>
  );

  // Return custom render per variant
  if (variant === 'button') {
    return (
      <>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-sky-50/70 p-4 rounded-3xl border border-sky-100 hover:border-sky-200 transition-all text-left">
          <div className="flex-1">
            <h4 className="text-sm font-black text-sky-950 flex items-center gap-2">
              📱 Install ConnectBoat on Your Device
            </h4>
            <p className="text-xs text-sky-800 mt-1">
              Access ConnectBoat directly from your home screen as a native App, fast, lightweight and without needing an app store.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="px-4 py-2 bg-sky-600 text-white hover:bg-sky-700 text-xs font-black rounded-xl shadow-md cursor-pointer transition-colors text-center whitespace-nowrap flex items-center justify-center gap-1.5"
            >
              📱 Install Web App
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showManualModal && renderManualModal()}
          {showAlreadyInstalledModal && renderAlreadyInstalledModal()}
        </AnimatePresence>
      </>
    );
  }

  if (variant === 'menu-item') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className="text-lg font-black text-sky-700 text-left flex items-center gap-2 w-full hover:bg-sky-50 p-2 rounded-xl transition-colors cursor-pointer"
        >
          <span>📲 Install Web App</span>
        </button>

        <AnimatePresence>
          {showManualModal && renderManualModal()}
          {showAlreadyInstalledModal && renderAlreadyInstalledModal()}
        </AnimatePresence>
      </>
    );
  }

  if (variant === 'dropdown-item') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-2 px-4 py-2 hover:bg-sky-50 text-sky-700 transition-colors text-sm font-black w-full text-left cursor-pointer outline-none"
        >
          <span>📲 Install Web App</span>
        </button>

        <AnimatePresence>
          {showManualModal && renderManualModal()}
          {showAlreadyInstalledModal && renderAlreadyInstalledModal()}
        </AnimatePresence>
      </>
    );
  }

  if (variant === 'footer-link') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className="hover:text-sky-600 active:text-sky-600 transition-colors gap-1 text-slate-400 text-xs uppercase tracking-widest font-black flex items-center cursor-pointer"
        >
          <span>📲 Install App</span>
        </button>

        <AnimatePresence>
          {showManualModal && renderManualModal()}
          {showAlreadyInstalledModal && renderAlreadyInstalledModal()}
        </AnimatePresence>
      </>
    );
  }

  return null;
};
