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

export function getCachedAds(country: string = 'Portugal'): Ad[] {
  return cache.ads[country] || [];
}

export function setCachedAds(ads: Ad[], country: string = 'Portugal') {
  cache.ads[country] = ads;
  cache.lastFetchTime[country] = Date.now();
  console.log(`[Cache] Gravou cache de ads (${country}) às: ${new Date(cache.lastFetchTime[country]).toISOString()} com ${ads.length} anúncios.`);
}

export function getLastFetchTime(country: string = 'Portugal'): number {
  return cache.lastFetchTime[country] || 0;
}

export function getCachedFeaturedAds(country: string = 'Portugal'): Ad[] {
  return cache.featuredAds[country] || [];
}

export function setCachedFeaturedAds(featuredAds: Ad[], country: string = 'Portugal') {
  cache.featuredAds[country] = featuredAds;
  cache.lastFeaturedFetchTime[country] = Date.now();
  console.log(`[Cache] Gravou cache de ads destacados (${country}) às: ${new Date(cache.lastFeaturedFetchTime[country]).toISOString()} com ${featuredAds.length} anúncios.`);
}

export function getLastFeaturedFetchTime(country: string = 'Portugal'): number {
  return cache.lastFeaturedFetchTime[country] || 0;
}

export function clearHomeCache() {
  cache.ads = {};
  cache.lastFetchTime = {};
  cache.featuredAds = {};
  cache.lastFeaturedFetchTime = {};
  console.log('[Cache] Cache da Home limpa com sucesso.');
}

