import type { Request, Response } from 'express';

console.log('[import-ad] MODULE_LOAD: Module initialized successfully');

export interface SupportedMarketplace {
  id: string;
  name: string;
  domains: string[];
}

export const SUPPORTED_MARKETPLACES: SupportedMarketplace[] = [
  {
    id: 'gumtree',
    name: 'Gumtree',
    domains: ['gumtree.com', 'gumtree.co.uk']
  },
  {
    id: 'olx',
    name: 'OLX',
    domains: ['olx.pt']
  },
  {
    id: 'boatsandoutboards',
    name: 'Boats and Outboards',
    domains: ['boatsandoutboards.co.uk']
  },
  {
    id: 'apolloduck',
    name: 'Apollo Duck',
    domains: ['apolloduck.com', 'apolloduck.co.uk', 'apolloduck.ie']
  },
  {
    id: 'yachtworld',
    name: 'YachtWorld',
    domains: ['yachtworld.com', 'yachtworld.co.uk']
  },
  {
    id: 'rightboat',
    name: 'Rightboat',
    domains: ['rightboat.com']
  },
  {
    id: 'theyachtmarket',
    name: 'TheYachtMarket',
    domains: ['theyachtmarket.com']
  },
  {
    id: 'boatshop24',
    name: 'Boatshop24',
    domains: ['boatshop24.com']
  },
  {
    id: 'boat24',
    name: 'Boat24',
    domains: ['boat24.com']
  },
  {
    id: 'boats',
    name: 'Boats.com',
    domains: ['boats.com']
  }
];

function inferConnectBoatCategory(title: string = '', description: string = '', rawCategory: string = ''): string {
  const text = `${title} ${description} ${rawCategory}`.toLowerCase();
  if (text.includes('hire') || text.includes('charter') || text.includes('rent')) return 'Boats for Hire';
  if (text.includes('engine') || text.includes('outboard') || text.includes('motor') || text.includes('yamaha') || text.includes('mercury') || text.includes('honda') || text.includes('tohatsu') || text.includes('mariner') || text.includes('suzuki') || text.includes('hp')) {
    if (!text.includes('boat') || text.includes('engine for sale') || text.includes('outboard engine')) return 'Boat Engines';
  }
  if (text.includes('trailer') || text.includes('reboque')) return 'Trailers';
  if (text.includes('part') || text.includes('propeller') || text.includes('anchor') || text.includes('fender') || text.includes('rigging') || text.includes('sail')) return 'Boat Parts';
  if (text.includes('vhf') || text.includes('gps') || text.includes('sonar') || text.includes('radar') || text.includes('chartplotter') || text.includes('electronics')) return 'Marine Electronics';
  if (text.includes('marina') || text.includes('berth') || text.includes('moor')) return 'Marinas';
  if (text.includes('service') || text.includes('repair') || text.includes('maintenance') || text.includes('survey')) return 'Boat Services';
  if (text.includes('wanted') || text.includes('procura-se')) return 'Wanted';
  if (text.includes('jacket') || text.includes('wetsuit') || text.includes('paddle') || text.includes('accessory') || text.includes('accessories')) return 'Accessories';

  return 'Boats for Sale';
}

export function getSupportedMarketplace(rawUrl: string): SupportedMarketplace | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  let hostname = parsed.hostname.toLowerCase();
  if (hostname.endsWith('.')) {
    hostname = hostname.slice(0, -1);
  }
  if (hostname.startsWith('www.')) {
    hostname = hostname.slice(4);
  }

  for (const m of SUPPORTED_MARKETPLACES) {
    for (const domain of m.domains) {
      const normDomain = domain.toLowerCase();
      if (hostname === normDomain || hostname.endsWith(`.${normDomain}`)) {
        return m;
      }
    }
  }

  return null;
}

export function isValidMarketplaceUrl(rawUrl: string): boolean {
  return getSupportedMarketplace(rawUrl) !== null;
}

export function getSupportedMarketplacesMessage(): string {
  const names = SUPPORTED_MARKETPLACES.map(m => m.name);
  const last = names.pop();
  return `Unsupported marketplace. Supported sources include ${names.join(', ')} and ${last}.`;
}

export function getSourceSiteFromUrl(rawUrl: string): string {
  const marketplace = getSupportedMarketplace(rawUrl);
  if (marketplace) {
    return marketplace.name;
  }

  try {
    const parsed = new URL(rawUrl.trim());
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) hostname = hostname.slice(4);
    return hostname;
  } catch {
    return 'External';
  }
}

// Decodificador de HTML Entities
export const decodeHtmlEntities = (str: string): string => {
  if (!str) return '';
  let temp = str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&pound;/g, '£')
    .replace(/&euro;/g, '€')
    .replace(/&#36;/g, '$')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  try {
    temp = temp.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  } catch (e) {
    // ignore
  }
  return temp;
};

// Limpador do título
export const cleanTitle = (title: string): string => {
  if (!title) return '';
  let temp = decodeHtmlEntities(title)
    .replace(/\s*-\s*à venda\s*-\s*.*$/gi, '')
    .replace(/\s*-\s*OLX\s*Portugal.*$/gi, '')
    .replace(/\s*-\s*OLX.*$/gi, '')
    .replace(/\s*[|]\s*Gumtree.*$/gi, '')
    .replace(/\s*-\s*Gumtree.*$/gi, '')
    .replace(/\s*in\s+[^|]+[|]\s*Gumtree.*$/gi, '')
    .replace(/\s*-\s*Boats\s*and\s*Outboards.*$/gi, '')
    .replace(/\s*-\s*Apollo\s*Duck.*$/gi, '')
    .replace(/\s*-\s*YachtWorld.*$/gi, '')
    .replace(/\s*-\s*Rightboat.*$/gi, '')
    .replace(/\s*-\s*TheYachtMarket.*$/gi, '')
    .replace(/\s*-\s*Boatshop24.*$/gi, '')
    .replace(/\s*-\s*Boat24.*$/gi, '')
    .replace(/\s*-\s*Boats\.com.*$/gi, '')
    .replace(/\|.*$/gi, '')
    .trim();

  // Remove emojis raros para manter o design clean
  temp = temp.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  
  // Substitui espaços duplicados
  temp = temp.replace(/\s+/g, ' ');

  return temp.trim();
};

// Limpador da descrição
export const cleanDescription = (desc: string): string => {
  if (!desc) return '';
  let temp = decodeHtmlEntities(desc);
  
  // Remove tags HTML se houver
  temp = temp.replace(/<[^>]*>/g, '');

  // Remove caracteres de controle mantendo normais o carriage return e quebras de linha
  temp = temp.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  temp = temp.replace(/\r/g, '');
  temp = temp.replace(/\n{3,}/g, '\n\n'); // Permite no máximo 2 novas linhas consecutivas
  temp = temp.split('\n').map(line => line.trim()).join('\n');
  temp = temp.split('\n').map(line => line.replace(/[ \t]{2,}/g, ' ')).join('\n');

  return temp.trim();
};

