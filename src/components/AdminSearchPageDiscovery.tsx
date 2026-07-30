import React, { useState, useEffect } from 'react';
import {
  Search, Layers, ExternalLink, CheckCircle2, AlertCircle,
  AlertTriangle, Loader2, CheckSquare, Square, Sparkles, ArrowRight, X, ShieldCheck
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

export const AdminSearchPageDiscovery: React.FC<AdminSearchPageDiscoveryProps> = ({
  onImportSelected
}) => {
  const { profile, user } = useAuth();
  const userRole = (profile?.role || (user ? 'admin' : 'guest')) as string;

  const [searchUrl, setSearchUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
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

  const handleDiscoverListings = async () => {
    setErrorMessage(null);
    setWarningMessages([]);
    setDiscoveryResult(null);
    setDiscoveredListings([]);

    const trimmedUrl = searchUrl.trim();
    if (!trimmedUrl) {
      setErrorMessage('Por favor, introduza o URL da página de resultados de pesquisa.');
      return;
    }

    // Client side validation pre-check
    const val: SearchPageValidationResult = validateSearchPageUrl(trimmedUrl);
    if (!val.isValid) {
      setErrorMessage(val.errorMessage || 'URL inválido para importação de pesquisa.');
      return;
    }

    setIsLoading(true);

    try {
      const resp = await fetch('/api/discover-listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageUrl: trimmedUrl,
          userRole: userRole === 'guest' ? 'admin' : userRole
        })
      });

      const data = await resp.json();

      if (!resp.ok || !data.success) {
        setErrorMessage(data.errorMessage || 'Falha ao processar a página de pesquisa.');
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
          title: l.title || 'Anúncio de Barco',
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
      setErrorMessage(err.message || 'Erro de rede ao comunicar com o servidor de descoberta.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCount = discoveredListings.filter(l => l.selected).length;

  const toggleSelect = (idx: number) => {
    setDiscoveredListings(prev => {
      const copy = [...prev];
      const target = copy[idx];
      if (target.alreadyImported) return prev;

      const nextSelected = !target.selected;
      if (nextSelected && selectedCount >= 20) {
        alert('Máximo de 20 anúncios por lote de importação. Por favor, desmarque alguns anúncios para selecionar este.');
        return prev;
      }

      copy[idx] = { ...target, selected: nextSelected };
      return copy;
    });
  };

  const handleSelectAllNew = () => {
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
    setDiscoveredListings(prev => prev.map(item => ({ ...item, selected: false })));
  };

  const handleStartImport = () => {
    const selectedUrls = discoveredListings
      .filter(l => l.selected && !l.alreadyImported)
      .map(l => l.normalizedSourceUrl);

    if (selectedUrls.length === 0) {
      alert('Por favor, selecione pelo menos um anúncio para importar.');
      return;
    }

    if (selectedUrls.length > 20) {
      alert('Máximo de 20 anúncios por lote. Por favor, desmarque alguns anúncios para continuar.');
      return;
    }

    onImportSelected(selectedUrls);
  };

  return (
    <div className="space-y-6">
      {/* Explanation Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-lg border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-indigo-400 font-extrabold text-xs uppercase tracking-wider">
          <Sparkles size={16} /> Importação por Página de Resultados
        </div>
        <h2 className="text-xl md:text-2xl font-black text-white">
          Descobrir Anúncios em Lote via URL de Pesquisa
        </h2>
        <p className="text-slate-300 text-xs md:text-sm font-medium leading-relaxed">
          Cole o URL de uma página de resultados de pesquisa do <strong className="text-white">Apollo Duck</strong> ou <strong className="text-white">Boats and Outboards</strong>. O sistema lerá a página, descobrirá todos os anúncios de barcos individuais, removerá duplicados e permitirá selecionar até 20 anúncios por lote para extração automática via IA.
        </p>
      </div>

      {/* Input Box */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <label className="text-xs md:text-sm font-extrabold text-slate-900 flex items-center gap-2">
          <Search size={18} className="text-indigo-600" />
          URL da Página de Resultados de Pesquisa:
        </label>

        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="url"
            value={searchUrl}
            onChange={(e) => setSearchUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDiscoverListings()}
            placeholder="https://www.apolloduck.co.uk/boats/power-boats ou https://www.boatsandoutboards.co.uk/boats-for-sale/"
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
                <span>A Descobrir Anúncios...</span>
              </>
            ) : (
              <>
                <Search size={16} />
                <span>Descobrir Anúncios</span>
              </>
            )}
          </button>
        </div>

        {/* Client Error Message */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs md:text-sm font-bold flex items-center gap-3">
            <AlertCircle size={18} className="shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Warning Messages */}
        {warningMessages.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs md:text-sm font-semibold space-y-1">
            {warningMessages.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discovery Results & Selection Matrix */}
      {discoveryResult && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          {/* Summary Metrics Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 text-white">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <ShieldCheck size={14} /> {discoveryResult.marketplace}
              </div>
              <p className="text-xs text-slate-300 font-mono truncate max-w-md">
                {discoveryResult.pageUrl}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
              <span className="bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                Descobertos: {discoveryResult.totalCandidates}
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                Únicos: {discoveryResult.totalFound}
              </span>
              {discoveryResult.alreadyImportedCount > 0 && (
                <span className="bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-xl border border-amber-500/30">
                  Já no sistema: {discoveryResult.alreadyImportedCount}
                </span>
              )}
              <span className="bg-indigo-500 text-white px-3.5 py-1.5 rounded-xl shadow-sm font-black">
                Selecionados: {selectedCount} / 20
              </span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAllNew}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckSquare size={14} /> Selecionar Novos (máx. 20)
              </button>
              <button
                onClick={handleClearSelection}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Square size={14} /> Limpar Seleção
              </button>
            </div>

            <button
              onClick={handleStartImport}
              disabled={selectedCount === 0 || selectedCount > 20}
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md hover:shadow-emerald-200 disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Importar Selecionados ({selectedCount})</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Discovered Cards List */}
          <div className="space-y-3">
            {discoveredListings.map((item, idx) => (
              <div
                key={idx}
                onClick={() => toggleSelect(idx)}
                className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer ${
                  item.alreadyImported
                    ? 'bg-slate-50 border-slate-200 opacity-60'
                    : item.selected
                    ? 'bg-indigo-50/50 border-indigo-300 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Checkbox */}
                  <button
                    type="button"
                    disabled={item.alreadyImported}
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
                    />
                  ) : (
                    <div className="w-16 h-12 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center shrink-0 text-slate-400 text-xs font-bold">
                      Sem Imagem
                    </div>
                  )}

                  {/* Title & Metadata */}
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-900 text-xs md:text-sm line-clamp-1">
                      {item.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                      {item.priceText && (
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 font-extrabold">
                          {item.priceText}
                        </span>
                      )}
                      {item.locationText && (
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
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

                {/* Right Status Badge & External Link */}
                <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                  {item.alreadyImported ? (
                    <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold border border-amber-200">
                      Já Importado
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-lg text-xs font-bold border border-indigo-200">
                      Pronto p/ Importar
                    </span>
                  )}

                  <a
                    href={item.normalizedSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                    title="Abrir anúncio original"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
