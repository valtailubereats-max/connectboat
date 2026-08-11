import React, { useState, useEffect } from 'react';
import {
  Search, Layers, ExternalLink, CheckCircle2, AlertCircle,
  AlertTriangle, Loader2, CheckSquare, Square, Sparkles, ArrowRight, X, ShieldCheck,
  Filter, RotateCcw, Info, Globe, Tag, MapPin, Anchor, ArrowLeftRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { validateSearchPageUrl, SearchPageValidationResult } from '../utils/urlNormalization';

export interface DiscoveredListingItem {
  sourceUrl: string;
  normalizedSourceUrl: string;
  externalId?: string;
  title?: string;
  image?: string;
  priceText?: string;
  locationText?: string;
  alreadyImported: boolean;
  selected: boolean;
  status: 'new' | 'already_imported' | 'invalid_url';
}

interface AdminSearchPageDiscoveryProps {
  onImportSelected: (urls: string[]) => void;
}

const LOADING_STEPS = [
  'Reading search results page...',
  'Identifying boat listings...',
  'Removing duplicate listings...',
  'Checking existing listings on ConnectBoat...',
  'Preparing listing preview...'
];

export const AdminSearchPageDiscovery: React.FC<AdminSearchPageDiscoveryProps> = ({
  onImportSelected
}) => {
  const { profile, user } = useAuth();
  const userRole = (profile?.role || (user ? 'admin' : 'guest')) as string;

  const [searchUrl, setSearchUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState<number>(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessages, setWarningMessages] = useState<string[]>([]);
  const [discoveryResult, setDiscoveryResult] = useState<{
    marketplace: string;
    pageUrl: string;
    totalCandidates: number;
    totalFound: number;
    duplicatesRemoved: number;
    alreadyImportedCount: number;
  } | null>(null);

  const [discoveredListings, setDiscoveredListings] = useState<DiscoveredListingItem[]>([]);
  const [existingDbUrls, setExistingDbUrls] = useState<Set<string>>(new Set());

  // Filter states
  const [filterOnlyNew, setFilterOnlyNew] = useState<boolean>(false);
  const [filterOnlyWithPrice, setFilterOnlyWithPrice] = useState<boolean>(false);
  const [filterUkOnly, setFilterUkOnly] = useState<boolean>(false);

  // Limit warning banner state
  const [showLimitWarning, setShowLimitWarning] = useState<boolean>(false);

  // Handoff state
  const [handoffCount, setHandoffCount] = useState<number | null>(null);

  // Diagnostic Error ID state
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
  const [errorDebug, setErrorDebug] = useState<any | null>(null);

  // Load existing Firestore URLs pre-flight for duplicate detection
  useEffect(() => {
    async function loadExistingDbUrls() {
      try {
        const q = query(collection(db, 'ads'));
        const snap = await getDocs(q);
        const set = new Set<string>();
        snap.docs.forEach(docSnap => {
          const sUrl = docSnap.data().sourceUrl;
          if (sUrl && typeof sUrl === 'string') {
            set.add(sUrl.trim().toLowerCase());
          }
        });
        setExistingDbUrls(set);
      } catch (err) {
        console.warn('[AdminSearchPageDiscovery] Error fetching existing db URLs:', err);
      }
    }
    loadExistingDbUrls();
  }, []);

  // Step ticker during loading
  useEffect(() => {
    if (!isLoading) {
      setLoadingStepIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStepIdx(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
    }, 1200);
    return () => clearInterval(interval);
  }, [isLoading]);

  const formatDiscoveryError = (errCode?: string, fallbackMsg?: string): string => {
    switch (errCode) {
      case 'INVALID_RESULTS_PAGE':
      case 'INVALID_SEARCH_URL':
        return 'Invalid search page. Please ensure you enter a search results URL from Apollo Duck or Boats & Outboards.';
      case 'INDIVIDUAL_LISTING_URL':
        return 'This URL is an individual boat listing. Please use the "Manual URLs" tab to import this single listing.';
      case 'PAGE_BLOCKED':
      case 'PAGE_ACCESS_DENIED':
        return 'This page is protected or temporarily unavailable (Cloudflare/Access Denied). Please try again later.';
      case 'UNSUPPORTED_MARKETPLACE':
        return 'Only Apollo Duck and Boats & Outboards are supported for search page discovery.';
      case 'UNAUTHORIZED':
        return 'You do not have permission to perform listing discovery.';
      case 'NO_LISTINGS_FOUND':
        return 'No boat listings were found on this results page.';
      default:
        return fallbackMsg || 'A temporary server error occurred while reading the page. Please try again.';
    }
  };

  const handleDiscoverListings = async () => {
    setErrorMessage(null);
    setErrorRequestId(null);
    setErrorDebug(null);
    setWarningMessages([]);
    setDiscoveryResult(null);
    setDiscoveredListings([]);
    setShowLimitWarning(false);

    const trimmedUrl = searchUrl.trim();
    if (!trimmedUrl) {
      setErrorMessage('Please enter the search results page URL.');
      return;
    }

    // Client side validation pre-check
    const val: SearchPageValidationResult = validateSearchPageUrl(trimmedUrl);
    if (!val.isValid) {
      setErrorMessage(formatDiscoveryError(val.errorCode, val.errorMessage));
      return;
    }

    setIsLoading(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user) {
        try {
          const token = await user.getIdToken();
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        } catch (authErr) {
          console.warn('[AdminSearchPageDiscovery] Could not retrieve ID token:', authErr);
        }
      }

      const resp = await fetch('/api/discover-listings', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pageUrl: trimmedUrl
        })
      });

      let data: any = null;
      try {
        data = await resp.json();
      } catch (jsonErr) {
        console.error('[AdminSearchPageDiscovery] Response was not valid JSON:', jsonErr, { status: resp.status, statusText: resp.statusText });
        setErrorMessage('A temporary server error occurred while reading the page. Please try again.');
        return;
      }

      console.log('[AdminSearchPageDiscovery Response]', {
        status: resp.status,
        statusText: resp.statusText,
        contentType: resp.headers.get('content-type'),
        requestId: data?.requestId,
        success: data?.success,
        marketplace: data?.marketplace,
        totalFound: data?.totalFound,
        error: data?.error,
        errorMessage: data?.errorMessage
      });

      if (!resp.ok || !data.success) {
        if (data?.requestId) setErrorRequestId(data.requestId);
        if (data?.debug) setErrorDebug(data.debug);

        setErrorMessage(formatDiscoveryError(data?.error, data?.errorMessage));
        return;
      }

      const rawListings = data.listings || [];
      let importedCount = 0;

      const items: DiscoveredListingItem[] = rawListings.map((l: any) => {
        const normKey = (l.normalizedSourceUrl || l.sourceUrl || '').toLowerCase();
        const isDbDup = existingDbUrls.has(normKey);

        if (isDbDup) importedCount++;

        return {
          sourceUrl: l.sourceUrl,
          normalizedSourceUrl: l.normalizedSourceUrl || l.sourceUrl,
          externalId: l.externalId,
          title: l.title || 'Boat Listing',
          image: l.image,
          priceText: l.priceText,
          locationText: l.locationText,
          alreadyImported: isDbDup,
          selected: !isDbDup, // Auto-select new valid listings by default
          status: isDbDup ? 'already_imported' : 'new'
        };
      });

      // Enforce max 20 default selected items
      let selectCount = 0;
      items.forEach(item => {
        if (item.selected) {
          if (selectCount < 20) {
            selectCount++;
          } else {
            item.selected = false;
          }
        }
      });

      setDiscoveredListings(items);
      setWarningMessages(data.warnings || []);
      setDiscoveryResult({
        marketplace: data.marketplace,
        pageUrl: data.pageUrl,
        totalCandidates: data.totalCandidates,
        totalFound: data.totalFound,
        duplicatesRemoved: data.duplicatesRemoved,
        alreadyImportedCount: importedCount
      });

    } catch (err: any) {
      console.error('[AdminSearchPageDiscovery] Error:', err);
      setErrorMessage('Communication error with the discovery server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCount = discoveredListings.filter(l => l.selected).length;

  const toggleSelect = (idxInDiscovered: number) => {
    setDiscoveredListings(prev => {
      const copy = [...prev];
      const target = copy[idxInDiscovered];
      if (target.alreadyImported) return prev;

      const nextSelected = !target.selected;
      if (nextSelected && selectedCount >= 20) {
        setShowLimitWarning(true);
        return prev;
      }

      setShowLimitWarning(false);
      copy[idxInDiscovered] = { ...target, selected: nextSelected };
      return copy;
    });
  };

  const handleSelectAllNew = () => {
    setShowLimitWarning(false);
    setDiscoveredListings(prev => {
      let count = 0;
      return prev.map(item => {
        if (item.alreadyImported) return item;
        if (count < 20) {
          count++;
          return { ...item, selected: true };
        } else {
          return { ...item, selected: false };
        }
      });
    });
  };

  const handleClearSelection = () => {
    setShowLimitWarning(false);
    setDiscoveredListings(prev => prev.map(item => ({ ...item, selected: false })));
  };

  const handleInvertSelection = () => {
    setShowLimitWarning(false);
    setDiscoveredListings(prev => {
      let count = 0;
      return prev.map(item => {
        if (item.alreadyImported) return item;
        const inverted = !item.selected;
        if (inverted && count < 20) {
          count++;
          return { ...item, selected: true };
        } else {
          return { ...item, selected: false };
        }
      });
    });
  };

  const handleStartImport = () => {
    const selectedUrls = discoveredListings
      .filter(l => l.selected && !l.alreadyImported)
      .map(l => l.normalizedSourceUrl);

    if (selectedUrls.length === 0) {
      alert('Please select at least one listing to import.');
      return;
    }

    if (selectedUrls.length > 20) {
      setShowLimitWarning(true);
      return;
    }

    setHandoffCount(selectedUrls.length);
    setTimeout(() => {
      onImportSelected(selectedUrls);
    }, 600);
  };

  // Location filter existence check
  const hasLocationData = discoveredListings.some(l => !!l.locationText && l.locationText.trim().length > 0);

  // Filtered List Computation
  const filteredListings = discoveredListings.filter(item => {
    if (filterOnlyNew && item.alreadyImported) return false;
    if (filterOnlyWithPrice && (!item.priceText || item.priceText.toLowerCase().includes('poa') || item.priceText.toLowerCase().includes('request price'))) return false;
    if (filterUkOnly && item.locationText) {
      const locLower = item.locationText.toLowerCase();
      const isUk = locLower.includes('uk') || locLower.includes('united kingdom') || locLower.includes('england') ||
                   locLower.includes('scotland') || locLower.includes('wales') || locLower.includes('gb') || locLower.includes('ireland');
      if (!isUk) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Handoff Modal Overlay */}
      {handoffCount !== null && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto text-indigo-600">
              <Loader2 size={32} className="animate-spin" />
            </div>
            <h3 className="text-xl font-black text-slate-900">
              Importing {handoffCount} Listings
            </h3>
            <p className="text-xs text-slate-600 font-medium">
              Transferring selected listings to the AI extraction and analysis pipeline...
            </p>
          </div>
        </div>
      )}

      {/* Explanation Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-indigo-400 font-extrabold text-xs uppercase tracking-wider">
          <Sparkles size={16} /> Results Page Bulk Import
        </div>
        <h2 className="text-xl md:text-2xl font-black text-white">
          Discover Boat Listings via Search URL
        </h2>
        <p className="text-slate-300 text-xs md:text-sm font-medium leading-relaxed max-w-4xl">
          Paste the URL of a search results page from <strong className="text-white">Apollo Duck</strong> or <strong className="text-white">Boats and Outboards</strong>. The system automatically discovers boat listings, removes duplicates, and allows selecting up to 20 listings per batch for extraction.
        </p>
      </div>

      {/* Input Box */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <label className="text-xs md:text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <Search size={18} className="text-indigo-600" />
          Search Results Page URL:
        </label>

        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="url"
            value={searchUrl}
            onChange={(e) => setSearchUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleDiscoverListings()}
            placeholder="https://www.apolloduck.co.uk/boats/power-boats or https://www.boatsandoutboards.co.uk/boats-for-sale/"
            className="flex-1 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs md:text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
          />

          <button
            onClick={handleDiscoverListings}
            disabled={isLoading || !searchUrl.trim()}
            className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md hover:shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Search size={16} />
                <span>Discover Listings</span>
              </>
            )}
          </button>
        </div>

        {/* Multi-Step Loading Indicator */}
        {isLoading && (
          <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 size={20} className="animate-spin text-indigo-600 shrink-0" />
              <span className="font-extrabold text-xs md:text-sm text-indigo-950">
                {LOADING_STEPS[loadingStepIdx]}
              </span>
            </div>
            <div className="w-full bg-indigo-200/60 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full transition-all duration-500 rounded-full"
                style={{ width: `${((loadingStepIdx + 1) / LOADING_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Client Error Message */}
        {errorMessage && !isLoading && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs md:text-sm font-bold space-y-2">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
            {errorRequestId && (
              <div className="pt-2 border-t border-rose-200/80 flex flex-wrap items-center justify-between text-[11px] text-rose-800 font-mono font-normal">
                <span>Error code: <strong className="font-bold select-all bg-rose-100 px-1.5 py-0.5 rounded">{errorRequestId}</strong></span>
              </div>
            )}
            {errorDebug && (
              <details className="mt-2 text-left text-[11px] font-mono text-slate-700 bg-white p-3 rounded-xl border border-rose-200">
                <summary className="cursor-pointer font-bold text-rose-900">Diagnostic Details (Admin)</summary>
                <div className="mt-2 space-y-1">
                  <div><strong>Stage:</strong> {errorDebug.stage}</div>
                  <div><strong>Error:</strong> {errorDebug.errorName} - {errorDebug.errorMessage}</div>
                  {errorDebug.stack && (
                    <pre className="text-[10px] overflow-x-auto p-2 bg-slate-100 rounded text-slate-800">{errorDebug.stack}</pre>
                  )}
                </div>
              </details>
            )}
          </div>
        )}

        {/* Warning Messages */}
        {warningMessages.length > 0 && !isLoading && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs md:text-sm font-semibold space-y-1.5">
            {warningMessages.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discovery Summary Card & Results */}
      {discoveryResult && !isLoading && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          {/* Summary Panel */}
          <div className="p-6 rounded-3xl bg-slate-900 text-white space-y-4 shadow-md border border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  <ShieldCheck size={14} /> {discoveryResult.marketplace}
                </div>
                <h3 className="text-base font-extrabold text-white truncate max-w-lg">
                  Discovery Summary
                </h3>
                <p className="text-xs text-slate-400 font-mono truncate max-w-md">
                  {discoveryResult.pageUrl}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-800/90 p-3 rounded-2xl border border-slate-700">
                <div className="text-right">
                  <span className="block text-[10px] text-slate-400 font-extrabold uppercase">Current Batch</span>
                  <span className="text-lg font-black text-indigo-400">
                    {selectedCount} / 20 <span className="text-xs text-slate-400">selected</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-slate-800/70 p-3.5 rounded-2xl border border-slate-700/60">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Listings on Site</span>
                <span className="text-lg font-black text-white">{discoveryResult.totalCandidates}</span>
              </div>

              <div className="bg-slate-800/70 p-3.5 rounded-2xl border border-slate-700/60">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Available for Review</span>
                <span className="text-lg font-black text-emerald-400">{discoveryResult.totalFound}</span>
              </div>

              <div className="bg-slate-800/70 p-3.5 rounded-2xl border border-slate-700/60">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">Already on ConnectBoat</span>
                <span className="text-lg font-black text-amber-400">{discoveryResult.alreadyImportedCount}</span>
              </div>

              <div className="bg-slate-800/70 p-3.5 rounded-2xl border border-slate-700/60">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">New Selectable</span>
                <span className="text-lg font-black text-indigo-300">
                  {Math.max(0, discoveryResult.totalFound - discoveryResult.alreadyImportedCount)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Filters Toolbar */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-black text-xs uppercase tracking-wider">
              <Filter size={14} className="text-indigo-600" /> Quick Filters
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-700">
              <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300 transition-all select-none">
                <input
                  type="checkbox"
                  checked={filterOnlyNew}
                  onChange={(e) => setFilterOnlyNew(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Hide Already Imported</span>
              </label>

              <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300 transition-all select-none">
                <input
                  type="checkbox"
                  checked={filterOnlyWithPrice}
                  onChange={(e) => setFilterOnlyWithPrice(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Price Only</span>
              </label>

              {hasLocationData && (
                <label className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300 transition-all select-none">
                  <input
                    type="checkbox"
                    checked={filterUkOnly}
                    onChange={(e) => setFilterUkOnly(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>UK Only</span>
                </label>
              )}
            </div>
          </div>

          {/* Selection Limit Explanation Warning Banner */}
          {showLimitWarning && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-semibold flex items-start gap-3 animate-in fade-in duration-150">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="font-extrabold text-amber-900 text-xs">
                  Maximum Limit of 20 Listings Per Batch Required
                </h5>
                <p className="text-amber-800 text-xs">
                  To ensure high accuracy in data extraction via AI and avoid network overload, the batch limit is 20 listings. Please uncheck some items or process in multiple batches.
                </p>
              </div>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleSelectAllNew}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckSquare size={14} className="text-indigo-600" /> Select New (max. 20)
              </button>

              <button
                onClick={handleInvertSelection}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeftRight size={14} className="text-slate-600" /> Invert Selection
              </button>

              <button
                onClick={handleClearSelection}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Square size={14} className="text-slate-500" /> Clear Selection
              </button>
            </div>

            <button
              onClick={handleStartImport}
              disabled={selectedCount === 0 || selectedCount > 20}
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md hover:shadow-emerald-200 disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Import Selected ({selectedCount})</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Discovered Cards Table Layout */}
          {filteredListings.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-bold text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No listings match the active filters.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredListings.map((item) => {
                const originalIndex = discoveredListings.findIndex(
                  l => l.normalizedSourceUrl === item.normalizedSourceUrl
                );

                return (
                  <div
                    key={item.normalizedSourceUrl}
                    onClick={() => toggleSelect(originalIndex)}
                    className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                      item.alreadyImported
                        ? 'bg-slate-100/70 border-slate-200 opacity-60 cursor-not-allowed'
                        : item.selected
                        ? 'bg-indigo-50/60 border-indigo-300 shadow-sm cursor-pointer'
                        : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                    }`}
                    title={item.alreadyImported ? "This listing already exists on ConnectBoat." : `Click to select: ${item.title}`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Checkbox */}
                      <button
                        type="button"
                        disabled={item.alreadyImported}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(originalIndex);
                        }}
                        className="shrink-0 text-slate-400 hover:text-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {item.alreadyImported ? (
                          <CheckCircle2 size={20} className="text-amber-500" />
                        ) : item.selected ? (
                          <CheckSquare size={20} className="text-indigo-600" />
                        ) : (
                          <Square size={20} />
                        )}
                      </button>

                      {/* Image Preview */}
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-16 h-12 object-cover rounded-xl border border-slate-200 bg-slate-100 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-16 h-12 bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-center justify-center shrink-0 text-slate-400 text-[10px] font-bold">
                          <Anchor size={14} />
                          <span>No Photo</span>
                        </div>
                      )}

                      {/* Title & Metadata */}
                      <div className="space-y-1 min-w-0 flex-1">
                        <h4 className="font-extrabold text-slate-900 text-xs md:text-sm truncate">
                          {item.title}
                        </h4>

                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                          {item.priceText ? (
                            <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200 font-black">
                              {item.priceText}
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md text-[11px]">
                              POA
                            </span>
                          )}

                          {item.locationText && (
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] flex items-center gap-1">
                              <MapPin size={10} className="text-slate-400" />
                              {item.locationText}
                            </span>
                          )}

                          {item.externalId && (
                            <span className="font-mono text-[10px] text-slate-400">
                              ID: {item.externalId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Status Badges & URL Link */}
                    <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                      {item.alreadyImported ? (
                        <span
                          className="px-3 py-1 bg-amber-100 text-amber-900 rounded-lg text-xs font-black border border-amber-200"
                          title="This listing already exists on ConnectBoat."
                        >
                          Already Imported
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-indigo-100 text-indigo-900 rounded-lg text-xs font-black border border-indigo-200">
                          New
                        </span>
                      )}

                      <a
                        href={item.normalizedSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                        title={`Open original listing: ${item.normalizedSourceUrl}`}
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