// Parseador de preço
export const parsePrice = (priceStr: string | number | undefined | null): number => {
  if (priceStr === undefined || priceStr === null) return 0;
  if (typeof priceStr === 'number') return priceStr;
  
  let str = String(priceStr).trim();
  if (!str) return 0;

  // Remove símbolos monetários e espaços
  str = str.replace(/[€$£\s]/g, '');

  // Analisa o estilo decimal
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');
  
  if (lastComma > lastDot && (lastComma === str.length - 3 || lastComma === str.length - 2)) {
    // Vírgula decimal europeia: 1.250,50 ou 1250,5
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && (lastDot === str.length - 3 || lastDot === str.length - 2)) {
    // Ponto decimal americano: 1,250.50
    str = str.replace(/,/g, '');
  } else {
    // Sem fração decimal explícita
    str = str.replace(/[.,]/g, '');
  }

  // Captura o primeiro dígito correspondente
  const match = str.match(/\d+(?:\.\d+)?/);
  if (match) {
    const parsed = parseFloat(match[0]);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

// Extrair tag Meta de HTML
const extractMetaContent = (html: string, nameOrProperty: string): string | null => {
  const regexes = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${nameOrProperty}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${nameOrProperty}["']`, 'i')
  ];
  for (const regex of regexes) {
    const match = html.match(regex);
    if (match) {
      return decodeHtmlEntities(match[1]);
    }
  }
  return null;
};

// Extrair JsonLd de HTML
const extractJsonLd = (html: string): any[] => {
  const results: any[] = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed) {
        results.push(parsed);
      }
    } catch (e) {
      // ignore
    }
  }
  return results;
};

// Extrair dados do Produto do JsonLd listado
const extractFromJsonLdList = (jsonLdList: any[]): any => {
  for (const obj of jsonLdList) {
    if (!obj) continue;
    const searchProduct = (item: any): any => {
      if (!item) return null;
      if (typeof item !== 'object') return null;
      if (Array.isArray(item)) {
        for (const child of item) {
          const res = searchProduct(child);
          if (res) return res;
        }
      } else {
        const typeStr = String(item['@type'] || '').toLowerCase();
        if (typeStr === 'product' || typeStr === 'productmodel' || typeStr === 'vehicle' || typeStr === 'boat') {
          return item;
        }
        if (item['@graph']) {
          const res = searchProduct(item['@graph']);
          if (res) return res;
        }
        for (const k of Object.keys(item)) {
          const res = searchProduct(item[k]);
          if (res) return res;
        }
      }
      return null;
    };
    const productNode = searchProduct(obj);
    if (productNode) {
      return productNode;
    }
  }
  return null;
};

// Encontrar localidade em JsonLd
const findLocationInJsonLd = (obj: any): string | null => {
  if (!obj) return null;
  if (typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const loc = findLocationInJsonLd(item);
      if (loc) return loc;
    }
  } else {
    if (obj.addressLocality) {
      return String(obj.addressLocality);
    }
    if (obj.addressRegion) {
      return String(obj.addressRegion);
    }
    if (obj.address && typeof obj.address === 'object') {
      if (obj.address.addressLocality) return String(obj.address.addressLocality);
      if (obj.address.addressRegion) return String(obj.address.addressRegion);
    }
    for (const k of Object.keys(obj)) {
      const loc = findLocationInJsonLd(obj[k]);
      if (loc) return loc;
    }
  }
  return null;
};

// Interface do Adaptador
export interface MarketplaceAdapterResult {
  price?: number;
  currency?: string;
  priceOnApplication?: boolean;
  city?: string;
  country?: string;
  manufacturer?: string;
  model?: string;
  year?: string;
  length?: string;
  beam?: string;
  draft?: string;
  fuelType?: string;
  engineBrand?: string;
  boatType?: string;
  priceSource: 'json-ld' | 'embedded-json' | 'marketplace-adapter' | 'visible-html' | 'gemini' | 'not-found';
  locationSource: 'json-ld' | 'embedded-json' | 'marketplace-adapter' | 'visible-html' | 'gemini' | 'not-found';
  rawPriceText?: string;
  rawLocationText?: string;
}

