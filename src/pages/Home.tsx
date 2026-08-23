import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { collection, query, where, limit, getCountFromServer, orderBy } from 'firebase/firestore';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { db, withTimeout, getDocsWithCacheFallback } from '../firebase';
import { Ad, CITIES, PORTUGAL_CITIES, UK_CITIES, UK_REGIONS, CITIES_BY_REGION, getRegionForCity, BOAT_TYPES, BOAT_CONDITIONS, BOAT_FUEL_TYPES, BOAT_HULL_MATERIALS } from '../types';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { 
  getCachedAds, 
  setCachedAds, 
  getLastFetchTime, 
  getCachedFeaturedAds, 
  setCachedFeaturedAds, 
  getLastFeaturedFetchTime,
  clearHomeCache
} from '../utils/cache';
import { LocationDoc, subscribeToCustomLocations, combineAndSortCities } from '../utils/locationService';
import AdCard from '../components/AdCard';
import { 
  Search, Tag, MapPin, ArrowRight, AlertCircle, RefreshCcw, ArrowUp, Store,
  SlidersHorizontal, X, Filter, Check, ChevronDown, Anchor, Ship, Fuel, Compass, RotateCcw, ArrowUpDown, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
// @ts-ignore
import lisbonAerial from '../assets/images/lisbon_aerial_1780755446715.png';
// @ts-ignore
import londonAerialOriginalStandby from '../assets/images/london_aerial_1780755464204.png';
// Nova foto bem clara, nítida e com aspeto de dia radiante:
const londonAerialSunny = "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&w=1600&q=80";

import { useClickOutside } from '../hooks/useClickOutside';
import { parsePrice } from '../utils';

const PAGE_SIZE = 30; 

const Home = () => {
  const { settings, bannerConfig, categories } = useSettings();
  const resultsSectionRef = useRef<HTMLDivElement>(null);
  const [londonBg, setLondonBg] = useState(londonAerialSunny);

  const handleSearchFocus = () => {
    setTimeout(() => {
      if (resultsSectionRef.current) {
        resultsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };
  
  const hexToRgba = (hex: string | undefined, opacity: number | undefined) => {
    const color = hex || '#ffffff';
    let alpha = 0.1;
    if (opacity !== undefined) {
      alpha = opacity > 1 ? opacity / 100 : opacity;
    }
    const cleanHex = color.replace('#', '');
    let fullHex = cleanHex;
    if (cleanHex.length === 3) fullHex = cleanHex.split('').map(x => x + x).join('');
    const r = parseInt(fullHex.substring(0, 2), 16) || 0;
    const g = parseInt(fullHex.substring(2, 4), 16) || 0;
    const b = parseInt(fullHex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const isColorLight = (hex: string | undefined) => {
    if (!hex) return false;
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) || 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 255;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6;
  };

  const getFeaturedSectionTheme = (hexColor: string | undefined, defaultHex: string) => {
    const colorStr = (hexColor && hexColor.trim()) ? hexColor.trim() : defaultHex;
    const cleanHex = colorStr.replace('#', '');
    let fullHex = cleanHex;
    if (cleanHex.length === 3) {
      fullHex = cleanHex.split('').map(x => x + x).join('');
    }
    
    let r = parseInt(fullHex.substring(0, 2), 16);
    let g = parseInt(fullHex.substring(2, 4), 16);
    let b = parseInt(fullHex.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      const fallbackClean = defaultHex.replace('#', '');
      r = parseInt(fallbackClean.substring(0, 2), 16) || 16;
      g = parseInt(fallbackClean.substring(2, 4), 16) || 183;
      b = parseInt(fallbackClean.substring(4, 6), 16) || 199;
    }

    // Derive a deep dark version of the base color for outer edge vignette
    const rDark = Math.max(0, Math.round(r * 0.55));
    const gDark = Math.max(0, Math.round(g * 0.55));
    const bDark = Math.max(0, Math.round(b * 0.55));

    return {
      hex: `#${fullHex}`,
      // 4-edge vignette shadow strictly derived from selected color
      boxShadow: `inset 0 0 38px 4px rgba(${rDark}, ${gDark}, ${bDark}, 0.22)`,
      // Radial gradient background starting from pure white (#ffffff) at center and shading to the derived dark edge
      radialBackground: `radial-gradient(ellipse at 50% 50%, #ffffff 30%, rgba(255, 255, 255, 0.96) 55%, rgba(${r}, ${g}, ${b}, 0.08) 78%, rgba(${rDark}, ${gDark}, ${bDark}, 0.18) 100%)`,
      // Subtle radial glow behind listing cards
      glowBackground: `radial-gradient(ellipse 80% 60% at 50% 65%, rgba(${r}, ${g}, ${b}, 0.08) 0%, rgba(${r}, ${g}, ${b}, 0.03) 55%, transparent 85%)`
    };
  };

  const hasCustomStyles = settings?.searchGroupBgColor !== undefined || settings?.searchGroupOpacity !== undefined;
  
  const customBg = hasCustomStyles 
    ? hexToRgba(settings?.searchGroupBgColor, settings?.searchGroupOpacity)
    : undefined;

  const customBorder = hasCustomStyles
    ? hexToRgba(settings?.searchGroupBgColor, Math.max(50, Math.min(100, (settings?.searchGroupOpacity ?? 10) + 25)))
    : undefined;

  const isLightText = !(isColorLight(settings?.searchGroupBgColor) && (settings?.searchGroupOpacity || 10) > 40);
  
  const txtColorClass = isLightText ? 'text-white' : 'text-slate-900';
  const txtMutedClass = isLightText ? 'text-white/75' : 'text-slate-900/75';
  const placeholderClass = isLightText 
    ? 'placeholder:text-white/80 placeholder:font-black placeholder:tracking-wide placeholder:uppercase placeholder:text-[10px] sm:placeholder:text-[11px]' 
    : 'placeholder:text-slate-900/80 placeholder:font-black placeholder:tracking-wide placeholder:uppercase placeholder:text-[10px] sm:placeholder:text-[11px]';
  const blurClass = settings?.searchGroupOpacity === 0 ? '' : 'backdrop-blur-3xl';

  const getFlagSvgUrl = (currentCountry: string) => {
    if (currentCountry === 'Portugal') {
      return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400'%3E%3Crect width='240' height='400' fill='%23006600'/%3E%3Crect x='240' width='360' height='400' fill='%23ff0000'/%3E%3Ccircle cx='240' cy='200' r='65' fill='%23ffe600'/%3E%3Cpath d='M240,165 v70 M205,200 h70' stroke='%23ff0000' stroke-width='10'/%3E%3C/svg%3E`;
    } else if (currentCountry === 'Reino Unido') {
      return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 30'%3E%3Crect width='60' height='30' fill='%23012169'/%3E%3Cpath d='M0%2C0 L60%2C30 M60%2C0 L0%2C30' stroke='%23fff' stroke-width='6'/%3E%3Cpath d='M0%2C0 L60%2C30 M60%2C0 L0%2C30' stroke='%23c8102e' stroke-width='4'/%3E%3Cpath d='M0%2C15 H60 M30%2C0 V30' stroke='%23fff' stroke-width='10'/%3E%3Cpath d='M0%2C15 H60 M30%2C0 V30' stroke='%23c8102e' stroke-width='6'/%3E%3C/svg%3E`;
    }
    return '';
  };

  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const isModeratorOrAdmin = isAdmin || profile?.role === 'admin' || profile?.role === 'moderator';
  // Só consideramos administrador confirmado para consultas restritas de contagem de users.
  const isConfirmedAdminOnly = !authLoading && profile?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [assistedPaymentMessage, setAssistedPaymentMessage] = useState(false);

  useEffect(() => {
    const paymentResult = searchParams.get('assisted_payment');

    if (paymentResult === 'success') {
      setAssistedPaymentMessage(true);

      const params = new URLSearchParams(searchParams);
      params.delete('assisted_payment');
      params.delete('session_id');

      setSearchParams(params, { replace: true });

      const timer = setTimeout(() => {
        setAssistedPaymentMessage(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, []);
  const [ads, setAds] = useState<Ad[]>([]);
  const [featuredAds, setFeaturedAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);
  const [category, setCategory] = useState('Todas');
  const [city, setCity] = useState('Todas');
  const [customLocations, setCustomLocations] = useState<LocationDoc[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToCustomLocations((locs) => {
      setCustomLocations(locs);
    });
    return () => unsubscribe();
  }, []);
  const [filterRegion, setFilterRegion] = useState(false);
  const [filterNational, setFilterNational] = useState(false);
  const [filterOnline, setFilterOnline] = useState(false);

  // Advanced Marine Search & Filter States
  const [filterBoatType, setFilterBoatType] = useState('Todas');
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterManufacturer, setFilterManufacturer] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterMinYear, setFilterMinYear] = useState('');
  const [filterMaxYear, setFilterMaxYear] = useState('');
  const [filterCondition, setFilterCondition] = useState('Todas');
  const [filterMinLength, setFilterMinLength] = useState('');
  const [filterMaxLength, setFilterMaxLength] = useState('');
  const [filterFuelType, setFilterFuelType] = useState('Todas');
  const [filterHullMaterial, setFilterHullMaterial] = useState('Todas');
  const [filterLocationKeyword, setFilterLocationKeyword] = useState('');
  const [filterMinCabins, setFilterMinCabins] = useState('');
  const [filterTrailer, setFilterTrailer] = useState<'Any' | 'Yes' | 'No'>('Any');

  const [sortBy, setSortBy] = useState<
    | 'newest'
    | 'oldest'
    | 'price_asc'
    | 'price_desc'
    | 'year_desc'
    | 'year_asc'
    | 'length_asc'
    | 'length_desc'
  >('newest');

  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Helper functions for marine filters
  const parseLengthMeters = (lengthStr?: string | number): number | null => {
    if (lengthStr === undefined || lengthStr === null || lengthStr === '') return null;
    if (typeof lengthStr === 'number') return isNaN(lengthStr) ? null : lengthStr;
    const match = String(lengthStr).replace(',', '.').match(/([0-9]+(?:\.[0-9]+)?)/);
    if (match) {
      const val = parseFloat(match[1]);
      return isNaN(val) ? null : val;
    }
    return null;
  };

  const parseYearNum = (yearVal?: number | string): number | null => {
    if (yearVal === undefined || yearVal === null || yearVal === '') return null;
    const num = typeof yearVal === 'number' ? yearVal : parseInt(String(yearVal), 10);
    return isNaN(num) ? null : num;
  };

  const matchesSearchText = (ad: Ad, queryStr: string) => {
    if (!queryStr) return true;
    const normalized = queryStr.toLowerCase().trim();
    if (!normalized) return true;

    const tokens = normalized.split(/\s+/).filter(Boolean);

    const searchableFields = [
      ad.title,
      ad.description,
      ad.boatType,
      ad.manufacturer,
      ad.model,
      ad.year ? String(ad.year) : '',
      ad.condition,
      ad.city,
      ad.location,
      ad.country,
      ad.fuelType,
      ad.engineBrand,
      ad.hullMaterial,
    ].map(f => (f ? String(f).toLowerCase() : ''));

    const combinedText = searchableFields.join(' ');
    return tokens.every(token => combinedText.includes(token));
  };

  const activeMarineFilterCount = useMemo(() => {
    let count = 0;
    if (filterBoatType !== 'Todas') count++;
    if (filterMinPrice.trim() !== '') count++;
    if (filterMaxPrice.trim() !== '') count++;
    if (filterManufacturer.trim() !== '') count++;
    if (filterModel.trim() !== '') count++;
    if (filterMinYear.trim() !== '') count++;
    if (filterMaxYear.trim() !== '') count++;
    if (filterCondition !== 'Todas') count++;
    if (filterMinLength.trim() !== '') count++;
    if (filterMaxLength.trim() !== '') count++;
    if (filterFuelType !== 'Todas') count++;
    if (filterHullMaterial !== 'Todas') count++;
    if (filterLocationKeyword.trim() !== '') count++;
    if (filterMinCabins.trim() !== '') count++;
    if (filterTrailer !== 'Any') count++;
    return count;
  }, [
    filterBoatType,
    filterMinPrice,
    filterMaxPrice,
    filterManufacturer,
    filterModel,
    filterMinYear,
    filterMaxYear,
    filterCondition,
    filterMinLength,
    filterMaxLength,
    filterFuelType,
    filterHullMaterial,
    filterLocationKeyword,
    filterMinCabins,
    filterTrailer,
  ]);

  const clearAllFilters = () => {
    setSearchTerm('');
    setCategory('Todas');
    setCity('Todas');
    setFilterBoatType('Todas');
    setFilterMinPrice('');
    setFilterMaxPrice('');
    setFilterManufacturer('');
    setFilterModel('');
    setFilterMinYear('');
    setFilterMaxYear('');
    setFilterCondition('Todas');
    setFilterMinLength('');
    setFilterMaxLength('');
    setFilterFuelType('Todas');
    setFilterHullMaterial('Todas');
    setFilterLocationKeyword('');
    setFilterMinCabins('');
    setFilterTrailer('Any');
    setFilterRegion(false);
    setFilterNational(false);
    setFilterOnline(false);
    setSelectedRegion('');
  };

  const availableManufacturers = useMemo(() => {
    const setM = new Set<string>();
    ads.forEach(ad => {
      if (ad.manufacturer?.trim()) {
        setM.add(ad.manufacturer.trim());
      }
    });
    return Array.from(setM).sort();
  }, [ads]);
  
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [country, setCountry] = useState<'Portugal' | 'Reino Unido'>(() => {
    // 1. Check URL parameters first for explicit country selection
    try {
      const params = new URLSearchParams(window.location.search);
      const urlCountry = params.get('country') as 'Portugal' | 'Reino Unido' | null;
      if (urlCountry === 'Reino Unido' || urlCountry === 'Portugal') {
        return urlCountry;
      }
    } catch (e) {
      console.warn("Could not determine country from URL parameters:", e);
    }
    
    // Default launch experience is strictly United Kingdom
    return 'Reino Unido';
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [totalUsersCount, setTotalUsersCount] = useState<number | null>(null);

  // Estados de paginação de 30 em 30 itens
  const [limitAmount, setLimitAmount] = useState(PAGE_SIZE);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [dbLimit, setDbLimit] = useState(48);
  const [allDbAdsFetched, setAllDbAdsFetched] = useState(false);

  // State to pause marquee on hover
  const [isHovered, setIsHovered] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSearchHovered, setIsSearchHovered] = useState(false);

  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Manter controle atualizado do país selecionado em uma ref mutável para o cleanup do useEffect
  const countryRef = useRef(country);
  useEffect(() => {
    countryRef.current = country;
  }, [country]);

  // Controle de requisições de anúncios gerais
  const inFlightAdsCountry = useRef<'Portugal' | 'Reino Unido' | null>(null);
  const fetchedAdsCountry = useRef<'Portugal' | 'Reino Unido' | null>(null);
  const fetchedLimit = useRef<number>(48);

  // Controle de requisições de anúncios destacados
  const inFlightFeaturedCountry = useRef<'Portugal' | 'Reino Unido' | null>(null);
  const fetchedFeaturedCountry = useRef<'Portugal' | 'Reino Unido' | null>(null);

  // Available countries configuration for Filters panel
  const AVAILABLE_COUNTRIES: Array<{ id: 'Reino Unido' | 'Portugal'; label: string; flagCode: 'Reino Unido' | 'Portugal' }> = React.useMemo(() => {
    if (settings?.enablePortugalMarket === true) {
      return [
        { id: 'Reino Unido', label: 'United Kingdom', flagCode: 'Reino Unido' },
        { id: 'Portugal', label: 'Portugal', flagCode: 'Portugal' },
      ];
    }
    return [
      { id: 'Reino Unido', label: 'United Kingdom', flagCode: 'Reino Unido' },
    ];
  }, [settings?.enablePortugalMarket]);

  // Sync with Profile country if registered
  useEffect(() => {
    const enablePortugal = settings?.enablePortugalMarket === true;
    if (enablePortugal && profile?.country && (profile.country === 'Portugal' || profile.country === 'Reino Unido')) {
      setCountry(profile.country);
      localStorage.setItem('selectedCountry', profile.country);
    } else if (!enablePortugal && country !== 'Reino Unido') {
      setCountry('Reino Unido');
    }
  }, [profile, settings?.enablePortugalMarket, country]);

  // Handle Country Change
  const handleCountryChange = (val: 'Portugal' | 'Reino Unido') => {
    setCountry(val);
    setCity('Todas');
    localStorage.setItem('selectedCountry', val);

    // Sync country URL parameter to prevent useSearchParams useEffect from reverting the value
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set('country', val);
    setSearchParams(currentParams);
  };

  // Monitorar scroll para exibir/esconder o botão de "Voltar ao topo"
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Resetar paginação ao alterar qualquer filtro principal ou avançado
  useEffect(() => {
    setLimitAmount(PAGE_SIZE);
    setDbLimit(48);
    setAllDbAdsFetched(false);
  }, [
    country,
    category,
    city,
    searchTerm,
    filterBoatType,
    filterMinPrice,
    filterMaxPrice,
    filterManufacturer,
    filterModel,
    filterMinYear,
    filterMaxYear,
    filterCondition,
    filterMinLength,
    filterMaxLength,
    filterFuelType,
    filterHullMaterial,
    filterLocationKeyword,
    filterMinCabins,
    filterTrailer,
    sortBy,
  ]);

  // Buscar total de utilizadores no banco de dados se permitido/configurado
  useEffect(() => {
    let active = true;

    // Log de diagnóstico temporário para confirmar quem e por que está executando a contagem de users
    console.log('[ROLE DEBUG]', {
      authLoading,
      isAdmin,
      profileRole: profile?.role,
      uid: user?.uid,
      email: user?.email,
      isConfirmedAdminOnly
    });

    // Se ainda está carregando a autenticação ou perfil, não podemos confirmar se é admin/moderador
    if (authLoading) {
      console.log('[USERS COUNT] skipped for non-admin (auth loading incerteza)');
      if (active) {
        setTotalUsersCount(852); // Fallback estático seguro
      }
      return;
    }

    // Se de fato não é admin confirmado, use o fallback estático e não execute a consulta
    if (!isConfirmedAdminOnly) {
      if (profile?.role === 'moderator') {
        console.log('[USERS COUNT] skipped for moderator');
      } else {
        console.log('[USERS COUNT] skipped for non-admin');
      }
      if (active) {
        setTotalUsersCount(852); // Fallback estático seguro
      }
      return;
    }

    const fetchUsersCount = async () => {
      console.log('[USERS COUNT] running for admin');
      try {
        const q = query(collection(db, 'users'));
        const snapshot = await getCountFromServer(q);
        if (active) {
          setTotalUsersCount(snapshot.data().count);
        }
      } catch (err) {
        console.error('Erro ao buscar total de utilizadores:', err);
      }
    };
    fetchUsersCount();
    return () => { active = false; };
  }, [settings?.showTotalUsersBadge, isConfirmedAdminOnly, authLoading]);

  // Buscar anúncios destacados para carrossel no topo
  useEffect(() => {
    // Se ainda está carregando a autenticação e não temos país explícito definido pelo utilizador, 
    // esperamos para não disparar consultas desnecessárias de Reino Unido (fallback) antes do perfil estar pronto
    const hasExplicitCountry = localStorage.getItem('selectedCountry') || 
      new URLSearchParams(window.location.search).get('country');
    if (authLoading && !hasExplicitCountry) {
      console.log('[FEATURED ADS] loading delayed until auth load complete');
      return;
    }

    // Se já foi buscado com sucesso para este país, evitamos chamar novamente
    if (fetchedFeaturedCountry.current === country) {
      console.log(`[FEATURED ADS] Já carregado com sucesso para o país: ${country}`);
      return;
    }

    // Se já existe uma requisição em andamento para este mesmo país, não iniciamos outra
    if (inFlightFeaturedCountry.current === country) {
      console.log(`[FEATURED ADS] Fetch em andamento para o país: ${country}`);
      return;
    }
    inFlightFeaturedCountry.current = country;

    let active = true;
    const fetchFeatured = async () => {
      // Verificação de cache de sessão de 5 minutos
      const now = Date.now();
      const featuredFromCache = getCachedFeaturedAds(country);
      const lastFeaturedFetch = getLastFeaturedFetchTime(country);
      if (lastFeaturedFetch > 0 && (now - lastFeaturedFetch < 5 * 60 * 1000)) {
        console.log(`[Cache HIT] Recuperou destacados da sessão (${country}). Total: ${featuredFromCache.length}`);
        setFeaturedAds(featuredFromCache);
        fetchedFeaturedCountry.current = country;
        inFlightFeaturedCountry.current = null;
        return;
      }
      try {
        const targetCountries = (country === 'Reino Unido' || country === 'United Kingdom')
          ? ['Reino Unido', 'United Kingdom', 'UK']
          : ['Portugal'];

        const qPaid = query(
          collection(db, 'ads'),
          where('status', '==', 'approved'),
          where('isFeatured', '==', true),
          where('country', 'in', targetCountries),
          limit(20)
        );
        const qPerm = query(
          collection(db, 'ads'),
          where('status', '==', 'approved'),
          where('isPermanentFeatured', '==', true)
        );

        const [paySnap, permSnap] = await Promise.all([
          getDocsWithCacheFallback(qPaid, `home/featured-ads/${country}`),
          getDocsWithCacheFallback(qPerm, `home/featured-permanent`)
        ]);

        if (!active) return;

        const payDocs = paySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));
        const permDocs = permSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));

        const allDocs = [...payDocs];
        permDocs.forEach(pAd => {
          if (!allDocs.some(f => f.id === pAd.id)) {
            allDocs.push(pAd);
          }
        });
        
        setCachedFeaturedAds(allDocs, country);
        setFeaturedAds(allDocs);
        fetchedFeaturedCountry.current = country;
      } catch (err) {
        console.error('Erro ao buscar anúncios destacados:', err);
        // Se der erro, limpamos as refs para permitir nova tentativa
        fetchedFeaturedCountry.current = null;
      } finally {
        if (active) {
          inFlightFeaturedCountry.current = null;
        }
      }
    };
    fetchFeatured();
    return () => { 
      // Apenas consideramos inativo se houver real mudança de país.
      if (countryRef.current !== country) {
        active = false;
        inFlightFeaturedCountry.current = null;
      }
    };
  }, [country, authLoading]);

  useEffect(() => {
    const search = searchParams.get('search');
    if (search) setSearchTerm(search);
    const cat = searchParams.get('category');
    if (cat) setCategory(cat);
    const cty = searchParams.get('city');
    if (cty) setCity(cty);
    const countr = searchParams.get('country') as 'Portugal' | 'Reino Unido' | null;
    if (countr === 'Portugal' || countr === 'Reino Unido') {
      setCountry(countr);
      localStorage.setItem('selectedCountry', countr);
    }
  }, [searchParams]);

  useEffect(() => {
    // Se ainda está carregando a autenticação e não temos país explícito definido pelo utilizador, 
    // esperamos para não disparar consultas desnecessárias de Reino Unido (fallback) antes do perfil estar pronto
    const hasExplicitCountry = localStorage.getItem('selectedCountry') || 
      new URLSearchParams(window.location.search).get('country');
    if (authLoading && !hasExplicitCountry) {
      console.log('[ADS] loading delayed until auth load complete');
      return;
    }

    // Se já foi carregado com sucesso para este país E com o mesmo limite, evitamos chamar novamente
    if (fetchedAdsCountry.current === country && fetchedLimit.current === dbLimit) {
      console.log(`[ADS] Já carregado com sucesso para o país: ${country} com limite ${dbLimit}`);
      return;
    }

    // Se já existe uma requisição em andamento para este mesmo país, não iniciamos outra
    if (inFlightAdsCountry.current === country) {
      if (fetchedLimit.current === dbLimit) {
        console.log(`[ADS] Fetch em andamento para o país: ${country}`);
        return;
      }
    }
    inFlightAdsCountry.current = country;

    let active = true;
    const fetchAds = async () => {
      // Verificação de cache de sessão de 5 minutos
      const now = Date.now();
      const adsFromCache = getCachedAds(country);
      const lastFetch = getLastFetchTime(country);
      if (adsFromCache && adsFromCache.length >= dbLimit && (now - lastFetch < 5 * 60 * 1000)) {
        console.log(`[Cache HIT] Recuperou anúncios gerais da sessão (${country}). Total:`, adsFromCache.length);
        setAds(adsFromCache);
        setLoading(false);
        setIsFetchingMore(false);
        fetchedAdsCountry.current = country;
        fetchedLimit.current = dbLimit;
        inFlightAdsCountry.current = null;
        return;
      }

      const isLoadMore = dbLimit > 48 || ads.length > 0;
      if (!isLoadMore) {
        setLoading(true);
      } else {
        setIsFetchingMore(true);
      }
      setErrorMsg(null);

      // Delay visual rápido e subtil de carregamento inicial apenas se não for load-more
      if (!isLoadMore) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      if (!active) return;

      try {
        let snapshot;
        const targetCountries = (country === 'Reino Unido' || country === 'United Kingdom')
          ? ['Reino Unido', 'United Kingdom', 'UK']
          : ['Portugal'];

        // Primeira tentativa: Buscar anúncios ordenados pela criação (createdAt desc), limitando a dbLimit documentos (otimização de leituras)
        try {
          const q = query(
            collection(db, 'ads'),
            where('status', '==', 'approved'),
            where('country', 'in', targetCountries),
            // @ts-ignore
            orderBy('createdAt', 'desc'),
            limit(dbLimit)
          );
          snapshot = await withTimeout(getDocsWithCacheFallback(q, `home/approved-ads-${country}-ordered-${dbLimit}`), 20000);
        } catch (idxErr) {
          console.warn("[Home] Query ordenada falhou (falta de índice composto), recorrendo a query plana e ordenação em memória:", idxErr);
          const q = query(
            collection(db, 'ads'),
            where('status', '==', 'approved'),
            where('country', 'in', targetCountries),
            limit(dbLimit)
          );
          snapshot = await withTimeout(getDocsWithCacheFallback(q, `home/approved-ads-${country}-flat-${dbLimit}`), 20000);
        }

        if (!active) return;

        const docs = snapshot.docs;
        const adsData = docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));

        // Garantir ordenação por data de criação de forma estrita em memória para evitar variações não-determinísticas
        adsData.sort((a, b) => {
          const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1050 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return (timeB || 0) - (timeA || 0);
        });

        if (adsData.length < dbLimit) {
          setAllDbAdsFetched(true);
        } else {
          setAllDbAdsFetched(false);
        }

        setCachedAds(adsData, country);
        setAds(adsData);
        fetchedAdsCountry.current = country;
        fetchedLimit.current = dbLimit;
      } catch (err: any) {
        console.error("[Home] Erro ao carregar anúncios do Firestore:", err);
        if (active) setErrorMsg("Erro ao carregar anúncios.");
        // Se der erro, limpamos as refs para permitir nova tentativa
        fetchedAdsCountry.current = null;
      } finally {
        if (active) {
          setLoading(false);
          setIsFetchingMore(false);
          inFlightAdsCountry.current = null;
        }
      }
    };

    fetchAds();
    return () => { 
      // Apenas consideramos inativo se houver real mudança de país.
      if (countryRef.current !== country) {
        active = false;
        inFlightAdsCountry.current = null;
      }
    };
  }, [country, authLoading, reloadCounter, dbLimit]); // Recarrega sempre que mudar de país ou com dbLimit

  const handleLoadMore = () => {
    if (isFetchingMore) return;
    
    // Incrementa o limitAmount de anúncios mostrados na tela
    const nextLimitAmount = limitAmount + PAGE_SIZE;
    setLimitAmount(nextLimitAmount);
    
    // Se não tivermos anúncios suficientes carregados offline no estado ads
    // E soubermos que ainda existem anúncios a buscar no Firestore
    if (nextLimitAmount > ads.length && !allDbAdsFetched) {
      setIsFetchingMore(true);
      setDbLimit(prev => prev + 48);
    }
  };

  const selectableCitiesOnHome = useMemo(() => {
    const defaultCities = country === 'Portugal' ? PORTUGAL_CITIES : UK_CITIES;
    return combineAndSortCities(defaultCities, customLocations);
  }, [country, customLocations]);

  const filteredFeaturedAds = useMemo(() => {
    const now = new Date();
    
    let result = featuredAds.filter(ad => {
      if (ad.isHidden) return false;
      if (ad.category === 'Trabalho/Empregos') return false;
      // EXCLUSIVE FOR SALE LISTINGS: Boats for Hire are strictly forbidden from Featured Marine Listings
      if (ad.listingIntent === 'hire' || ad.category === 'Boats for Hire') return false;
      
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch = !search || ad.title?.toLowerCase().includes(search) || ad.description?.toLowerCase().includes(search);
      const matchesStatus = ad.status === 'approved' && (ad.adStatus === 'active' || ad.adStatus === 'sold' || !ad.adStatus);
      if (!matchesSearch || !matchesStatus) return false;

      // Allow country match or Ambos (for permanent)
      const adCountry = ad.country || 'Reino Unido';
      const isUkMatch = (country === 'Reino Unido' || country === 'United Kingdom') && (adCountry === 'Reino Unido' || adCountry === 'United Kingdom' || adCountry === 'UK');
      const matchesCountry = isUkMatch || adCountry === country || (ad.isPermanentFeatured && adCountry === 'Ambos');
      if (!matchesCountry) return false;

      // Category filter
      if (category !== 'Todas' && ad.category !== category) return false;

      // Service coverage filter
      const isServiceCategory = category === 'Serviços' || category?.startsWith('Serviços') || category?.includes('Serviços');
      if (isServiceCategory && (filterRegion || filterNational || filterOnline)) {
        const coverage = ad.serviceCoverage || 'city';
        let matchesServiceFilter = false;
        
        if (filterRegion && (coverage === 'city' || coverage === 'radius20' || coverage === 'radius50' || coverage === 'county')) {
          matchesServiceFilter = true;
        }
        if (filterNational) {
          if (country === 'Reino Unido' && coverage === 'uk') matchesServiceFilter = true;
          if (country === 'Portugal' && coverage === 'portugal') matchesServiceFilter = true;
        }
        if (filterOnline && coverage === 'online') {
          matchesServiceFilter = true;
        }
        
        if (!matchesServiceFilter) return false;
      }

      // City / Regional limits
      // Current paid plans (Featured/Premium) are marketplace-wide highlights.
      // Legacy local/national plans are still supported for older listings.
      const isPremiumPlan = ad.featuredLevel === 'premium' || ad.plan === 'premium';
      const isFeaturedPlan = ad.featuredLevel === 'featured' || ad.plan === 'featured';
      const isNational =
        isPremiumPlan ||
        isFeaturedPlan ||
        ad.featuredLevel === 'national' ||
        ad.plan === 'national' ||
        !ad.featuredLevel;

      if (city !== 'Todas') {
        const isLocal = ad.featuredLevel === 'local' || ad.plan === 'local' || ad.plan === 'highlight' || ad.plan === 'intermediate';
        if (isLocal) {
          if (ad.city?.toLowerCase().trim() !== city.toLowerCase().trim()) return false;
        } else if (!isNational) {
          return false;
        }
      } else {
        // With no city selected, show current Featured/Premium plans and legacy national highlights.
        if (!isNational) return false;
      }

      return true;
    });

    // Check expiration only for non-permanent ads
    const filteredActivePaid = result.filter(ad => {
      if (ad.isPermanentFeatured) return false;
      if (!ad.isFeatured || !ad.featuredUntil) return false;
      
      const featuredUntilDate = ad.featuredUntil.seconds
        ? ad.featuredUntil.toDate()
        : new Date(ad.featuredUntil);
      return featuredUntilDate > now;
    });

    const filteredActivePermanent = result.filter(ad => ad.isPermanentFeatured);

    // Featured Marine Listings priority:
    // 1. Premium paid listings
    // 2. Featured paid listings
    // 3. Legacy national highlights
    // 4. Legacy local highlights
    // 5. Permanent highlights
    const paidPremium = filteredActivePaid.filter(ad => ad.featuredLevel === 'premium' || ad.plan === 'premium');
    const paidFeatured = filteredActivePaid.filter(ad => ad.featuredLevel === 'featured' || ad.plan === 'featured');
    const paidNational = filteredActivePaid.filter(ad =>
      (ad.featuredLevel === 'national' || ad.plan === 'national' || !ad.featuredLevel) &&
      ad.featuredLevel !== 'premium' && ad.plan !== 'premium' &&
      ad.featuredLevel !== 'featured' && ad.plan !== 'featured'
    );
    const paidLocal = filteredActivePaid.filter(ad => ad.featuredLevel === 'local' || ad.plan === 'local' || ad.plan === 'highlight' || ad.plan === 'intermediate');

    const sortByFeaturedUntilDesc = (a: Ad, b: Ad) => {
      const timeA = a.featuredUntil?.seconds ? a.featuredUntil.seconds * 1000 : new Date(a.featuredUntil).getTime();
      const timeB = b.featuredUntil?.seconds ? b.featuredUntil.seconds * 1000 : new Date(b.featuredUntil).getTime();
      return (timeB || 0) - (timeA || 0);
    };

    paidPremium.sort(sortByFeaturedUntilDesc);
    paidFeatured.sort(sortByFeaturedUntilDesc);
    paidNational.sort(sortByFeaturedUntilDesc);
    paidLocal.sort(sortByFeaturedUntilDesc);

    // Sort permanent highlights by creation date descending
    filteredActivePermanent.sort((a, b) => {
      const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime();
      const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime();
      return (timeB || 0) - (timeA || 0);
    });

    // Combine in commercial plan priority order.
    let finalResult = [
      ...paidPremium,
      ...paidFeatured,
      ...paidNational,
      ...paidLocal,
      ...filteredActivePermanent
    ];

    return finalResult.slice(0, 50);
  }, [featuredAds, searchTerm, category, city, country, filterRegion, filterNational, filterOnline]);

  const marqueeData = useMemo(() => {
    if (filteredFeaturedAds.length === 0) return { items: [], duration: '35s' };
    // Para um loop contínuo elegante e 100% livre de espaços vazios ou saltos,
    // o conjunto base de itens (sem duplicação) precisa estender-se além do limite
    // visual das maiores telas. Usamos no mínimo 12 itens no conjunto base.
    const targetCount = 12;
    const repetitions = Math.ceil(targetCount / filteredFeaturedAds.length);
    const baseArray = [];
    for (let i = 0; i < repetitions; i++) {
      baseArray.push(...filteredFeaturedAds);
    }
    const items = [...baseArray, ...baseArray];
    const speedMultiplier = settings?.highlightSpeed !== undefined ? settings.highlightSpeed : 6;
    let duration = '35s';
    if (speedMultiplier > 0) {
      // Cada item no conjunto base demora ~2.8 segundos para deslocar em velocidade padrão
      const seconds = (baseArray.length * 2.8) / speedMultiplier;
      duration = `${seconds}s`;
    }
    return { items, duration };
  }, [filteredFeaturedAds, settings?.highlightSpeed]);



  const filteredAds = useMemo(() => {
    let result = ads.filter(ad => {
      if (ad.isHidden) return false;
      if (ad.category === 'Trabalho/Empregos') return false;

      // Exclude rental/hire listings from "Latest Marine Listings"
      if (
        ad.listingIntent === 'hire' ||
        ad.category === 'Boats for Hire' ||
        ad.category === 'Aluguer de Barcos' ||
        ad.category === 'Boat Hire & Charters' ||
        ad.listingType === 'hire' ||
        ad.listingType === 'rent'
      ) {
        return false;
      }

      // 1. Status & Active checks
      const matchesStatus = ad.status === 'approved' && (ad.adStatus === 'active' || ad.adStatus === 'sold' || !ad.adStatus);
      if (!matchesStatus) return false;

      // 2. Region check
      if (selectedRegion && selectedRegion !== 'All Regions' && selectedRegion !== '') {
        const adRegion = ad.region || getRegionForCity(ad.city);
        if (adRegion !== selectedRegion) return false;
      }

      // 3. Main Search text
      if (!matchesSearchText(ad, searchTerm)) return false;

      // 4. Category filter
      if (category !== 'Todas' && ad.category !== category) return false;

      // 5. City / Location filter
      if (city !== 'Todas' && ad.city?.toLowerCase().trim() !== city.toLowerCase().trim()) return false;

      // 6. Service coverage filter
      const isServiceCategory = category === 'Boat Services' || category === 'Serviços' || category?.includes('Services') || category?.includes('Serviços');
      if (isServiceCategory && (filterRegion || filterNational || filterOnline)) {
        const coverage = ad.serviceCoverage || 'city';
        let matchesServiceFilter = false;
        
        if (filterRegion && (coverage === 'city' || coverage === 'radius20' || coverage === 'radius50' || coverage === 'county')) {
          matchesServiceFilter = true;
        }
        if (filterNational) {
          if (country === 'Reino Unido' && coverage === 'uk') matchesServiceFilter = true;
          if (country === 'Portugal' && coverage === 'portugal') matchesServiceFilter = true;
        }
        if (filterOnline && coverage === 'online') {
          matchesServiceFilter = true;
        }
        if (!matchesServiceFilter) return false;
      }

      // 7. Advanced Marine Filters

      // Boat Type
      if (filterBoatType !== 'Todas') {
        const typeStr = (ad.boatType || '').toLowerCase();
        const targetType = filterBoatType.toLowerCase();
        if (!typeStr.includes(targetType) && !targetType.includes(typeStr)) return false;
      }

      // Min / Max Price
      if (filterMinPrice.trim() !== '') {
        const minP = parsePrice(filterMinPrice);
        if (minP > 0 && (ad.price === undefined || ad.price < minP)) return false;
      }
      if (filterMaxPrice.trim() !== '') {
        const maxP = parsePrice(filterMaxPrice);
        if (maxP > 0 && (ad.price === undefined || ad.price > maxP)) return false;
      }

      // Manufacturer
      if (filterManufacturer.trim() !== '') {
        const mfg = (ad.manufacturer || '').toLowerCase();
        if (!mfg.includes(filterManufacturer.toLowerCase().trim())) return false;
      }

      // Model
      if (filterModel.trim() !== '') {
        const mdl = (ad.model || '').toLowerCase();
        if (!mdl.includes(filterModel.toLowerCase().trim())) return false;
      }

      // Year Min / Max
      if (filterMinYear.trim() !== '') {
        const minY = parseInt(filterMinYear, 10);
        const adY = parseYearNum(ad.year);
        if (!isNaN(minY) && (adY === null || adY < minY)) return false;
      }
      if (filterMaxYear.trim() !== '') {
        const maxY = parseInt(filterMaxYear, 10);
        const adY = parseYearNum(ad.year);
        if (!isNaN(maxY) && (adY === null || adY > maxY)) return false;
      }

      // Condition
      if (filterCondition !== 'Todas') {
        const cond = (ad.condition || '').toLowerCase();
        const targetCond = filterCondition.toLowerCase();
        if (!cond.includes(targetCond) && !targetCond.includes(cond)) {
          const token = targetCond.split('-')[0].trim();
          if (!cond.includes(token)) return false;
        }
      }

      // Length Min / Max
      if (filterMinLength.trim() !== '') {
        const minL = parseFloat(filterMinLength);
        const adL = parseLengthMeters(ad.length);
        if (!isNaN(minL) && (adL === null || adL < minL)) return false;
      }
      if (filterMaxLength.trim() !== '') {
        const maxL = parseFloat(filterMaxLength);
        const adL = parseLengthMeters(ad.length);
        if (!isNaN(maxL) && (adL === null || adL > maxL)) return false;
      }

      // Fuel Type
      if (filterFuelType !== 'Todas') {
        const fuel = (ad.fuelType || '').toLowerCase();
        const targetFuel = filterFuelType.toLowerCase().split('/')[0].trim();
        if (!fuel.includes(targetFuel)) return false;
      }

      // Hull Material
      if (filterHullMaterial !== 'Todas') {
        const hull = (ad.hullMaterial || '').toLowerCase();
        const targetHull = filterHullMaterial.toLowerCase().split('/')[0].trim();
        if (!hull.includes(targetHull)) return false;
      }

      // Location Keyword Search
      if (filterLocationKeyword.trim() !== '') {
        const locStr = `${ad.city || ''} ${ad.location || ''} ${ad.country || ''}`.toLowerCase();
        if (!locStr.includes(filterLocationKeyword.toLowerCase().trim())) return false;
      }

      // Min Cabins
      if (filterMinCabins.trim() !== '') {
        const minCab = parseInt(filterMinCabins, 10);
        const adCab = ad.cabins ? parseInt(String(ad.cabins), 10) : 0;
        if (!isNaN(minCab) && (isNaN(adCab) || adCab < minCab)) return false;
      }

      // Trailer Included
      if (filterTrailer !== 'Any') {
        const trailer = (ad.trailerIncluded || '').toLowerCase();
        const isYes = trailer === 'yes' || trailer === 'sim' || trailer === 'yes / sim';
        if (filterTrailer === 'Yes' && !isYes) return false;
        if (filterTrailer === 'No' && isYes) return false;
      }

      return true;
    });

    // Sorting Options
    return result.sort((a, b) => {
      if (sortBy === 'price_asc') {
        const priceA = a.price ?? Infinity;
        const priceB = b.price ?? Infinity;
        return priceA - priceB;
      }
      if (sortBy === 'price_desc') {
        const priceA = a.price ?? -1;
        const priceB = b.price ?? -1;
        return priceB - priceA;
      }
      if (sortBy === 'year_desc') {
        const yearA = parseYearNum(a.year) ?? -1;
        const yearB = parseYearNum(b.year) ?? -1;
        return yearB - yearA;
      }
      if (sortBy === 'year_asc') {
        const yearA = parseYearNum(a.year) ?? Infinity;
        const yearB = parseYearNum(b.year) ?? Infinity;
        return yearA - yearB;
      }
      if (sortBy === 'length_desc') {
        const lenA = parseLengthMeters(a.length) ?? -1;
        const lenB = parseLengthMeters(b.length) ?? -1;
        return lenB - lenA;
      }
      if (sortBy === 'length_asc') {
        const lenA = parseLengthMeters(a.length) ?? Infinity;
        const lenB = parseLengthMeters(b.length) ?? Infinity;
        return lenA - lenB;
      }
      if (sortBy === 'oldest') {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds : (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds : (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
        return timeA - timeB;
      }

      // Default 'newest' (priority weighting)
      const getPriority = (ad: any) => {
        const isFeatured = ad.isFeatured && ad.featuredUntil && (
          ad.isPermanentFeatured || (
            ad.featuredUntil.seconds 
              ? ad.featuredUntil.toDate() > new Date() 
              : new Date(ad.featuredUntil) > new Date()
          )
        );

        if (isFeatured) {
          // Current ConnectBoat paid-plan hierarchy.
          if (ad.featuredLevel === 'premium' || ad.plan === 'premium') return 5;
          if (ad.featuredLevel === 'featured' || ad.plan === 'featured') return 4;

          // Keep compatibility with older national/local featured records.
          const isNational = ad.featuredLevel === 'national' || ad.plan === 'national' || !ad.featuredLevel;
          if (isNational) return 4;
          const isDonation = ad.category === '💚 Doações & Solidariedade' || ad.donationBoost === true || ad.featuredReason === 'donation';
          if (isDonation) return 2;
          return 3;
        }
        
        if (ad.category === '💚 Doações & Solidariedade' || ad.donationBoost === true) {
          return 2;
        }
        
        return 1;
      };

      const pA = getPriority(a);
      const pB = getPriority(b);
      
      if (pA !== pB) {
        return pB - pA;
      }

      const timeA = a.createdAt?.seconds ? a.createdAt.seconds : (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
      const timeB = b.createdAt?.seconds ? b.createdAt.seconds : (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
      return timeB - timeA;
    });
  }, [
    ads,
    searchTerm,
    category,
    city,
    country,
    filterRegion,
    filterNational,
    filterOnline,
    filterBoatType,
    filterMinPrice,
    filterMaxPrice,
    filterManufacturer,
    filterModel,
    filterMinYear,
    filterMaxYear,
    filterCondition,
    filterMinLength,
    filterMaxLength,
    filterFuelType,
    filterHullMaterial,
    filterLocationKeyword,
    filterMinCabins,
    filterTrailer,
    sortBy,
  ]);

  // Contagem calculada de anúncios aprovados em tempo real de acordo com as diretrizes de contexto de país e expiração de anúncios
  const totalApprovedCount = useMemo(() => {
    return ads.filter(ad => {
      const adCountry = ad.country || 'Reino Unido';
      const isActive = ad.status === 'approved' && (ad.adStatus === 'active' || ad.adStatus === 'sold' || !ad.adStatus);
      const isUkMatch = (country === 'Reino Unido' || country === 'United Kingdom') && (adCountry === 'Reino Unido' || adCountry === 'United Kingdom' || adCountry === 'UK');
      const matchesCountry = isUkMatch || adCountry === country;
      return matchesCountry && isActive;
    }).length;
  }, [ads, country]);

  // Paginação inteligente de anúncios filtrados em memória (carregamento instantâneo offline-first)
  // Boats for Hire list
  const hireAds = useMemo(() => {
    return ads.filter(ad => (
      ad.status === 'approved' &&
      (ad.adStatus === 'active' || ad.adStatus === 'sold' || !ad.adStatus) &&
      (ad.listingIntent === 'hire' || ad.category === 'Boats for Hire') &&
      (ad.country ? ad.country === country : true)
    ));
  }, [ads, country]);

  const displayedAds = useMemo(() => {
    return filteredAds.slice(0, limitAmount);
  }, [filteredAds, limitAmount]);

  const hasMore = useMemo(() => {
    return filteredAds.length > limitAmount;
  }, [filteredAds, limitAmount]);

  const flagItemsMarquee = [
    { flag: '🇬🇧', name: 'The Solent', code: 'gb', border: 'border-sky-400/80' },
    { flag: '🇬🇧', name: 'Cornwall Coast', code: 'gb', border: 'border-sky-400/80' },
    { flag: '🇬🇧', name: 'Norfolk Broads', code: 'gb', border: 'border-sky-400/80' },
    { flag: '🇬🇧', name: 'Scottish Lochs', code: 'gb', border: 'border-sky-400/80' },
    { flag: '🇬🇧', name: 'River Thames', code: 'gb', border: 'border-sky-400/80' },
    { flag: '🇬🇧', name: 'Plymouth Sound', code: 'gb', border: 'border-sky-400/80' },
    { flag: '🇬🇧', name: 'Wales Coast', code: 'gb', border: 'border-sky-400/80' },
    { flag: '🇬🇧', name: 'Northern Ireland', code: 'gb', border: 'border-sky-400/80' },
    { flag: '🇬🇧', name: 'English Channel', code: 'gb', border: 'border-sky-400/80' },
  ];

  return (
    <div className="w-full">
      {assistedPaymentMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-xl">
          <div className="bg-emerald-600 text-white rounded-2xl shadow-2xl px-5 py-4 flex items-start gap-3 border border-emerald-400">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
              ✓
            </div>

            <div>
              <p className="font-bold text-base">
                Payment completed successfully
              </p>

              <p className="text-sm text-emerald-50 mt-1">
                Your listing payment has been received. The listing is now awaiting admin approval.
              </p>
            </div>

            <button
              onClick={() => setAssistedPaymentMessage(false)}
              className="ml-auto text-white/80 hover:text-white font-bold text-lg"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <Helmet>
        <title>ConnectBoat - Buy, Sell & Hire Boats Across the UK</title>
        <meta name="description" content="ConnectBoat is the UK's premier boat and marine marketplace to buy, sell, hire, and advertise boats, yachts, outboard engines, gear, and marine services." />
        <link rel="canonical" href="https://connectboat.co.uk/" />
        <meta property="og:url" content="https://connectboat.co.uk/" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="ConnectBoat" />
        <meta property="og:title" content="ConnectBoat - Buy, Sell & Hire Boats Across the UK" />
        <meta property="og:description" content="ConnectBoat is the UK's premier boat and marine marketplace to buy, sell, hire, and advertise boats, yachts, outboard engines, gear, and marine services." />
        <meta property="og:image" content="https://connectboat.co.uk/api/og-image" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="ConnectBoat - Buy, Sell & Hire Boats Across the UK" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="ConnectBoat - Buy, Sell & Hire Boats Across the UK" />
        <meta name="twitter:description" content="ConnectBoat is the UK's premier boat and marine marketplace to buy, sell, hire, and advertise boats, yachts, outboard engines, gear, and marine services." />
        <meta name="twitter:image" content="https://connectboat.co.uk/api/og-image" />
      </Helmet>
      {/* ============================================================== */}
      {/* 💻 LAYOUT DESKTOP (Aparece apenas em ecrãs médios e superiores) */}
      {/* ============================================================== */}
      <div className="hidden md:flex flex-col gap-4 md:gap-5 max-w-full">
        {/* 1. HERO BANNER LUXURY (Título no topo esquerdo, stats à direita e subtítulo flutuante abaixo do casco) */}
        <section className="relative overflow-hidden shadow-xl rounded-2xl sm:rounded-3xl transition-all duration-500 max-w-full bg-slate-950 min-h-[220px] xs:min-h-[260px] sm:min-h-[320px] md:min-h-[400px] lg:min-h-[440px] flex flex-col justify-between" id="desktop-banner-section">
          {/* Imagem de Fundo dinâmica */}
          <div className="absolute inset-0 z-0 overflow-hidden bg-slate-950">
            <img 
              src={londonBg} 
              alt="ConnectBoat UK Marine" 
              className="w-full h-full object-cover object-[center_20%] transition-all duration-700 ease-in-out"
              onError={() => {
                if (londonBg !== londonAerialOriginalStandby) {
                  setLondonBg(londonAerialOriginalStandby);
                }
              }}
            />
            {/* Overlay em gradiente top-to-bottom para maximizar legibilidade no topo e no fundo sem cobrir o centro */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-black/15 to-slate-950/90" />
          </div>

          <div className="relative z-10 w-full h-full flex flex-col justify-between p-3.5 xs:p-4 sm:p-8 md:p-10 lg:p-12 min-h-[220px] xs:min-h-[260px] sm:min-h-[320px] md:min-h-[400px] lg:min-h-[440px]">
            {/* Topo do Banner: Título no Topo à Esquerda + Stats Badges à Direita */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-row items-start justify-between gap-3 sm:gap-4 w-full"
            >
              <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.12] drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] max-w-[220px] xs:max-w-[280px] sm:max-w-md md:max-w-xl text-left">
                Your Next Adventure Starts Here
              </h1>

              {/* Estatísticas (Stats) do Marketplace como Cards Flutuantes de Vidro */}
              <div className="flex flex-row items-center gap-1.5 sm:gap-3 shrink-0">
                {/* Contador de Anúncios Slim (Apenas para Staff / Administradores) */}
                {isModeratorOrAdmin && (
                  <div 
                    className="flex items-center bg-black/50 backdrop-blur-md border border-white/15 rounded-lg sm:rounded-xl px-2 py-1 xs:px-2.5 xs:py-1.5 sm:px-3.5 sm:py-2 shadow-lg select-none min-w-[70px] xs:min-w-[85px] sm:min-w-[110px] relative group"
                  >
                    <span className="text-white font-black text-xs xs:text-sm md:text-xl mr-1 sm:mr-2">
                      {totalApprovedCount !== null ? totalApprovedCount : filteredAds.length}
                    </span>
                    <span className="text-white/70 text-[7px] xs:text-[8px] md:text-[9px] uppercase font-black tracking-wider leading-none">Active<br/>Listings</span>

                    <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-950 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold px-3 py-1 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none z-10">
                      🔒 Hidden (Staff view)
                    </span>
                  </div>
                )}

                {/* Contador de Utilizadores Slim */}
                {(settings?.showTotalUsersBadge || isModeratorOrAdmin) && totalUsersCount !== null && (
                  <div 
                    className="flex items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-lg sm:rounded-xl px-2 py-1 xs:px-2.5 xs:py-1.5 sm:px-3.5 sm:py-2 shadow-lg select-none min-w-[70px] xs:min-w-[85px] sm:min-w-[110px] relative group"
                  >
                    <span className="text-amber-300 font-black text-xs xs:text-sm md:text-xl mr-1 sm:mr-2">
                      {totalUsersCount}
                    </span>
                    <span className="text-white/80 text-[7px] xs:text-[8px] md:text-[9px] uppercase font-black tracking-wider leading-none">UK<br/>Members</span>

                    {!settings?.showTotalUsersBadge && isModeratorOrAdmin && (
                      <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-950 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold px-3 py-1 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none z-10">
                        🔒 Oculto (Visto por Staff)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Base do Banner: Subtítulo Flutuante sem container na Parte Inferior (Lado Direito) em 2 linhas */}
            {bannerConfig?.enabled !== false && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="mt-auto pt-2 sm:pt-4 w-full flex justify-end text-right"
              >
                <p 
                  className="text-xs sm:text-sm md:text-base font-medium text-white/95 leading-snug tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] max-w-[280px] xs:max-w-[340px] sm:max-w-[420px] md:max-w-[460px] text-right"
                >
                  Buy, sell and hire boats, yachts, marine gear & services across the United Kingdom.
                </p>
              </motion.div>
            )}
          </div>
        </section>

        {/* 2. BARRA DE PESQUISA E DROPDOWNS DESKTOP (Abaixo do Banner, estilo Mobile) */}
        <section className="w-full flex flex-col gap-2 bg-transparent" id="desktop-search-section">
          
          {/* 3 Dropdowns na Primeira Linha */}
          <div className="grid grid-cols-3 gap-2 w-full" id="desktop-filters-section">
            {/* Categoria */}
            <div className="relative h-11 flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 sm:px-3.5 transition-all min-w-0">
              <Tag size={14} className="text-slate-400 dark:text-slate-400 shrink-0 select-none" />
              <select
                value={category}
                onChange={(e) => {
                  const val = e.target.value;
                  setCategory(val);
                  setFilterRegion(false);
                  setFilterNational(false);
                  setFilterOnline(false);
                }}
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none appearance-none cursor-pointer pr-3 border-none py-0 pl-0 min-w-0 truncate text-center [text-align-last:center]"
              >
                <option value="Todas" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium">All Categories</option>
                {categories.map((c, i) => (
                  <option key={i} value={c} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium">{c}</option>
                ))}
              </select>
              <span className="text-[9px] text-slate-400 dark:text-slate-400 absolute right-3 pointer-events-none select-none">▼</span>
            </div>

            {/* Cidade / Localização */}
            <div className="relative h-11 flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 sm:px-3.5 transition-all min-w-0">
              <MapPin size={14} className="text-slate-400 dark:text-slate-400 shrink-0 select-none" />
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none appearance-none cursor-pointer pr-3 border-none py-0 pl-0 min-w-0 truncate"
              >
                <option value="Todas" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium">All Locations</option>
                {selectableCitiesOnHome.map((c, i) => (
                  <option key={i} value={c} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium">{c}</option>
                ))}
              </select>
              <span className="text-[9px] text-slate-400 dark:text-slate-400 absolute right-3 pointer-events-none select-none">▼</span>
            </div>

            {/* Botão de Filtros */}
            <button
              type="button"
              onClick={() => setFilterDrawerOpen(true)}
              className={`h-11 flex items-center justify-center gap-1.5 px-3 sm:px-3.5 rounded-2xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer min-w-0 truncate ${
                activeMarineFilterCount > 0
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal size={14} className="shrink-0 text-slate-500 dark:text-slate-400" />
              <span className="truncate">Filters</span>
              {activeMarineFilterCount > 0 && (
                <span className="bg-white text-sky-700 rounded-full px-1.5 py-0.2 text-[9px] font-bold shrink-0">
                  {activeMarineFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Campo de Pesquisa Textual na Segunda Linha */}
          <div className="h-12 flex items-center gap-2 pl-4 pr-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 focus-within:border-sky-500 transition-all">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => {
                handleSearchFocus();
                setIsSearchFocused(true);
              }}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Search boats, engines, parts, services..."
              className="w-full bg-transparent text-slate-900 dark:text-slate-100 font-medium placeholder:text-slate-400 focus:outline-none text-xs sm:text-sm py-2 leading-normal"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1 font-semibold text-xs shrink-0"
              >
                ✕
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSearchFocus()}
              className="w-9 h-9 sm:w-10 sm:h-10 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-xl flex items-center justify-center shrink-0 transition-all shadow-sm cursor-pointer"
              aria-label="Search"
            >
              <Search size={18} />
            </button>
          </div>

          {/* Chips de Filtros Ativos (Removíveis) */}
          {(activeMarineFilterCount > 0 || searchTerm || category !== 'Todas' || city !== 'Todas') && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-left px-1">
              <span className="text-slate-400 font-extrabold uppercase text-[10px] tracking-wider flex items-center gap-1">
                <Filter size={11} /> Filters ({filteredAds.length} found):
              </span>

              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-[11px] border border-slate-300 dark:border-slate-700">
                  Search: "{searchTerm}"
                  <button onClick={() => setSearchTerm('')} className="hover:text-red-500 font-black ml-0.5">✕</button>
                </span>
              )}

              {category !== 'Todas' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 font-extrabold text-[11px] border border-indigo-200 dark:border-indigo-800">
                  Cat: {category}
                  <button onClick={() => setCategory('Todas')} className="hover:text-red-500 font-black ml-0.5">✕</button>
                </span>
              )}

              {city !== 'Todas' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 font-extrabold text-[11px] border border-rose-200 dark:border-rose-800">
                  Location: {city}
                  <button onClick={() => setCity('Todas')} className="hover:text-red-500 font-black ml-0.5">✕</button>
                </span>
              )}

              {filterBoatType !== 'Todas' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 font-extrabold text-[11px] border border-sky-200 dark:border-sky-800">
                  Type: {filterBoatType}
                  <button onClick={() => setFilterBoatType('Todas')} className="hover:text-red-500 font-black ml-0.5">✕</button>
                </span>
              )}

              {(filterMinPrice || filterMaxPrice) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-extrabold text-[11px] border border-emerald-200 dark:border-emerald-800">
                  Price: {filterMinPrice ? `${country === 'Portugal' ? '€' : '£'}${filterMinPrice}` : '0'} - {filterMaxPrice ? `${country === 'Portugal' ? '€' : '£'}${filterMaxPrice}` : 'Any'}
                  <button onClick={() => { setFilterMinPrice(''); setFilterMaxPrice(''); }} className="hover:text-red-500 font-black ml-0.5">✕</button>
                </span>
              )}

              {filterManufacturer && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 font-extrabold text-[11px] border border-indigo-200 dark:border-indigo-800">
                  Make: {filterManufacturer}
                  <button onClick={() => setFilterManufacturer('')} className="hover:text-red-500 font-black ml-0.5">✕</button>
                </span>
              )}

              {filterModel && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 font-extrabold text-[11px] border border-indigo-200 dark:border-indigo-800">
                  Model: {filterModel}
                  <button onClick={() => setFilterModel('')} className="hover:text-red-500 font-black ml-0.5">✕</button>
                </span>
              )}

              {(filterMinYear || filterMaxYear) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-extrabold text-[11px] border border-amber-200 dark:border-amber-800">
                  Year: {filterMinYear || 'Any'} - {filterMaxYear || 'Any'}
                  <button onClick={() => { setFilterMinYear(''); setFilterMaxYear(''); }} className="hover:text-red-500 font-black ml-0.5">✕</button>
                </span>
              )}

              {filterCondition !== 'Todas' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 font-extrabold text-[11px] border border-purple-200 dark:border-purple-800">
                  Cond: {filterCondition}
                  <button onClick={() => setFilterCondition('Todas')} className="hover:text-red-500 font-black ml-0.5">✕</button>
                </span>
              )}

              {(filterMinLength || filterMaxLength) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 font-extrabold text-[11px] border border-teal-200 dark:border-teal-800">
                  Length: {filterMinLength ? `${filterMinLength}m` : '0m'} - {filterMaxLength ? `${filterMaxLength}m` : 'Any'}
                  <button onClick={() => { setFilterMinLength(''); setFilterMaxLength(''); }} className="hover:text-red-500 font-black ml-0.5">✕</button>
                </span>
              )}

              {filterFuelType !== 'Todas' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-extrabold text-[11px] border border-blue-200 dark:border-blue-800">
                  Fuel: {filterFuelType}
                  <button onClick={() => setFilterFuelType('Todas')} className="hover:text-red-500 font-black ml-0.5">✕</button>
                </span>
              )}

              {filterHullMaterial !== 'Todas' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold text-[11px] border border-slate-300 dark:border-slate-700">
                  Hull: {filterHullMaterial}
                  <button onClick={() => setFilterHullMaterial('Todas')} className="hover:text-red-500 font-black ml-0.5">✕</button>
                </span>
              )}

              {filterLocationKeyword && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 font-extrabold text-[11px] border border-rose-200 dark:border-rose-800">
                  Region: {filterLocationKeyword}
                  <button onClick={() => setFilterLocationKeyword('')} className="hover:text-red-500 font-black ml-0.5">✕</button>
                </span>
              )}

              {filterMinCabins && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 font-extrabold text-[11px] border border-cyan-200 dark:border-cyan-800">
                  Cabins: {filterMinCabins}+
                  <button onClick={() => setFilterMinCabins('')} className="hover:text-red-500 font-black ml-0.5">✕</button>
                </span>
              )}

              {filterTrailer !== 'Any' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300 font-extrabold text-[11px] border border-orange-200 dark:border-orange-800">
                  Trailer: {filterTrailer}
                  <button onClick={() => setFilterTrailer('Any')} className="hover:text-red-500 font-black ml-0.5">✕</button>
                </span>
              )}

              <button
                onClick={clearAllFilters}
                className="text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 font-black text-[11px] underline underline-offset-2 ml-1 cursor-pointer transition-colors"
              >
                Clear All
              </button>
            </div>
          )}

          {/* Filtro de Área de Atendimento para Categoria Serviços */}
          {(() => {
            const isServiceCategory = category === 'Boat Services' || category === 'Serviços' || category?.includes('Services') || category?.includes('Serviços');
            return isServiceCategory && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="w-full mt-2 border-t border-slate-100 dark:border-slate-800 pt-2.5"
              >
                <div className="text-left">
                  <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-slate-500 flex items-center gap-2">
                    <span>📍</span> Service Coverage Filter
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-slate-100 dark:border-slate-800 select-none bg-slate-50/50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200">
                      <input 
                        type="checkbox" 
                        checked={filterRegion} 
                        onChange={(e) => setFilterRegion(e.target.checked)}
                        className="w-5 h-5 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs md:text-sm font-extrabold">Local Area Only</span>
                        <span className="text-[10px] text-slate-400">Local harbour, marina or county</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-slate-100 dark:border-slate-800 select-none bg-slate-50/50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200">
                      <input 
                        type="checkbox" 
                        checked={filterNational} 
                        onChange={(e) => setFilterNational(e.target.checked)}
                        className="w-5 h-5 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs md:text-sm font-extrabold">Nationwide Service</span>
                        <span className="text-[10px] text-slate-400">Across the entire United Kingdom</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-slate-100 dark:border-slate-800 select-none bg-slate-50/50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200">
                      <input 
                        type="checkbox" 
                        checked={filterOnline} 
                        onChange={(e) => setFilterOnline(e.target.checked)}
                        className="w-5 h-5 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs md:text-sm font-extrabold">Online / Remote Service</span>
                        <span className="text-[10px] text-slate-400">100% remote marine services</span>
                      </div>
                    </label>
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </section>

        {/* 3. ✨ ANÚNCIOS EM DESTAQUE */}
        {filteredFeaturedAds.length > 0 && (() => {
          const salesTheme = getFeaturedSectionTheme(settings?.featuredSalesColor, '#0c223f');
          return (
            <section className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 md:p-6 my-3 shadow-xs">
              {/* Soft 4-Edge Vignette & Pure White Center Overlay */}
              <div 
                className="absolute inset-0 pointer-events-none z-0 rounded-2xl md:rounded-3xl"
                style={{
                  boxShadow: salesTheme.boxShadow,
                  background: salesTheme.radialBackground
                }}
              />
              {/* Subtle radial glow behind listing cards */}
              <div 
                className="absolute inset-0 pointer-events-none z-0"
                style={{
                  background: salesTheme.glowBackground
                }}
              />

              <div className="relative z-10">
                <div className="flex flex-col gap-0.5 mb-4 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base sm:text-lg">✨</span>
                    <h2 className="text-xs sm:text-sm md:text-base font-brand font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
                      Featured Marine Listings
                    </h2>
                  </div>
                  <p className="text-[9px] md:text-[10px] text-slate-500 dark:text-slate-400 font-extrabold tracking-wider uppercase">
                    Promoted boats, engines, moorings and equipment across the UK
                  </p>
                </div>
                
                {/* Carrossel Horizontal Responsivo */}
                <div className="relative w-full overflow-hidden py-1">
                  <div 
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onTouchStart={() => setIsHovered(true)}
                    onTouchEnd={() => setIsHovered(false)}
                    className="carouselTrack flex gap-4 md:gap-6"
                    style={{
                      animationName: (settings?.highlightSpeed !== 0) ? 'scrollCarousel' : 'none',
                      animationDuration: marqueeData.duration,
                      animationTimingFunction: 'linear',
                      animationIterationCount: 'infinite',
                      animationPlayState: (isHovered || settings?.highlightSpeed === 0) ? 'paused' : 'running',
                    }}
                  >
                    {marqueeData.items.map((ad, idx) => (
                      <div key={`${ad.id}-${idx}`} className="w-[140px] sm:w-[165px] md:w-[195px] shrink-0">
                        <AdCard ad={ad} variant="featured" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          );
        })()}

        {/* 4. ⚓ BOATS FOR HIRE SECTION */}
        {(() => {
          const hireTheme = getFeaturedSectionTheme(settings?.featuredHireColor, '#10b7c7');
          return (
            <section className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 md:p-6 my-3 shadow-xs text-left" id="boats-for-hire-section">
              {/* Soft 4-Edge Vignette & Pure White Center Overlay */}
              <div 
                className="absolute inset-0 pointer-events-none z-0 rounded-2xl md:rounded-3xl"
                style={{
                  boxShadow: hireTheme.boxShadow,
                  background: hireTheme.radialBackground
                }}
              />
              {/* Subtle radial glow behind content */}
              <div 
                className="absolute inset-0 pointer-events-none z-0"
                style={{
                  background: hireTheme.glowBackground
                }}
              />

              <div className="relative z-10">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <Anchor className="text-sky-600 dark:text-sky-400 shrink-0" size={18} />
                      <h2 className="text-xs sm:text-sm md:text-base font-brand font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
                        Boats for Hire & Charter
                      </h2>
                    </div>
                    <p className="text-[9px] md:text-[10px] text-slate-500 dark:text-slate-400 font-extrabold tracking-wider uppercase">
                      Explore luxury yachts, motorboats & RIBs available for hire across the UK
                    </p>
                  </div>

                  <Link
                    to="/boats-for-hire"
                    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-[11px] rounded-xl transition-all shadow-xs flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span>View All Boats for Hire</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>

                {hireAds.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                    {hireAds.slice(0, 5).map((ad) => (
                      <AdCard key={`hire-${ad.id}`} ad={ad} />
                    ))}
                  </div>
                ) : (
                  <div className="p-6 bg-white dark:bg-slate-900/80 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center gap-2 shadow-xs">
                    <Anchor size={28} className="text-sky-500/60" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Are you a boat owner or charter operator?
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md">
                      List your yacht, powerboat or RIB for hire on ConnectBoat and connect directly with interested clients via WhatsApp.
                    </p>
                    <Link
                      to="/criar-anuncio"
                      className="mt-1 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5"
                    >
                      <span>List Boat for Hire</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        {/* 5. ⛵ GRID DE ANÚNCIOS (Últimos anúncios) */}
        <section className="py-2 md:py-4 text-left">
          <div className="flex flex-col gap-0.5 mb-4">
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg">⛵</span>
              <h2 className="text-xs sm:text-sm md:text-base font-brand font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
                Latest Marine Listings
              </h2>
            </div>
            <p className="text-[9px] md:text-[10px] text-slate-500 dark:text-slate-400 font-extrabold tracking-wider uppercase">
              Discover the newest boats, engines, electronics, parts and accessories in real-time
            </p>
          </div>

          <div className="px-0">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-slate-100 dark:bg-slate-800 rounded-2xl h-64 animate-pulse" />
                ))}
              </div>
            ) : errorMsg ? (
              <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-red-100 dark:border-red-950 shadow-md max-w-md mx-auto p-6 flex flex-col items-center">
                <span className="text-3xl">⚠️</span>
                <h3 className="text-md font-extrabold text-slate-850 dark:text-slate-100 mt-2">Connection Issue</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                  Unable to connect to the database right now.
                </p>
                <button
                  onClick={() => {
                    setErrorMsg(null);
                    setLoading(true);
                    clearHomeCache();
                    setReloadCounter(prev => prev + 1);
                  }}
                  className="mt-4 px-5 py-2 bg-slate-900 dark:bg-slate-850 text-white font-black text-xs rounded-lg hover:bg-slate-800 transition active:scale-95 shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCcw size={12} />
                  Try Again
                </button>
              </div>
            ) : filteredAds.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <Anchor size={40} className="mx-auto text-slate-200 dark:text-slate-700 mb-3" />
                <h3 className="text-md font-extrabold text-slate-400">No boating listings found</h3>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                {displayedAds.map((ad) => (
                  <AdCard key={ad.id} ad={ad} hideCategory hideActions />
                ))}
              </div>
            )}

            {hasMore && !loading && (
              <div className="flex justify-center mt-10 pb-6">
                <button
                  onClick={handleLoadMore}
                  disabled={isFetchingMore}
                  className="flex items-center gap-2 px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-full shadow-md active:scale-95 disabled:opacity-50 transition-all duration-300 cursor-pointer"
                >
                  {isFetchingMore ? (
                    <>
                      <RefreshCcw className="animate-spin" size={14} />
                      Loading more...
                    </>
                  ) : (
                    <>
                      View More Listings
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ============================================================== */}
      {/* 📱 LAYOUT MOBILE (Aparece apenas em ecrãs menores que md) */}
      {/* ============================================================== */}
      <div className="flex md:hidden flex-col gap-4 w-full max-w-full overflow-hidden" id="mobile-home-root">
        
        {/* 1. HERO BANNER LUXURY (Primeiro elemento no topo) */}
        <section className="relative overflow-hidden shadow-xl rounded-2xl sm:rounded-3xl transition-all duration-500 w-full bg-slate-950 min-h-[220px] xs:min-h-[260px] sm:min-h-[320px] md:min-h-[400px] lg:min-h-[440px] flex flex-col justify-between" id="mobile-banner-section">
          {/* Imagem de Fundo dinâmica */}
          <div className="absolute inset-0 z-0 overflow-hidden bg-slate-950">
            <img 
              src={londonBg} 
              alt="ConnectBoat UK Marine" 
              className="w-full h-full object-cover object-[center_20%] transition-all duration-700 ease-in-out"
              onError={() => {
                if (londonBg !== londonAerialOriginalStandby) {
                  setLondonBg(londonAerialOriginalStandby);
                }
              }}
            />
            {/* Overlay em gradiente top-to-bottom para maximizar legibilidade no topo e no fundo sem cobrir o centro */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-black/15 to-slate-950/90" />
          </div>

          <div className="relative z-10 w-full h-full flex flex-col justify-between p-3.5 xs:p-4 sm:p-8 md:p-10 lg:p-12 min-h-[220px] xs:min-h-[260px] sm:min-h-[320px] md:min-h-[400px] lg:min-h-[440px]">
            {/* Topo do Banner: Título no Topo à Esquerda + Stats Badges à Direita */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-row items-start justify-between gap-2.5 sm:gap-4 w-full"
            >
              <h1 className="text-xl xs:text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-[1.12] drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] max-w-[200px] xs:max-w-[240px] sm:max-w-md text-left">
                Your Next Adventure Starts Here
              </h1>

              {/* Estatísticas (Stats) do Marketplace como Cards Flutuantes de Vidro */}
              <div className="flex flex-row items-center gap-1.5 sm:gap-3 shrink-0">
                {/* Contador de Anúncios Slim (Apenas para Staff / Administradores) */}
                {isModeratorOrAdmin && (
                  <div 
                    className="flex items-center bg-black/50 backdrop-blur-md border border-white/15 rounded-lg sm:rounded-xl px-2 py-1 xs:px-2.5 xs:py-1.5 sm:px-3.5 sm:py-2 shadow-lg select-none min-w-[70px] xs:min-w-[85px] sm:min-w-[110px] relative group"
                  >
                    <span className="text-white font-black text-xs xs:text-sm md:text-xl mr-1 sm:mr-2">
                      {totalApprovedCount !== null ? totalApprovedCount : filteredAds.length}
                    </span>
                    <span className="text-white/70 text-[7px] xs:text-[8px] md:text-[9px] uppercase font-black tracking-wider leading-none">Active<br/>Listings</span>

                    <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-950 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold px-3 py-1 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none z-10">
                      🔒 Hidden (Staff view)
                    </span>
                  </div>
                )}

                {/* Contador de Utilizadores Slim */}
                {(settings?.showTotalUsersBadge || isModeratorOrAdmin) && totalUsersCount !== null && (
                  <div 
                    className="flex items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-2 py-1 xs:px-2.5 xs:py-1.5 sm:px-3.5 sm:py-2 shadow-lg select-none min-w-[70px] xs:min-w-[85px] sm:min-w-[110px] relative group"
                  >
                    <span className="text-amber-300 font-black text-xs xs:text-sm md:text-xl mr-1 sm:mr-2">
                      {totalUsersCount}
                    </span>
                    <span className="text-white/80 text-[7px] xs:text-[8px] md:text-[9px] uppercase font-black tracking-wider leading-none">UK<br/>Members</span>

                    {!settings?.showTotalUsersBadge && isModeratorOrAdmin && (
                      <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-950 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold px-3 py-1 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none z-10">
                        🔒 Oculto (Visto por Staff)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Base do Banner: Subtítulo Flutuante sem container na Parte Inferior (Lado Direito) em 2 linhas no Mobile */}
            {bannerConfig?.enabled !== false && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="mt-auto pt-2 w-full flex justify-end text-right"
              >
                <p 
                  className="text-[11px] xs:text-xs sm:text-sm font-medium text-white/95 leading-snug tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] max-w-[215px] xs:max-w-[250px] sm:max-w-[300px] text-right"
                >
                  Buy, sell and hire boats, yachts, marine gear & services across the United Kingdom.
                </p>
              </motion.div>
            )}
          </div>
        </section>

        {/* 2. FILTROS DROPDOWNS E BARRA DE PESQUISA MOBILE */}
        <section className="w-full flex flex-col gap-2 bg-transparent" id="mobile-search-section">
          
          {/* 3 Dropdowns na Mesma Linha */}
          <div className="grid grid-cols-3 gap-1.5 xs:gap-2 w-full" id="mobile-filters-section">
            {/* Categoria */}
            <div className="relative h-11 flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-2.5 transition-all min-w-0">
              <Tag size={14} className="text-slate-400 dark:text-slate-400 shrink-0 select-none" />
              <select
                value={category}
                onChange={(e) => {
                  const val = e.target.value;
                  setCategory(val);
                  setFilterRegion(false);
                  setFilterNational(false);
                  setFilterOnline(false);
                }}
                className="w-full bg-transparent text-[11px] xs:text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none appearance-none cursor-pointer pr-3 border-none py-0 pl-0 min-w-0 truncate"
              >
                <option value="Todas" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium">All Categories</option>
                {categories.map((c, i) => (
                  <option key={i} value={c} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium">{c}</option>
                ))}
              </select>
              <span className="text-[9px] text-slate-400 dark:text-slate-400 absolute right-2.5 pointer-events-none select-none">▼</span>
            </div>

            {/* Cidade / Localização */}
            <div className="relative h-11 flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-2.5 transition-all min-w-0">
              <MapPin size={14} className="text-slate-400 dark:text-slate-400 shrink-0 select-none" />
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-transparent text-[11px] xs:text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none appearance-none cursor-pointer pr-3 border-none py-0 pl-0 min-w-0 truncate"
              >
                <option value="Todas" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium">All Locations</option>
                {selectableCitiesOnHome.map((c, i) => (
                  <option key={i} value={c} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium">{c}</option>
                ))}
              </select>
              <span className="text-[9px] text-slate-400 dark:text-slate-400 absolute right-2.5 pointer-events-none select-none">▼</span>
            </div>

            {/* Botão de Filtros */}
            <button
              type="button"
              onClick={() => setFilterDrawerOpen(true)}
              className={`h-11 flex items-center justify-center gap-1.5 px-2 xs:px-2.5 rounded-2xl border text-[11px] xs:text-xs font-semibold transition-all cursor-pointer min-w-0 truncate ${
                activeMarineFilterCount > 0
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal size={14} className="shrink-0 text-slate-500 dark:text-slate-400" />
              <span className="truncate">Filters</span>
              {activeMarineFilterCount > 0 && (
                <span className="bg-white text-sky-700 rounded-full px-1.5 py-0.2 text-[9px] font-bold shrink-0">
                  {activeMarineFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Campo de Pesquisa Textual Mobile */}
          <div className="h-12 flex items-center gap-2 pl-4 pr-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 focus-within:border-sky-500 transition-all">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => {
                handleSearchFocus();
                setIsSearchFocused(true);
              }}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Search boats, engines, parts, services..."
              className="w-full bg-transparent text-slate-900 dark:text-slate-100 font-medium placeholder:text-slate-400 focus:outline-none text-xs sm:text-sm py-2 leading-normal"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1 font-semibold text-xs shrink-0"
              >
                ✕
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSearchFocus()}
              className="w-9 h-9 sm:w-10 sm:h-10 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-xl flex items-center justify-center shrink-0 transition-all shadow-sm cursor-pointer"
              aria-label="Search"
            >
              <Search size={18} />
            </button>
          </div>

          {/* Filtros expandidos de serviços se categoria for Serviços */}
          {(() => {
            const isServiceCategory = category === 'Boat Services' || category === 'Serviços' || category?.includes('Services') || category?.includes('Serviços');
            return isServiceCategory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="w-full mt-1 bg-slate-50/80 dark:bg-slate-800/60 rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-800"
              >
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Service Area:</span>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <input type="checkbox" checked={filterRegion} onChange={(e) => setFilterRegion(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                      <span>Local</span>
                    </label>
                    <label className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200">
                      <input type="checkbox" checked={filterNational} onChange={(e) => setFilterNational(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                      <span>Nationwide</span>
                    </label>
                    <label className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200">
                      <input type="checkbox" checked={filterOnline} onChange={(e) => setFilterOnline(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                      <span>Remote</span>
                    </label>
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </section>

        {/* 4. ANÚNCIOS EM DESTAQUE (Carrossel Compacto) */}
        {filteredFeaturedAds.length > 0 && (
          <section className="relative w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 my-1 shadow-2xs overflow-hidden" id="mobile-featured-section">
            {/* Soft 4-Edge Navy Vignette & Pure White Center Overlay */}
            <div 
              className="absolute inset-0 pointer-events-none z-0 rounded-2xl"
              style={{
                boxShadow: 'inset 0 0 28px 2px rgba(12, 34, 63, 0.12)',
                background: 'radial-gradient(ellipse at 50% 50%, #ffffff 25%, rgba(255, 255, 255, 0.96) 50%, rgba(20, 50, 93, 0.05) 80%, rgba(12, 34, 63, 0.14) 100%)'
              }}
            />
            {/* Subtle radial glow behind listing cards */}
            <div 
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                background: 'radial-gradient(ellipse 85% 55% at 50% 60%, rgba(20, 50, 93, 0.04) 0%, rgba(12, 34, 63, 0.02) 55%, transparent 80%)'
              }}
            />

            <div className="relative z-10">
              <div className="flex items-center gap-1.5 mb-2.5 text-left">
                <span className="text-base">✨</span>
                <h2 className="text-xs font-brand font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Featured
                </h2>
              </div>
              
              {/* Esteira horizontal compacta */}
              <div className="relative w-full overflow-hidden">
                <div 
                  className="carouselTrack flex gap-3"
                  style={{
                    animationName: (settings?.highlightSpeed !== 0) ? 'scrollCarousel' : 'none',
                    animationDuration: marqueeData.duration,
                    animationTimingFunction: 'linear',
                    animationIterationCount: 'infinite',
                  }}
                >
                  {marqueeData.items.map((ad, idx) => (
                    <div key={`${ad.id}-${idx}`} className="w-[125px] shrink-0">
                      <AdCard ad={ad} variant="featured" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 5. ⚓ BOATS FOR HIRE SECTION MOBILE */}
        {(() => {
          const hireTheme = getFeaturedSectionTheme(settings?.featuredHireColor, '#10b7c7');
          return (
            <section 
              className="relative w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 my-1 shadow-2xs overflow-hidden text-left" 
              id="mobile-hire-section"
            >
              {/* Soft 4-Edge Vignette & Pure White Center Overlay */}
              <div 
                className="absolute inset-0 pointer-events-none z-0 rounded-2xl"
                style={{
                  boxShadow: hireTheme.boxShadow,
                  background: hireTheme.radialBackground
                }}
              />
              <div 
                className="absolute inset-0 pointer-events-none z-0"
                style={{
                  background: hireTheme.glowBackground
                }}
              />

              <div className="relative z-10">
                <div className="flex items-center justify-between gap-2 mb-2.5 text-left">
                  <div className="flex items-center gap-1.5">
                    <Anchor className="text-sky-600 dark:text-sky-400 shrink-0" size={16} />
                    <h2 className="text-xs font-brand font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
                      Boats for Hire & Charter
                    </h2>
                  </div>
                  
                  <Link
                    to="/boats-for-hire"
                    className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-[10px] rounded-lg transition-all shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span>View All</span>
                    <ArrowRight size={11} />
                  </Link>
                </div>

                {hireAds.length > 0 ? (
                  /* Manual horizontal scrollable row with same proportion as featured cards */
                  <div className="w-full overflow-x-auto scrollbar-none pb-1 pt-0.5">
                    <div className="flex gap-3 min-w-min">
                      {hireAds.map((ad) => (
                        <div key={`mobile-hire-${ad.id}`} className="w-[125px] shrink-0">
                          <AdCard ad={ad} variant="featured" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center gap-1">
                    <Anchor size={20} className="text-sky-500/60" />
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                      Are you a boat owner or charter operator?
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-xs leading-tight">
                      List your boat or yacht for hire on ConnectBoat.
                    </p>
                    <Link
                      to="/criar-anuncio"
                      className="mt-1 px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] rounded-lg transition-all shadow-2xs flex items-center gap-1"
                    >
                      <span>List Boat for Hire</span>
                      <ArrowRight size={11} />
                    </Link>
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        {/* 6. ÚLTIMOS ANÚNCIOS (Grid Compacta de 2 Colunas) */}
        <section className="w-full text-left" id="mobile-latest-section">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-base">⛵</span>
            <h2 className="text-xs font-brand font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
              Latest Listings
            </h2>
          </div>

          <div ref={resultsSectionRef}>
            {loading ? (
              <div className="grid grid-cols-2 gap-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-slate-100 dark:bg-slate-850 rounded-xl h-44 animate-pulse" />
                ))}
              </div>
            ) : errorMsg ? (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-red-100 dark:border-red-950 p-4">
                <span className="text-2xl">⚠️</span>
                <p className="text-slate-600 dark:text-slate-400 text-xs mt-1 font-bold">Unable to load listings right now.</p>
              </div>
            ) : filteredAds.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-xs font-black text-slate-400">No boating listings available.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {displayedAds.map((ad) => (
                  <AdCard key={`mb-ad-${ad.id}`} ad={ad} hideCategory hideActions />
                ))}
              </div>
            )}

            {hasMore && !loading && (
              <div className="flex justify-center mt-6 pb-4">
                <button
                  onClick={handleLoadMore}
                  disabled={isFetchingMore}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-full shadow-md transition-all cursor-pointer"
                >
                  {isFetchingMore ? (
                    <span>Loading...</span>
                  ) : (
                    <>
                      <span>Load More</span>
                      <ArrowRight size={12} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Voltar ao Topo (Comum a ambos os layouts) */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 15 }}
            onClick={scrollToTop}
            title="Voltar ao topo"
            aria-label="Voltar ao topo"
            className="fixed bottom-6 right-6 z-50 p-3.5 md:p-4 bg-white text-indigo-600 hover:text-indigo-700 border border-slate-150 rounded-full shadow-2xl transition-transform hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center"
            id="back-to-top-btn"
          >
            <ArrowUp size={20} className="md:w-6 md:h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* ⚓ ADVANCED MARINE FILTER SLIDE-OVER DRAWER / MODAL */}
      {/* ============================================================== */}
      <AnimatePresence>
        {filterDrawerOpen && (
          <div className="fixed inset-0 z-[9999] flex justify-end bg-slate-950/70 backdrop-blur-sm transition-opacity">
            <motion.div
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 h-full flex flex-col shadow-2xl border-l border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400">
                    <Anchor size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                      Marine Filters
                      {activeMarineFilterCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-black bg-sky-600 text-white">
                          {activeMarineFilterCount}
                        </span>
                      )}
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                      Narrow down boats, engines, gear and services
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeMarineFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-xs font-extrabold text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setFilterDrawerOpen(false)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Modal Body - Scrollable Form Controls */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 text-left">
                
                {/* Section 0: Region Selection */}
                <div className="space-y-2.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <MapPin size={14} className="text-sky-500" />
                    <span>Region</span>
                  </label>
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-extrabold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                  >
                    <option value="">All Regions</option>
                    {UK_REGIONS.map(reg => (
                      <option key={reg} value={reg}>{reg}</option>
                    ))}
                  </select>
                </div>

                {/* Section 1: Boat Type */}
                <div className="space-y-2.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Ship size={14} className="text-sky-500" />
                    <span>Boat Type</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFilterBoatType('Todas')}
                      className={`px-3 py-2 rounded-xl text-xs font-extrabold border transition-all text-center ${
                        filterBoatType === 'Todas'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/20'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      All Types
                    </button>
                    {BOAT_TYPES.map((bt) => (
                      <button
                        key={bt}
                        type="button"
                        onClick={() => setFilterBoatType(filterBoatType === bt ? 'Todas' : bt)}
                        className={`px-3 py-2 rounded-xl text-xs font-extrabold border transition-all text-center truncate ${
                          filterBoatType === bt
                            ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/20'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {bt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section 2: Price Range */}
                <div className="space-y-2.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>Price Range ({country === 'Portugal' ? '€' : '£'})</span>
                    {(filterMinPrice || filterMaxPrice) && (
                      <button
                        type="button"
                        onClick={() => { setFilterMinPrice(''); setFilterMaxPrice(''); }}
                        className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline"
                      >
                        Reset Price
                      </button>
                    )}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 mb-1 block">Min Price</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Min (£/€)"
                        value={filterMinPrice}
                        onChange={(e) => setFilterMinPrice(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 mb-1 block">Max Price</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Max (£/€)"
                        value={filterMaxPrice}
                        onChange={(e) => setFilterMaxPrice(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Make & Model */}
                <div className="space-y-2.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Manufacturer & Model
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 mb-1 block">Manufacturer / Builder</span>
                      <input
                        type="text"
                        list="mfg-suggestions"
                        placeholder="e.g. Beneteau, Sunseeker..."
                        value={filterManufacturer}
                        onChange={(e) => setFilterManufacturer(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
                      />
                      <datalist id="mfg-suggestions">
                        {availableManufacturers.map((m) => (
                          <option key={m} value={m} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 mb-1 block">Model Name</span>
                      <input
                        type="text"
                        placeholder="e.g. Antares, Predator..."
                        value={filterModel}
                        onChange={(e) => setFilterModel(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Year Range */}
                <div className="space-y-2.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Year Built
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 mb-1 block">Min Year</span>
                      <input
                        type="number"
                        placeholder="e.g. 2010"
                        value={filterMinYear}
                        onChange={(e) => setFilterMinYear(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 mb-1 block">Max Year</span>
                      <input
                        type="number"
                        placeholder="e.g. 2024"
                        value={filterMaxYear}
                        onChange={(e) => setFilterMaxYear(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 5: Condition */}
                <div className="space-y-2.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Vessel Condition
                  </label>
                  <select
                    value={filterCondition}
                    onChange={(e) => setFilterCondition(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
                  >
                    <option value="Todas">Any Condition</option>
                    {BOAT_CONDITIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Section 6: Length (Meters) */}
                <div className="space-y-2.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Length (Metres)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 mb-1 block">Min Length (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 6"
                        value={filterMinLength}
                        onChange={(e) => setFilterMinLength(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 mb-1 block">Max Length (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 15"
                        value={filterMaxLength}
                        onChange={(e) => setFilterMaxLength(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 7: Fuel & Hull */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2.5">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Fuel size={14} className="text-amber-500" />
                      <span>Fuel Type</span>
                    </label>
                    <select
                      value={filterFuelType}
                      onChange={(e) => setFilterFuelType(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
                    >
                      <option value="Todas">Any Fuel</option>
                      {BOAT_FUEL_TYPES.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Hull Material
                    </label>
                    <select
                      value={filterHullMaterial}
                      onChange={(e) => setFilterHullMaterial(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
                    >
                      <option value="Todas">Any Hull Material</option>
                      {BOAT_HULL_MATERIALS.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Section 8: Location / Region Text */}
                <div className="space-y-2.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Compass size={14} className="text-emerald-500" />
                    <span>Location / Boating Region</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Solent, Faro, Plymouth, Hampshire..."
                    value={filterLocationKeyword}
                    onChange={(e) => setFilterLocationKeyword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Section 9: Cabins & Trailer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2.5">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Minimum Cabins
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 1"
                      value={filterMinCabins}
                      onChange={(e) => setFilterMinCabins(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Trailer Included
                    </label>
                    <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-800">
                      {(['Any', 'Yes', 'No'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setFilterTrailer(t)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                            filterTrailer === t
                              ? 'bg-sky-600 text-white shadow'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setFilterDrawerOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs transition-all shadow-md shadow-sky-600/20 text-center"
                >
                  Show {filteredAds.length} {filteredAds.length === 1 ? 'Listing' : 'Listings'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;
