// Helper utilities for URL normalization, search page validation, and external ID extraction

import { decodeHtmlEntities } from '../../api/import-ad';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'fbclid',
  'ref',
  'source',
  '_ga',
  '_gl',
  'mc_cid',
  'mc_eid'
]);

/**
 * Normalizes a listing URL cleanly:
 * - Resolves relative URLs against baseUrl
 * - Enforces HTTPS
 * - Lowercases hostname
 * - Strips fragments
 * - Removes tracking query parameters
 * - Decodes HTML entities (e.g. &amp;)
 * - Rejects non-HTTP(S) protocols
 */
export function normalizeListingUrl(rawUrl: string, baseUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  
  let decoded = decodeHtmlEntities(rawUrl.trim());
  if (decoded.startsWith('javascript:') || decoded.startsWith('mailto:') || decoded.startsWith('tel:')) {
    return '';
  }

  let parsed: URL;
  try {
    if (baseUrl && !decoded.startsWith('http://') && !decoded.startsWith('https://')) {
      parsed = new URL(decoded, baseUrl);
    } else {
      parsed = new URL(decoded);
    }
  } catch {
    return '';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return '';
  }

  // Force HTTPS
  parsed.protocol = 'https:';

  // Lowercase hostname
  parsed.hostname = parsed.hostname.toLowerCase();
  if (parsed.hostname.endsWith('.')) {
    parsed.hostname = parsed.hostname.slice(0, -1);
  }

  // Remove tracking parameters
  const searchParams = new URLSearchParams(parsed.search);
  const keysToDelete: string[] = [];
  searchParams.forEach((_, key) => {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(k => searchParams.delete(k));
  parsed.search = searchParams.toString();

  // Remove fragment
  parsed.hash = '';

  let finalUrl = parsed.toString();
  // Strip trailing slash for consistency (unless it's just origin e.g. https://domain.com/)
  if (parsed.pathname !== '/' && finalUrl.endsWith('/')) {
    finalUrl = finalUrl.slice(0, -1);
  }

  return finalUrl;
}

/**
 * Extracts a unique external marketplace ID from a listing URL.
 */
export function extractExternalId(url: string, marketplaceId: string): string | undefined {
  if (!url) return undefined;
  
  const norm = normalizeListingUrl(url);
  if (!norm) return undefined;

  try {
    const parsed = new URL(norm);
    const path = parsed.pathname;

    if (marketplaceId === 'apolloduck') {
      // e.g. /boat/sessa-marine-oyster-34-for-sale/811335
      const match = path.match(/\/boat\/[^\/]+\/(\d+)\/?$/i) || path.match(/\/(\d+)\/?$/);
      if (match) return match[1];
    }

    if (marketplaceId === 'boatsandoutboards') {
      // e.g. /boat/1997-beneteau-oceanis-461-10002369/ or /boats-for-sale/2019-beneteau-9816500/
      const match = path.match(/-(\d{5,})\/?$/i) || path.match(/\/(\d{5,})\/?$/i);
      if (match) return match[1];
    }
  } catch {
    // ignore
  }

  return undefined;
}

export type SearchPageValidationResult = {
  isValid: boolean;
  errorCode?: 
    | 'INVALID_URL'
    | 'UNSUPPORTED_MARKETPLACE'
    | 'INDIVIDUAL_LISTING_URL'
    | 'NOT_A_RESULTS_PAGE'
    | 'UNAUTHORIZED';
  errorMessage?: string;
  marketplaceId?: 'apolloduck' | 'boatsandoutboards';
  marketplaceName?: string;
  normalizedUrl?: string;
};

/**
 * Validates whether a given URL is a supported search/results page URL.
 */
export function validateSearchPageUrl(urlInput: string): SearchPageValidationResult {
  if (!urlInput || typeof urlInput !== 'string' || !urlInput.trim()) {
    return {
      isValid: false,
      errorCode: 'INVALID_URL',
      errorMessage: 'Por favor, introduza um URL válido.'
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlInput.trim());
  } catch {
    return {
      isValid: false,
      errorCode: 'INVALID_URL',
      errorMessage: 'O URL fornecido não é válido. Verifique a sintaxe.'
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      errorCode: 'INVALID_URL',
      errorMessage: 'Apenas são suportados URLs com protocolo HTTP ou HTTPS.'
    };
  }

  let hostname = parsed.hostname.toLowerCase();
  if (hostname.startsWith('www.')) hostname = hostname.slice(4);

  let marketplaceId: 'apolloduck' | 'boatsandoutboards' | null = null;
  let marketplaceName = '';

  if (hostname === 'apolloduck.com' || hostname.endsWith('.apolloduck.com') ||
      hostname === 'apolloduck.co.uk' || hostname.endsWith('.apolloduck.co.uk') ||
      hostname === 'apolloduck.ie' || hostname.endsWith('.apolloduck.ie')) {
    marketplaceId = 'apolloduck';
    marketplaceName = 'Apollo Duck';
  } else if (hostname === 'boatsandoutboards.co.uk' || hostname.endsWith('.boatsandoutboards.co.uk')) {
    marketplaceId = 'boatsandoutboards';
    marketplaceName = 'Boats and Outboards';
  }

  if (!marketplaceId) {
    return {
      isValid: false,
      errorCode: 'UNSUPPORTED_MARKETPLACE',
      errorMessage: 'Marketplace não suportado para Importação de Resultados. Apenas Apollo Duck e Boats and Outboards são permitidos nesta versão.'
    };
  }

  const normalizedUrl = normalizeListingUrl(urlInput);
  const path = parsed.pathname.toLowerCase();

  // Check if it's an individual listing URL
  if (marketplaceId === 'apolloduck') {
    if (/\/boat\/[^\/]+\/\d+/i.test(path)) {
      return {
        isValid: false,
        errorCode: 'INDIVIDUAL_LISTING_URL',
        errorMessage: 'O URL fornecido é um anúncio individual, não uma página de resultados de pesquisa. Utilize a importação por URL individual.'
      };
    }
  }

  if (marketplaceId === 'boatsandoutboards') {
    if (/\/boat\/[^\/]*\d{5,}/i.test(path) || /\/boats-for-sale\/[^\/]*\d{5,}\/?$/i.test(path)) {
      return {
        isValid: false,
        errorCode: 'INDIVIDUAL_LISTING_URL',
        errorMessage: 'O URL fornecido é um anúncio individual, não uma página de resultados de pesquisa. Utilize a importação por URL individual.'
      };
    }
  }

  return {
    isValid: true,
    marketplaceId,
    marketplaceName,
    normalizedUrl
  };
}
