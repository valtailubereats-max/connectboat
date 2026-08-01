import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Sparkles, Check, AlertCircle, RefreshCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { CITIES } from '../types';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { formatPrice } from '../utils';

import AdminDemoListings from './AdminDemoListings';
import AdminBulkImport from './AdminBulkImport';

const AdminImport = () => {
  const { categories } = useSettings();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'bulk' | 'print' | 'demo'>('bulk');
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzePrint = async () => {
    if (!image) return;

    setAnalyzing(true);
    setError(null);

    try {
      // Chamamos o nosso endpoint do servidor robusto e compatível com Vercel
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image, categories })
      });

      if (!response.ok) {
        throw new Error(`[HTTP ${response.status}] Falha ao conectar com o serviço de IA.`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[AdminImport Error] Non-JSON response:', response.status, text.slice(0, 200));
        throw new Error(`[HTTP ${response.status}] Resposta inválida da API (/api/gemini/analyze).`);
      }

      const serverResult = await response.json();
      if (serverResult.success && serverResult.data) {
        setResult(serverResult.data);
      } else {
        throw new Error(serverResult.error || 'Não foi possível extrair os dados do print.');
      }
    } catch (err: any) {
      console.error('Erro no processamento do Gemini no servidor:', err);
      setError(`⚠️ Falha na IA: ${err.message || 'Erro inesperado'}`);
      // Log failure to health events
      addDoc(collection(db, 'system_health_events'), {
        type: 'import_failure',
        error: err?.message || String(err),
        timestamp: new Date()
      }).catch(logErr => console.warn('[AdminImport] Failed to log import failure:', logErr));
    } finally {
      setAnalyzing(false);
    }
  };

  const confirmAndRedirect = () => {
    if (!result) return;
    navigate('/create-ad', { state: { prefill: result } });
  };

  if (!isAdmin) {
    return <div className="p-8 text-center font-bold">Acesso restrito a administradores.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200">
        <button
          onClick={() => setActiveTab('bulk')}
          className={`px-5 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'bulk'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles size={16} />
          <span>Bulk Import Listings (URLs)</span>
        </button>

        <button
          onClick={() => setActiveTab('print')}
          className={`px-5 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'print'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Upload size={16} />
          <span>Extração via Print / IA</span>
        </button>

        <button
          onClick={() => setActiveTab('demo')}
          className={`px-5 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'demo'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles size={16} />
          <span>Gerador Demo Fixo</span>
        </button>
      </div>

      {activeTab === 'bulk' ? (
        <AdminBulkImport />
      ) : activeTab === 'demo' ? (
        <AdminDemoListings />
      ) : (
        <>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Importador Inteligente por Print</h1>
            <p className="text-slate-500 font-medium">Faça upload de um print/captura de ecrã para extrair informações via IA.</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100"
          >
        <div className="space-y-8">
          <div 
            onClick={() => !analyzing && fileInputRef.current?.click()}
            className={`aspect-video rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group ${
              image ? 'border-indigo-400' : 'border-slate-200 hover:border-indigo-400 bg-slate-50'
            } ${analyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {image ? (
              <>
                <img src={image} alt="Print" className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-white font-bold flex items-center gap-2">
                    <RefreshCcw size={20} /> Alterar Imagem
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center p-8">
                <Upload size={32} className="mx-auto mb-4 text-slate-400 group-hover:text-indigo-600" />
                <p className="text-slate-600 font-bold">Suba o print do anúncio</p>
              </div>
            )}
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              onChange={handleImageChange} 
              className="hidden" 
            />
          </div>

          {image && !result && !analyzing && (
            <button
              onClick={analyzePrint}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl flex items-center justify-center gap-2"
            >
              <Sparkles size={20} /> Analisar Print com IA
            </button>
          )}

          {analyzing && (
            <div className="text-center py-8">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-indigo-600 font-bold animate-pulse">Lendo dados do print...</p>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 text-rose-600">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-6 pt-6 border-t border-slate-100"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase">Title</p>
                    <p className="text-slate-900 font-bold">{result.title}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase">Price</p>
                    <p className="text-indigo-600 font-black text-lg">{result.price ? formatPrice(result.price) : 'N/A'}</p>
                  </div>
                  {(result.manufacturer || result.model || result.year || result.boatType) && (
                    <div className="bg-sky-50/50 border border-sky-100 p-4 rounded-2xl md:col-span-2">
                      <p className="text-xs font-extrabold text-sky-800 uppercase mb-2 flex items-center gap-1.5">
                        ⚓ Extracted Nautical Details
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-700">
                        {result.boatType && <div><span className="font-semibold text-slate-500">Type:</span> {result.boatType}</div>}
                        {result.manufacturer && <div><span className="font-semibold text-slate-500">Manufacturer:</span> {result.manufacturer}</div>}
                        {result.model && <div><span className="font-semibold text-slate-500">Model:</span> {result.model}</div>}
                        {result.year && <div><span className="font-semibold text-slate-500">Year:</span> {result.year}</div>}
                        {result.length && <div><span className="font-semibold text-slate-500">Length:</span> {result.length}</div>}
                        {result.beam && <div><span className="font-semibold text-slate-500">Beam:</span> {result.beam}</div>}
                        {result.draft && <div><span className="font-semibold text-slate-500">Draft:</span> {result.draft}</div>}
                        {result.engineBrand && <div><span className="font-semibold text-slate-500">Engine:</span> {result.engineBrand}</div>}
                        {result.horsepower && <div><span className="font-semibold text-slate-500">Power:</span> {result.horsepower}</div>}
                        {result.engineHours && <div><span className="font-semibold text-slate-500">Hours:</span> {result.engineHours}</div>}
                        {result.fuelType && <div><span className="font-semibold text-slate-500">Fuel:</span> {result.fuelType}</div>}
                        {result.cabins && <div><span className="font-semibold text-slate-500">Cabins:</span> {result.cabins}</div>}
                        {result.berths && <div><span className="font-semibold text-slate-500">Berths:</span> {result.berths}</div>}
                        {result.bathrooms && <div><span className="font-semibold text-slate-500">Bathrooms:</span> {result.bathrooms}</div>}
                        {result.hullMaterial && <div><span className="font-semibold text-slate-500">Material:</span> {result.hullMaterial}</div>}
                        {result.trailerIncluded && <div><span className="font-semibold text-slate-500">Trailer:</span> {result.trailerIncluded}</div>}
                        {result.vatPaid && <div><span className="font-semibold text-slate-500">VAT Paid:</span> {result.vatPaid}</div>}
                        {result.ceCertified && <div><span className="font-semibold text-slate-500">CE Certified:</span> {result.ceCertified}</div>}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={confirmAndRedirect}
                  className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-600 transition-all shadow-xl"
                >
                  Confirm and Create Listing
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  )}
</div>
);
};

export default AdminImport;