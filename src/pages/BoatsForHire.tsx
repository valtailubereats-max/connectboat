import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { db, getDocsWithCacheFallback } from '../firebase';
import { Ad } from '../types';
import AdCard from '../components/AdCard';
import { useSettings } from '../context/SettingsContext';
import { 
  Anchor, 
  Search, 
  Filter, 
  MapPin, 
  Compass, 
  Users, 
  PlusCircle, 
  ArrowLeft, 
  RefreshCcw,
  CheckCircle2,
  X,
  MessageCircle
} from 'lucide-react';

const BoatsForHire = () => {
  const navigate = useNavigate();
  const { country } = useSettings();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('All');
  const [boatTypeFilter, setBoatTypeFilter] = useState('All');
  const [skipperFilter, setSkipperFilter] = useState('All');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Fetch all hire ads from Firestore
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
        if (isMounted) {
          const loadedAds: Ad[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Ad;
            const isHire = data.listingIntent === 'hire' || data.category === 'Boats for Hire';
            const isActive = data.adStatus === 'active' || data.adStatus === 'sold' || !data.adStatus;
            
            if (isHire && isActive) {
              loadedAds.push({
                ...data,
                id: docSnap.id
              });
            }
          });

          // Sort newest first
          loadedAds.sort((a, b) => {
            const timeA = a.createdAt?.seconds ? a.createdAt.seconds : (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
            const timeB = b.createdAt?.seconds ? b.createdAt.seconds : (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
            return timeB - timeA;
          });

          setAds(loadedAds);
        }
      } catch (err) {
        console.error('Error loading hire ads:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHireAds();
    return () => { isMounted = false; };
  }, []);

  // Available unique cities for filter
  const availableCities = useMemo(() => {
    const cities = ads
      .map(a => a.city)
      .filter((c): c is string => Boolean(c && c.trim() !== ''));
    return ['All', ...Array.from(new Set(cities)).sort()];
  }, [ads]);

  // Available unique boat types
  const availableBoatTypes = useMemo(() => {
    const types = ads
      .map(a => a.boatType)
      .filter((t): t is string => Boolean(t && t.trim() !== ''));
    return ['All', ...Array.from(new Set(types)).sort()];
  }, [ads]);

  // Filtered ads computation
  const filteredAds = useMemo(() => {
    return ads.filter(ad => {
      // 1. Country filter
      if (country && ad.country && ad.country !== country) {
        // Keep flexible if no country set
      }

      // 2. Search term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase().trim();
        const titleMatch = ad.title?.toLowerCase().includes(term);
        const descMatch = ad.description?.toLowerCase().includes(term);
        const locMatch = ad.city?.toLowerCase().includes(term) || ad.location?.toLowerCase().includes(term);
        const mfgMatch = ad.manufacturer?.toLowerCase().includes(term) || ad.model?.toLowerCase().includes(term);
        if (!titleMatch && !descMatch && !locMatch && !mfgMatch) return false;
      }

      // 3. City filter
      if (cityFilter !== 'All' && ad.city?.toLowerCase().trim() !== cityFilter.toLowerCase().trim()) {
        return false;
      }

      // 4. Boat type filter
      if (boatTypeFilter !== 'All') {
        const typeStr = (ad.boatType || '').toLowerCase();
        if (!typeStr.includes(boatTypeFilter.toLowerCase())) return false;
      }

      // 5. Skipper included filter
      if (skipperFilter !== 'All') {
        const skipper = (ad.skipperIncluded || '').toLowerCase();
        const isYes = skipper === 'yes' || skipper === 'sim' || skipper === 'included' || skipper === 'com skipper';
        if (skipperFilter === 'Yes' && !isYes) return false;
        if (skipperFilter === 'No' && isYes) return false;
      }

      // 6. Max price filter
      if (maxPriceFilter.trim() !== '') {
        const maxP = parseFloat(maxPriceFilter);
        const adP = ad.rentalPrice || ad.price || 0;
        if (!isNaN(maxP) && adP > maxP) return false;
      }

      return true;
    });
  }, [ads, country, searchTerm, cityFilter, boatTypeFilter, skipperFilter, maxPriceFilter]);

  const clearFilters = () => {
    setSearchTerm('');
    setCityFilter('All');
    setBoatTypeFilter('All');
    setSkipperFilter('All');
    setMaxPriceFilter('');
  };

  const hasActiveFilters = searchTerm !== '' || cityFilter !== 'All' || boatTypeFilter !== 'All' || skipperFilter !== 'All' || maxPriceFilter !== '';

  return (
    <div className="min-h-screen pb-16 space-y-6 text-left">
      <Helmet>
        <title>Boats for Hire Across the UK | ConnectBoat</title>
        <meta name="description" content="Explore motorboats, luxury yachts, RIBs and powerboats available for hire across the UK. Connect directly with boat owners and hire operators on WhatsApp." />
      </Helmet>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 text-white p-6 sm:p-8 md:p-10 shadow-xl border border-sky-900/40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-500/15 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="flex items-center gap-2">
            <Link 
              to="/" 
              className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-sky-400 hover:text-sky-300 bg-sky-900/50 hover:bg-sky-900/80 px-3 py-1.5 rounded-xl border border-sky-700/50 transition-all"
            >
              <ArrowLeft size={14} />
              <span>Back to Home</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0">
              <Anchor size={22} />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-brand font-black uppercase tracking-tight text-white">
              Boats for Hire
            </h1>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed max-w-2xl">
            Discover motorboats, luxury yachts, RIBs & sailing vessels available for hire across the UK. Connect directly with verified owners and operators via WhatsApp — 100% direct marketplace connection with no hidden booking fees.
          </p>

          <div className="flex items-center gap-3 pt-2">
            <Link
              to="/create-ad"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-sky-500/20 cursor-pointer"
            >
              <PlusCircle size={16} />
              <span>List Your Boat for Hire</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, make or location..."
              className="w-full pl-10 pr-4 py-2.5 bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* City Filter */}
          <div>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
            >
              <option value="All" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">All Locations</option>
              {availableCities.filter(c => c !== 'All').map(c => (
                <option key={c} value={c} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{c}</option>
              ))}
            </select>
          </div>

          {/* Boat Type Filter */}
          <div>
            <select
              value={boatTypeFilter}
              onChange={(e) => setBoatTypeFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
            >
              <option value="All" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">All Boat Types</option>
              <option value="Yacht" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Yacht</option>
              <option value="Motorboat" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Motorboat</option>
              <option value="RIB" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">RIB / Inflatable</option>
              <option value="Sailboat" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Sailboat</option>
              <option value="Catamaran" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Catamaran</option>
              <option value="Jet Ski" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Jet Ski</option>
              {availableBoatTypes.filter(t => !['All', 'Yacht', 'Motorboat', 'RIB', 'Sailboat', 'Catamaran', 'Jet Ski'].includes(t)).map(t => (
                <option key={t} value={t} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{t}</option>
              ))}
            </select>
          </div>

          {/* Skipper Filter */}
          <div>
            <select
              value={skipperFilter}
              onChange={(e) => setSkipperFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
            >
              <option value="All" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Skipper: Any</option>
              <option value="Yes" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Skipper Included</option>
              <option value="No" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Bareboat (Self-drive)</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="font-extrabold text-sky-600 dark:text-sky-400">
              Showing {filteredAds.length} of {ads.length} hire listings
            </span>
            <button
              onClick={clearFilters}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCcw size={12} />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCcw className="animate-spin text-sky-600 mx-auto" size={28} />
          <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
            Loading boat hire listings...
          </p>
        </div>
      ) : filteredAds.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {filteredAds.length} {filteredAds.length === 1 ? 'Boat Available for Hire' : 'Boats Available for Hire'}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {filteredAds.map((ad) => (
              <AdCard key={`hire-page-${ad.id}`} ad={ad} />
            ))}
          </div>
        </div>
      ) : (
        <div className="p-10 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-4 max-w-xl mx-auto my-8">
          <div className="w-14 h-14 bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 rounded-2xl flex items-center justify-center mx-auto border border-sky-100 dark:border-sky-800">
            <Anchor size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              No Boats Found matching your criteria
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              {hasActiveFilters 
                ? 'Try adjusting or resetting your search filters to view more listings.' 
                : 'Be the first to list a boat for hire on ConnectBoat! Connect directly with clients via WhatsApp.'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            {hasActiveFilters ? (
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Clear Filters
              </button>
            ) : null}
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

      {/* Marketplace info banner */}
      <div className="p-5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0 border border-emerald-200/50">
            <MessageCircle size={18} />
          </div>
          <div>
            <p className="font-extrabold text-slate-900 dark:text-slate-100">
              Direct WhatsApp Connection
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              ConnectBoat is an open marketplace connecting renters and owners directly. Click WhatsApp on any listing to inquire about rates and availability.
            </p>
          </div>
        </div>

        <Link
          to="/create-ad"
          className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-[11px] rounded-xl transition-all shrink-0"
        >
          Are you an Operator? List Here →
        </Link>
      </div>
    </div>
  );
};

export default BoatsForHire;
