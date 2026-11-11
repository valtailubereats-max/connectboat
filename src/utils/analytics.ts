export const GA_MEASUREMENT_ID = 'G-B0BPV9R463';
export const GOOGLE_ADS_ID = 'AW-18437934848';
export const GOOGLE_ADS_SIGNUP_SEND_TO = 'AW-18437934848/iOpbCL2rmPEcEICe8tdE';
export const META_PIXEL_ID = '938018453719754';

export const ANALYTICS_CONSENT_STORAGE_KEY = 'connectboat_cookie_consent';
export const ANALYTICS_CONSENT_TIMESTAMP_KEY = 'connectboat_cookie_consent_changed_at';

export type CookieConsentChoice = 'analytics' | 'essential';

export interface GA4ClientContext {
  clientId: string;
  sessionId?: string;
}

declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
    fbq?: MetaPixelFunction;
    _fbq?: MetaPixelFunction;
    __connectboatSentSignupIds?: Set<string>;
  }
}

type MetaPixelFunction = ((...args: any[]) => void) & {
  callMethod?: (...args: any[]) => void;
  queue?: any[][];
  loaded?: boolean;
  version?: string;
};

/**
 * Keeps staff and private account areas out of analytics page-view collection.
 */
export const isExcludedPath = (pathname: string): boolean => {
  if (!pathname) return false;
  const normalized = pathname.toLowerCase();

  const excludedPrefixes = [
    '/admin',
    '/profile',
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
 * Returns true only when the visitor has explicitly accepted Analytics.
 * Until a choice is saved, Analytics remains disabled.
 */
export const hasAnalyticsConsent = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) === 'analytics';
  } catch {
    return false;
  }
};

/**
 * Saves the visitor's cookie choice.
 * The visual consent banner will use this in the next step.
 */
export const saveCookieConsent = (choice: CookieConsentChoice) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, choice);
    window.localStorage.setItem(ANALYTICS_CONSENT_TIMESTAMP_KEY, String(Date.now()));
  } catch {
    // If browser storage is unavailable, keep Analytics disabled by default.
  }
};

export const getAnalyticsConsentTimestamp = (): number => {
  if (typeof window === 'undefined') return 0;
  try {
    const value = Number(window.localStorage.getItem(ANALYTICS_CONSENT_TIMESTAMP_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

/**
 * Removes GA cookies that may have been set on this site.
 * Used when a visitor chooses Essential Only after previously accepting Analytics.
 */
export const clearAnalyticsCookies = () => {
  if (typeof document === 'undefined') return;

  const cookieNames = document.cookie
    .split(';')
    .map((cookie) => cookie.split('=')[0]?.trim())
    .filter((name) => name === '_ga' || name?.startsWith('_ga_'));

  cookieNames.forEach((name) => {
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=.${window.location.hostname}; SameSite=Lax`;
  });
};

export const disableMetaPixel = () => {
  if (typeof window === 'undefined') return;

  window.fbq?.('consent', 'revoke');

  if (typeof document === 'undefined') return;
  ['_fbp', '_fbc'].forEach((name) => {
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=.${window.location.hostname}; SameSite=Lax`;
  });
};

/** Loads Meta Pixel only after explicit consent. PageView is sent separately. */
export const initMetaPixel = (): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (!hasAnalyticsConsent()) return false;

  const metaWindow = window as typeof window & Record<string, any>;

  if (!window.fbq) {
    const fbq: MetaPixelFunction = function (...args: any[]) {
      if (fbq.callMethod) {
        fbq.callMethod(...args);
      } else {
        fbq.queue = fbq.queue || [];
        fbq.queue.push(args);
      }
    };
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = '2.0';
    window.fbq = fbq;
    window._fbq = fbq;
  }

  if (!document.getElementById('meta-pixel-script')) {
    const script = document.createElement('script');
    script.id = 'meta-pixel-script';
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }

  const initializedFlag = '__connectboatMetaPixelInitialized';
  if (!metaWindow[initializedFlag]) {
    window.fbq('init', META_PIXEL_ID);
    metaWindow[initializedFlag] = true;
  }

  window.fbq('consent', 'grant');

  return true;
};

export const sendMetaPageView = () => {
  if (!initMetaPixel()) return;
  window.fbq?.('track', 'PageView');
};

export const sendMetaCompleteRegistration = () => {
  if (!initMetaPixel()) return;
  window.fbq?.('track', 'CompleteRegistration', {
    content_name: 'ConnectBoat account',
    status: true,
  });
};

/**
 * Initializes GA4 only after explicit Analytics consent.
 */
export const initGA = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (!hasAnalyticsConsent()) return false;

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
      send_page_view: false,
    });
  }

  // Configure Google Ads on the same Google tag, but only after Analytics consent.
  // A window flag prevents duplicate config calls when initGA() runs more than once.
  const adsConfiguredFlag = '__connectboatGoogleAdsConfigured';
  const adsWindow = window as typeof window & Record<string, any>;
  if (!adsWindow[adsConfiguredFlag] && typeof window.gtag === 'function') {
    window.gtag('config', GOOGLE_ADS_ID);
    adsWindow[adsConfiguredFlag] = true;
  }

  return true;
};

