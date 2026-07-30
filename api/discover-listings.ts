import type { Request, Response } from 'express';
import { decodeHtmlEntities, cleanTitle } from '../src/utils/textUtils';
import {
  normalizeListingUrl,
  extractExternalId,
  validateSearchPageUrl,
  SearchPageValidationResult
} from '../src/utils/urlNormalization';

console.log('[discover-listings] MODULE_LOAD: Module initialized successfully');

export type DiscoveredListing = {
  sourceUrl: string;
  normalizedSourceUrl: string;
  externalId?: string;
  title?: string;
  image?: string;
  priceText?: string;
  locationText?: string;
  alreadyImported: boolean;
  status: 'new' | 'already_imported' | 'invalid_url' | 'ready_for_import';
};

/**
 * Apollo Duck Search Results Page Discovery Adapter
 */
export function discoverApolloDuckListings(html: string, pageUrl: string): DiscoveredListing[] {
  const decodedHtml = decodeHtmlEntities(html);
  const results: DiscoveredListing[] = [];
  const seenUrls = new Set<string>();

  // Pattern 1: Apollo Duck listing URLs usually have /boat/[slug]/[id]
  const linkRegex = /href=["'](\/boat\/[^\/"']+\/(\d+)\/?|https?:\/\/(?:www\.)?apolloduck\.(?:com|co\.uk|ie)\/boat\/[^\/"']+\/(\d+)\/?)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(decodedHtml)) !== null) {
    const rawUrl = match[1];
    const externalId = match[2] || match[3];

    const normalized = normalizeListingUrl(rawUrl, pageUrl);
    if (!normalized || seenUrls.has(normalized)) continue;

    seenUrls.add(normalized);

    // Extract surrounding card HTML context (approx +/- 600 chars)
    const matchIdx = match.index;
    const startIdx = Math.max(0, matchIdx - 300);
    const endIdx = Math.min(decodedHtml.length, matchIdx + 800);
    const snippet = decodedHtml.slice(startIdx, endIdx);

    // Extract image
    let image: string | undefined = undefined;
    const imgMatch = snippet.match(/src=["'](https?:\/\/ics\.apolloduck\.com\/[^"']+)["']/i) ||
                     snippet.match(/srcset=["'](https?:\/\/ics\.apolloduck\.com\/[^"']+)["']/i) ||
                     snippet.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) {
      const candidateImg = imgMatch[1].split(' ')[0];
      if (candidateImg && !candidateImg.includes('logo') && !candidateImg.includes('icon')) {
        image = candidateImg;
      }
    }

    // Extract Title & Price from caption / snippet
    let title: string | undefined = undefined;
    let priceText: string | undefined = undefined;
    let locationText: string | undefined = undefined;

    // Check _sbcaption or class="BasicTitle"
    const captionMatch = snippet.match(/class=["']_sbcaption["'][^>]*>([\s\S]*?)<\/div>/i);
    const titleClassMatch = snippet.match(/class=["']BasicTitle["'][^>]*>([\s\S]*?)<\/a>/i);

    if (titleClassMatch && titleClassMatch[1]) {
      const rawTitleText = titleClassMatch[1].replace(/<[^>]+>/g, '').trim();
      // Titles often include price e.g. "60ft Liverpool Boats - £97,500"
      const priceInTitle = rawTitleText.match(/(?:£|€|\$|GBP|EUR|USD)\s*[\d,.]+/i);
      if (priceInTitle) {
        priceText = priceInTitle[0];
        title = cleanTitle(rawTitleText.replace(priceInTitle[0], '').replace(/[-|]\s*$/, '').trim());
      } else {
        title = cleanTitle(rawTitleText);
      }
    } else if (captionMatch && captionMatch[1]) {
      const captionText = captionMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const priceInCaption = captionText.match(/(?:&pound;|&euro;|£|€|\$|GBP|EUR|USD)\s*[\d,.]+/i) || captionText.match(/\bPOA\b/i);
      if (priceInCaption) {
        priceText = decodeHtmlEntities(priceInCaption[0]);
        const beforePrice = captionText.replace(priceInCaption[0], '').trim();
        title = cleanTitle(beforePrice);
      } else {
        title = cleanTitle(captionText);
      }
    }

    // Fallback title from slug if title is empty
    if (!title) {
      const slugMatch = normalized.match(/\/boat\/([^\/]+)\/\d+/i);
      if (slugMatch) {
        title = cleanTitle(slugMatch[1].replace(/-for-sale$/i, '').replace(/-/g, ' '));
      }
    }

    results.push({
      sourceUrl: normalized,
      normalizedSourceUrl: normalized,
      externalId,
      title: title || 'Apollo Duck Listing',
      image,
      priceText,
      locationText,
      alreadyImported: false,
      status: 'new'
    });
  }

  return results;
}

/**
 * Boats and Outboards Search Results Page Discovery Adapter
 * Supports both direct HTML and Jina Reader Markdown output
 */
export function discoverBoatsAndOutboardsListings(textOrHtml: string, pageUrl: string): DiscoveredListing[] {
  const results: DiscoveredListing[] = [];
  const seenUrls = new Set<string>();

  // Detect boatsandoutboards target links (either in markdown or html)
  const targetUrlRegex = /(?:\]\(|href=["'])(https?:\/\/(?:www\.)?boatsandoutboards\.co\.uk\/(?:boat|boats-for-sale)\/[^\)\s"']+\d{5,}\/?)/gi;
  let m: RegExpExecArray | null;

  while ((m = targetUrlRegex.exec(textOrHtml)) !== null) {
    const rawUrl = m[1];
    const normalized = normalizeListingUrl(rawUrl, pageUrl);
    if (!normalized || seenUrls.has(normalized)) continue;

    seenUrls.add(normalized);
    const externalId = extractExternalId(normalized, 'boatsandoutboards');

    // Extract context around the match
    const matchIdx = m.index;
    let startIdx = Math.max(0, matchIdx - 600);

    // If there's an outer opening '[' before matchIdx, start from there
    let depth = 0;
    for (let i = matchIdx; i >= startIdx; i--) {
      if (textOrHtml[i] === ']') depth++;
      else if (textOrHtml[i] === '[') {
        depth--;
        if (depth === 0) {
          startIdx = i;
          break;
        }
      }
    }

    const snippet = textOrHtml.slice(startIdx, matchIdx);

    // Extract image URL from snippet
    let image: string | undefined = undefined;
    const imgMatch = snippet.match(/(https?:\/\/images\.boatsgroup\.com\/resize\/[^\)\s"']+)/i) ||
                     snippet.match(/src=["'](https?:\/\/[^"']+)["']/i);
    if (imgMatch) {
      image = imgMatch[1];
    }

    // Extract price, location, title from snippet
    let title: string | undefined = undefined;
    let priceText: string | undefined = undefined;
    let locationText: string | undefined = undefined;

    const cleanSnippet = snippet
      .replace(/!\[[^\]]*\]\([^\)]+\)/g, '')
      .replace(/#+/g, '')
      .replace(/[*_]/g, '')
      .replace(/\[/g, '')
      .replace(/\]/g, '')
      .trim();

    const priceMatch = cleanSnippet.match(/(?:£|€|\$|GBP|EUR|USD)\s*[\d,.]+/i) || cleanSnippet.match(/\bPOA\b/i) || cleanSnippet.match(/Request price/i);
    if (priceMatch) {
      priceText = priceMatch[0];
    }

    const locationMatch = cleanSnippet.match(/\|\s*([^|\n]+)$/) || cleanSnippet.match(/\|\s*([^|\n]+)/);
    if (locationMatch) {
      const candidateLoc = locationMatch[1].trim();
      if (!candidateLoc.toLowerCase().includes('in-stock') && !candidateLoc.toLowerCase().includes('featured') && candidateLoc.length < 50) {
        locationText = candidateLoc;
      }
    }

    // Title extraction
    let rawTitle = cleanSnippet;
    if (priceMatch) {
      rawTitle = rawTitle.split(priceMatch[0])[0];
    } else if (locationMatch) {
      rawTitle = rawTitle.split('|')[0];
    }

    rawTitle = rawTitle.replace(/^(?:Featured|New Arrival|In-Stock|Price Drop|↓ Price Drop|\s)+/i, '').trim();

    title = cleanTitle(rawTitle);
    if (!title || title.length < 3) {
      const slugMatch = normalized.match(/\/boat\/(?:[^\/]+-)?([^\/]+)-\d+/i);
      if (slugMatch) {
        title = cleanTitle(slugMatch[1].replace(/-/g, ' '));
      }
    }

    results.push({
      sourceUrl: normalized,
      normalizedSourceUrl: normalized,
      externalId,
      title: title || 'Boats and Outboards Listing',
      image,
      priceText,
      locationText,
      alreadyImported: false,
      status: 'new'
    });
  }

  return results;
}

export type FetchResult = {
  htmlOrText: string;
  fetchSource: 'direct' | 'jina';
  status: number;
  errorCode?: 'FETCH_TIMEOUT' | 'DNS_ERROR' | 'TLS_ERROR' | 'PAGE_ACCESS_DENIED' | 'FALLBACK_FAILED' | 'EMPTY_RESPONSE';
  errorDetails?: string;
  fallbackAttempted: boolean;
};

/**
 * Resilient Page Fetcher with Jina Reader Fallback
 */
async function fetchPageResiliently(pageUrl: string): Promise<FetchResult> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  ];

  let directStatus = 0;
  let directHtml = '';
  let fallbackAttempted = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const resp = await fetch(pageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': userAgents[0],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);
    directStatus = resp.status;

    if (resp.ok) {
      directHtml = await resp.text();
      // Check if blocked by Cloudflare / anti-bot shell
      const isBlocked = directHtml.includes('Access Denied') ||
                        directHtml.includes('Cloudflare') ||
                        directHtml.includes('Just a moment...') ||
                        directHtml.includes('Attention Required');

      if (!isBlocked && directHtml.length > 500) {
        return { htmlOrText: directHtml, fetchSource: 'direct', status: directStatus, fallbackAttempted: false };
      }
    }
  } catch (err: any) {
    console.warn('[discover-listings] Direct fetch failed or timed out:', err);
  }

  // Fallback to Jina Reader
  fallbackAttempted = true;
  const jinaTargetUrl = (pageUrl.includes('boatsandoutboards') && !pageUrl.endsWith('/')) ? `${pageUrl}/` : pageUrl;
  console.log('[discover-listings] Attempting Jina Reader fallback for:', jinaTargetUrl);
  try {
    const jinaUrl = `https://r.jina.ai/${jinaTargetUrl}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const jinaResp = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/plain, text/html'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);
    if (jinaResp.ok) {
      const jinaText = await jinaResp.text();
      if (jinaText && jinaText.length > 300) {
        return { htmlOrText: jinaText, fetchSource: 'jina', status: jinaResp.status, fallbackAttempted: true };
      }
    }
  } catch (jinaErr: any) {
    console.error('[discover-listings] Jina fallback failed:', jinaErr);
    let errorCode: FetchResult['errorCode'] = 'FALLBACK_FAILED';
    if (jinaErr.name === 'AbortError') errorCode = 'FETCH_TIMEOUT';
    else if (jinaErr.code === 'ENOTFOUND') errorCode = 'DNS_ERROR';

    return {
      htmlOrText: directHtml,
      fetchSource: 'direct',
      status: directStatus || 500,
      errorCode,
      errorDetails: jinaErr.message,
      fallbackAttempted: true
    };
  }

  const finalErrorCode = directStatus === 403 ? 'PAGE_ACCESS_DENIED' : (!directHtml ? 'EMPTY_RESPONSE' : 'FALLBACK_FAILED');

  return {
    htmlOrText: directHtml,
    fetchSource: 'direct',
    status: directStatus || 500,
    errorCode: finalErrorCode,
    errorDetails: 'Não foi possível aceder à página diretamente nem via serviço de leitura.',
    fallbackAttempted: true
  };
}

/**
 * Main Endpoint Handler for POST /api/discover-listings
 * Fully wrapped to guarantee zero unhandled runtime exceptions escape to Vercel.
 */
export default async function discoverListingsHandler(req: any, res: any) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  let lastCompletedStage = 'REQUEST_RECEIVED';
  let targetPageUrl = '';
  let detectedMarketplace = 'Unknown';
  let authUid = 'anonymous';
  let httpStatus = 0;
  let fallbackAttempted = false;
  let htmlLength = 0;

  try {
    console.log('[discover-listings] HANDLER_START', { requestId, method: req?.method });

    // Set CORS and content type headers safely
    if (res && typeof res.setHeader === 'function') {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    if (req?.method === "OPTIONS") {
      return res.status(200).end();
    }

    if (req?.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "METHOD_NOT_ALLOWED",
        errorMessage: "Método não permitido.",
        requestId
      });
    }

    // Stage 2: BODY_PARSED
    let body: any = {};
    if (typeof req?.body === 'string') {
      try {
        body = JSON.parse(req.body);
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_JSON_PAYLOAD',
          errorMessage: 'Corpo do pedido em formato JSON inválido.',
          requestId
        });
      }
    } else if (req?.body && typeof req.body === 'object') {
      body = req.body;
    }

    lastCompletedStage = 'BODY_PARSED';

    const rawPageUrl = body.pageUrl || body.url || body.searchUrl;
    const userRole = body.userRole;
    const diagnosticsOnly = body.diagnosticsOnly === true;

    console.log('[discover-listings] BODY_RECEIVED', { requestId, pageUrl: rawPageUrl, userRole, diagnosticsOnly });

    if (!rawPageUrl || typeof rawPageUrl !== 'string' || !rawPageUrl.trim()) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST_BODY',
        errorMessage: 'O URL da página de pesquisa (pageUrl) é obrigatório.',
        requestId
      });
    }

    targetPageUrl = rawPageUrl.trim();

    // Stage 3: AUTH_STARTED
    lastCompletedStage = 'AUTH_STARTED';
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    console.log('[discover-listings] AUTH_START', { requestId, hasAuthHeader: Boolean(authHeader) });

    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      authUid = 'authenticated_token_user';
    }

    // Role check: Admin or Moderator required
    if (userRole !== 'admin' && userRole !== 'moderator') {
      if (!authHeader) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHENTICATED',
          errorMessage: 'Autenticação necessária. Faça login como administrador ou moderador.',
          requestId
        });
      }
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        errorMessage: 'Acesso negado. Apenas administradores ou moderadores podem realizar a descoberta de anúncios.',
        requestId
      });
    }

    // Stage 4: AUTH_SUCCESS
    lastCompletedStage = 'AUTH_SUCCESS';
    console.log('[discover-listings] AUTH_SUCCESS', { requestId, authUid, userRole });

    // Stage 5: URL_VALIDATED
    const validation: SearchPageValidationResult = validateSearchPageUrl(targetPageUrl);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.errorCode,
        errorMessage: validation.errorMessage,
        requestId
      });
    }

    lastCompletedStage = 'URL_VALIDATED';

    // Stage 6: MARKETPLACE_DETECTED
    const { marketplaceId, marketplaceName, normalizedUrl } = validation;
    detectedMarketplace = marketplaceName;
    targetPageUrl = normalizedUrl || targetPageUrl;
    lastCompletedStage = 'MARKETPLACE_DETECTED';
    console.log('[discover-listings] MARKETPLACE_DETECTED', { requestId, detectedMarketplace, targetPageUrl });

    // Stage 7: FETCH_STARTED
    lastCompletedStage = 'FETCH_STARTED';
    console.log('[discover-listings] BEFORE_FETCH', { requestId, targetPageUrl });

    const fetchRes = await fetchPageResiliently(targetPageUrl);
    httpStatus = fetchRes.status;
    fallbackAttempted = fetchRes.fallbackAttempted;
    htmlLength = fetchRes.htmlOrText ? fetchRes.htmlOrText.length : 0;

    if (fetchRes.fetchSource === 'jina') {
      lastCompletedStage = 'FALLBACK_FETCH_STARTED';
    } else {
      lastCompletedStage = 'DIRECT_FETCH_COMPLETED';
    }

    console.log('[discover-listings] AFTER_FETCH', { requestId, httpStatus, htmlLength, fetchSource: fetchRes.fetchSource });

    if (!fetchRes.htmlOrText || fetchRes.htmlOrText.length < 200) {
      const errCode = fetchRes.errorCode || (fetchRes.status === 403 ? 'PAGE_ACCESS_DENIED' : 'SEARCH_PAGE_FETCH_FAILED');
      const errMsg = fetchRes.errorDetails || 'Não foi possível aceder à página de resultados de pesquisa. Verifique se a página está disponível publicamente.';

      return res.status(400).json({
        success: false,
        error: errCode,
        errorMessage: errMsg,
        requestId,
        _diagnostics: {
          directStatus: fetchRes.status,
          fallbackUsed: fetchRes.fetchSource === 'jina',
          fetchSource: fetchRes.fetchSource,
          htmlLength
        }
      });
    }

    // Stage 10: HTML_RECEIVED
    lastCompletedStage = 'HTML_RECEIVED';

    // Stage 11: ADAPTER_STARTED
    lastCompletedStage = 'ADAPTER_STARTED';
    let candidateListings: DiscoveredListing[] = [];
    if (marketplaceId === 'apolloduck') {
      candidateListings = discoverApolloDuckListings(fetchRes.htmlOrText, targetPageUrl);
    } else if (marketplaceId === 'boatsandoutboards') {
      candidateListings = discoverBoatsAndOutboardsListings(fetchRes.htmlOrText, targetPageUrl);
    }

    // Stage 12: LINKS_DISCOVERED
    lastCompletedStage = 'LINKS_DISCOVERED';
    const totalCandidates = candidateListings.length;
    console.log('[discover-listings] LINKS_DISCOVERED', { requestId, totalCandidates });

    // Stage 13: DUPLICATE_CHECK_STARTED
    lastCompletedStage = 'DUPLICATE_CHECK_STARTED';
    const uniqueMap = new Map<string, DiscoveredListing>();
    let duplicatesInPage = 0;

    for (const item of candidateListings) {
      const key = item.normalizedSourceUrl.toLowerCase();
      if (uniqueMap.has(key)) {
        duplicatesInPage++;
      } else {
        uniqueMap.set(key, item);
      }
    }

    let validListings = Array.from(uniqueMap.values());
    const totalFound = validListings.length;
    const warnings: string[] = [];

    // Result Limit: Maximum 30 discovered listings
    if (validListings.length > 30) {
      validListings = validListings.slice(0, 30);
      warnings.push('A página contém mais de 30 anúncios. Apenas os primeiros 30 anúncios foram listados.');
    }

    // If Health-Check Mode (diagnosticsOnly) is requested:
    if (diagnosticsOnly) {
      return res.status(200).json({
        success: true,
        requestId,
        stages: {
          authentication: "ok",
          validation: "ok",
          marketplace: marketplaceName,
          directFetchStatus: fetchRes.status,
          fallbackUsed: fetchRes.fetchSource === 'jina',
          htmlLength,
          candidateLinks: totalCandidates,
          validLinks: validListings.length,
          duplicateCheck: "ok"
        }
      });
    }

    if (totalCandidates === 0) {
      warnings.push('Nenhum anúncio individual de barco foi encontrado nesta página de resultados.');
    }

    // Stage 14: RESPONSE_SENT
    lastCompletedStage = 'RESPONSE_SENT';
    console.log('[discover-listings] BEFORE_RESPONSE', { requestId, totalFound, warningsCount: warnings.length });

    return res.status(200).json({
      success: true,
      requestId,
      marketplace: marketplaceName,
      pageUrl: targetPageUrl,
      totalCandidates,
      totalFound,
      duplicatesRemoved: duplicatesInPage,
      alreadyImportedCount: 0,
      listings: validListings,
      warnings,
      _diagnostics: {
        directStatus: fetchRes.status,
        fallbackUsed: fetchRes.fetchSource === 'jina',
        fetchSource: fetchRes.fetchSource,
        htmlLength,
        candidateLinkCount: totalCandidates,
        validListingCount: validListings.length
      }
    });

  } catch (err: any) {
    console.error('[discover-listings EXCEPTION_CAUGHT]', {
      requestId,
      lastCompletedStage,
      pageUrl: targetPageUrl,
      marketplace: detectedMarketplace,
      authenticatedUserUid: authUid,
      httpStatus,
      fallbackAttempted,
      htmlLength,
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack
    });

    if (res && typeof res.status === 'function') {
      return res.status(500).json({
        success: false,
        error: 'DISCOVERY_FAILED',
        errorMessage: 'Ocorreu um erro temporário no servidor ao ler a página. Por favor, tente novamente.',
        requestId,
        debug: {
          errorName: err?.name || 'Error',
          errorMessage: err?.message || 'Erro desconhecido',
          stage: lastCompletedStage,
          stack: err?.stack
        }
      });
    }
  }
}
