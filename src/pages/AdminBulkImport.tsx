import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, Sparkles, Check, AlertCircle, RefreshCcw, ExternalLink,
  Trash2, Edit3, ChevronDown, ChevronUp, CheckSquare, Square,
  Layers, ShieldCheck, FileText, CheckCircle2, XCircle, AlertTriangle, Play
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Ad, BOAT_TYPES, CATEGORIES, getRegionForCity } from '../types';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, clearDocsCache } from '../firebase';
import { clearHomeCache } from '../utils/cache';
import { formatPrice, parsePrice } from '../utils';

function inferConnectBoatCategory(title: string = '', description: string = '', rawCategory: string = ''): string {
  const text = `${title} ${description} ${rawCategory}`.toLowerCase();
  if (text.includes('hire') || text.includes('charter') || text.includes('rent')) return 'Boats for Hire';
  if (text.includes('engine') || text.includes('outboard') || text.includes('motor') || text.includes('yamaha') || text.includes('mercury') || text.includes('honda') || text.includes('tohatsu') || text.includes('mariner') || text.includes('suzuki') || text.includes('hp')) {
    if (!text.includes('boat') || text.includes('engine for sale') || text.includes('outboard engine')) return 'Boat Engines';
  }
  if (text.includes('trailer') || text.includes('reboque')) return 'Trailers';
  if (text.includes('part') || text.includes('propeller') || text.includes('anchor') || text.includes('fender') || text.includes('rigging') || text.includes('sail')) return 'Boat Parts';
  if (text.includes('vhf') || text.includes('gps') || text.includes('sonar') || text.includes('radar') || text.includes('chartplotter') || text.includes('electronics')) return 'Marine Electronics';
  if (text.includes('marina') || text.includes('berth') || text.includes('moor')) return 'Marinas';
  if (text.includes('service') || text.includes('repair') || text.includes('maintenance') || text.includes('survey')) return 'Boat Services';
  if (text.includes('wanted') || text.includes('procura-se')) return 'Wanted';
  if (text.includes('jacket') || text.includes('wetsuit') || text.includes('paddle') || text.includes('accessory') || text.includes('accessories')) return 'Accessories';

  return 'Boats for Sale';
}
import { getSourceSiteFromUrl, getSupportedMarketplace } from '../utils/marketplaces';
import { normalizeAndLimitImages, sanitizeFirestorePayload } from '../utils/adSanitizer';
import { AdminSearchPageDiscovery } from '../components/AdminSearchPageDiscovery';

export interface BulkItem {
  id: string; // internal tracking id
  url: string;
  sourceSite: string;
  status: 'pending' | 'processing' | 'success' | 'duplicate' | 'failed' | 'published' | 'draft_saved';
  errorMessage?: string;
  // Extracted data
  title?: string;
  description?: string;
  price?: number;
  category?: string;
  city?: string;
  country?: string;
  images?: string[];
  imageUrl?: string;
  // Boat specs
  boatType?: string;
  manufacturer?: string;
  model?: string;
  year?: string | number;
  condition?: string;
  length?: string;
  beam?: string;
  draft?: string;
  fuelType?: string;
  engineBrand?: string;
  horsepower?: string;
  engineHours?: string;
  cabins?: string;
  berths?: string;
  bathrooms?: string;
  hullMaterial?: string;
  serviceCoverage?: string;
  // UI states
  selected: boolean;
  expanded?: boolean;
}

