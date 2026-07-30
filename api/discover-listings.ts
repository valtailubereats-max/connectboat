import type { Request, Response } from 'express';
import { decodeHtmlEntities, cleanTitle } from './import-ad';
import {
  normalizeListingUrl,
  extractExternalId,
  validateSearchPageUrl,
  SearchPageValidationResult
} from '../src/utils/urlNormalization';

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

  const isMarkdown = textOrHtml.includes('Markdown Content:') || textOrHtml.includes('URL Source:');

  if (isMarkdown) {
    // Parse Markdown link blocks e.g. [Title £ Price Dealer | Location ![Image](url)](https://www.boatsandoutboards.co.uk/boat/...)
    const markdownLinkRegex = /\[([\s\S]*?)\]\((https?:\/\/(?:www\.)?boatsandoutboards\.co\.uk\/[^\)\s]+)\)/gi;
    let m: RegExpExecArray | null;

    while ((m = markdownLinkRegex.exec(textOrHtml)) !== null) {
      const linkText = m[1];
      const rawUrl = m[2];

      const normalized = normalizeListingUrl(rawUrl, pageUrl);
      if (!normalized || seenUrls.has(normalized)) continue;

      // Ensure it's an individual boat listing link e.g. contains /boat/ or numeric ID at end of path
      const path = new URL(normalized).pathname;
      if (!/\/boat\/[^\/]*\d{5,}/i.test(path) && !/\/boats-for-sale\/[^\/]*\d{5,}\/?$/i.test(path)) {
        continue;
      }

      seenUrls.add(normalized);

      const externalId = extractExternalId(normalized, 'boatsandoutboards');

      // Extract Image URL inside link text if present e.g. ![Image 25](https://images.boatsgroup.com/...)
      let image: string | undefined = undefined;
      const imgMatch = linkText.match(/!\[[^\]]*\]\((https?:\/\/images\.boatsgroup\.com\/[^"\)]+)\)/i);
      if (imgMatch) {
        image = imgMatch[1];
      }

      // Extract Title, Price, Location from link text
      let title: string | undefined = undefined;
      let priceText: string | undefined = undefined;
      let locationText: string | undefined = undefined;

      // Clean image markdown out of link text
      const cleanText = linkText.replace(/!\[[^\]]*\]\([^\)]+\)/g, '').replace(/#+/g, '').replace(/[*_]/g, '').trim();

      const priceMatch = cleanText.match(/(?:£|€|\$|GBP|EUR|USD)\s*[\d,.]+/i) || cleanText.match(/\bPOA\b/i) || cleanText.match(/Request price/i);
      if (priceMatch) {
        priceText = priceMatch[0];
      }

      const locationMatch = cleanText.match(/\|\s*([^|\n]+)$/);
      if (locationMatch) {
        locationText = locationMatch[1].trim();
      }

      // Title is before price or location
      let rawTitle = cleanText;
      if (priceMatch) {
        rawTitle = rawTitle.split(priceMatch[0])[0];
      } else if (locationMatch) {
        rawTitle = rawTitle.split('|')[0];
      }

      title = cleanTitle(rawTitle);

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
  } else {
    // Parse Direct HTML
    const decodedHtml = decodeHtmlEntities(textOrHtml);
    const linkRegex = /href=["'](\/boat\/[^\/"']+\/|https?:\/\/(?:www\.)?boatsandoutboards\.co\.uk\/(?:boat|boats-for-sale)\/[^\/"']+\d{5,}\/?)["']/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(decodedHtml)) !== null) {
      const rawUrl = match[1];
      const normalized = normalizeListingUrl(rawUrl, pageUrl);
      if (!normalized || seenUrls.has(normalized)) continue;

      seenUrls.add(normalized);
      const externalId = extractExternalId(normalized, 'boatsandoutboards');

      results.push({
        sourceUrl: normalized,
        normalizedSourceUrl: normalized,
        externalId,
        title: 'Boats and Outboards Listing',
        alreadyImported: false,
        status: 'new'
      });
    }
  }

  return results;
}

/**
 * Resilient Page Fetcher with Jina Reader Fallback
 */
