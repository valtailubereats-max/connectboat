import React, { useEffect, useState } from 'react';
import { db, getDocsWithCacheFallback, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { PhotoStoreItem } from '../types';
import { Camera, Image as ImageIcon, AlertCircle, ShoppingBag, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils';

export default function Fotos() {
  const { settings } = useSettings();
  const { isAdmin, isModerator } = useAuth();
  const [photos, setPhotos] = useState<PhotoStoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMessage, setShowMessage] = useState(false);

  const isFeatureDisabled = settings?.enableFotosFeature === false && !isAdmin && !isModerator;

  useEffect(() => {
    async function fetchActivePhotos() {
      setLoading(true);
      setError(null);
      const colPath = 'photoStoreItems';
      try {
        const q = query(
          collection(db, colPath),
          where('active', '==', true),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocsWithCacheFallback(q, colPath);
        const list: PhotoStoreItem[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as PhotoStoreItem);
        });
        setPhotos(list);
      } catch (err) {
        console.error('Erro ao buscar fotos:', err);
        setError('Não foi possível carregar o catálogo de fotos digitais. Por favor, tente novamente mais tarde.');
        try {
          handleFirestoreError(err, OperationType.LIST, colPath);
        } catch (_) {}
      } finally {
        setLoading(false);
      }
    }

    fetchActivePhotos();
  }, []);

  const handleBuyClick = () => {
    setShowMessage(true);
    setTimeout(() => {
      setShowMessage(false);
    }, 4000);
  };

  if (isFeatureDisabled) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center flex flex-col items-center justify-center" id="pagina-loja-fotos-disabled">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-amber-50/70 text-amber-500 mb-6 border border-amber-100/50">
          <Camera size={40} className="stroke-[1.5]" />
        </div>
        <h1 className="text-3xl font-brand font-black text-slate-900 tracking-tight">
          Secção de Fotos Indisponível
        </h1>
        <p className="text-slate-500 mt-2 font-medium max-w-md mx-auto leading-relaxed text-sm">
          This section is temporarily disabled by the ConnectBoat team. Please check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" id="pagina-loja-fotos">
      {/* Toast Notification for Buy Click */}
      <AnimatePresence>
        {showMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-700/50 max-w-sm w-full text-center sm:text-left"
          >
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
              <ShoppingBag size={20} />
            </div>
            <div>
              <p className="font-black text-sm">Compra online em breve.</p>
              <p className="text-xs text-slate-300 mt-0.5">Estamos a preparar a infraestrutura financeira de pagamento!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Section */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[#52b64d]/10 text-pt-green mb-4">
          <Camera size={32} className="stroke-[1.5]" />
        </div>
        <h1 className="text-4xl font-brand font-black text-slate-900 tracking-tight" id="titulo-loja-fotos">
          Loja de Fotos
        </h1>
        <p className="text-slate-600 mt-2 font-medium">
          Descubra e adquira fotografias digitais fantásticas capturadas pela nossa comunidade. Apoie os talentos locais e dê vida aos seus ecrãs.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-pt-green mb-4" size={40} />
          <p className="text-sm font-bold text-slate-500 animate-pulse">A carregar fotos incríveis...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-6 text-center max-w-md mx-auto">
          <AlertCircle className="text-red-500 mx-auto mb-3" size={32} />
          <p className="text-sm font-bold text-red-900">{error}</p>
        </div>
      ) : photos.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-12 text-center border border-slate-200/60 max-w-lg mx-auto shadow-sm">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <ImageIcon size={28} />
          </div>
          <h3 className="text-xl font-black text-slate-900">Nenhuma foto de momento</h3>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            A nossa loja de fotos digitais ainda não tem itens ativos disponíveis. Volte a visitar esta secção em breve!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {photos.map((item) => (
            <motion.div
              layout
              key={item.id}
              className="card-flutuante flex flex-col h-full bg-white rounded-3xl overflow-hidden group shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-100"
              id={`foto-card-${item.id}`}
            >
              {/* Image box */}
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 shrink-0 select-none">
                <img
                  src={item.imageUrl && item.imageUrl.trim() !== '' ? item.imageUrl : null}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full text-white font-mono text-sm font-bold flex items-center gap-1.5 shadow-md">
                  <span>{formatPrice(item.price)}</span>
                </div>
              </div>

              {/* Text content & buttons */}
              <div className="p-6 flex flex-col flex-1 justify-between gap-5">
                <div className="space-y-1.5">
                  <h3 className="text-lg font-brand font-black text-slate-900 truncate group-hover:text-pt-green transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-slate-500 text-xs font-semibold leading-relaxed line-clamp-3">
                    {item.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-50">
                  <button
                    onClick={handleBuyClick}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-brand font-bold uppercase tracking-widest text-sm py-3.5 rounded-2xl shadow-md cursor-pointer transition-all active:scale-[0.98]"
                    id={`btn-buy-${item.id}`}
                  >
                    Buy
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
