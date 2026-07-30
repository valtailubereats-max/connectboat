import { decodeHtmlEntities } from '../../api/import-ad';

/**
 * Normaliza uma URL de imagem (trata URLs relativas ao protocolo, decodifica entidades HTML, trim)
 */
export const normalizeImageUrl = (url: any): string | null => {
  if (!url || typeof url !== 'string') return null;
  let decoded = url.trim();
  
  // Tentar decodificar entidades HTML se necessário
  if (decoded.includes('&amp;') || decoded.includes('&#')) {
    try {
      decoded = decodeHtmlEntities(decoded).trim();
    } catch (e) {
      // fallback
    }
  }

  // Prepend https: para URLs relativas ao protocolo //
  if (decoded.startsWith('//')) {
    decoded = 'https:' + decoded;
  }

  if (!decoded.startsWith('http://') && !decoded.startsWith('https://')) {
    return null;
  }

  try {
    const parsed = new URL(decoded);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch (e) {
    return null;
  }

  return null;
};

/**
 * Verifica se a URL da imagem é um placeholder, logo, avatar ou pixel de rastreamento
 */
export const isAdImagePlaceholderOrLogo = (url: string): boolean => {
  if (!url) return true;
  const lower = url.toLowerCase();
  
  // Padrões de logos, avatares, pixels de rastreio e placeholders a ignorar
  const bannedKeywords = [
    'logo',
    'avatar',
    'placeholder',
    'no-image',
    'no_image',
    'default-image',
    'default_image',
    'spacer',
    '1x1',
    'tracking',
    'pixel',
    'analytics',
    'badge',
    'site-logo',
    'footer-logo',
    'header-logo',
    'fav-icon',
    'favicon'
  ];

  // Ignorar apenas se a palavra banida estiver no nome do ficheiro ou caminho específico
  const urlPath = new URL(url).pathname.toLowerCase();
  for (const keyword of bannedKeywords) {
    if (urlPath.includes(keyword)) {
      return true;
    }
  }

  return false;
};

/**
 * Normaliza, prioriza, remove duplicados e aplica o limite máximo de imagens (por padrão 6)
 */
export const normalizeAndLimitImages = (
  images: (string | undefined | null)[],
  maxLimit: number = 6
): string[] => {
  if (!Array.isArray(images) || images.length === 0) return [];

  const validUrls: string[] = [];
  const seenUrls = new Set<string>();

  for (const img of images) {
    const normalized = normalizeImageUrl(img);
    if (!normalized) continue;

    // Deduplicação insensível a maiúsculas/minúsculas
    const key = normalized.toLowerCase();
    if (seenUrls.has(key)) continue;

    // Filtrar placeholders e logos
    if (isAdImagePlaceholderOrLogo(normalized)) continue;

    seenUrls.add(key);
    validUrls.push(normalized);

    if (validUrls.length >= maxLimit) break;
  }

  // Se a filtragem de placeholders tiver removido tudo mas existiam imagens válidas, recuperar a primeira
  if (validUrls.length === 0 && images.length > 0) {
    for (const img of images) {
      const normalized = normalizeImageUrl(img);
      if (normalized) {
        validUrls.push(normalized);
        break;
      }
    }
  }

  return validUrls.slice(0, maxLimit);
};

/**
 * Verifica se o anúncio é importado, externo ou reivindicável
 */
export const isImportedOrExternalAd = (adData: any): boolean => {
  if (!adData) return false;
  
  const hasValidSourceUrl = !!(adData.sourceUrl && typeof adData.sourceUrl === 'string' && /^https?:\/\//i.test(adData.sourceUrl.trim()));
  const isExternalMode = adData.listingMode === 'external' || adData.listingMode === 'claimable';
  const isClaimable = adData.isClaimableBusiness === true;
  const isExternal = adData.externalListing === true;
  const hasImportedBy = !!adData.importedBy;
  const hasSourceSite = !!adData.sourceSite;

  return hasValidSourceUrl || isExternalMode || isClaimable || isExternal || hasImportedBy || hasSourceSite;
};

/**
 * Sanitiza o objeto de dados antes de enviar para o Firestore (remove keys undefined e NaNs)
 */
export const sanitizeFirestorePayload = (data: Record<string, any>): Record<string, any> => {
  if (!data || typeof data !== 'object') return {};

  const clean: Record<string, any> = {};

  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) {
      continue; // Remove undefined
    }

    if (typeof val === 'number') {
      if (isNaN(val)) {
        clean[key] = 0;
      } else {
        clean[key] = val;
      }
      continue;
    }

    if (Array.isArray(val)) {
      // Sanitizar arrays para remover elementos undefined
      clean[key] = val.filter(item => item !== undefined).map(item => {
        if (typeof item === 'number' && isNaN(item)) return 0;
        return item;
      });
      continue;
    }

    // Objetos aninhados simples (exceto Timestamp/FieldValue/Date que têm funções ou propriedades especiais)
    if (val !== null && typeof val === 'object' && val.constructor === Object) {
      clean[key] = sanitizeFirestorePayload(val);
      continue;
    }

    clean[key] = val;
  }

  return clean;
};
