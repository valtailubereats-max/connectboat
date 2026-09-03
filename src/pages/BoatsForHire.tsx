import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { db, getDocsWithCacheFallback } from '../firebase';
import { Ad } from '../types';
import AdCard from '../components/AdCard';
import { useSettings } from '../context/SettingsContext';
import {
  Anchor,
  Search,
  PlusCircle,
  ArrowRight,
  RefreshCcw,
  X,
  MessageCircle,
  Crown,
  Star
} from 'lucide-react';

const hireHeroImage =
  'https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&w=1600&q=85';

const getCreatedAtSeconds = (ad: Ad) => {
  if (ad.createdAt?.seconds) return ad.createdAt.seconds;
  if (ad.createdAt) return new Date(ad.createdAt as any).getTime() / 1000;
  return 0;
};

const getPlanPriority = (ad: Ad) => {
  const plan = String((ad as any).plan || '').toLowerCase();
  const level = String((ad as any).featuredLevel || '').toLowerCase();

  if (plan === 'premium' || level === 'premium') return 3;

  if (
    plan === 'featured' ||
    level === 'featured' ||
    level === 'national' ||
    level === 'local' ||
    (ad as any).isFeatured === true
  ) {
    return 2;
  }

  return 1;
};

const isFeaturedHire = (ad: Ad) => getPlanPriority(ad) >= 2;

