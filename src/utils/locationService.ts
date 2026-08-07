import { collection, doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getRegionForCity, UK_CITIES, CITIES_BY_REGION } from '../types';

export interface LocationDoc {
  id: string; // normalized doc id, e.g. "southampton"
  name: string; // display name, e.g. "Southampton"
  normalizedName: string; // e.g. "southampton"
  region?: string;
  country?: string;
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Normalizes a city name for duplicate prevention.
 * Converts to lower case, trims whitespace, collapses multiple spaces into one space,
 * and strips simple diacritics.
 */
export const normalizeCityName = (cityName: string): string => {
  if (!cityName) return '';
  return cityName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/\s+/g, ' '); // collapse multiple spaces
};

/**
 * Converts a normalized city name into a safe Firestore document ID.
 */
export const getCityDocId = (cityName: string): string => {
  const norm = normalizeCityName(cityName);
  if (!norm) return '';
  return norm.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
};

/**
 * Saves or updates a custom city in the `locations` collection in Firestore.
 * Prevents duplicates by targeting a deterministic document ID based on normalizedName.
 */
export const saveCustomCity = async (
  cityName: string,
  region?: string,
  country?: string
): Promise<void> => {
  if (!cityName) return;
  const trimmed = cityName.trim();
  const normalized = normalizeCityName(trimmed);
  if (!normalized) return;

  const docId = getCityDocId(trimmed);
  if (!docId) return;

  const resolvedRegion = region || getRegionForCity(trimmed) || 'England';
  const resolvedCountry = country || 'United Kingdom';

  try {
    const cityRef = doc(db, 'locations', docId);
    await setDoc(cityRef, {
      id: docId,
      name: trimmed,
      normalizedName: normalized,
      region: resolvedRegion,
      country: resolvedCountry,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.error('[LocationService] Error saving custom city to Firestore:', err);
  }
};

/**
 * Subscribes to custom cities in Firestore, calling callback with LocationDoc[].
 */
export const subscribeToCustomLocations = (
  onUpdate: (locations: LocationDoc[]) => void
) => {
  try {
    const colRef = collection(db, 'locations');
    return onSnapshot(colRef, (snapshot) => {
      const locs: LocationDoc[] = snapshot.docs.map(d => d.data() as LocationDoc);
      onUpdate(locs);
    }, (err) => {
      console.error('[LocationService] Error listening to locations:', err);
      onUpdate([]);
    });
  } catch (err) {
    console.error('[LocationService] Failed to set up location listener:', err);
    onUpdate([]);
    return () => {};
  }
};

/**
 * Combines default static UK cities with custom Firestore locations,
 * deduplicates based on normalized name, and sorts alphabetically.
 */
export const combineAndSortCities = (
  defaultList: string[],
  customLocs: LocationDoc[]
): string[] => {
  const seenNorm = new Set<string>();
  const result: string[] = [];

  // 1. Add static default cities
  for (const city of defaultList) {
    if (!city) continue;
    const norm = normalizeCityName(city);
    if (!seenNorm.has(norm)) {
      seenNorm.add(norm);
      result.push(city.trim());
    }
  }

  // 2. Add custom Firestore cities if not already present
  for (const loc of customLocs) {
    if (!loc || !loc.name) continue;
    const norm = loc.normalizedName || normalizeCityName(loc.name);
    if (norm && !seenNorm.has(norm)) {
      seenNorm.add(norm);
      result.push(loc.name.trim());
    }
  }

  // 3. Sort alphabetically (case-insensitive, UK/locale aware)
  return result.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
};