async function fetchPageResiliently(pageUrl: string): Promise<{ htmlOrText: string; fetchSource: 'direct' | 'jina'; status: number }> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  ];

  let directStatus = 0;
  let directHtml = '';

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
        return { htmlOrText: directHtml, fetchSource: 'direct', status: directStatus };
      }
    }
  } catch (err) {
    console.warn('[discover-listings] Direct fetch failed or timed out:', err);
  }

  // Fallback to Jina Reader
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
        return { htmlOrText: jinaText, fetchSource: 'jina', status: jinaResp.status };
      }
    }
  } catch (jinaErr) {
    console.error('[discover-listings] Jina fallback failed:', jinaErr);
  }

  return { htmlOrText: directHtml, fetchSource: 'direct', status: directStatus || 500 };
}

/**
 * Main Endpoint Handler for POST /api/discover-listings
 */
export default async function discoverListingsHandler(req: Request, res: Response) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "METHOD_NOT_ALLOWED",
      errorMessage: "Método não permitido."
    });
  }

  try {
    let body: any = {};
    if (typeof req.body === 'string') {
      try {
        body = JSON.parse(req.body);
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_JSON_PAYLOAD',
          errorMessage: 'Corpo do pedido em formato JSON inválido.'
        });
      }
    } else {
      body = req.body || {};
    }

    const { pageUrl, userRole } = body;

    // 1. Authorization Verification
    if (userRole !== 'admin' && userRole !== 'moderator') {
      return res.status(403).json({
        success: false,
        error: 'UNAUTHORIZED',
        errorMessage: 'Acesso negado. Apenas administradores ou moderadores podem realizar a descoberta de anúncios.'
      });
    }

    // 2. Search Page URL Validation
    const validation: SearchPageValidationResult = validateSearchPageUrl(pageUrl);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.errorCode,
        errorMessage: validation.errorMessage
      });
    }

    const { marketplaceId, marketplaceName, normalizedUrl } = validation;

    // 3. Resilient Fetch
    const fetchRes = await fetchPageResiliently(normalizedUrl || pageUrl);
    if (!fetchRes.htmlOrText || fetchRes.htmlOrText.length < 200) {
      return res.status(400).json({
        success: false,
        error: fetchRes.status === 403 ? 'PAGE_ACCESS_DENIED' : 'SEARCH_PAGE_FETCH_FAILED',
        errorMessage: 'Não foi possível aceder à página de resultados de pesquisa. Verifique se a página está disponível publicamente.'
      });
    }

    // 4. Discovery via Marketplace Adapter
    let candidateListings: DiscoveredListing[] = [];
    if (marketplaceId === 'apolloduck') {
      candidateListings = discoverApolloDuckListings(fetchRes.htmlOrText, normalizedUrl || pageUrl);
    } else if (marketplaceId === 'boatsandoutboards') {
      candidateListings = discoverBoatsAndOutboardsListings(fetchRes.htmlOrText, normalizedUrl || pageUrl);
    }

    const totalCandidates = candidateListings.length;

    if (totalCandidates === 0) {
      return res.status(200).json({
        success: true,
        marketplace: marketplaceName,
        pageUrl: normalizedUrl || pageUrl,
        totalCandidates: 0,
        totalFound: 0,
        duplicatesRemoved: 0,
        alreadyImportedCount: 0,
        listings: [],
        warnings: ['Nenhum anúncio individual de barco foi encontrado nesta página de resultados.'],
        _diagnostics: {
          directStatus: fetchRes.status,
          fallbackUsed: fetchRes.fetchSource === 'jina',
          fetchSource: fetchRes.fetchSource,
          htmlLength: fetchRes.htmlOrText.length,
          candidateLinkCount: 0,
          validListingCount: 0
        }
      });
    }

    // 5. URL Normalization & Local Deduplication
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

    return res.status(200).json({
      success: true,
      marketplace: marketplaceName,
      pageUrl: normalizedUrl || pageUrl,
      totalCandidates,
      totalFound,
      duplicatesRemoved: duplicatesInPage,
      alreadyImportedCount: 0, // Duplicate check on client against Firestore or DB
      listings: validListings,
      warnings,
      _diagnostics: {
        directStatus: fetchRes.status,
        fallbackUsed: fetchRes.fetchSource === 'jina',
        fetchSource: fetchRes.fetchSource,
        htmlLength: fetchRes.htmlOrText.length,
        candidateLinkCount: totalCandidates,
        validListingCount: validListings.length
      }
    });

  } catch (err: any) {
    console.error('[discover-listings exception]:', err);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      errorMessage: err.message || 'Erro interno ao processar a página de pesquisa.'
    });
  }
}