const BoatsForHire = () => {
  const { country, settings } = useSettings();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroImage, setHeroImage] = useState(hireHeroImage);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('All');
  const [boatTypeFilter, setBoatTypeFilter] = useState('All');
  const [skipperFilter, setSkipperFilter] = useState('All');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchHireAds = async () => {
      setLoading(true);

      try {
        const q = query(
          collection(db, 'ads'),
          where('status', '==', 'approved')
        );

        const snapshot = await getDocsWithCacheFallback(q, 'hire_ads_page');

        if (!isMounted) return;

        const loadedAds: Ad[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Ad;

          const isHire =
            data.listingIntent === 'hire' ||
            data.category === 'Boats for Hire';

          const isActive =
            data.adStatus === 'active' ||
            data.adStatus === 'sold' ||
            !data.adStatus;

          if (isHire && isActive && !data.isHidden) {
            loadedAds.push({
              ...data,
              id: docSnap.id
            });
          }
        });

        // Default Hire hierarchy:
        // Premium -> Featured -> Standard -> newest within each group.
        loadedAds.sort((a, b) => {
          const priorityDiff = getPlanPriority(b) - getPlanPriority(a);
          if (priorityDiff !== 0) return priorityDiff;

          return getCreatedAtSeconds(b) - getCreatedAtSeconds(a);
        });

        setAds(loadedAds);
      } catch (err) {
        console.error('Error loading hire ads:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHireAds();

    return () => {
      isMounted = false;
    };
  }, []);

  const availableCities = useMemo(() => {
    const cities = ads
      .map((a) => a.city)
      .filter((c): c is string => Boolean(c && c.trim() !== ''));

    return ['All', ...Array.from(new Set(cities)).sort()];
  }, [ads]);

  const availableBoatTypes = useMemo(() => {
    const types = ads
      .map((a) => a.boatType)
      .filter((t): t is string => Boolean(t && t.trim() !== ''));

    return ['All', ...Array.from(new Set(types)).sort()];
  }, [ads]);

  // Dedicated top carousel: ONLY paid Featured/Premium hire listings.
  const featuredHireAds = useMemo(() => {
    return ads
      .filter(isFeaturedHire)
      .sort((a, b) => {
        const priorityDiff = getPlanPriority(b) - getPlanPriority(a);
        if (priorityDiff !== 0) return priorityDiff;

        return getCreatedAtSeconds(b) - getCreatedAtSeconds(a);
      });
  }, [ads]);

  const filteredAds = useMemo(() => {
    return ads.filter((ad) => {
      // Keep marketplace country handling compatible with the current app.
      if (country && ad.country && ad.country !== country) {
        // Existing marketplace behaviour remains flexible here.
      }

      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase().trim();
        const titleMatch = ad.title?.toLowerCase().includes(term);
        const descMatch = ad.description?.toLowerCase().includes(term);
        const locMatch =
          ad.city?.toLowerCase().includes(term) ||
          ad.location?.toLowerCase().includes(term);
        const mfgMatch =
          ad.manufacturer?.toLowerCase().includes(term) ||
          ad.model?.toLowerCase().includes(term);

        if (!titleMatch && !descMatch && !locMatch && !mfgMatch) {
          return false;
        }
      }

      if (
        cityFilter !== 'All' &&
        ad.city?.toLowerCase().trim() !== cityFilter.toLowerCase().trim()
      ) {
        return false;
      }

      if (boatTypeFilter !== 'All') {
        const typeStr = (ad.boatType || '').toLowerCase();
        if (!typeStr.includes(boatTypeFilter.toLowerCase())) return false;
      }

      if (skipperFilter !== 'All') {
        const skipper = (ad.skipperIncluded || '').toLowerCase();
        const isYes =
          skipper === 'yes' ||
          skipper === 'sim' ||
          skipper === 'included' ||
          skipper === 'com skipper';

        if (skipperFilter === 'Yes' && !isYes) return false;
        if (skipperFilter === 'No' && isYes) return false;
      }

      if (maxPriceFilter.trim() !== '') {
        const maxP = parseFloat(maxPriceFilter);
        const adP = ad.rentalPrice || ad.price || 0;

        if (!isNaN(maxP) && adP > maxP) return false;
      }

      return true;
    });
  }, [
    ads,
    country,
    searchTerm,
    cityFilter,
    boatTypeFilter,
    skipperFilter,
    maxPriceFilter
  ]);

  const clearFilters = () => {
    setSearchTerm('');
    setCityFilter('All');
    setBoatTypeFilter('All');
    setSkipperFilter('All');
    setMaxPriceFilter('');
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    cityFilter !== 'All' ||
    boatTypeFilter !== 'All' ||
    skipperFilter !== 'All' ||
    maxPriceFilter !== '';

  const hireAccent = settings?.featuredHireColor || '#10b7c7';

  return (
    <div className="min-h-screen pb-16 space-y-5 md:space-y-6 text-left">
      <Helmet>
        <title>Boats for Hire & Charter Across the UK | ConnectBoat</title>
        <meta
          name="description"
          content="Explore boats, yachts, RIBs and charters available for hire across the UK. Connect directly with boat owners and hire operators on ConnectBoat."
        />
        <link rel="canonical" href="https://connectboat.co.uk/boats-for-hire" />
        <meta
          property="og:title"
          content="Boats for Hire & Charter Across the UK | ConnectBoat"
        />
        <meta
          property="og:description"
          content="Discover boats, yachts and charters for hire across the UK and connect directly with owners and operators."
        />
        <meta
          property="og:url"
          content="https://connectboat.co.uk/boats-for-hire"
        />
        <meta
          property="og:image"
          content="https://connectboat.co.uk/api/og-image"
        />
      </Helmet>

      {/* ============================================================ */}
      {/* HIRE HERO — same visual language as the ConnectBoat Home hero */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden shadow-xl rounded-2xl sm:rounded-3xl bg-slate-950 min-h-[220px] xs:min-h-[260px] sm:min-h-[320px] md:min-h-[400px] lg:min-h-[440px] flex flex-col justify-between">
        <div className="absolute inset-0 z-0 overflow-hidden bg-slate-950">
          <img
            src={heroImage}
            alt="Boat and yacht hire across the United Kingdom"
            className="w-full h-full object-cover object-center transition-all duration-700 ease-in-out"
            onError={() => {
              setHeroImage(
                'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&w=1600&q=80'
              );
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-black/15 to-slate-950/90" />
        </div>

        <div className="relative z-10 w-full h-full flex flex-col justify-between p-3.5 xs:p-4 sm:p-8 md:p-10 lg:p-12 min-h-[220px] xs:min-h-[260px] sm:min-h-[320px] md:min-h-[400px] lg:min-h-[440px]">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-row items-start justify-between gap-3 sm:gap-4 w-full"
          >
            <div className="max-w-[235px] xs:max-w-[285px] sm:max-w-md md:max-w-xl">
              <div className="inline-flex items-center gap-1.5 mb-2 bg-black/35 backdrop-blur-md border border-white/15 rounded-lg px-2.5 py-1 text-[9px] xs:text-[10px] sm:text-xs font-black uppercase tracking-wider text-sky-200">
                <Anchor size={13} />
                Boats for Hire & Charter
              </div>

              <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.12] drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] text-left">
                Your Next Day on the Water Starts Here
              </h1>
            </div>

            <Link
              to="/"
              className="hidden xs:inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white shadow-lg transition-all shrink-0"
            >
              Home
              <ArrowRight size={12} />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-auto pt-2 sm:pt-4 w-full flex justify-end text-right"
          >
            <p className="text-[11px] xs:text-xs sm:text-sm md:text-base font-medium text-white/95 leading-snug tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] max-w-[245px] xs:max-w-[300px] sm:max-w-[420px] md:max-w-[470px] text-right">
              Hire boats, yachts and charters across the United Kingdom — connect directly with owners and operators.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* PREMIUM / FEATURED HIRE CAROUSEL */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 sm:p-5 md:p-6 shadow-xs">
        <div
          className="absolute inset-0 pointer-events-none z-0 rounded-2xl md:rounded-3xl"
          style={{
            boxShadow: `inset 0 0 34px ${hireAccent}22`,
            background: `radial-gradient(circle at center, rgba(255,255,255,0) 35%, ${hireAccent}12 100%)`
          }}
        />

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
            <div>
              <div className="flex items-center gap-1.5">
                <Crown
                  size={17}
                  className="text-sky-600 dark:text-sky-400 shrink-0"
                />
                <h2 className="text-xs sm:text-sm md:text-base font-brand font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Featured Boats for Hire
                </h2>
              </div>
              <p className="text-[9px] md:text-[10px] text-slate-500 dark:text-slate-400 font-extrabold tracking-wider uppercase mt-0.5">
                Premium listings first, followed by Featured hire listings
              </p>
            </div>

            <Link
              to="/create-ad"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-[9px] sm:text-[11px] rounded-xl transition-all shadow-xs shrink-0"
            >
              <PlusCircle size={13} />
              <span className="hidden sm:inline">List Your Boat</span>
              <span className="sm:hidden">List</span>
            </Link>
          </div>

          {loading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-slate-500">
              <RefreshCcw size={17} className="animate-spin text-sky-600" />
              <span className="text-xs font-bold">Loading featured hire listings...</span>
            </div>
          ) : featuredHireAds.length > 0 ? (
            <div className="w-full overflow-x-auto scrollbar-none pb-1 pt-0.5 snap-x snap-mandatory">
              <div className="flex gap-3 md:gap-4 min-w-min">
                {featuredHireAds.map((ad) => (
                  <div
                    key={`featured-hire-${ad.id}`}
                    className="w-[132px] xs:w-[145px] sm:w-[190px] md:w-[210px] lg:w-[220px] shrink-0 snap-start"
                  >
                    <AdCard ad={ad} variant="featured" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-5 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center gap-2">
              <Star size={24} className="text-sky-500/60" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Featured hire spaces are available.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md">
                Featured and Premium hire listings will appear here, with Premium listings shown first.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/* FILTERS FOR THE COMPLETE HIRE MARKETPLACE */}
      {/* ============================================================ */}
      <section className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
              All Boats for Hire
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Browse every approved boat hire and charter listing.
            </p>
          </div>

          <Link
            to="/create-ad"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/30 text-[10px] font-extrabold rounded-xl transition-all"
          >
            <PlusCircle size={13} />
            List Boat for Hire
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
          <div className="relative col-span-2 lg:col-span-2">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, make or location..."
              className="w-full pl-10 pr-9 py-2.5 bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
            >
              <option value="All">All Locations</option>
              {availableCities
                .filter((c) => c !== 'All')
                .map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <select
              value={boatTypeFilter}
              onChange={(e) => setBoatTypeFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
            >
              <option value="All">All Boat Types</option>
              <option value="Yacht">Yacht</option>
              <option value="Motorboat">Motorboat</option>
              <option value="RIB">RIB / Inflatable</option>
              <option value="Sailboat">Sailboat</option>
              <option value="Catamaran">Catamaran</option>
              <option value="Jet Ski">Jet Ski</option>
              {availableBoatTypes
                .filter(
                  (t) =>
                    ![
                      'All',
                      'Yacht',
                      'Motorboat',
                      'RIB',
                      'Sailboat',
                      'Catamaran',
                      'Jet Ski'
                    ].includes(t)
                )
                .map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <select
              value={skipperFilter}
              onChange={(e) => setSkipperFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
            >
              <option value="All">Skipper: Any</option>
              <option value="Yes">Skipper Included</option>
              <option value="No">Bareboat (Self-drive)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:max-w-md">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
              £
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={maxPriceFilter}
              onChange={(e) => setMaxPriceFilter(e.target.value)}
              placeholder="Max price"
              className="w-full pl-7 pr-3 py-2.5 bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] sm:text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 transition-all"
            />
          </div>

          {hasActiveFilters ? (
            <button
              onClick={clearFilters}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-xl transition-all"
            >
              <RefreshCcw size={12} />
              Reset Filters
            </button>
          ) : (
            <div className="flex items-center px-3 py-2.5 text-[10px] sm:text-[11px] font-bold text-slate-400">
              Premium & Featured receive priority
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] sm:text-xs font-extrabold text-sky-600 dark:text-sky-400">
            Showing {filteredAds.length} of {ads.length} hire listings
          </div>
        )}
      </section>

      {/* ============================================================ */}
      {/* COMPLETE HIRE LISTING GRID */}
      {/* ============================================================ */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCcw
            className="animate-spin text-sky-600 mx-auto"
            size={28}
          />
          <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
            Loading boat hire listings...
          </p>
        </div>
      ) : filteredAds.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {filteredAds.length}{' '}
              {filteredAds.length === 1
                ? 'Boat Available for Hire'
                : 'Boats Available for Hire'}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {filteredAds.map((ad) => (
              <AdCard key={`hire-page-${ad.id}`} ad={ad} />
            ))}
          </div>
        </section>
      ) : (
        <div className="p-10 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-4 max-w-xl mx-auto my-8">
          <div className="w-14 h-14 bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 rounded-2xl flex items-center justify-center mx-auto border border-sky-100 dark:border-sky-800">
            <Anchor size={32} />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              No boats found matching your criteria
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              {hasActiveFilters
                ? 'Try adjusting or resetting your search filters to view more listings.'
                : 'Be the first to list a boat for hire on ConnectBoat and connect directly with clients.'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all"
              >
                Clear Filters
              </button>
            )}

            <Link
              to="/create-ad"
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-sky-600/20 flex items-center gap-1.5"
            >
              <PlusCircle size={15} />
              <span>List Boat for Hire</span>
            </Link>
          </div>
        </div>
      )}

      {/* DIRECT CONTACT INFO */}
      <div className="p-5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0 border border-emerald-200/50">
            <MessageCircle size={18} />
          </div>
          <div>
            <p className="font-extrabold text-slate-900 dark:text-slate-100">
              Direct Contact with Owners
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              ConnectBoat connects hirers with owners and operators directly.
              Use the contact option on a listing to discuss rates, availability
              and booking terms.
            </p>
          </div>
        </div>

        <Link
          to="/create-ad"
          className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-[11px] rounded-xl transition-all shrink-0"
        >
          Are you an operator? List here →
        </Link>
      </div>
    </div>
  );
};

export default BoatsForHire;
