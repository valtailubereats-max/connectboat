import { Ad } from '../types';

export interface AdCache {
  ads: Record<string, Ad[]>;
  lastFetchTime: Record<string, number>;
  featuredAds: Record<string, Ad[]>;
  lastFeaturedFetchTime: Record<string, number>;
}

const cache: AdCache = {
  ads: {},
  lastFetchTime: {},
  featuredAds: {},
  lastFeaturedFetchTime: {},
};

const HOME_PREVIEW_STORAGE_KEY = 'connectboat-home-preview-v1';
const HOME_PREVIEW_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const HOME_PREVIEW_MAX_ADS = 30;

type PersistedHomePreview = {
  savedAt: number;
  ads: Record<string, Ad[]>;
  featuredAds: Record<string, Ad[]>;
};

function readPersistedHomePreview(): PersistedHomePreview | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(HOME_PREVIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedHomePreview;
    if (!parsed || Date.now() - parsed.savedAt > HOME_PREVIEW_MAX_AGE) {
      window.sessionStorage.removeItem(HOME_PREVIEW_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

const persistedHomePreview = readPersistedHomePreview();
if (persistedHomePreview) {
  cache.ads = persistedHomePreview.ads || {};
  cache.featuredAds = persistedHomePreview.featuredAds || {};
}

function persistHomePreview() {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedHomePreview = {
      savedAt: Date.now(),
      ads: Object.fromEntries(Object.entries(cache.ads).map(([country, ads]) => [country, ads.slice(0, HOME_PREVIEW_MAX_ADS)])),
      featuredAds: Object.fromEntries(Object.entries(cache.featuredAds).map(([country, ads]) => [country, ads.slice(0, HOME_PREVIEW_MAX_ADS)])),
    };
    window.sessionStorage.setItem(HOME_PREVIEW_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage may be unavailable or full; the in-memory cache still works.
  }
}

export function getCachedAds(country: string = 'Reino Unido'): Ad[] {
  return cache.ads[country] || [];
}

export function setCachedAds(ads: Ad[], country: string = 'Reino Unido') {
  cache.ads[country] = ads;
  cache.lastFetchTime[country] = Date.now();
  persistHomePreview();
  console.log(`[Cache] Gravou cache de ads (${country}) às: ${new Date(cache.lastFetchTime[country]).toISOString()} com ${ads.length} anúncios.`);
}

export function getLastFetchTime(country: string = 'Reino Unido'): number {
  return cache.lastFetchTime[country] || 0;
}

export function getCachedFeaturedAds(country: string = 'Reino Unido'): Ad[] {
  return cache.featuredAds[country] || [];
}

export function setCachedFeaturedAds(featuredAds: Ad[], country: string = 'Reino Unido') {
  cache.featuredAds[country] = featuredAds;
  cache.lastFeaturedFetchTime[country] = Date.now();
  persistHomePreview();
  console.log(`[Cache] Gravou cache de ads destacados (${country}) às: ${new Date(cache.lastFeaturedFetchTime[country]).toISOString()} com ${featuredAds.length} anúncios.`);
}

export function getLastFeaturedFetchTime(country: string = 'Reino Unido'): number {
  return cache.lastFeaturedFetchTime[country] || 0;
}

export function clearHomeCache() {
  cache.ads = {};
  cache.lastFetchTime = {};
  cache.featuredAds = {};
  cache.lastFeaturedFetchTime = {};
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(HOME_PREVIEW_STORAGE_KEY);
    } catch {
      // Ignore unavailable storage.
    }
  }
  console.log('[Cache] Cache da Home limpa com sucesso.');
}

