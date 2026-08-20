import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { MarketplaceSettings, CATEGORIES, BannerConfig, DEFAULT_BANNER_CONFIG } from '../types';

interface SettingsContextType {
  settings: MarketplaceSettings | null;
  bannerConfig: BannerConfig | null;
  categories: string[];
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  bannerConfig: DEFAULT_BANNER_CONFIG,
  categories: CATEGORIES,
  loading: true,
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<MarketplaceSettings | null>(null);
  const [bannerConfig, setBannerConfig] = useState<BannerConfig | null>(DEFAULT_BANNER_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timer to ensure UI isn't locked if there's any problem
    const safetyTimer = setTimeout(() => {
      console.warn("Settings fetch took too long, fallback loading initiated.");
      setLoading(false);
    }, 15000);

    const docRef = doc(db, 'settings', 'global');
    
    const unsubscribeGlobal = onSnapshot(docRef, 
      (docSnap) => {
        clearTimeout(safetyTimer);
        if (docSnap.exists()) {
          const data = docSnap.data() as MarketplaceSettings;
          setSettings({
            ...data,
            planDurations: {
              standard: data.planDurations?.standard || 30,
              featured: data.planDurations?.featured || 30,
              premium: data.planDurations?.premium || 30,
              free: data.planDurations?.free || 30,
              local: data.planDurations?.local || 30,
              national: data.planDurations?.national || 30,
              showcase: data.planDurations?.showcase || 30,
            },
            planPrices: {
              standard: data.planPrices?.standard || 2.99,
              featured: data.planPrices?.featured || 4.99,
              premium: data.planPrices?.premium || 9.99,
              local: data.planPrices?.local || 4.99,
              national: data.planPrices?.national || 7.99,
              showcase: data.planPrices?.showcase || 8.99
            },
            maxImages: {
              standard: data.maxImages?.standard || 8,
              featured: data.maxImages?.featured || 15,
              premium: data.maxImages?.premium || 25,
              free: data.maxImages?.free || 2,
              local: data.maxImages?.local || 4,
              national: data.maxImages?.national || 6,
            },
            maxShowcaseProducts: data.maxShowcaseProducts || 6,
            showTotalAdsBadge: data.showTotalAdsBadge !== undefined ? data.showTotalAdsBadge : false,
            showTotalUsersBadge: data.showTotalUsersBadge !== undefined ? data.showTotalUsersBadge : false,
            compactCardMode: data.compactCardMode !== undefined ? data.compactCardMode : false,
            enableFotosFeature: data.enableFotosFeature !== undefined ? data.enableFotosFeature : false,
            launchPromoActive: data.launchPromoActive !== undefined ? data.launchPromoActive : false,
            enablePortugalMarket: data.enablePortugalMarket !== undefined ? data.enablePortugalMarket : false
          });
        } else {
          // Initialize local state if document doesn't exist in Firestore
          const defaultSettings: MarketplaceSettings = {
            id: 'global',
            planDurations: { standard: 30, featured: 30, premium: 30 },
            planPrices: { standard: 2.99, featured: 4.99, premium: 9.99 },
            maxImages: { standard: 8, featured: 15, premium: 25 },
            maxShowcaseProducts: 6,
            expirationAction: 'archive',
            warningDays: 3,
            categories: CATEGORIES,
            showTotalAdsBadge: false,
            showTotalUsersBadge: false,
            compactCardMode: false,
            enableFotosFeature: false,
            launchPromoActive: false,
            enablePortugalMarket: false
          };
          setSettings(defaultSettings);
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

    // Snapshot listener for Banner Configuration
    const bannerDocRef = doc(db, 'settings', 'bannerConfig');
    const unsubscribeBanner = onSnapshot(bannerDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<BannerConfig>;
          setBannerConfig({
            id: 'bannerConfig',
            enabled: data.enabled !== undefined ? data.enabled : true,
            desktop: {
              ...DEFAULT_BANNER_CONFIG.desktop,
              ...(data.desktop || {})
            },
            mobile: {
              ...DEFAULT_BANNER_CONFIG.mobile,
              ...(data.mobile || {})
            },
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy
          });
        } else {
          setBannerConfig(DEFAULT_BANNER_CONFIG);
        }
      },
      (error) => {
        console.warn("Banner config listener warning:", error);
      }
    );

    return () => {
      clearTimeout(safetyTimer);
      unsubscribeGlobal();
      unsubscribeBanner();
    };
  }, []);

  const categories = (settings?.categories && settings.categories.includes('Boats for Sale'))
    ? settings.categories
    : CATEGORIES;

  return (
    <SettingsContext.Provider value={{ settings, bannerConfig, categories, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