// ADAPTADOR 1: APOLLO DUCK
export function extractApolloDuckData(html: string, url: string): MarketplaceAdapterResult {
  const decodedHtml = decodeHtmlEntities(html);

  let rawPriceText = '';
  let price = 0;
  let currency = 'GBP';
  let priceOnApplication = false;
  let priceSource: MarketplaceAdapterResult['priceSource'] = 'not-found';

  // Verificação de Sob Consulta / POA
  if (/\b(?:poa|price on application|price on request)\b/i.test(decodedHtml)) {
    priceOnApplication = true;
    priceSource = 'marketplace-adapter';
  } else {
    // 1. _boatAdvertPrice
    const boatPriceMatch = decodedHtml.match(/<div[^>]*class=["']_boatAdvertPrice["'][^>]*>([\s\S]*?)<\/div>/i);
    // 2. nativePrice span
    const nativePriceMatch = decodedHtml.match(/<span[^>]*id=["']nativePrice["'][^>]*>([\s\S]*?)<\/span>/i);
    // 3. _pclPrice
    const pclPriceMatch = decodedHtml.match(/<td[^>]*class=["']_pclPrice["'][^>]*>([\s\S]*?)<\/td>/i);

    const priceTarget = boatPriceMatch?.[1] || nativePriceMatch?.[1] || pclPriceMatch?.[1];
    if (priceTarget) {
      const cleanTarget = priceTarget.replace(/<select[\s\S]*?<\/select>/gi, '').replace(/<[^>]+>/g, ' ').trim();
      const numMatch = cleanTarget.match(/(?:£|€|\$|GBP|EUR|USD)\s*([\d,.]+)|([\d,.]+)/i);
      if (numMatch) {
        rawPriceText = cleanTarget;
        if (cleanTarget.includes('€') || cleanTarget.includes('EUR')) currency = 'EUR';
        else if (cleanTarget.includes('$') || cleanTarget.includes('USD')) currency = 'USD';
        else currency = 'GBP';

        const pStr = numMatch[1] || numMatch[2];
        const num = parseFloat(pStr.replace(/,/g, ''));
        if (!isNaN(num) && num > 0) {
          price = num;
          priceSource = 'marketplace-adapter';
        }
      }
    }
  }

  // Extração de Localização em Apollo Duck
  let rawLocationText = '';
  let city = '';
  let country = 'United Kingdom';
  let locationSource: MarketplaceAdapterResult['locationSource'] = 'not-found';

  const locRowMatch = decodedHtml.match(/<td[^>]*class=["']_pclLabel["'][^>]*>\s*(?:Location|Lying):\s*<\/td>\s*<td[^>]*class=["']_pclData["'][^>]*>([\s\S]*?)<\/td>/i);
  if (locRowMatch) {
    const rawLoc = locRowMatch[1]
      .replace(/\[\s*<a[^>]*>[\s\S]*?<\/a>\s*\]/gi, '') // remove [View Map]
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (rawLoc) {
      rawLocationText = rawLoc;
      locationSource = 'marketplace-adapter';

      let cleanLoc = rawLoc.replace(/\bUK\b/i, '').replace(/\bUnited Kingdom\b/i, '').trim();
      cleanLoc = cleanLoc.replace(/,$/, '').trim();
      const parts = cleanLoc.split(',').map(p => p.trim()).filter(Boolean);
      city = parts[0] || cleanLoc;
      country = 'United Kingdom';
    }
  }

  // Extração de especificações
  let year = '';
  let length = '';
  let beam = '';
  let draft = '';
  let manufacturer = '';
  let model = '';

  const specRows = decodedHtml.match(/<tr[^>]*class=["']_pclLine["'][^>]*>[\s\S]*?<\/tr>/gi) || [];
  for (const row of specRows) {
    const labelMatch = row.match(/<td[^>]*class=["']_pclLabel["'][^>]*>([\s\S]*?)<\/td>/i);
    const dataMatch = row.match(/<td[^>]*class=["']_pclData["'][^>]*>([\s\S]*?)<\/td>/i);
    if (labelMatch && dataMatch) {
      const lbl = labelMatch[1].replace(/<[^>]+>/g, '').trim().toLowerCase();
      const val = dataMatch[1].replace(/<[^>]+>/g, '').trim();

      if (lbl.includes('year') || lbl.includes('built')) year = val;
      else if (lbl.includes('loa') || lbl.includes('length')) length = val;
      else if (lbl.includes('beam')) beam = val;
      else if (lbl.includes('draft')) draft = val;
      else if (lbl.includes('manufacturer') || lbl.includes('builder')) manufacturer = val;
      else if (lbl.includes('model')) model = val;
    }
  }

  return {
    price,
    currency,
    priceOnApplication,
    city,
    country,
    year,
    length,
    beam,
    draft,
    manufacturer,
    model,
    priceSource,
    locationSource,
    rawPriceText,
    rawLocationText
  };
}

// ADAPTADOR 2: BOATS AND OUTBOARDS
export function extractBoatsAndOutboardsData(textOrHtml: string, url: string): MarketplaceAdapterResult {
  let rawPriceText = '';
  let price = 0;
  let currency = 'GBP';
  let priceOnApplication = false;
  let priceSource: MarketplaceAdapterResult['priceSource'] = 'not-found';

  let rawLocationText = '';
  let city = '';
  let country = 'United Kingdom';
  let locationSource: MarketplaceAdapterResult['locationSource'] = 'not-found';

  // 1. JSON embutido ("boatcity":"poole", "boatcountry":"gb", "price":799950)
  const boatCityMatch = textOrHtml.match(/"boatcity"\s*:\s*"([^"]+)"/i);
  const boatCountryMatch = textOrHtml.match(/"boatcountry"\s*:\s*"([^"]+)"/i);
  if (boatCityMatch && boatCityMatch[1]) {
    city = boatCityMatch[1].charAt(0).toUpperCase() + boatCityMatch[1].slice(1);
    if (boatCountryMatch?.[1]?.toLowerCase() === 'gb' || boatCountryMatch?.[1]?.toLowerCase() === 'uk') {
      country = 'United Kingdom';
    }
    rawLocationText = `${city}, ${country}`;
    locationSource = 'marketplace-adapter';
  }

  // 2. Localização por padrão de texto ("Poole, Dorset")
  if (!city) {
    const textLocMatch = textOrHtml.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*(Dorset|Hampshire|Devon|Cornwall|Kent|Essex|Norfolk|Suffolk|Surrey|Sussex|Lincolnshire|Yorkshire|Pembrokeshire|Argyll|Fife|Glamorgan)\b/i);
    if (textLocMatch) {
      city = textLocMatch[1];
      rawLocationText = textLocMatch[0];
      country = 'United Kingdom';
      locationSource = 'marketplace-adapter';
    }
  }

  // 3. Sufixo no título ("Fairline Targa 50 Open | 15m | 2025 - Dorset | Boats and Outboards")
  if (!city) {
    const titleLocMatch = textOrHtml.match(/-\s*([A-Za-z\s]+)\s*\|\s*Boats and Outboards/i);
    if (titleLocMatch && titleLocMatch[1]) {
      const cand = titleLocMatch[1].trim();
      if (!/boat|sale|search|login/i.test(cand)) {
        city = cand;
        rawLocationText = cand;
        country = 'United Kingdom';
        locationSource = 'marketplace-adapter';
      }
    }
  }

  // Preço
  const jsonPriceMatch = textOrHtml.match(/"price"\s*:\s*"?(\d+)"?/i) || textOrHtml.match(/"listingPrice"\s*:\s*"?(\d+)"?/i);
  if (jsonPriceMatch && jsonPriceMatch[1] && parseInt(jsonPriceMatch[1], 10) > 100) {
    price = parseInt(jsonPriceMatch[1], 10);
    rawPriceText = `${price}`;
    currency = 'GBP';
    priceSource = 'marketplace-adapter';
  } else {
    const textPriceMatch = textOrHtml.match(/£\s*([\d,.]+)/i);
    if (textPriceMatch && textPriceMatch[1]) {
      rawPriceText = textPriceMatch[0];
      const p = parseFloat(textPriceMatch[1].replace(/,/g, ''));
      if (!isNaN(p) && p > 0) {
        price = p;
        currency = 'GBP';
        priceSource = 'marketplace-adapter';
      }
    }
  }

  // Especificações
  let year = '';
  let manufacturer = '';
  let model = '';

  const yearMatch = textOrHtml.match(/"modelyear"\s*:\s*"([^"]+)"/i) || textOrHtml.match(/\b(20\d{2}|19\d{2})\b/);
  if (yearMatch) year = yearMatch[1];

  const makeMatch = textOrHtml.match(/"make"\s*:\s*"([^"]+)"/i);
  if (makeMatch) manufacturer = makeMatch[1];

  const modelMatch = textOrHtml.match(/"model"\s*:\s*"([^"]+)"/i);
  if (modelMatch) model = modelMatch[1];

  return {
    price,
    currency,
    priceOnApplication,
    city,
    country,
    year,
    manufacturer,
    model,
    priceSource,
    locationSource,
    rawPriceText,
    rawLocationText
  };
}

// ADAPTADOR 3: GUMTREE
export function extractGumtreeData(textOrHtml: string, url: string): MarketplaceAdapterResult {
  let rawPriceText = '';
  let price = 0;
  let currency = 'GBP';
  let priceOnApplication = false;
  let priceSource: MarketplaceAdapterResult['priceSource'] = 'not-found';

  let rawLocationText = '';
  let city = '';
  let country = 'United Kingdom';
  let locationSource: MarketplaceAdapterResult['locationSource'] = 'not-found';

  // Localização
  const titleLocMatch = textOrHtml.match(/\|\s*in\s+([^|]+)\|/i) || textOrHtml.match(/Location[:\s]+([^\n<]+)/i) || textOrHtml.match(/itemprop=["']addressLocality["'][^>]*>([^<]+)</i);
  if (titleLocMatch && titleLocMatch[1]) {
    const cand = titleLocMatch[1].trim();
    if (cand) {
      city = cand.split(',')[0].trim();
      rawLocationText = cand;
      locationSource = 'marketplace-adapter';
    }
  }

  // Preço
  const priceMatch = textOrHtml.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i) || textOrHtml.match(/£\s*([\d,.]+)/i);
  if (priceMatch) {
    const rawP = priceMatch[1] || priceMatch[0];
    const p = parsePrice(rawP);
    if (p > 0) {
      price = p;
      rawPriceText = rawP;
      priceSource = 'marketplace-adapter';
    }
  }

  return {
    price,
    currency,
    priceOnApplication,
    city,
    country,
    priceSource,
    locationSource,
    rawPriceText,
    rawLocationText
  };
}

// Extração de Preço e Moeda (Genérico)
interface PriceResult {
  price: number;
  currency: string;
  priceOnApplication: boolean;
  priceRequiresReview: boolean;
  priceSource: 'json-ld' | 'embedded-json' | 'marketplace-adapter' | 'visible-html' | 'gemini' | 'not-found';
  rawPriceText: string;
}

function extractPriceAndCurrency(
  html: string,
  productNode: any,
  jsonLdList: any[],
  rawTitle: string,
  url: string
): PriceResult {
  const lowerUrl = url.toLowerCase();
  
  let defaultCurrency = 'GBP';
  if (lowerUrl.includes('.pt') || lowerUrl.includes('olx.pt') || lowerUrl.includes('barcos.pt')) {
    defaultCurrency = 'EUR';
  } else if (lowerUrl.includes('.uk') || lowerUrl.includes('gumtree.com') || lowerUrl.includes('apolloduck.com') || lowerUrl.includes('boatsandoutboards') || lowerUrl.includes('boatshop24')) {
    defaultCurrency = 'GBP';
  }

  // 1. Verificação de Sob Consulta / POA
  const poaRegex = /\b(?:poa|price on application|price on request|sob consulta|a consultar|price upon request)\b/i;
  if (poaRegex.test(rawTitle + ' ' + html.slice(0, 8000))) {
    return {
      price: 0,
      currency: defaultCurrency,
      priceOnApplication: true,
      priceRequiresReview: false,
      priceSource: 'visible-html',
      rawPriceText: 'POA'
    };
  }

  let extractedPrice = 0;
  let extractedCurrency = defaultCurrency;
  let priceSource: PriceResult['priceSource'] = 'not-found';
  let rawPriceText = '';

  const detectCurrency = (str: string) => {
    if (!str) return;
    if (str.includes('€') || /\beur\b/i.test(str)) extractedCurrency = 'EUR';
    else if (str.includes('£') || /\bgbp\b/i.test(str)) extractedCurrency = 'GBP';
    else if (str.includes('$') || /\busd\b/i.test(str)) extractedCurrency = 'USD';
  };

  // Etapa 1: Metatags Open Graph & Produto
  const ogPriceAmount = extractMetaContent(html, 'product:price:amount') || extractMetaContent(html, 'og:price:amount');
  const ogPriceCurrency = extractMetaContent(html, 'product:price:currency') || extractMetaContent(html, 'og:price:currency');
  if (ogPriceCurrency) detectCurrency(ogPriceCurrency);

  if (ogPriceAmount) {
    extractedPrice = parsePrice(ogPriceAmount);
    if (extractedPrice > 0) {
      priceSource = 'visible-html';
      rawPriceText = ogPriceAmount;
    }
  }

  // Etapa 2: JSON-LD
  if (extractedPrice === 0) {
    const checkOffer = (offer: any) => {
      if (!offer) return;
      if (offer.priceCurrency) detectCurrency(offer.priceCurrency);
      if (offer.price !== undefined && offer.price !== null) {
        const p = parsePrice(offer.price);
        if (p > 0) {
          extractedPrice = p;
          priceSource = 'json-ld';
          rawPriceText = String(offer.price);
        }
      } else if (offer.lowPrice !== undefined && offer.lowPrice !== null) {
        const p = parsePrice(offer.lowPrice);
        if (p > 0) {
          extractedPrice = p;
          priceSource = 'json-ld';
          rawPriceText = String(offer.lowPrice);
        }
      }
    };

    if (productNode?.offers) {
      if (Array.isArray(productNode.offers)) {
        for (const o of productNode.offers) {
          checkOffer(o);
          if (extractedPrice > 0) break;
        }
      } else {
        checkOffer(productNode.offers);
      }
    }
  }

  // Etapa 3: Schema.org microdata (itemprop="price")
  if (extractedPrice === 0) {
    const itempropPriceMatch = html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i) || html.match(/content=["']([^"']+)["'][^>]*itemprop=["']price["']/i);
    if (itempropPriceMatch) {
      extractedPrice = parsePrice(itempropPriceMatch[1]);
      if (extractedPrice > 0) {
        priceSource = 'visible-html';
        rawPriceText = itempropPriceMatch[1];
      }
    }
    const itempropCurrencyMatch = html.match(/itemprop=["']priceCurrency["'][^>]*content=["']([^"']+)["']/i);
    if (itempropCurrencyMatch) {
      detectCurrency(itempropCurrencyMatch[1]);
    }
  }

  // Etapa 4: Dados de Hidratação Embutidos (__NEXT_DATA__, __NUXT__, __INITIAL_STATE__)
  if (extractedPrice === 0) {
    const jsonMatches = html.match(/<script[^>]*id=["'](?:__NEXT_DATA__|__NUXT__|__INITIAL_STATE__)["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonMatches) {
      for (const jm of jsonMatches) {
        const cleanContent = jm.replace(/<[^>]+>/g, '');
        const pMatch = cleanContent.match(/"(?:price|askingPrice|listingPrice|amount)"\s*:\s*"?(\d+(?:[.,]\d+)?)"?/i);
        if (pMatch) {
          const p = parsePrice(pMatch[1]);
          if (p > 0) {
            extractedPrice = p;
            priceSource = 'embedded-json';
            rawPriceText = pMatch[1];
            const cMatch = cleanContent.match(/"(?:currency|priceCurrency|currencyCode)"\s*:\s*"([A-Z]{3})"/i);
            if (cMatch) detectCurrency(cMatch[1]);
            break;
          }
        }
      }
    }
  }

  // Etapa 5: Elementos HTML DOM com classes de preço
  if (extractedPrice === 0) {
    const priceClassMatch = html.match(/(?:class|id)=["'][^"']*(?:price|asking-price|boat-price|ad-price|listing-price)[^"']*["'][^>]*>([^<]+)</i);
    if (priceClassMatch) {
      detectCurrency(priceClassMatch[1]);
      extractedPrice = parsePrice(priceClassMatch[1]);
      if (extractedPrice > 0) {
        priceSource = 'visible-html';
        rawPriceText = priceClassMatch[1];
      }
    }
  }

  // Etapa 6: Regex inteligente sobre título e snippet inicial do HTML
  if (extractedPrice === 0) {
    const snippet = (rawTitle + ' ' + html.slice(0, 10000));
    const priceMatch = snippet.match(/(?:€|£|\$)\s*([\d,.]+)|([\d,.]+)\s*(?:€|£|\$|GBP|EUR|USD)/i);
    if (priceMatch) {
      detectCurrency(priceMatch[0]);
      extractedPrice = parsePrice(priceMatch[1] || priceMatch[2]);
      if (extractedPrice > 0) {
        priceSource = 'visible-html';
        rawPriceText = priceMatch[0];
      }
    }
  }

  if (extractedPrice > 0) {
    return {
      price: extractedPrice,
      currency: extractedCurrency,
      priceOnApplication: false,
      priceRequiresReview: false,
      priceSource,
      rawPriceText
    };
  }

  return {
    price: 0,
    currency: extractedCurrency,
    priceOnApplication: false,
    priceRequiresReview: true,
    priceSource: 'not-found',
    rawPriceText: ''
  };
}

// Extração de Localização (Genérico)
interface LocationResult {
  city: string;
  country: string;
  locationRequiresReview: boolean;
  locationSource: 'json-ld' | 'embedded-json' | 'marketplace-adapter' | 'visible-html' | 'gemini' | 'not-found';
  rawLocationText: string;
}

function extractLocation(
  html: string,
  jsonLdList: any[],
  url: string
): LocationResult {
  const lowerUrl = url.toLowerCase();
  const defaultCountry = 'United Kingdom';

  let foundLoc: string | null = null;
  let locationSource: LocationResult['locationSource'] = 'not-found';

  // 1. Procura em JSON-LD
  foundLoc = findLocationInJsonLd(jsonLdList);
  if (foundLoc) locationSource = 'json-ld';

  // 2. Procura em OpenGraph / Metatags
  if (!foundLoc) {
    foundLoc = extractMetaContent(html, 'og:locality') || extractMetaContent(html, 'geo.placename') || extractMetaContent(html, 'locality');
    if (foundLoc) locationSource = 'visible-html';
  }

  // 3. Procura em atributos Microdata / JSON
  if (!foundLoc) {
    const localityMatch = html.match(/"addressLocality"\s*:\s*"([^"]+)"/i) || 
                          html.match(/"addressRegion"\s*:\s*"([^"]+)"/i) || 
                          html.match(/"cityName"\s*:\s*"([^"]+)"/i) ||
                          html.match(/itemprop=["']addressLocality["'][^>]*>([^<]+)</i);
    if (localityMatch) {
      foundLoc = localityMatch[1];
      locationSource = 'embedded-json';
    }
  }

  // 4. Procura por palavras-chave visíveis no texto do anúncio marítimo
  if (!foundLoc) {
    const locationTextMatches = html.match(/(?:Boat Location|Location|Lying|Based in|Marina|Port|Harbour|Town|County|Docked in)[:\s]+([A-Za-z0-9\s,.-]{3,35})(?:<|\n|"|;|\))/i);
    if (locationTextMatches) {
      const candidate = locationTextMatches[1].trim();
      if (candidate && !/cookie|policy|rights|copyright|terms|privacy|navigation/i.test(candidate)) {
        foundLoc = candidate;
        locationSource = 'visible-html';
      }
    }
  }

  // Sanitização da localização encontrada
  if (foundLoc) {
    let clean = decodeHtmlEntities(String(foundLoc)).replace(/[\r\n]+/g, ' ').trim();
    if (
      clean &&
      clean.length > 1 &&
      clean.length < 60 &&
      !/copyright|all rights|limited|ltd|inc|website|homepage|cookies|privacy/i.test(clean)
    ) {
      const parts = clean.split(',').map(p => p.trim());
      const cityPart = parts[0] || clean;
      return {
        city: cityPart,
        country: defaultCountry,
        locationRequiresReview: false,
        locationSource,
        rawLocationText: clean
      };
    }
  }

  return {
    city: "",
    country: defaultCountry,
    locationRequiresReview: true,
    locationSource: 'not-found',
    rawLocationText: ''
  };
}

// Função para descarregar o HTML da página do anúncio
async function fetchAdHtml(url: string): Promise<{ html: string; source: string; status: number }> {
  console.log('[Import Pipeline] Stage: Fetching HTML from URL:', url);

  const headersList = [
    {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9,pt-PT,pt;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Upgrade-Insecure-Requests': '1'
    },
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'pt-PT,pt;q=0.9,en-GB;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  ];

  // Tentativa 1: Fetch direto com Headers de browser
  for (let i = 0; i < headersList.length; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: headersList[i]
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        if (text && !text.includes('Request Blocked') && !text.includes('Link11') && text.length > 2000) {
          console.log(`[Import Pipeline] Direct fetch attempt ${i + 1} succeeded! HTML Length: ${text.length}`);
          return { html: text, source: 'direct', status: res.status };
        }
      } else {
        console.warn(`[Import Pipeline] Direct fetch attempt ${i + 1} returned status: ${res.status}`);
      }
    } catch (err: any) {
      console.warn(`[Import Pipeline] Direct fetch attempt ${i + 1} error: ${err.message}`);
    }
  }

  // Tentativa 2: Jina Reader Proxy Fallback
  try {
    console.log('[Import Pipeline] Trying Jina Reader proxy fallback...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const jRes = await fetch("https://r.jina.ai/" + url, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (jRes.ok) {
      const jText = await jRes.text();
      if (jText && jText.length > 500 && !jText.includes("Request Blocked")) {
        console.log('[Import Pipeline] Jina Reader fallback succeeded! Length:', jText.length);
        return { html: jText, source: 'jina', status: 200 };
      }
    }
  } catch (jErr: any) {
    console.warn('[Import Pipeline] Jina fallback error:', jErr.message);
  }

  // Tentativa 3: Microlink API Proxy Fallback
  try {
    console.log('[Import Pipeline] Trying Microlink API proxy fallback...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const mRes = await fetch("https://api.microlink.io/?url=" + encodeURIComponent(url) + "&prerender=true", {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (mRes.ok) {
      const mData = await mRes.json();
      if (mData?.status === 'success' && mData?.data) {
        console.log('[Import Pipeline] Microlink API proxy fallback succeeded!');
        const d = mData.data;
        const syntheticHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>${d.title || ''}</title>
              <meta property="og:title" content="${d.title || ''}" />
              <meta property="og:description" content="${d.description || ''}" />
              <meta property="og:image" content="${d.image?.url || ''}" />
              <meta name="description" content="${d.description || ''}" />
            </head>
            <body>
              <h1>${d.title || ''}</h1>
              <p>${d.description || ''}</p>
              ${d.image?.url ? `<img src="${d.image.url}" />` : ''}
            </body>
          </html>
        `;
        return { html: syntheticHtml, source: 'microlink', status: 200 };
      }
    }
  } catch (mErr: any) {
    console.warn('[Import Pipeline] Microlink fallback error:', mErr.message);
  }

  throw new Error('Não foi possível transferir o conteúdo da página do anúncio. O fornecedor bloqueou a ligação.');
}

// Helper para extração de especificações náuticas e suporte a IA Gemini
async function extractNauticalDetails(title: string, description: string, rawHtml?: string): Promise<Record<string, any>> {
  console.log('[Import Pipeline] Stage: Extracting nautical details via AI/Regex...');

  const result: Record<string, any> = {
    boatType: '',
    manufacturer: '',
    model: '',
    year: '',
    condition: '',
    length: '',
    beam: '',
    draft: '',
    fuelType: '',
    engineBrand: '',
    horsepower: '',
    engineHours: '',
    cabins: '',
    berths: '',
    bathrooms: '',
    hullMaterial: '',
    trailerIncluded: '',
    vatPaid: '',
    ceCertified: '',
    extractedPrice: 0,
    extractedCity: '',
    aiPriceOnApplication: false
  };

  const combinedText = `${title || ''}\n${description || ''}\n${(rawHtml || '').slice(0, 8000)}`;
  const lowerText = combinedText.toLowerCase();

  try {
    console.log('[Import Pipeline] Calling Gemini AI (gemini-2.5-flash)...');
    const { GoogleGenAI } = await import('@google/genai');
    const apiKey = process.env.GEMINI_API_KEY || "AIzaSyBewRCSZ-nNqXiaVCRzgpfI1ieWf5QEyq4";
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const prompt = `Você é um motor de extração de dados náuticos de nível profissional e altíssima precisão.
Sua missão é analisar o título, tabelas de especificações, marcadores e descrição deste anúncio náutico e extrair as especificações exatas em JSON estrito.

REGRAS RÍGIDAS DE PRECISÃO - NUNCA INVENTE DADOS:
- A PRECISÃO É MUITO MAIS IMPORTANTE QUE A COMPLETUDE. Um campo omitido/vazio é INFINITAMENTE MELHOR do que um dado inventado, estimado ou incorreto.
- NUNCA adivinhe, estime, fabrique, presuma ou invente informações que não estejam explicitamente escritas no texto do anúncio.
- Se uma informação NÃO for mencionada no texto, retorne "" (string vazia) ou 0 para números.
- Se a confiança sobre uma informação for BAIXA, DEIXE O CAMPO VAZIO ("").

DIRETRIZES CAMPO A CAMPO:
1. boatType: "Sailboat" | "Motorboat" | "RIB" | "Jet Ski" | "Fishing Boat" | "Catamaran" | "Canal Boat" | "Narrowboat" | "Yacht" | "Houseboat" | "Commercial Boat" | "Other" | ""
2. manufacturer & model: Fabricante exato (ex: "Princess", "Beneteau", "Fairline", "Tornado", "Fletcher") e modelo exato (ex: "V48", "Oceanis 34.1", "Targa 50", "5.5m", "Arrowflyte").
3. year: Ano real de fabricação de 4 dígitos (ex: "1982", "2021", "2025"). Nunca anos futuros ou códigos.
4. length, beam, draft: Comprimento total (LOA), boca e calado com unidades (ex: "8.23 m", "22 ft", "15m").
5. berths, cabins, bathrooms: Contagem exata em string.
6. fuelType, engineBrand, horsepower, engineHours: Especificações do motor se explícitas.
7. trailerIncluded, vatPaid, ceCertified: "Yes" ou "No" apenas se afirmado explicitamente.
8. extractedPrice: Valor numérico do preço se presente no texto (ex: 799950), ou 0 se não encontrado.
9. extractedCity: Cidade, concelho ou porto/marina onde o barco se encontra se explícito (ex: "Poole", "West Mersea", "East End"), ou "".
10. aiPriceOnApplication: true se for "POA" / "Sob consulta", senão false.

Retorne APENAS um objeto JSON válido com essa estrutura.`;

    const aiRes = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: `${prompt}\n\nTexto do anúncio:\n${combinedText}` }] },
      config: { responseMimeType: "application/json" }
    });

    if (aiRes.text) {
      const cleanJson = aiRes.text.replace(/```json/gi, '').replace(/```/gi, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed && typeof parsed === 'object') {
        Object.keys(result).forEach(key => {
          if (parsed[key] !== undefined && parsed[key] !== null) {
            result[key] = parsed[key];
          }
        });
        console.log('[Import Pipeline] Gemini AI extraction succeeded!');
        return result;
      }
    }
  } catch (err: any) {
    console.warn("[Import Pipeline] Gemini AI extraction failed or timed out. Falling back to regex rules:", err.message);
  }

  // Fallback seguro por expressões regulares
  const currentYear = new Date().getFullYear();
  const yearExplicitMatch = combinedText.match(/\b(?:year|built|built in|ano|fabrico|ano de fabrico)[:\s]*([12]\d{3})\b/i);
  if (yearExplicitMatch) {
    const yr = parseInt(yearExplicitMatch[1], 10);
    if (yr >= 1850 && yr <= currentYear + 1) {
      result.year = String(yr);
    }
  }

  const loaMatch = combinedText.match(/\b(?:loa|length|comprimento|comprimento total)[:\s]*(\d+(?:[.,]\d+)?\s*(?:m|metres|meters|ft|feet|'))\b/i);
  if (loaMatch) result.length = loaMatch[1];

  const beamMatch = combinedText.match(/\b(?:beam|boca|largura)[:\s]*(\d+(?:[.,]\d+)?\s*(?:m|metres|meters|ft|feet|'))\b/i);
  if (beamMatch) result.beam = beamMatch[1];

  const draftMatch = combinedText.match(/\b(?:draft|max draft|calado)[:\s]*(\d+(?:[.,]\d+)?\s*(?:m|metres|meters|ft|feet|'))\b/i);
  if (draftMatch) result.draft = draftMatch[1];

  const hpMatch = combinedText.match(/\b(\d+)\s*(?:hp|cv|bhp|ps)\b/i);
  if (hpMatch) result.horsepower = hpMatch[0];

  const engineBrands = ['Mercury', 'Yamaha', 'Volvo Penta', 'Honda', 'Suzuki', 'Yanmar', 'Mercruiser', 'Evinrude', 'Tohatsu', 'Cummins', 'Caterpillar', 'Perkins', 'Nanni', 'Beta Marine'];
  const foundBrand = engineBrands.find(b => lowerText.includes(b.toLowerCase()));
  if (foundBrand) result.engineBrand = foundBrand;

  if (/\bdiesel\b/i.test(combinedText)) result.fuelType = 'Diesel';
  else if (/\b(?:gasolina|petrol|gasoline)\b/i.test(combinedText)) result.fuelType = 'Petrol / Gasoline';
  else if (/\b(?:eletrico|elétrico|electric)\b/i.test(combinedText)) result.fuelType = 'Electric';

  if (/\b(?:veleiro|sailboat|sailing|mast|rigging|sloop|ketch|schooner|mainsail|keel|bilge keel|fin keel)\b/i.test(combinedText)) {
    result.boatType = 'Sailboat';
  } else if (/\b(?:semirrigido|semi-rigido|rib|zodiac|ribcraft)\b/i.test(combinedText)) {
    result.boatType = 'RIB';
  } else if (/\b(?:jet ski|jetski|waverunner|pwc|sea-doo|seadoo|mota de agua)\b/i.test(combinedText)) {
    result.boatType = 'Jet Ski';
  } else if (/\b(?:catamara|catamaran|multihull|trimaran)\b/i.test(combinedText)) {
    result.boatType = 'Catamaran';
  } else if (/\b(?:iate|superyacht|luxury yacht)\b/i.test(combinedText)) {
    result.boatType = 'Yacht';
  } else if (/\b(?:barco de pesca|fishing boat|cuddy fisher|pilothouse|traineira)\b/i.test(combinedText)) {
    result.boatType = 'Fishing Boat';
  } else if (/\b(?:lancha|barco a motor|motorboat|motor cruiser|speed boat|day cruiser)\b/i.test(combinedText)) {
    result.boatType = 'Motorboat';
  }

  const builders = ['Atlanta Marine', 'Atlanta', 'Beneteau', 'Jeanneau', 'Quicksilver', 'Bayliner', 'Sea Ray', 'Bavaria', 'Yamaha', 'Sessa', 'Princess', 'Sunseeker', 'Azimut', 'Boston Whaler', 'Ranieri', 'Capelli', 'Zodiac', 'Mastercraft', 'Monterey', 'Chaparral', 'Regal', 'Westerly', 'Moody', 'Sadler', 'Hunter', 'Hanse', 'Dufour', 'Hallberg-Rassy', 'Catalina', 'MacGregor', 'Fairline', 'Sealine', 'Orkney', 'Fletcher', 'Tornado'];
  const foundBuilder = builders.find(b => lowerText.includes(b.toLowerCase()));
  if (foundBuilder) result.manufacturer = foundBuilder;

  return result;
}

// Handler Serverless Function da Vercel / Express
export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    console.log('[Import Pipeline] Stage 1: Request received');
    const { url, userRole } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    // Permission check
    if (userRole !== 'admin' && userRole !== 'moderator') {
      console.warn('[Import Pipeline Failure] Permission denied for role:', userRole);
      return res.status(403).json({ 
        success: false, 
        stage: 'Permission Validation',
        error: 'Access denied. Only administrators or moderators can import listings from URL.' 
      });
    }

    if (!url) {
      return res.status(400).json({ success: false, stage: 'URL Validation', error: "Please provide a listing URL." });
    }

    const lowerUrl = url.toLowerCase();
    const marketplace = getSupportedMarketplace(url);
    const isOlx = marketplace?.id === 'olx' || lowerUrl.includes('olx.pt');
    const isGumtree = marketplace?.id === 'gumtree' || lowerUrl.includes('gumtree.com') || lowerUrl.includes('gumtree.co.uk');
    const isApolloDuck = marketplace?.id === 'apolloduck' || lowerUrl.includes('apolloduck.com');
    const isBoatsAndOutboards = marketplace?.id === 'boatsandoutboards' || lowerUrl.includes('boatsandoutboards.co.uk');
    const isTestUrl = lowerUrl.includes('teste.mercadoluso.com') || lowerUrl.includes('teste.mercadoluso');

    if (!marketplace && !isTestUrl) {
      return res.status(200).json({
        success: false,
        stage: 'Platform Support Check',
        error: getSupportedMarketplacesMessage()
      });
    }

    // Suporte a URLs de teste para simulação e homologação local/preview
    if (isTestUrl) {
      console.log('[Import Pipeline] Handling test URL preview mode...');
      return res.status(200).json({
        success: true,
        stage: 'Complete',
        data: {
          title: "Beneteau Antares 8 OB (2021) - Mercury 200 HP",
          description: "Beneteau Antares 8 OB em estado imaculado, ano 2021. Equipado com motor fora-de-borda Mercury Verado 200 HP com 140 horas de navegação.\n\nFicha Técnica:\n- Comprimento: 8.23 m | Boca: 2.76 m | Calado: 0.80 m\n- Casco em Fibra de Vidro (GRP)\n- 1 Cabine, 4 Camas, 1 WC elétrico\n- Reboque incluído e IVA pago.",
          price: 68500,
          currency: "EUR",
          priceOnApplication: false,
          priceRequiresReview: false,
          category: "Boats for Sale",
          city: "Faro",
          country: "Portugal",
          locationRequiresReview: false,
          images: [
            "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&auto=format&fit=crop&q=60"
          ],
          boatType: "Motorboat",
          manufacturer: "Beneteau",
          model: "Antares 8 OB",
          year: "2021",
          condition: "Used - Excellent",
          length: "8.23 m",
          beam: "2.76 m",
          draft: "0.80 m",
          fuelType: "Petrol / Gasoline",
          engineBrand: "Mercury",
          horsepower: "200 HP",
          engineHours: "140 h",
          cabins: "1",
          berths: "4",
          bathrooms: "1",
          hullMaterial: "Fiberglass / GRP",
          trailerIncluded: "Yes",
          vatPaid: "Yes",
          ceCertified: "Yes",
          listingMode: "external",
          sourceUrl: url,
          sourceSite: "ConnectBoat Test Marketplace"
        }
      });
    }

    // Stage 2: Fetch HTML
    let responseText = '';
    let fetchSource = 'direct';
    let fetchStatus = 200;
    try {
      const fetchResult = await fetchAdHtml(url);
      responseText = fetchResult.html;
      fetchSource = fetchResult.source;
      fetchStatus = fetchResult.status;
    } catch (fetchErr: any) {
      console.error("[Import Pipeline Failure Stage 2 - Fetch HTML]:", fetchErr.message);
      return res.status(200).json({
        success: false,
        stage: 'Fetching HTML',
        error: 'Unable to import listing data. The origin server rejected the connection or the page is unavailable.'
      });
    }

    // Stage 3: Marketplace-Specific Adapter Execution
    let adapterRes: MarketplaceAdapterResult | null = null;
    if (isApolloDuck) {
      console.log('[Import Pipeline] Running Apollo Duck Marketplace Adapter...');
      adapterRes = extractApolloDuckData(responseText, url);
    } else if (isBoatsAndOutboards) {
      console.log('[Import Pipeline] Running Boats & Outboards Marketplace Adapter...');
      adapterRes = extractBoatsAndOutboardsData(responseText, url);
    } else if (isGumtree) {
      console.log('[Import Pipeline] Running Gumtree Marketplace Adapter...');
      adapterRes = extractGumtreeData(responseText, url);
    }

    // Parse Metadata & JSON-LD
    console.log('[Import Pipeline] Stage 3: Parsing metadata & JSON-LD...');
    const jsonLdList = extractJsonLd(responseText);
    const productNode = extractFromJsonLdList(jsonLdList);

    // Title Extraction
    let rawTitle = extractMetaContent(responseText, 'og:title');
    if (!rawTitle) {
      rawTitle = productNode?.name || productNode?.title || extractMetaContent(responseText, 'twitter:title') || '';
    }
    if (!rawTitle) {
      const titleMatch = responseText.match(/<title>([^<]+)<\/title>/i);
      rawTitle = titleMatch ? titleMatch[1] : '';
    }
    // Jina Reader Markdown Title Header ("Title: ..." or "# ...")
    if (!rawTitle || /second-hand|items for sale|access denied|attention required|just a moment/i.test(rawTitle)) {
      const jinaTitleMatch = responseText.match(/^Title:\s*([^\n]+)/m) || responseText.match(/^#\s*([^\n]+)/m);
      if (jinaTitleMatch) {
        rawTitle = jinaTitleMatch[1].trim();
      }
    }

    // Check if the page is a 404, deleted, or dead listing
    const isDeadOr404Listing = (html: string, rawTitleStr: string): boolean => {
      const normTitle = (rawTitleStr || '').toLowerCase();
      const normHtml = (html || '').toLowerCase();
      const deadPatterns = [
        '404 page not found',
        '404 - page not found',
        '404 not found',
        'page not found',
        'ad no longer available',
        'listing no longer available',
        'listing expired',
        'item no longer available',
        'this ad has been removed',
        'this ad is no longer active',
        'página não encontrada',
        'anúncio indisponível',
        'anúncio expirado',
        'access denied',
        'attention required',
        'just a moment'
      ];
      if (deadPatterns.some(pat => normTitle.includes(pat))) return true;
      if (
        normHtml.includes('target url returned error 404') ||
        (normHtml.includes('404 page not found') && !normHtml.includes('itemprop="name"')) ||
        (normHtml.includes('ad no longer available') && !normHtml.includes('itemprop="name"'))
      ) return true;
      return false;
    };

    if (isDeadOr404Listing(responseText, rawTitle)) {
      console.warn("[Import Pipeline Failure Stage 3 - Dead Listing/404 Detected]:", rawTitle);
      return res.status(200).json({
        success: false,
        stage: 'Listing Availability Check',
        error: 'This listing is no longer available or could not be found (404 Page Not Found). Please check the link or fill in details manually.'
      });
    }

    // Fallback by URL slug if title is still generic or empty
    if (!rawTitle || /second-hand|items for sale|access denied|attention required|just a moment/i.test(rawTitle)) {
      const urlSlugMatch = url.match(/\/([a-z0-9-]+?)(?:\/\d+)?\/?$/i);
      if (urlSlugMatch) {
        const slug = urlSlugMatch[1].replace(/[-_]/g, ' ').trim();
        if (slug.length > 5 && !/boats|kayaks|jet-skis|p|boat/i.test(slug)) {
          rawTitle = slug.charAt(0).toUpperCase() + slug.slice(1);
        }
      }
    }

    let title = cleanTitle(rawTitle);
    if (!title && rawTitle) {
      title = decodeHtmlEntities(rawTitle).trim();
    }

    if (!title) {
      console.error("[Import Pipeline Failure Stage 3 - Title Extraction]: Title empty");
      return res.status(200).json({
        success: false,
        stage: 'Parsing HTML',
        error: 'Unable to extract listing title. Please check if the listing link is active.'
      });
    }

    // Extração de Descrição
    let foundDescription = extractMetaContent(responseText, 'og:description');
    if (!foundDescription) {
      foundDescription = productNode?.description || extractMetaContent(responseText, 'twitter:description') || extractMetaContent(responseText, 'description') || '';
    }
    const description = cleanDescription(foundDescription);

    // Extração de Preço e Moeda
    const priceRes = extractPriceAndCurrency(responseText, productNode, jsonLdList, rawTitle, url);

    // Extração de Cidade e País
    const locRes = extractLocation(responseText, jsonLdList, url);

    // Consolidação de Preço
    let finalPrice = adapterRes?.price && adapterRes.price > 0 ? adapterRes.price : priceRes.price;
    let finalCurrency = adapterRes?.currency || priceRes.currency;
    let finalPriceOnApp = adapterRes?.priceOnApplication || priceRes.priceOnApplication;
    let finalPriceRequiresReview = finalPrice === 0 && !finalPriceOnApp;
    let priceSource = adapterRes?.price && adapterRes.price > 0 ? adapterRes.priceSource : priceRes.priceSource;
    let rawPriceText = adapterRes?.rawPriceText || priceRes.rawPriceText;

    // Consolidação de Localização
    let finalCity = adapterRes?.city || locRes.city;
    let finalCountry = adapterRes?.country || locRes.country;
    let finalLocRequiresReview = !finalCity;
    let locationSource = adapterRes?.city ? adapterRes.locationSource : locRes.locationSource;
    let rawLocationText = adapterRes?.rawLocationText || locRes.rawLocationText;

    // Mapeamento de Categoria
    let parsedCategory = productNode?.category || '';
    if (!parsedCategory) {
      for (const obj of jsonLdList) {
        if (obj?.itemListElement && Array.isArray(obj.itemListElement)) {
          const sortedItems = [...obj.itemListElement].sort((a,b) => (a.position || 0) - (b.position || 0));
          if (sortedItems.length > 1) {
            parsedCategory = sortedItems[1].name || sortedItems[1].item?.name || '';
          }
        }
      }
    }
    if (!parsedCategory) {
      parsedCategory = extractMetaContent(responseText, 'category') || '';
    }

    let category = inferConnectBoatCategory(title, description, parsedCategory);

    // Extração de Imagens
    let images: string[] = [];
    const ogImage = extractMetaContent(responseText, 'og:image');
    if (ogImage) images.push(ogImage);

    if (productNode?.image) {
      if (Array.isArray(productNode.image)) {
        productNode.image.forEach((img: any) => {
          const urlStr = typeof img === 'string' ? img : (typeof img === 'object' && img?.url ? img.url : '');
          if (urlStr) images.push(urlStr);
        });
      } else if (typeof productNode.image === 'string') {
        images.push(productNode.image);
      } else if (typeof productNode.image === 'object' && productNode.image?.url) {
        images.push(productNode.image.url);
      }
    }

    const twitterImg = extractMetaContent(responseText, 'twitter:image');
    if (twitterImg) images.push(twitterImg);
    
    const htmlImgMatches = responseText.match(/https?:\/\/[^\s"'>]+?\.olx\.pt\/v1\/files\/[a-zA-Z0-9_-]+\/image;[^\s"'>\)]*/gi) || [];
    for (const mUrl of htmlImgMatches) images.push(mUrl);

    if (isGumtree) {
      const ebayImgMatches = responseText.match(/https?:\/\/(?:i\.ebayimg\.com|img\.gumtree\.com|img\.gumtree\.co\.uk)[^\s"';,>]+/gi) || [];
      for (const mUrl of ebayImgMatches) images.push(mUrl);
    }

    const genericImgMatches = responseText.match(/https?:\/\/[^\s"'>\)]+?\.(?:jpg|jpeg|png|webp)/gi) || [];
    for (const mUrl of genericImgMatches) images.push(mUrl);

    const isValidImageUrl = (imgUrl: string): string | null => {
      if (!imgUrl || typeof imgUrl !== 'string') return null;
      try {
        let decoded = decodeHtmlEntities(imgUrl).trim();
        if (decoded.startsWith('//')) {
          decoded = 'https:' + decoded;
        }
        if (!decoded.startsWith('http://') && !decoded.startsWith('https://')) return null;
        const parsed = new URL(decoded);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          return parsed.toString();
        }
        return null;
      } catch (e) {
        return null;
      }
    };

    const isPlaceholderOrLogo = (imgUrl: string): boolean => {
      if (!imgUrl) return true;
      const lower = imgUrl.toLowerCase();
      const banned = ['logo', 'avatar', 'placeholder', 'no-image', 'no_image', 'default-image', 'spacer', '1x1', 'tracking', 'pixel', 'analytics', 'badge', 'fav-icon', 'favicon'];
      try {
        const pathname = new URL(imgUrl).pathname.toLowerCase();
        return banned.some(b => pathname.includes(b));
      } catch (e) {
        return false;
      }
    };

    const cleanImages: string[] = [];
    const seenImages = new Set<string>();

    for (const rawImg of images) {
      const normalized = isValidImageUrl(rawImg);
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (seenImages.has(key)) continue;
      if (isPlaceholderOrLogo(normalized)) continue;
      seenImages.add(key);
      cleanImages.push(normalized);
      if (cleanImages.length >= 6) break;
    }

    images = cleanImages;

    // Stage 4: Extração de Especificações Náuticas com Gemini AI
    const nauticalDetails = await extractNauticalDetails(title, description, responseText);

    // Preenche com dados do adaptador se disponíveis
    if (adapterRes?.year && !nauticalDetails.year) nauticalDetails.year = adapterRes.year;
    if (adapterRes?.manufacturer && !nauticalDetails.manufacturer) nauticalDetails.manufacturer = adapterRes.manufacturer;
    if (adapterRes?.model && !nauticalDetails.model) nauticalDetails.model = adapterRes.model;
    if (adapterRes?.length && !nauticalDetails.length) nauticalDetails.length = adapterRes.length;
    if (adapterRes?.beam && !nauticalDetails.beam) nauticalDetails.beam = adapterRes.beam;
    if (adapterRes?.draft && !nauticalDetails.draft) nauticalDetails.draft = adapterRes.draft;

    // Se preço ou cidade ainda não tiverem sido encontrados, usa o resultado da IA Gemini
    if (finalPrice === 0 && !finalPriceOnApp && nauticalDetails.extractedPrice && Number(nauticalDetails.extractedPrice) > 0) {
      finalPrice = Number(nauticalDetails.extractedPrice);
      finalPriceRequiresReview = false;
      priceSource = 'gemini';
      rawPriceText = String(finalPrice);
    }
    if (nauticalDetails.aiPriceOnApplication) {
      finalPriceOnApp = true;
      finalPriceRequiresReview = false;
      finalPrice = 0;
      priceSource = 'gemini';
      rawPriceText = 'POA';
    }

    if (!finalCity && nauticalDetails.extractedCity && typeof nauticalDetails.extractedCity === 'string' && nauticalDetails.extractedCity.trim()) {
      finalCity = nauticalDetails.extractedCity.trim();
      finalLocRequiresReview = false;
      locationSource = 'gemini';
      rawLocationText = finalCity;
    }

    const sourceSite = marketplace ? marketplace.name : getSourceSiteFromUrl(url);

    // Remove campos de controlo temporários
    delete nauticalDetails.extractedPrice;
    delete nauticalDetails.extractedCity;
    delete nauticalDetails.aiPriceOnApplication;

    console.log('[Import Pipeline] Stage 5: Import completed successfully!');

    // Diagnósticos de desenvolvimento para inspeção e auditoria
    const diagnostics = {
      httpStatus: fetchStatus,
      finalUrl: url,
      contentType: 'text/html',
      htmlLength: responseText.length,
      pageTitle: title,
      hasPrice: finalPrice > 0 || finalPriceOnApp,
      hasLocation: Boolean(finalCity),
      hasJsonLd: jsonLdList.length > 0,
      hasNextData: responseText.includes('__NEXT_DATA__'),
      hasHydrationData: responseText.includes('__NUXT__') || responseText.includes('__INITIAL_STATE__'),
      isAntiBotOrConsentShell: responseText.includes('Request Blocked') || responseText.includes('Cloudflare') || responseText.includes('Link11'),
      priceSource,
      locationSource,
      rawPriceText,
      rawLocationText,
      fetchSource
    };

    return res.status(200).json({
      success: true,
      stage: 'Complete',
      data: {
        title,
        description,
        price: finalPrice,
        currency: finalCurrency,
        priceOnApplication: finalPriceOnApp,
        priceRequiresReview: finalPriceRequiresReview,
        category,
        city: finalCity,
        country: finalCountry,
        locationRequiresReview: finalLocRequiresReview,
        images,
        listingMode: 'external',
        sourceUrl: url,
        sourceSite,
        priceSource,
        locationSource,
        rawPriceText,
        rawLocationText,
        _diagnostics: diagnostics,
        ...nauticalDetails
      }
    });
  } catch (err: any) {
    console.error("[Import Pipeline Exception]:", err);
    return res.status(200).json({ 
      success: false, 
      stage: 'Server Exception', 
      error: 'Unable to import listing data. Please check the URL or fill in details manually.' 
    });
  }
}
