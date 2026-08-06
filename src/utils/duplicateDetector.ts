/**
 * Duplicate Listing Detector for ConnectBoat
 * 
 * Provides intelligent comparison of boat listings to prevent exact duplicate publications
 * without false-flagging legitimate different boats that share location or price.
 */

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  level: 'confirmed' | 'possible' | 'none';
  score: number;
  reason: string;
  matchedFields: string[];
  matchedAdId?: string;
  matchedAdTitle?: string;
  matchedAd?: any;
  explanationDetails?: string;
}

/**
 * Stop words in English and Portuguese to strip before comparing titles & descriptions
 */
const STOP_WORDS = new Set([
  'boat', 'boats', 'yacht', 'yachts', 'vessel', 'vessels', 'cruiser',
  'for', 'sale', 'hire', 'charter', 'buy', 'sell', 'new', 'used',
  'barco', 'barcos', 'embarcacao', 'venda', 'aluguer', 'aluguel', 'novo', 'usado',
  'com', 'sem', 'para', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos',
  'and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'of', 'with', 'without',
  'uk', 'portugal', 'london', 'lisbon', 'porto', 'southampton'
]);

/**
 * Normalize text by converting to lowercase, removing accents, punctuation and stop words.
 */
export function normalizeTextForComparison(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics / accents
    .replace(/[^a-z0-9\s]/g, " ") // replace punctuation with space
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w))
    .join(" ");
}

/**
 * Tokenize text into significant words
 */
export function getTokens(text: string): string[] {
  const norm = normalizeTextForComparison(text);
  if (!norm) return [];
  return norm.split(" ").filter(w => w.length > 2);
}

/**
 * Calculate Word Jaccard / Overlap similarity ratio (0 to 1)
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const tokens1 = getTokens(text1);
  const tokens2 = getTokens(text2);
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  let common = 0;
  for (const token of set1) {
    if (set2.has(token)) common++;
  }

  const unionSize = new Set([...set1, ...set2]).size;
  if (unionSize === 0) return 0;
  return common / unionSize;
}

/**
 * Compare two ads and return duplicate score and matching details
 */
