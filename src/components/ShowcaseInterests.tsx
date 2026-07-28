import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  deleteDoc, 
  orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, parseFirestoreDate } from '../firebase';
import { 
  Mail, 
  Phone, 
  MessageSquare, 
  Trash2, 
  Clock, 
  Inbox, 
  User as UserIcon, 
  ShoppingBag, 
  CheckCircle,
  PlusSquare,
  AlertTriangle,
  Loader2,
  Calendar,
  Sparkles,
  Award
} from 'lucide-react';
import { pt } from 'date-fns/locale';
import { formatDistanceToNow } from 'date-fns';

interface ShowcaseInterestsProps {
  sellerId: string;
}

export const ShowcaseInterests: React.FC<ShowcaseInterestsProps> = ({ sellerId }) => {
  const [loading, setLoading] = useState(true);
  const [interests, setInterests] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ [productId: string]: { name: string; count: number; image?: string } }>({});
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch all registered interests for this showcase seller
  const fetchInterests = async () => {
    if (!sellerId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'showcaseProductInterests'),
        where('sellerId', '==', sellerId)
      );
      const snap = await getDocs(q);
      const list: any[] = [];
      const tempSummary: typeof summary = {};

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const item = { id: docSnap.id, ...data };
        list.push(item);

        // Populate summary metrics
        const pid = data.productId;
        if (pid) {
          if (!tempSummary[pid]) {
            tempSummary[pid] = {
              name: data.productName || 'Produto',
              count: 0,
              image: data.productImageUrl || ''
            };
          }
          tempSummary[pid].count += 1;
        }
      });

      // Sort by computed date locally in case Firestore sorting is pending an index
      list.sort((a, b) => {
        const dateA = a.createdAt ? (a.createdAt.seconds || new Date(a.createdAt).getTime() / 1000) : 0;
        const dateB = b.createdAt ? (b.createdAt.seconds || new Date(b.createdAt).getTime() / 1000) : 0;
        return dateB - dateA;
      });

      setInterests(list);
      setSummary(tempSummary);
    } catch (err) {
      console.error('Erro ao buscar contactos/interesses da vitrine:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterests();
  }, [sellerId]);

  // Action: deletion of a lead record
  const handleDeleteInterest = async (id: string) => {
    if (!window.confirm('Tem a certeza que deseja excluir as informações deste interesse recebido?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'showcaseProductInterests', id));
      setSuccessMsg('Interesse removido com sucesso!');
      
      // Update local state without full server reload for maximum reactivity
      setInterests(prev => prev.filter(item => item.id !== id));
      
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Erro ao remover lead:', err);
      alert('Ocorreu um erro ao excluir permanentemente o interesse.');
    }
  };

  // Convert Firestore Timestamp/Date to elegant time string
  const formatTimeAgo = (createdAt: any) => {
    const rawDate = parseFirestoreDate(createdAt);
    if (!rawDate) return 'Recentemente';
    try {
      return formatDistanceToNow(rawDate, { addSuffix: true, locale: pt });
    } catch (e) {
      return 'Recentemente';
    }
  };

  // Build a smart reply link to open WhatsApp window with buyer
  const getReplyUrl = (item: any) => {
    if (!item.buyerPhone) return '#';
    const cleanPhone = item.buyerPhone.replace(/\+/g, '').replace(/\D/g, '');
    let text = `Hello ${item.buyerName || ''}! I received your interest in *${item.productName}* via ConnectBoat.`;
    if (item.message) {
      text += `\n\n_A sua nota:_ "${item.message}"`;
    }
    return `https://wa.me/${cleanPhone}/?text=${encodeURIComponent(text)}`;
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-4 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded" />
        <div className="space-y-3">
          <div className="h-16 bg-slate-100 rounded-2xl" />
          <div className="h-16 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Get most requested products array
  const topRefProducts = (Object.values(summary) as any[]).sort((a, b) => b.count - a.count).slice(0, 3);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-6" id="showcase-leads-interest-panel">
      
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-100">
            <Inbox size={20} />
          </div>
          <div>
            <h4 className="text-base font-black text-slate-900 leading-tight">INTERESSES NOS PRODUTOS</h4>
            <p className="text-xs text-slate-550 font-medium">Contatos e pedidos iniciados pelo WhatsApp</p>
          </div>
        </div>

        {interests.length > 0 && (
          <span className="bg-indigo-100 text-indigo-850 text-[10px] font-black uppercase px-3 py-1.5 rounded-full block border border-indigo-200">
            {interests.length} {interests.length === 1 ? 'Pedido' : 'Pedidos'} Totais
          </span>
        )}
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black p-3.5 rounded-xl flex items-center gap-2">
          <CheckCircle size={14} />
          <span>{successMsg}</span>
        </div>
      )}

      {interests.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center space-y-3 shadow-xs">
          <div className="text-4xl">📩</div>
          <div className="space-y-1">
            <h5 className="font-extrabold text-slate-800 text-sm">Sem pedidos recebidos ainda</h5>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Quando um cliente clicar em "Pedir pelo WhatsApp" no catálogo da sua vitrine, os dados e observações serão guardados aqui em tempo real.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Quick Stats Summary Grid */}
          {topRefProducts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Box 1: Highlights */}
              <div className="bg-white border border-slate-150 p-4 rounded-2xl flex flex-col justify-between space-y-3">
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">⭐ Produtos Mais Solicitados</span>
                
                <div className="space-y-2">
                  {topRefProducts.map((p, index) => (
                    <div key={`lead-summary-${index}`} className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        {p.image ? (
                          <img src={p.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs">📦</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-slate-700 truncate">{p.name}</span>
                        <span className="bg-slate-100 text-slate-800 text-[10px] font-black px-2 py-0.5 rounded shrink-0">
                          {p.count} {p.count === 1 ? 'pedido' : 'pedidos'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Box 2: Quick Tip helper */}
              <div className="bg-indigo-50/20 border border-indigo-100 p-4 rounded-2xl flex flex-col justify-between space-y-3">
                <span className="text-[10px] uppercase font-black text-sky-600 tracking-wider flex items-center gap-1">
                  <Sparkles size={11} /> Sales Help & Tips
                </span>
                <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                  Respond promptly to interested buyers. Clicking "Reply" will automatically prepare a pre-formatted message with item details for easy communication.
                </p>
                <span className="text-[10px] font-extrabold text-sky-500 block">Recommended response time: &lt; 2 hours</span>
              </div>

            </div>
          )}

          {/* Chronological List of Contacts */}
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">📋 Pedidos Recebidos Recentes</span>
            
            <div className="space-y-3 block max-h-[480px] overflow-y-auto pr-1">
              {interests.map((item) => {
                const isPhoneReplyable = item.buyerPhone && item.buyerPhone.trim().length > 3;

                return (
                  <div key={item.id} className="bg-white border border-slate-150 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs hover:border-slate-300 transition-colors">
                    
                    {/* Buyer info and product relationship */}
                    <div className="flex gap-3 min-w-0">
                      
                      {/* Left: Product preview badge */}
                      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-150 overflow-hidden shrink-0 flex items-center justify-center">
                        {item.productImageUrl ? (
                          <img src={item.productImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingBag size={18} className="text-slate-400" />
                        )}
                      </div>

                      {/* Info lines stack */}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900 leading-none truncate flex items-center gap-1">
                            <UserIcon size={12} className="text-slate-450" />
                            <span>{item.buyerName || 'Visitante Anónimo'}</span>
                          </span>
                          
                          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-semibold">
                            <span>•</span>
                            <Clock size={10} className="shrink-0" />
                            <span>{formatTimeAgo(item.createdAt)}</span>
                          </div>
                        </div>

                        {/* Product identifier */}
                        <p className="text-xs font-bold text-slate-600">
                          Pediu: <span className="text-indigo-600 font-black">{item.productName || 'Produto'}</span>
                          {item.productPrice && <span className="text-slate-500 ml-1">({item.productPrice}€)</span>}
                        </p>

                        {/* Customer note */}
                        {item.message ? (
                          <p className="text-xs font-medium text-slate-550 italic bg-slate-50 border border-slate-100 p-2 rounded-lg mt-1 block">
                            "{item.message}"
                          </p>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-semibold block italic pt-0.5">Nenhuma observação incluída</span>
                        )}

                        {/* Badges contacts */}
                        <div className="flex flex-wrap gap-2 pt-1 font-semibold text-[10px]">
                          {item.buyerPhone && (
                            <span className="text-slate-500 flex items-center gap-1">
                              <Phone size={10} /> {item.buyerPhone}
                            </span>
                          )}
                          {item.buyerEmail && (
                            <span className="text-slate-400 flex items-center gap-1">
                              <Mail size={10} /> {item.buyerEmail}
                            </span>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Operational controls */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      
                      {isPhoneReplyable ? (
                        <a 
                          href={getReplyUrl(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <MessageSquare size={13} />
                          <span>Contactar</span>
                        </a>
                      ) : (
                        <span className="px-3.5 py-2 bg-slate-50 text-slate-400 font-bold text-xs rounded-xl border border-slate-100 select-none cursor-not-allowed cursor-pointer" title="Sem contacto telefónico fornecido">
                          Sem telefone
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteInterest(item.id)}
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-150 rounded-xl transition-all cursor-pointer"
                        title="Eliminar Lead"
                      >
                        <Trash2 size={13} />
                      </button>

                    </div>

                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
export default ShowcaseInterests;
