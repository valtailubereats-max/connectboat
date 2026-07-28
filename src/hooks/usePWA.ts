import { useState, useEffect } from 'react';

export interface UsePWAReturn {
  isInstalled: boolean;
  isInstallable: boolean;
  isIOS: boolean;
  shouldShowInstall: boolean;
  showIOSInstructions: boolean;
  setShowIOSInstructions: (show: boolean) => void;
  installApp: () => Promise<boolean>;
  dismissInstall: () => void;
}

export function usePWA(): UsePWAReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // 1. Check if already installed / running in standalone mode
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    
    setIsInstalled(isStandalone);

    // 2. Identify iOS/Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /ipad|iphone|ipod/.test(userAgent) && !(window as any).MSStream;
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios|opera|opios/.test(userAgent);
    
    setIsIOS(isIosDevice);

    // If it's an iOS device and not in standalone mode, it can be added to the home screen
    if (isIosDevice && !isStandalone && isSafari) {
      setIsInstallable(true);
    }

    // 3. Listen for the native beforeinstallprompt event (Android / Desktop Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      // Store event for triggering later
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Listen for appinstalled event to update state
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log('[PWA] ConnectBoat was installed successfully');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // 5. Check dismissal from localStorage
    const dismissedUntil = localStorage.getItem('pwa_install_dismissed_until');
    if (dismissedUntil) {
      if (Date.now() < parseInt(dismissedUntil, 10)) {
        setIsDismissed(true);
      } else {
        localStorage.removeItem('pwa_install_dismissed_until');
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = async (): Promise<boolean> => {
    if (isIOS) {
      // For iOS, toggle the modal containing step-by-step instructions
      setShowIOSInstructions(true);
      return true;
    }

    if (!deferredPrompt) {
      console.warn('[PWA] No install prompt event stored');
      return false;
    }

    // Trigger the stored prompt
    deferredPrompt.prompt();
    
    // Wait for the user's choice
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Install choice outcome: ${outcome}`);
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      return true;
    } else {
      // If user declined, let's treat it as a light dismissal
      dismissInstall();
      return false;
    }
  };

  const dismissInstall = () => {
    // Suppress showing the banner / button for 7 days
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const dismissedUntil = Date.now() + sevenDaysInMs;
    localStorage.setItem('pwa_install_dismissed_until', dismissedUntil.toString());
    setIsDismissed(true);
  };

  const shouldShowInstall = isInstallable && !isInstalled && !isDismissed;

  return {
    isInstalled,
    isInstallable,
    isIOS,
    shouldShowInstall,
    showIOSInstructions,
    setShowIOSInstructions,
    installApp,
    dismissInstall,
  };
}
