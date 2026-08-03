export const GA_MEASUREMENT_ID = 'G-B0BPV9R463';

declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Checks whether a given path should be excluded from Google Analytics tracking.
 * Excludes admin, login, profile, create-ad, edit-ad, campanhas, convite, and api routes.
 */
export const isExcludedPath = (pathname: string): boolean => {
  if (!pathname) return false;
  const normalized = pathname.toLowerCase();

  const excludedPrefixes = [
    '/admin',
    '/login',
    '/profile',
    '/create-ad',
    '/edit-ad',
    '/campanhas',
    '/convite',
    '/api',
  ];

  return excludedPrefixes.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix + '/')
  );
};

/**
 * Initializes GA4 gtag snippet if not already loaded in the HTML.
 */
export const initGA = () => {
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
  }

  const existingScript =
    document.getElementById('ga-gtag-script') ||
    document.querySelector('script[src*="googletagmanager.com/gtag/js"]');

  if (!existingScript) {
    const script = document.createElement('script');
    script.id = 'ga-gtag-script';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, {
      send_page_view: false, // Prevent duplicate automatic initial pageview
    });
  }
};

/**
 * Sends a page_view event to GA4 for the given page path and title.
 */
export const sendGAPageView = (pagePath: string, pageTitle?: string) => {
  if (typeof window === 'undefined') return;

  // Double check path exclusion
  const pathWithoutQuery = pagePath.split('?')[0];
  if (isExcludedPath(pathWithoutQuery)) {
    return;
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_location: window.location.href,
      page_path: pagePath,
      page_title: pageTitle || document.title,
      send_to: GA_MEASUREMENT_ID,
    });
  } else {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'page_view',
      page_location: window.location.href,
      page_path: pagePath,
      page_title: pageTitle || document.title,
      send_to: GA_MEASUREMENT_ID,
    });
  }
};