export function compareAdsForDuplicates(newAd: any, existingAd: any): {
  score: number;
  matchedFields: string[];
  reasons: string[];
} {
  let score = 0;
  const matchedFields: string[] = [];
  const reasons: string[] = [];

  // 1. Source URL exact match (highest priority if imported listing)
  if (
    newAd.sourceUrl &&
    existingAd.sourceUrl &&
    newAd.sourceUrl.trim().toLowerCase() === existingAd.sourceUrl.trim().toLowerCase()
  ) {
    return {
      score: 100,
      matchedFields: ['sourceUrl'],
      reasons: ['Identical import source link (sourceUrl)']
    };
  }

  // 2. Image matching (Exact image URL or image storage path)
  let imageMatched = false;
  if (newAd.imageUrl && existingAd.imageUrl && newAd.imageUrl === existingAd.imageUrl) {
    imageMatched = true;
  }
  if (!imageMatched && newAd.images && existingAd.images && Array.isArray(newAd.images) && Array.isArray(existingAd.images)) {
    const newImgs = new Set(newAd.images);
    const existingImgs = existingAd.images;
    const overlap = existingImgs.filter((img: string) => newImgs.has(img));
    if (overlap.length > 0) {
      imageMatched = true;
    }
  }
  if (imageMatched) {
    score += 35;
    matchedFields.push('images');
    reasons.push('Identical listing photographs');
  }

  // 3. Title Similarity (normalized, without stop words)
  const titleSim = calculateTextSimilarity(newAd.title || '', existingAd.title || '');
  if (titleSim >= 0.85) {
    score += 30;
    matchedFields.push('title');
    reasons.push(`High title similarity (${Math.round(titleSim * 100)}%)`);
  } else if (titleSim >= 0.6) {
    score += 20;
    matchedFields.push('title');
    reasons.push(`Moderate title similarity (${Math.round(titleSim * 100)}%)`);
  }

  // 4. Make & Model Match (Fabricante & Modelo)
  const normMakeNew = (newAd.make || '').toLowerCase().trim();
  const normMakeExist = (existingAd.make || '').toLowerCase().trim();
  const normModelNew = (newAd.model || '').toLowerCase().trim();
  const normModelExist = (existingAd.model || '').toLowerCase().trim();

  const sameMake = Boolean(normMakeNew && normMakeExist && normMakeNew === normMakeExist);
  const sameModel = Boolean(normModelNew && normModelExist && normModelNew === normModelExist);

  if (sameMake && sameModel) {
    score += 25;
    matchedFields.push('make_and_model');
    reasons.push(`Matching manufacturer (${newAd.make}) and model (${newAd.model})`);
  } else if (sameMake && (normModelNew || normModelExist)) {
    score += 10;
    matchedFields.push('make');
    reasons.push(`Matching manufacturer (${newAd.make})`);
  }

  // 5. Year Match (Ano)
  if (
    newAd.year &&
    existingAd.year &&
    Number(newAd.year) === Number(existingAd.year) &&
    Number(newAd.year) > 1900
  ) {
    score += 10;
    matchedFields.push('year');
    reasons.push(`Same year of manufacture (${newAd.year})`);
  }

  // 6. Description Similarity (normalized)
  if (
    newAd.description &&
    existingAd.description &&
    newAd.description.length > 20 &&
    existingAd.description.length > 20
  ) {
    const descSim = calculateTextSimilarity(newAd.description, existingAd.description);
    if (descSim >= 0.8) {
      score += 25;
      matchedFields.push('description');
      reasons.push(`Highly identical description (${Math.round(descSim * 100)}% match)`);
    } else if (descSim >= 0.5) {
      score += 12;
      matchedFields.push('description');
      reasons.push(`Similar description text (${Math.round(descSim * 100)}% match)`);
    }
  }

  // 7. Phone / WhatsApp Contact Number Match
  const phoneNew = (newAd.contactPhone || newAd.phone || '').replace(/[^0-9]/g, '');
  const phoneExist = (existingAd.contactPhone || existingAd.phone || '').replace(/[^0-9]/g, '');
  if (phoneNew && phoneExist && phoneNew.length >= 7 && phoneNew === phoneExist) {
    score += 10;
    matchedFields.push('contact_phone');
    reasons.push('Same contact phone number');
  }

  // 8. Technical Specs (Length, Beam, Fuel, Engine)
  let specMatches = 0;
  if (
    newAd.lengthFeet &&
    existingAd.lengthFeet &&
    Math.abs(Number(newAd.lengthFeet) - Number(existingAd.lengthFeet)) < 0.5
  ) {
    specMatches++;
  }
  if (
    newAd.fuelType &&
    existingAd.fuelType &&
    newAd.fuelType.toLowerCase() === existingAd.fuelType.toLowerCase()
  ) {
    specMatches++;
  }
  if (
    newAd.engineMake &&
    existingAd.engineMake &&
    newAd.engineMake.toLowerCase() === existingAd.engineMake.toLowerCase()
  ) {
    specMatches++;
  }
  if (specMatches >= 2) {
    score += 10;
    matchedFields.push('technical_specs');
    reasons.push('Matching technical specifications (length, engine, fuel type)');
  }

  // WEAK SIGNALS: Price and Location
  // CRITICAL RULE: Price and Location ONLY contribute if there is ALREADY core similarity (score >= 20).
  // On their own (core score = 0), Price and Location contribute 0 points and cannot flag a duplicate!
  const hasCoreSimilarity = score >= 20;

  if (hasCoreSimilarity) {
    const sameCity = Boolean(
      newAd.city &&
      existingAd.city &&
      newAd.city.toLowerCase().trim() === existingAd.city.toLowerCase().trim()
    );
    const samePrice = Boolean(
      newAd.price > 0 &&
      existingAd.price > 0 &&
      Math.abs(Number(newAd.price) - Number(existingAd.price)) < 0.01
    );

    if (sameCity) {
      score += 5;
      matchedFields.push('city');
      reasons.push(`Same location (${newAd.city})`);
    }
    if (samePrice) {
      score += 5;
      matchedFields.push('price');
      reasons.push(`Same price (£${newAd.price})`);
    }
  }

  return {
    score: Math.min(score, 100),
    matchedFields,
    reasons
  };
}

/**
 * Evaluate a listing against existing seller ads (or all ads)
 */
export function evaluateListingDuplicates(
  newAdData: any,
  existingAds: any[],
  currentAdId?: string
): DuplicateCheckResult {
  let highestScore = 0;
  let bestMatchAd: any = null;
  let bestMatchResult: { matchedFields: string[]; reasons: string[] } = { matchedFields: [], reasons: [] };

  for (const existingAd of existingAds) {
    if (currentAdId && existingAd.id === currentAdId) continue;

    const res = compareAdsForDuplicates(newAdData, existingAd);
    if (res.score > highestScore) {
      highestScore = res.score;
      bestMatchAd = existingAd;
      bestMatchResult = res;
    }
  }

  // Thresholds:
  // Score >= 65: CONFIRMED duplicate (Hard Block)
  // Score >= 35 & < 65: POSSIBLE duplicate (Warning with option to proceed)
  // Score < 35: NONE (Normal publication)
  if (highestScore >= 65) {
    return {
      isDuplicate: true,
      level: 'confirmed',
      score: highestScore,
      reason: `This listing appears to be an exact duplicate of one you already published.`,
      explanationDetails: `Matched elements: ${bestMatchResult.reasons.join('; ')}.`,
      matchedFields: bestMatchResult.matchedFields,
      matchedAdId: bestMatchAd?.id,
      matchedAdTitle: bestMatchAd?.title,
      matchedAd: bestMatchAd
    };
  } else if (highestScore >= 35) {
    return {
      isDuplicate: true,
      level: 'possible',
      score: highestScore,
      reason: `We found a similar listing. Please confirm that this is a different boat before continuing.`,
      explanationDetails: `Matched elements: ${bestMatchResult.reasons.join('; ')}.`,
      matchedFields: bestMatchResult.matchedFields,
      matchedAdId: bestMatchAd?.id,
      matchedAdTitle: bestMatchAd?.title,
      matchedAd: bestMatchAd
    };
  }

  return {
    isDuplicate: false,
    level: 'none',
    score: highestScore,
    reason: '',
    matchedFields: [],
  };
}