const AdminBulkImport: React.FC = () => {
  const { isAdmin, isModerator, profile, user } = useAuth();
  const { categories } = useSettings();
  const navigate = useNavigate();

  const [importTabMode, setImportTabMode] = useState<'search_page' | 'manual_urls'>('search_page');
  const [rawUrls, setRawUrls] = useState<string>('');
  const [items, setItems] = useState<BulkItem[]>([]);
  const [batchListingMode, setBatchListingMode] = useState<'external' | 'claimable'>('external');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Counters
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    duplicate: 0,
    failed: 0,
    published: 0
  });

  const handleStartBulkImportWithUrls = async (urlsToImport: string[]) => {
    setActionStatus(null);
    const validLines = urlsToImport
      .map(l => l.trim())
      .filter(l => l.length > 0 && /^https?:\/\//i.test(l));

    if (validLines.length === 0) {
      setActionStatus({
        type: 'error',
        message: 'Please enter at least one valid URL (starting with http:// or https://).'
      });
      return;
    }

    // De-duplicate lines input & cap at 20 per batch if coming from search page
    const uniqueUrls: string[] = Array.from(new Set(validLines)).slice(0, 20);

    setIsProcessing(true);
    setCurrentIndex(0);

    // Fetch existing sourceUrls from Firestore for batch duplicate detection
    let existingSourceUrls = new Set<string>();
    try {
      const q = query(collection(db, 'ads'));
      const snap = await getDocs(q);
      snap.docs.forEach(docSnap => {
        const sUrl = docSnap.data().sourceUrl;
        if (sUrl && typeof sUrl === 'string') {
          existingSourceUrls.add(sUrl.trim().toLowerCase());
        }
      });
    } catch (e) {
      console.warn('[AdminBulkImport] Error checking Firestore duplicates pre-flight:', e);
    }

    // Initialize items state
    const initialItems: BulkItem[] = uniqueUrls.map((url, idx) => {
      const normalizedUrl = url.toLowerCase();
      const isDup = existingSourceUrls.has(normalizedUrl);
      return {
        id: `bulk-${idx}-${Date.now()}`,
        url,
        sourceSite: getSourceSiteFromUrl(url),
        status: isDup ? 'duplicate' : 'pending',
        errorMessage: isDup ? 'A listing with this URL already exists in the marketplace.' : undefined,
        selected: !isDup,
        expanded: false
      };
    });

    setItems(initialItems);

    let succCount = 0;
    let dupCount = initialItems.filter(i => i.status === 'duplicate').length;
    let failCount = 0;

    setStats({
      total: initialItems.length,
      success: 0,
      duplicate: dupCount,
      failed: 0,
      published: 0
    });

    // Process pending items sequentially using existing /api/import-ad endpoint
    for (let i = 0; i < initialItems.length; i++) {
      setCurrentIndex(i);
      const currentItem = initialItems[i];

      if (currentItem.status === 'duplicate') {
        continue;
      }

      // Mark processing
      setItems(prev => prev.map(item => item.id === currentItem.id ? { ...item, status: 'processing' } : item));

      try {
        const userRole = isAdmin ? 'admin' : isModerator ? 'moderator' : (profile?.role || 'user');

        const resp = await fetch('/api/import-ad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: currentItem.url,
            userId: user?.uid,
            userRole
          })
        });

        const resData = await resp.json().catch(() => null);

        if (!resp.ok) {
          throw new Error(resData?.error || `[HTTP ${resp.status}] Failed to import URL.`);
        }

        if (resData.success && resData.data) {
          const d = resData.data;
          const extractedImages = Array.isArray(d.images) && d.images.length > 0
            ? d.images
            : ['https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&w=1200&q=80'];

          // Fallback category matching
          let matchedCategory = typeof d.category === 'string' ? d.category : 'Other';
          if (categories && Array.isArray(categories) && categories.length > 0) {
            const foundCat = categories.find(c => {
              const nameStr = typeof c === 'string' ? c : (c as any)?.name || '';
              return nameStr.toLowerCase() === matchedCategory.toLowerCase();
            });
            if (foundCat) {
              matchedCategory = typeof foundCat === 'string' ? foundCat : (foundCat as any).name;
            }
          }

          succCount++;
          setItems(prev => prev.map(item => item.id === currentItem.id ? {
            ...item,
            status: 'success',
            title: d.title || 'Listing Imported from ' + item.sourceSite,
            description: d.description || 'Description extracted from ' + item.url,
            price: typeof d.price === 'number' ? d.price : Number(d.price) || 0,
            category: matchedCategory,
            city: d.city || 'Unknown',
            country: d.country || 'United Kingdom',
            images: extractedImages,
            imageUrl: extractedImages[0],
            boatType: d.boatType || '',
            manufacturer: d.manufacturer || '',
            model: d.model || '',
            year: d.year ? String(d.year) : '',
            condition: d.condition || '',
            length: d.length || '',
            beam: d.beam || '',
            draft: d.draft || '',
            fuelType: d.fuelType || '',
            engineBrand: d.engineBrand || '',
            horsepower: d.horsepower || '',
            engineHours: d.engineHours || '',
            cabins: d.cabins || '',
            berths: d.berths || '',
            bathrooms: d.bathrooms || '',
            hullMaterial: d.hullMaterial || '',
            selected: true
          } : item));
        } else {
          throw new Error(resData.error || 'AI extraction did not return valid data.');
        }
      } catch (err: any) {
        failCount++;
        const errMsg = err.message || String(err);
        setItems(prev => prev.map(item => item.id === currentItem.id ? {
          ...item,
          status: 'failed',
          errorMessage: errMsg,
          selected: false
        } : item));

        // Log system health event silently
        addDoc(collection(db, 'system_health_events'), {
          type: 'bulk_import_failure',
          url: currentItem.url,
          error: errMsg,
          timestamp: new Date()
        }).catch(logErr => console.warn('[AdminBulkImport] Health log failed:', logErr));
      }

      // Update counters
      setStats({
        total: initialItems.length,
        success: succCount,
        duplicate: dupCount,
        failed: failCount,
        published: 0
      });
    }

    setIsProcessing(false);
    setActionStatus({
      type: 'success',
      message: `Bulk extraction completed! ${succCount} successful, ${dupCount} duplicates ignored, ${failCount} failed.`
    });
  };

  const handleStartBulkImport = async () => {
    const lines = rawUrls
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && /^https?:\/\//i.test(l));

    await handleStartBulkImportWithUrls(lines);
  };

  const handleImportDiscoveredUrls = (selectedUrls: string[]) => {
    setRawUrls(selectedUrls.join('\n'));
    setImportTabMode('manual_urls');
    handleStartBulkImportWithUrls(selectedUrls);
  };

  const toggleSelect = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  const toggleSelectAll = (select: boolean) => {
    setItems(prev => prev.map(item => ({ ...item, selected: select })));
  };

  const toggleExpand = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, expanded: !item.expanded } : item));
  };

  const updateItemField = (id: string, field: keyof BulkItem, value: any) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleBatchPublish = async (asDraft: boolean = false) => {
    const selectedItems = items.filter(i => i.selected && i.status === 'success');
    if (selectedItems.length === 0) {
      setActionStatus({
        type: 'error',
        message: 'Select at least one successfully extracted listing to publish or save draft.'
      });
      return;
    }

    setIsProcessing(true);
    setActionStatus({
      type: 'info',
      message: asDraft ? `Saving ${selectedItems.length} draft(s)...` : `Publishing ${selectedItems.length} listing(s)...`
    });

    try {
      let count = 0;
      for (const item of selectedItems) {
        const cleanImages = normalizeAndLimitImages(item.images || [item.imageUrl || ''], 6);
        const primaryImage = cleanImages[0] || item.imageUrl || '';

        const normCountry = (item.country && item.country.toLowerCase().includes('portugal')) ? 'Portugal' : 'Reino Unido';

        let cat = item.category || 'Boats for Sale';
        if (!CATEGORIES.includes(cat) || cat === 'Carros, motos e barcos' || cat === 'Other' || cat === 'Outros') {
          cat = inferConnectBoatCategory(item.title || '', item.description || '', item.category || '');
        }

        const payload: Partial<Ad> = {
          title: item.title || 'Imported Listing',
          description: item.description || '',
          price: item.price || 0,
          category: cat,
          city: item.city || '',
          country: normCountry,
          region: getRegionForCity(item.city || ''),
          imageUrl: primaryImage,
          images: cleanImages,
          status: asDraft ? 'draft' : 'approved',
          adStatus: asDraft ? 'inactive' : 'active',
          views: 0,
          whatsappClicks: 0,
          createdAt: serverTimestamp(),
          // Mode & Claim status
          listingMode: batchListingMode,
          isClaimableBusiness: batchListingMode === 'claimable',
          claimStatus: batchListingMode === 'claimable' ? 'unclaimed' : null,
          // Metadata
          externalListing: true,
          demoListing: false,
          sourceUrl: item.url,
          sourceSite: item.sourceSite,
          sourceCheckedAt: new Date(),
          externalStatus: 'active',
          importedBy: user?.email || user?.uid || 'admin',
          importedAt: new Date(),
          sellerId: user?.uid || 'admin',
          sellerName: user?.displayName || user?.email || 'ConnectBoat Admin',
          // Phone details optional for external imports
          sellerPhone: '',
          contactPhone: '',
          useProfilePhone: false,
          // Boat specs
          boatType: item.boatType || '',
          manufacturer: item.manufacturer || '',
          model: item.model || '',
          year: item.year ? String(item.year) : '',
          condition: item.condition || '',
          length: item.length || '',
          beam: item.beam || '',
          draft: item.draft || '',
          fuelType: item.fuelType || '',
          engineBrand: item.engineBrand || '',
          horsepower: item.horsepower || '',
          engineHours: item.engineHours || '',
          cabins: item.cabins || '',
          berths: item.berths || '',
          bathrooms: item.bathrooms || '',
          hullMaterial: item.hullMaterial || '',
        };

        const cleanPayload = sanitizeFirestorePayload(payload);
        await addDoc(collection(db, 'ads'), cleanPayload);
        count++;

        // Update item status locally
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: asDraft ? 'draft_saved' : 'published', selected: false } : i));
      }

      // Invalidate home and firestore caches so published items appear immediately
      clearHomeCache();
      clearDocsCache();

      setActionStatus({
        type: 'success',
        message: asDraft
          ? `Success! ${count} listing(s) saved as Draft successfully.`
          : `Success! ${count} listing(s) published on ConnectBoat marketplace successfully!`
      });
    } catch (err: any) {
      console.error('[AdminBulkImport] Batch publish error:', err);
      setActionStatus({
        type: 'error',
        message: `Error publishing listings in bulk: ${err.message || String(err)}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isAdmin) {
    return <div className="p-8 text-center font-bold text-slate-700">Access restricted to administrators.</div>;
  }

  const selectedCount = items.filter(i => i.selected).length;
  const processableCount = items.filter(i => i.status === 'success').length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-xl border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-xs font-bold border border-indigo-400/30">
              <Layers size={14} /> Bulk Import System
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Bulk Import Listings
            </h1>
            <p className="text-slate-300 text-xs md:text-sm font-medium max-w-2xl">
              Paste multiple marine marketplace URLs. The AI engine will automatically extract titles, images, prices and nautical specifications for each individual listing.
            </p>
          </div>
        </div>
      </div>

      {/* Action status message */}
      <AnimatePresence>
        {actionStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl border text-xs md:text-sm font-bold flex items-center justify-between gap-3 ${
              actionStatus.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : actionStatus.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-sky-50 border-sky-200 text-sky-800'
            }`}
          >
            <span>{actionStatus.message}</span>
            <button onClick={() => setActionStatus(null)} className="text-xs font-black opacity-70 hover:opacity-100 cursor-pointer">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Tabs */}
      <div className="flex bg-slate-200/80 p-1.5 rounded-2xl max-w-md">
        <button
          onClick={() => setImportTabMode('search_page')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            importTabMode === 'search_page'
              ? 'bg-white text-indigo-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles size={16} className={importTabMode === 'search_page' ? 'text-indigo-600' : ''} />
          Search Page
        </button>

        <button
          onClick={() => setImportTabMode('manual_urls')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            importTabMode === 'manual_urls'
              ? 'bg-white text-indigo-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText size={16} className={importTabMode === 'manual_urls' ? 'text-indigo-600' : ''} />
          Manual URLs
        </button>
      </div>

      {/* Mode View Rendering */}
      {importTabMode === 'search_page' && items.length === 0 ? (
        <AdminSearchPageDiscovery onImportSelected={handleImportDiscoveredUrls} />
      ) : (
        /* Step 1: Input Box for Manual URLs */
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <FileText size={18} className="text-indigo-600" />
              URLs for Extraction (One URL per line):
            </label>
            <span className="text-xs text-slate-500 font-semibold">
              Supports any quantity (1, 10, 20, 50, 100+ URLs)
            </span>
          </div>

          <textarea
            rows={6}
            value={rawUrls}
            onChange={(e) => setRawUrls(e.target.value)}
            placeholder={`https://www.yachtworld.com/yacht/2021-princess-v48-9283741/\nhttps://www.apolloduck.com/boat/hallberg-rassy-340-for-sale/732109\nhttps://www.olx.pt/d/anuncio/...`}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="text-xs text-slate-500 font-medium">
              💡 URLs are checked against the database to prevent duplicates automatically.
            </div>

            <button
              onClick={handleStartBulkImport}
              disabled={isProcessing || !rawUrls.trim()}
              className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md hover:shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Play size={16} />
              {isProcessing ? 'Extracting URLs via AI...' : 'Start Bulk Import'}
            </button>
          </div>
        </div>
      )}

      {/* Progress & Live Stats Counter */}
      {stats.total > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-extrabold text-slate-900 text-sm">
              Batch Progress ({currentIndex + 1} / {stats.total})
            </h3>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                ✓ Success: {stats.success}
              </span>
              <span className="text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                ⚠ Duplicates: {stats.duplicate}
              </span>
              <span className="text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                ✕ Failed: {stats.failed}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full transition-all duration-300"
              style={{ width: `${Math.round(((currentIndex + 1) / stats.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Step 2: Preview & Batch Publication List */}
      {items.length > 0 && (
        <div className="space-y-4">
          <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Publishing Mode:</span>
                <select
                  value={batchListingMode}
                  onChange={(e) => setBatchListingMode(e.target.value as 'external' | 'claimable')}
                  className="bg-slate-100 text-slate-900 border border-slate-300 text-xs font-bold rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="external">🔗 External Redirect (Default: Directs to Original Listing)</option>
                  <option value="claimable">🏷️ Claimable (Administrator enables Claim flow)</option>
                </select>
              </div>
            </div>
          </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleSelectAll(selectedCount < items.length)}
                  className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition cursor-pointer"
                >
                  {selectedCount === items.length ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} />}
                  {selectedCount === items.length ? 'Unselect All' : 'Select All'}
                </button>
                <span className="text-xs font-bold text-slate-500">
                  {selectedCount} of {items.length} selected ({processableCount} ready to publish)
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleBatchPublish(true)}
                  disabled={isProcessing || selectedCount === 0}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition border border-slate-700 disabled:opacity-50 cursor-pointer"
                >
                  Save Drafts
                </button>
                <button
                  onClick={() => handleBatchPublish(false)}
                  disabled={isProcessing || selectedCount === 0}
                  className="flex-1 sm:flex-initial px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                <CheckCircle2 size={16} />
                Publish Selected
              </button>
            </div>
          </div>

          {/* List of Extracted / Duplicated / Failed Items */}
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                  item.status === 'success'
                    ? item.selected
                      ? 'border-indigo-300 shadow-md ring-1 ring-indigo-200'
                      : 'border-slate-200'
                    : item.status === 'duplicate'
                    ? 'border-amber-200 bg-amber-50/20 opacity-85'
                    : item.status === 'failed'
                    ? 'border-rose-200 bg-rose-50/20'
                    : item.status === 'published'
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : 'border-slate-200'
                }`}
              >
                {/* Main Card Row */}
                <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      onClick={() => toggleSelect(item.id)}
                      disabled={item.status !== 'success'}
                      className="mt-1 text-slate-400 hover:text-indigo-600 transition cursor-pointer shrink-0 disabled:opacity-30"
                    >
                      {item.selected ? <CheckSquare size={20} className="text-indigo-600" /> : <Square size={20} />}
                    </button>

                    <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-200 shrink-0 border border-slate-200 relative">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.title || 'Image'} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100">
                          <FileText size={16} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
                          <ExternalLink size={10} /> {item.sourceSite}
                        </span>

                        {item.status === 'success' && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-emerald-200">
                            ✓ Successfully Extracted
                          </span>
                        )}

                        {item.status === 'processing' && (
                          <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-indigo-200 animate-pulse">
                            ⚙ Extracting via AI...
                          </span>
                        )}

                        {item.status === 'duplicate' && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-amber-200">
                            ⚠ Duplicate
                          </span>
                        )}

                        {item.status === 'failed' && (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-rose-200">
                            ✕ Failed
                          </span>
                        )}

                        {item.status === 'published' && (
                          <span className="bg-emerald-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded">
                            ✓ Published
                          </span>
                        )}

                        {item.status === 'draft_saved' && (
                          <span className="bg-slate-700 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded">
                            📝 Draft Saved
                          </span>
                        )}
                      </div>

                      <h3 className="font-extrabold text-slate-900 text-sm md:text-base leading-snug truncate">
                        {item.title || item.url}
                      </h3>

                      {item.status === 'success' && (
                        <p className="text-xs text-slate-500 font-semibold truncate">
                          {item.city}, {item.country} • {formatPrice(item.price, item.country)} • {item.category}
                        </p>
                      )}

                      {item.errorMessage && (
                        <p className="text-xs text-rose-600 font-semibold mt-0.5">
                          {item.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                    {item.status === 'success' && (
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 transition cursor-pointer"
                      >
                        <Edit3 size={12} />
                        {item.expanded ? 'Hide Editor' : 'Edit'}
                        {item.expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}

                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Remove from review list"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Expanded Inline Editor */}
                {item.expanded && item.status === 'success' && (
                  <div className="p-4 md:p-6 border-t border-slate-100 bg-white space-y-4 text-xs font-sans">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-600 block mb-1">Listing Title</label>
                        <input
                          type="text"
                          value={item.title || ''}
                          onChange={(e) => updateItemField(item.id, 'title', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-600 block mb-1">Price (£ / €)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.price !== undefined && item.price !== null ? formatPrice(item.price) : ''}
                          onChange={(e) => updateItemField(item.id, 'price', parsePrice(e.target.value))}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-600 block mb-1">Category</label>
                        <input
                          type="text"
                          value={item.category || ''}
                          onChange={(e) => updateItemField(item.id, 'category', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-600 block mb-1">City</label>
                        <input
                          type="text"
                          value={item.city || ''}
                          onChange={(e) => updateItemField(item.id, 'city', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-600 block mb-1">Boat Type</label>
                        <input
                          type="text"
                          value={item.boatType || ''}
                          onChange={(e) => updateItemField(item.id, 'boatType', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-600 block mb-1">Manufacturer</label>
                        <input
                          type="text"
                          value={item.manufacturer || ''}
                          onChange={(e) => updateItemField(item.id, 'manufacturer', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-600 block mb-1">Model</label>
                        <input
                          type="text"
                          value={item.model || ''}
                          onChange={(e) => updateItemField(item.id, 'model', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-600 block mb-1">Year Built</label>
                        <input
                          type="text"
                          value={item.year || ''}
                          onChange={(e) => updateItemField(item.id, 'year', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                        />
                      </div>

                      <div className="sm:col-span-2 md:col-span-3">
                        <label className="font-bold text-slate-600 block mb-1">Description</label>
                        <textarea
                          rows={3}
                          value={item.description || ''}
                          onChange={(e) => updateItemField(item.id, 'description', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBulkImport;