/**
 * Sends a page_view event only when Analytics consent exists.
 */
export const sendGAPageView = (pagePath: string, pageTitle?: string) => {
  if (typeof window === 'undefined') return;
  if (!hasAnalyticsConsent()) return;

  const pathWithoutQuery = pagePath.split('?')[0];
  if (isExcludedPath(pathWithoutQuery)) {
    return;
  }

  // Make sure GA is available after consent before sending the event.
  initGA();

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      // Avoid sending query parameters, which can contain referral codes or
      // other values that should not be included in Analytics URLs.
      page_location: `${window.location.origin}${pathWithoutQuery}`,
      page_path: pathWithoutQuery,
      page_title: pageTitle || document.title,
      send_to: GA_MEASUREMENT_ID,
    });
  }
};

export const sendGA4Event = (
  eventName: string,
  params: Record<string, string | number | boolean | undefined> = {}
) => {
  if (typeof window === 'undefined' || !hasAnalyticsConsent()) return false;
  initGA();
  if (typeof window.gtag !== 'function') return false;

  const safeParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined)
  );
  window.gtag('event', eventName, safeParams);
  return true;
};

export const sendGA4SignUpOnce = (firebaseUid: string, method: 'google' | 'email') => {
  if (typeof window === 'undefined' || !firebaseUid || !hasAnalyticsConsent()) return false;

  const sentIds = window.__connectboatSentSignupIds || new Set<string>();
  window.__connectboatSentSignupIds = sentIds;
  if (sentIds.has(firebaseUid)) return false;

  // The Firebase UID is only used as an in-memory deduplication key; it is
  // never included in the Analytics event.
  sentIds.add(firebaseUid);
  return sendGA4Event('sign_up', { method });
};

/** Resolve GA identifiers only after Analytics consent. No user profile data is read. */
export const getGA4ClientContext = async (): Promise<GA4ClientContext | null> => {
  if (typeof window === 'undefined' || !hasAnalyticsConsent()) return null;
  initGA();
  if (typeof window.gtag !== 'function') return null;

  return new Promise((resolve) => {
    let clientId: string | undefined;
    let sessionId: string | undefined;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      resolve(clientId ? { clientId, ...(sessionId ? { sessionId } : {}) } : null);
    };
    const timeout = window.setTimeout(finish, 1500);

    window.gtag?.('get', GA_MEASUREMENT_ID, 'client_id', (value: unknown) => {
      if (typeof value === 'string' && value.length <= 100) clientId = value;
      if (clientId) {
        window.clearTimeout(timeout);
        finish();
      }
    });
    window.gtag?.('get', GA_MEASUREMENT_ID, 'session_id', (value: unknown) => {
      if (typeof value === 'string' && /^\d{1,20}$/.test(value)) sessionId = value;
      if (clientId) {
        window.clearTimeout(timeout);
        finish();
      }
    });
  });
};


/**
 * Reports a completed new-user registration to Google Ads.
 * It is intentionally called only from successful registration flows.
 */
export const sendGoogleAdsSignupConversion = () => {
  if (typeof window === 'undefined') return;
  if (!hasAnalyticsConsent()) return;

  initGA();

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'conversion', {
      send_to: GOOGLE_ADS_SIGNUP_SEND_TO,
      value: 1.0,
      currency: 'GBP',
    });
  }
};
