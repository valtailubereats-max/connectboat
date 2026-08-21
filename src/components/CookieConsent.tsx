import React from 'react';
import { Link } from 'react-router-dom';
import { Cookie, ShieldCheck, BarChart3, X } from 'lucide-react';
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  clearAnalyticsCookies,
  initGA,
  saveCookieConsent,
  sendGAPageView,
} from '../utils/analytics';

const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    try {
      const savedChoice = window.localStorage.getItem(
        ANALYTICS_CONSENT_STORAGE_KEY
      );

      if (savedChoice !== 'analytics' && savedChoice !== 'essential') {
        setIsVisible(true);
      }
    } catch {
      // If browser storage is unavailable, show the choice rather than
      // enabling optional Analytics automatically.
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAnalytics = () => {
    saveCookieConsent('analytics');
    initGA();

    // Register the current public page immediately after consent.
    window.setTimeout(() => {
      sendGAPageView(
        window.location.pathname + window.location.search,
        document.title
      );
    }, 150);

    setIsVisible(false);
  };

  const handleEssentialOnly = () => {
    saveCookieConsent('essential');
    clearAnalyticsCookies();
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9999] p-3 sm:p-4 pointer-events-none"
      role="region"
      aria-label="Cookie preferences"
    >
      <div className="pointer-events-auto max-w-3xl mx-auto bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl sm:rounded-3xl shadow-2xl shadow-slate-950/20 overflow-hidden">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <Cookie size={21} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-900">
                    Your privacy choices
                  </h2>
                  <p className="mt-1 text-[11px] sm:text-xs leading-relaxed text-slate-600">
                    ConnectBoat uses essential technologies to keep the site working.
                    With your permission, we also use Google Analytics to understand
                    how the marketplace is used and improve the experience.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleEssentialOnly}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1 shrink-0"
                  aria-label="Continue with essential cookies only"
                  title="Essential Only"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleAcceptAnalytics}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#52b64d] hover:bg-[#459d41] text-white text-xs font-extrabold transition-all shadow-sm"
                >
                  <BarChart3 size={15} />
                  Accept Analytics
                </button>

                <button
                  type="button"
                  onClick={handleEssentialOnly}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold transition-all"
                >
                  <ShieldCheck size={15} />
                  Essential Only
                </button>

                <Link
                  to="/cookie-policy"
                  className="sm:ml-auto text-center sm:text-right text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  Cookie Policy
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
