import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { MarketplaceSettings, CATEGORIES } from '../types';

interface SettingsContextType {
  settings: MarketplaceSettings | null;
  categories: string[];
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  categories: CATEGORIES,
  loading: true,
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<MarketplaceSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timer to ensure UI isn't locked if there's any problem
    const safetyTimer = setTimeout(() => {
      console.warn("Settings fetch took too long, fallback loading initiated.");
      setLoading(false);
    }, 15000);

    const docRef = doc(db, 'settings', 'global');
    
    const unsubscribe = onSnapshot(docRef, 
      (docSnap) => {
        console.log('[READ] Settings');
        clearTimeout(safetyTimer);
        if (docSnap.exists()) {
          const data = docSnap.data() as MarketplaceSettings;
          setSettings({
            ...data,
            planDurations: {
              free: data.planDurations?.free || 30,
              local: data.planDurations?.local || 30,
              national: data.planDurations?.national || 30,
              showcase: data.planDurations?.showcase || 30,
              intermediate: data.planDurations?.intermediate || 180,
              premium: data.planDurations?.premium || 365
            },
            planPrices: data.planPrices || {
              local: 4.99,
              national: 7.99,
              showcase: 8.99
            },
            maxImages: {
              free: data.maxImages?.free || 2,
              local: data.maxImages?.local || 4,
              national: data.maxImages?.national === 4 ? 6 : (data.maxImages?.national || 6),
              showcase: data.maxImages?.showcase || 6,
              intermediate: data.maxImages?.intermediate || 3,
              premium: data.maxImages?.premium || 5
            },
            maxShowcaseProducts: data.maxShowcaseProducts || 6,
            showTotalAdsBadge: data.showTotalAdsBadge !== undefined ? data.showTotalAdsBadge : true,
            showTotalUsersBadge: data.showTotalUsersBadge !== undefined ? data.showTotalUsersBadge : false,
            compactCardMode: data.compactCardMode !== undefined ? data.compactCardMode : false,
            enableFotosFeature: data.enableFotosFeature !== undefined ? data.enableFotosFeature : false,
            launchPromoActive: data.launchPromoActive !== undefined ? data.launchPromoActive : false
          });
        } else {
          // Initialize local state if document doesn't exist in Firestore
          const defaultSettings: MarketplaceSettings = {
            id: 'global',
            planDurations: { free: 30, local: 30, national: 30, showcase: 30, intermediate: 180, premium: 365 },
            planPrices: { local: 4.99, national: 7.99, showcase: 8.99 },
            maxImages: { free: 2, local: 4, national: 6, showcase: 6, intermediate: 3, premium: 5 },
            maxShowcaseProducts: 6,
            expirationAction: 'archive',
            warningDays: 3,
            categories: CATEGORIES,
            showTotalAdsBadge: true,
            showTotalUsersBadge: false,
            compactCardMode: false,
            enableFotosFeature: false,
            launchPromoActive: false
          };
          setSettings(defaultSettings);
          // Attempt to write default settings only if caller has permissions (ignore permission-denied for non-admins)
          setDoc(doc(db, 'settings', 'global'), defaultSettings).catch((err) => {
            if (err?.code !== 'permission-denied') {
              console.warn("Could not save default settings to Firestore:", err);
            }
          });
        }
        setLoading(false);
      },
      (error) => {
        clearTimeout(safetyTimer);
        console.error("Settings listener error:", error);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  const categories = (settings?.categories && settings.categories.includes('Boats for Sale'))
    ? settings.categories
    : CATEGORIES;

  return (
    <SettingsContext.Provider value={{ settings, categories, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
