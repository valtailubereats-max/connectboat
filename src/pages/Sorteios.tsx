import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  getDocs, 
  where, 
  doc, 
  setDoc,
  Timestamp 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Gift, 
  Globe, 
  Clock, 
  AlertCircle, 
  BookOpen, 
  LogIn, 
  Check, 
  Share2,
  Copy,
  PlusCircle,
  HelpCircle,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Giveaway, GiveawayParticipation } from '../types';
import { triggerShare } from '../utils/shareUtils';

export default function Sorteios() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [participationsMap, setParticipationsMap] = useState<Record<string, GiveawayParticipation>>({});
  const [loading, setLoading] = useState(true);
  const [participatingId, setParticipatingId] = useState<string | null>(null);

  // Tracks which giveaway is currently showing its sharing options tray
  const [activeShareId, setActiveShareId] = useState<string | null>(null);

  // Selected giveaway rules modal
  const [rulesGiveaway, setRulesGiveaway] = useState<Giveaway | null>(null);

  const [activeVideoModal, setActiveVideoModal] = useState<{ title: string; url?: string; base64?: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  // Synchronize with global navbar share clicks
  useEffect(() => {
    const handleGlobalShareRequest = (e: Event) => {
      const activeGiveaway = giveaways.find(g => g.status === 'Ativo');
      if (!activeGiveaway) return;
      const customEvent = e as CustomEvent<{ onHandled: () => void }>;
      if (customEvent.detail && typeof customEvent.detail.onHandled === 'function') {
        customEvent.detail.onHandled();
      }
      triggerShare({
        type: 'sorteio',
        title: activeGiveaway.title,
        prize: activeGiveaway.prize,
        url: `${window.location.origin}/sorteios`
      });
    };
    window.addEventListener('request-share-current-page', handleGlobalShareRequest);
    return () => {
      window.removeEventListener('request-share-current-page', handleGlobalShareRequest);
    };
  }, [giveaways]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'giveaways'));
      const list: Giveaway[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as Giveaway);
      });

      // Sort: Active first, then concluded
      const sorted = list.sort((a, b) => {
        if (a.status === 'Ativo' && b.status !== 'Ativo') return -1;
        if (a.status !== 'Ativo' && b.status === 'Ativo') return 1;
        return 0;
      });
      setGiveaways(sorted);

      // If user is authenticated, check their participations including ticket counts
      if (user) {
        const partsQuery = query(collection(db, 'participations'), where('userId', '==', user.uid));
        const partsSnap = await getDocs(partsQuery);
        const pMap: Record<string, GiveawayParticipation> = {};
        partsSnap.forEach(docSnap => {
          const partData = docSnap.data() as GiveawayParticipation;
          pMap[partData.giveawayId] = partData;
        });
        setParticipationsMap(pMap);
      }
    } catch (err) {
      console.error('Error loading public giveaways:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShareAndRegister = async (g: Giveaway, channel: string) => {
    if (!user) {
      if (window.confirm('Necessita de iniciar sessão para poder entrar nos sorteios. Deseja iniciar sessão agora?')) {
        navigate('/login');
      }
      return;
    }

    // Check country restrictions
    const userCountry = (user as any).country || 'Ambos';
    if (g.country !== 'Ambos' && userCountry !== 'Ambos' && g.country !== userCountry) {
      alert(`Lamentamos, mas este sorteio é exclusivo para residentes em: ${g.country}. O seu perfil está registado como: ${userCountry}.`);
      return;
    }

    const currentParticipation = participationsMap[g.id];
    const previousTickets = currentParticipation?.ticketsCount ?? 0;

    // Check ticket count limit (Max 3)
    if (previousTickets >= 3) {
      alert('Já atingiu o limite de 3 bilhetes para este sorteio. Obrigado por partilhar!');
      return;
    }

    // Check minimum 5-minute interval between tickets
    if (currentParticipation && currentParticipation.lastShareAt) {
      const lastShareDate = currentParticipation.lastShareAt.toDate 
        ? currentParticipation.lastShareAt.toDate() 
        : new Date(currentParticipation.lastShareAt);
      const now = new Date();
      const diffMs = now.getTime() - lastShareDate.getTime();
      const intervalMs = 5 * 60 * 1000; // 5 minutes (300,000 ms)
      
      if (diffMs < intervalMs) {
        const remainingMs = intervalMs - diffMs;
        const remainingMin = Math.floor(remainingMs / (60 * 1000));
        const remainingSec = Math.floor((remainingMs % (60 * 1000)) / 1000);
        alert(`⏳ Por favor, aguarde 5 minutos entre partilhas. Falta ${remainingMin} min e ${remainingSec} seg.`);
        return;
      }
    }

    setParticipatingId(g.id);
    try {
      // 1. Prepare share window link and text
      const shareUrl = `${window.location.origin}/sorteios`;
      const text = `🍀 Sorteio: *${g.title}*\n\n`;
      let finalUrl = '';

      if (channel === 'whatsapp') {
        finalUrl = `https://wa.me/?text=${encodeURIComponent(text + 'Participe gratuitamente aqui: ' + shareUrl)}`;
      } else if (channel === 'facebook') {
        finalUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
      } else if (channel === 'telegram') {
        finalUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text + 'Participe gratuitamente e garanta a sua chance!')}`;
      } else if (channel === 'twitter') {
        finalUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text + 'Participe gratuitamente aqui: ')}&url=${encodeURIComponent(shareUrl)}`;
      }

      if (finalUrl) {
        window.open(finalUrl, '_blank', 'noopener,noreferrer');
      } else if (channel === 'copylink') {
        try {
          await navigator.clipboard.writeText(shareUrl);
          alert('Link do sorteio copiado com sucesso! Partilhe-o com os seus familiares e amigos. 📋');
        } catch (copyErr) {
          // Fallback if blocked
          alert(`Copie este link para partilhar: ${shareUrl}`);
        }
      }

      // 2. Add raw share tracking object to Firestore /shares collection
      const shareDocId = `${g.id}_${user.uid}_${Date.now()}`;
      await setDoc(doc(db, 'shares', shareDocId), {
        giveawayId: g.id,
        userId: user.uid,
        channel: channel,
        createdAt: Timestamp.now()
      });

      // 3. Register or increment participation
      const partId = `${g.id}_${user.uid}`;
      const previousShares = currentParticipation?.sharesCount ?? 0;

      const newSharesCount = previousShares + 1;
      const newTicketsCount = previousTickets + 1;

      const participationData: GiveawayParticipation = {
        id: partId,
        giveawayId: g.id,
        userId: user.uid,
        userName: user.displayName || 'Utilizador',
        userEmail: user.email || '',
        sharesCount: newSharesCount,
        ticketsCount: newTicketsCount,
        lastShareAt: Timestamp.now(),
        lastShareChannel: channel,
        createdAt: currentParticipation?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await setDoc(doc(db, 'participations', partId), participationData);

      // 4. Update the reactive local state
      setParticipationsMap(prev => ({
        ...prev,
        [g.id]: participationData
      }));

      // Close share dropdown
      setActiveShareId(null);
      alert('A sua intenção de partilha foi registada com sucesso! Recebeu +1 Bilhete de Sorteio! 🍀🎟️');
    } catch (err) {
      console.error('Error in handleShareAndRegister:', err);
      alert('Não foi possível registar o seu bilhete. Por favor, tente novamente.');
    } finally {
      setParticipatingId(null);
    }
  };

  const activeGiveaways = giveaways.filter(g => g.status === 'Ativo');
  const pastGiveaways = giveaways.filter(g => g.status !== 'Ativo');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12 animate-fade-in">
      {/* Visual Header */}
      <div className="relative rounded-3xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 p-8 md:p-12 text-white overflow-hidden shadow-xl ring-1 ring-white/10">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl"></div>
        <div className="absolute bottom-0 left-1/3 -mb-20 -ml-20 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl"></div>

        <div className="max-w-xl space-y-4 relative z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 uppercase tracking-wider">
            <Gift size={14} />
            Campanhas Activas
          </span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none">
            Campanhas e Sorteios <span className="text-amber-400 font-extrabold">Gratuitos</span>
          </h1>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
            Participe de forma simples e transparente. Basta partilhar para ganhar um bilhete garantido, e pode continuar a partilhar para acumular mais bilhetes e multiplicar as suas chances!
          </p>
        </div>
      </div>

      {/* Rules Explanatory Board */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm space-y-5">
        <div className="flex items-center gap-2.5">
          <HelpCircle className="text-indigo-600 shrink-0" size={24} />
          <h2 className="text-lg md:text-xl font-extrabold text-slate-900 tracking-tight">Como Funcionam os Nossos Sorteios?</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100/80 space-y-2">
            <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm">1</span>
            <h3 className="font-bold text-slate-900 text-sm">Entre na sua conta</h3>
            <p className="text-slate-500 text-xs leading-relaxed">Inicie sessão com o seu perfil de utilizador do Mercado Luso de forma a podermos associar os seus bilhetes.</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100/80 space-y-2">
            <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm">2</span>
            <h3 className="font-bold text-slate-900 text-sm">Partilhe o Mercado Luso</h3>
            <p className="text-slate-500 text-xs leading-relaxed">Clique no botão oficial de partilha. <strong>1 partilha mínima obrigatória</strong> garante imediatamente a sua participação.</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100/80 space-y-2">
            <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm">3</span>
            <h3 className="font-bold text-slate-900 text-sm">Ganhe Até 3 Bilhetes</h3>
            <p className="text-slate-500 text-xs leading-relaxed"><strong>Cada partilha vale 1 bilhete (máximo 3)</strong>. É necessário aguardar um intervalo de 5 minutos entre partilhas.</p>
          </div>
        </div>
      </div>

      {/* Sorteios Ativos Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Passatempos a Decorrer</h2>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-150 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-slate-400 text-xs font-bold">A procurar sorteios ativos...</p>
          </div>
        ) : activeGiveaways.length === 0 ? (
          <div className="p-12 bg-slate-50 rounded-2xl text-center border border-slate-100">
            <Gift className="mx-auto text-slate-300 mb-3" size={40} />
            <h3 className="font-bold text-slate-800">Sem sorteios ativos de momento</h3>
            <p className="text-slate-400 text-xs mt-1">Fique atento, novas campanhas promocionais serão lançadas brevemente!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {activeGiveaways.map((g) => {
              const userParticipation = participationsMap[g.id];
              const isRegistered = !!userParticipation;
              const sharesCount = userParticipation?.sharesCount ?? 0;
              const ticketsCount = userParticipation?.ticketsCount ?? 0;
              const isShareTrayOpen = activeShareId === g.id;

              return (
                <div 
                  id={`public-giveaway-${g.id}`}
                  key={g.id} 
                  className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition-all group"
                >
                  {/* Prize Cover Photo */}
                  <div 
                    className={`h-52 relative overflow-hidden bg-slate-100 ${
                      g.videoBase64 || g.videoUrl ? 'cursor-pointer group' : ''
                    }`}
                    onClick={() => {
                      if (g.videoBase64 || g.videoUrl) {
                        setActiveVideoModal({ title: g.title, url: g.videoUrl, base64: g.videoBase64 });
                      }
                    }}
                  >
                    <img 
                      src={g.prizeImage} 
                      alt={g.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                    />

                    {/* Play video overlay indicator */}
                    {(g.videoBase64 || g.videoUrl) && (
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all z-10">
                        <div className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm shadow-md flex items-center justify-center text-indigo-600 scale-90 group-hover:scale-100 transition-all hover:bg-white">
                          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" stroke="currentColor" strokeWidth="0" />
                          </svg>
                        </div>
                        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-black text-white px-2.5 py-0.5 bg-slate-900/80 rounded-full tracking-wider uppercase whitespace-nowrap">
                          Ver Vídeo de Evidência
                        </span>
                      </div>
                    )}

                    {/* Eligible Country Badge */}
                    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md px-3.5 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 shadow-sm text-slate-800 animate-fade-inDown z-10">
                      <Globe size={11} className="text-slate-400" />
                      <span>{g.country === 'Ambos' ? 'PT + UK 🌍' : g.country}</span>
                    </div>

                    {/* Urgent end timer badge */}
                    <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur px-3 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1 z-10">
                      <Clock size={11} className="text-amber-400" />
                      <span>Fim: {g.endDate}</span>
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {g.drawNumber !== undefined && (
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                            g.drawNumber === 0 
                              ? 'bg-rose-100 text-rose-800 animate-pulse border border-rose-200' 
                              : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {g.drawNumber === 0 ? '🎁 Edição #0 (Exemplo Fictício)' : `Sorteio #${g.drawNumber}`}
                          </span>
                        )}
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">Prémio</span>
                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                          {g.winnersCount} {g.winnersCount === 1 ? 'Vencedor' : 'Vencedores'}
                        </span>
                        {isRegistered && (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                            🎟️ {ticketsCount} {ticketsCount === 1 ? 'Bilhete' : 'Bilhetes'}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight leading-snug group-hover:text-indigo-600 transition-all">{g.title}</h3>
                      <p className="text-slate-500 text-xs leading-relaxed line-clamp-3">{g.description}</p>
                      
                      {/* Compact Play Video Banner when video exists */}
                      {(g.videoBase64 || g.videoUrl) && (
                        <button
                          onClick={() => {
                            setActiveVideoModal({ title: g.title, url: g.videoUrl, base64: g.videoBase64 });
                          }}
                          className="mt-1 text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl font-extrabold flex items-center gap-1.5 cursor-pointer transition-all border border-indigo-150/60"
                        >
                          <span>🎥 Ver Vídeo do Sorteio</span>
                          <span className="text-[8px] bg-indigo-150 text-indigo-800 px-1.5 py-0.2 rounded-md font-bold">Auditável</span>
                        </button>
                      )}
                    </div>

                    {/* Bottom Actions and Workflow */}
                    <div className="space-y-4">
                      {/* Rules button */}
                      <button 
                        onClick={() => setRulesGiveaway(g)}
                        className="w-full text-center text-xs font-bold text-slate-600 hover:text-indigo-600 flex items-center justify-center gap-1 py-1.5 border border-slate-150 rounded-xl hover:bg-slate-50 transition-all text-[11px]"
                      >
                        <BookOpen size={12} />
                        <span>Ver Regras do Passatempo</span>
                      </button>

                      {/* WORKFLOW CONDITIONAL */}
                      {!user ? (
                        /* Case 1: NOT AUTHENTICATED */
                        <div className="space-y-2">
                          <button
                            onClick={() => navigate('/login')}
                            className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center gap-1.5 text-xs font-black transition-all shadow-md shadow-indigo-100"
                          >
                            <LogIn size={15} />
                            <span>Entrar para Participar</span>
                          </button>
                          <p className="text-[10px] text-slate-400 text-center font-medium">É necessário iniciar sessão para associar os bilhetes de sorteio.</p>
                        </div>
                      ) : (
                        /* Case 2: AUTHENTICATED */
                        <div className="space-y-3 pt-1">
                          {isRegistered && (
                            ticketsCount >= 3 ? (
                              <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-3.5 space-y-1 text-emerald-800 animate-fade-in text-center">
                                <p className="text-xs font-extrabold flex items-center justify-center gap-1.5 leading-snug">
                                  <Check size={16} className="text-emerald-600 shrink-0" />
                                  <span>Já atingiu o limite de 3 bilhetes para este sorteio. Obrigado por partilhar!</span>
                                </p>
                              </div>
                            ) : (
                              <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-3.5 space-y-1 text-emerald-800 animate-fade-in text-center">
                                <p className="text-sm font-extrabold flex items-center justify-center gap-1.5 leading-none">
                                  <span>🎟️ Os seus bilhetes: {ticketsCount} de 3</span>
                                </p>
                                <p className="text-[11px] font-semibold text-emerald-700 leading-tight pt-1">
                                  Partilhe novamente para ganhar mais chances.
                                </p>
                              </div>
                            )
                          )}

                          {/* Sharing container action buttons */}
                          {ticketsCount < 3 && (
                            !isShareTrayOpen ? (
                              <button
                                onClick={() => setActiveShareId(g.id)}
                                disabled={participatingId === g.id}
                                className={`w-full h-11 rounded-xl flex items-center justify-center gap-2 text-xs font-black transition-all shadow-md ${
                                  isRegistered 
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 hover:scale-[1.01]' 
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 hover:scale-[1.01] animate-pulseHover'
                                }`}
                              >
                                <Share2 size={15} />
                                {isRegistered ? (
                                  <span>Partilhar novamente</span>
                                ) : (
                                  <span>Partilhar Mercado Luso</span>
                                )}
                              </button>
                            ) : (
                              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2 animate-slideDown">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider text-center">Partilhe em qualquer canal para ganhar +1 Bilhete</p>
                                
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => handleShareAndRegister(g, 'whatsapp')}
                                    className="py-2.5 px-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-1.5"
                                  >
                                    <span>💬 WhatsApp</span>
                                  </button>
                                  <button
                                    onClick={() => handleShareAndRegister(g, 'facebook')}
                                    className="py-2.5 px-3 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition flex items-center justify-center gap-1.5"
                                  >
                                    <span>👥 Facebook</span>
                                  </button>
                                  <button
                                    onClick={() => handleShareAndRegister(g, 'telegram')}
                                    className="py-2.5 px-3 bg-sky-500 text-white rounded-xl text-xs font-bold hover:bg-sky-600 transition flex items-center justify-center gap-1.5"
                                  >
                                    <span>✈️ Telegram</span>
                                  </button>
                                  <button
                                    onClick={() => handleShareAndRegister(g, 'copylink')}
                                    className="py-2.5 px-3 bg-white text-slate-700 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100 transition flex items-center justify-center gap-1.5"
                                  >
                                    <Copy size={12} />
                                    <span>Copiar Link</span>
                                  </button>
                                </div>

                                <button
                                  onClick={() => setActiveShareId(null)}
                                  className="w-full text-center text-[10px] text-slate-400 font-bold hover:text-slate-600 py-1"
                                >
                                  Cancelar
                                </button>
                              </div>
                            )
                          )}

                          {isRegistered && ticketsCount < 3 && (
                            <p className="text-[10px] text-slate-500 font-semibold leading-relaxed text-center flex items-center justify-center gap-1">
                              <span>🎟️ Cada partilha adicional (com intervalo de 5 min) gera mais uma chance.</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Histórico e Transparência Section */}
      <div className="space-y-6 pt-6">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-6 bg-slate-700 rounded-full"></div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Histórico de Premiados</h2>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
          </div>
        ) : pastGiveaways.length === 0 ? (
          <div className="p-8 bg-slate-50 rounded-2xl text-center text-slate-400 text-xs border border-slate-100">
            Nenhuma campanha anterior registada.
          </div>
        ) : (
          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100/60 divide-y divide-slate-200/80">
            {pastGiveaways.map((g) => (
              <div key={g.id} className="py-6 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                
                {/* Giveaway Details mini */}
                <div className="flex items-center gap-4 min-w-0">
                  <div 
                    className={`w-16 h-16 rounded-2xl overflow-hidden bg-slate-200 shrink-0 border border-slate-205 relative ${
                      g.videoBase64 || g.videoUrl ? 'cursor-pointer group' : ''
                    }`}
                    onClick={() => {
                      if (g.videoBase64 || g.videoUrl) {
                        setActiveVideoModal({ title: g.title, url: g.videoUrl, base64: g.videoBase64 });
                      }
                    }}
                  >
                    <img src={g.prizeImage} alt={g.title} className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                    {(g.videoBase64 || g.videoUrl) && (
                      <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center text-white opacity-90 group-hover:opacity-100 transition-opacity">
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Passatempo Encerrado</span>
                    <h3 className="font-extrabold text-slate-900 truncate text-base">{g.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-slate-500">Sorteado em: {g.endDate}</p>
                      {(g.videoBase64 || g.videoUrl) && (
                        <button
                          onClick={() => setActiveVideoModal({ title: g.title, url: g.videoUrl, base64: g.videoBase64 })}
                          className="text-[9px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-extrabold px-1.5 py-0.2 rounded border border-indigo-100 cursor-pointer"
                        >
                          🎥 Vídeo Oficial
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Winners showcase */}
                <div className="flex-1 max-w-xl">
                  {g.winners && g.winners.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {g.winners.map((win, winIdx) => (
                        <div key={winIdx} className="bg-white px-4 py-3 rounded-2xl border border-slate-150 flex items-center justify-between gap-3 shadow-none hover:shadow-sm transition-all">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 truncate flex items-center gap-1">
                              <Trophy size={12} className="text-amber-500 shrink-0" />
                              {win.name}
                            </p>
                            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mt-0.5">
                              {win.status === 'Prémio Entregue' ? '🎁 Prémio Entregue' : '🕒 Contactado'}
                            </p>
                          </div>
                          <span className="text-[20px]" title={g.country === 'Portugal' ? 'Portugal' : 'Reino Unido'}>
                            {g.country === 'Portugal' ? '🇵🇹' : g.country === 'Reino Unido' ? '🇬🇧' : '🌍'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Sorteio encerrado. Lista de vencedores a ser validada.</span>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rules Modal Dialog */}
      <AnimatePresence>
        {rulesGiveaway && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setRulesGiveaway(null)}
              className="absolute inset-0 bg-black"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="text-indigo-600" size={20} />
                  <h3 className="font-extrabold text-slate-900 text-lg">Regras do Passatempo</h3>
                </div>
                <button 
                  onClick={() => setRulesGiveaway(null)}
                  className="p-1 hover:bg-slate-100 rounded-xl font-bold text-lg text-slate-400 hover:text-slate-700"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-4 text-xs leading-relaxed text-slate-600 font-medium">
                <h4 className="font-black text-slate-900 text-sm">{rulesGiveaway.title}</h4>
                
                <div className="whitespace-pre-line bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-500 font-semibold leading-relaxed">
                  {rulesGiveaway.rules}
                </div>

                <div className="bg-indigo-50/50 p-3 rounded-2xl flex items-center gap-2.5 text-indigo-800 font-semibold">
                  <AlertCircle size={16} className="text-indigo-600 shrink-0" />
                  <span>A participação é totalmente livre de encargos financeiros! 🏆</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Video Evidence Modal Popup */}
      <AnimatePresence>
        {activeVideoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveVideoModal(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />

            {/* Content Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 text-white rounded-3xl overflow-hidden shadow-2xl flex flex-col z-10"
            >
              {/* Header */}
              <div className="p-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse"></span>
                  <h3 className="text-sm font-black tracking-tight">{activeVideoModal.title} - Evidência Oficial</h3>
                </div>
                <button 
                  onClick={() => setActiveVideoModal(null)}
                  className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Player stage */}
              <div className="p-1 bg-black aspect-video flex items-center justify-center relative min-h-[220px]">
                {activeVideoModal.base64 ? (
                  <video 
                    src={activeVideoModal.base64} 
                    controls 
                    autoPlay 
                    playsInline 
                    className="w-full h-full rounded-2.5xl object-contain bg-black font-semibold"
                  />
                ) : activeVideoModal.url ? (
                  activeVideoModal.url.includes('mp4') || activeVideoModal.url.includes('webm') || activeVideoModal.url.includes('video') ? (
                    <video 
                      src={activeVideoModal.url} 
                      controls 
                      autoPlay 
                      playsInline 
                      className="w-full h-full rounded-2.5xl object-contain bg-black font-semibold"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-6 space-y-4">
                      <div className="w-16 h-16 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                        <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                          <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" stroke="currentColor"/>
                        </svg>
                      </div>
                      <div className="space-y-1">
                        <p className="font-extrabold text-sm text-slate-100">Vídeo em Link Externo</p>
                        <p className="text-xs text-slate-400 max-w-sm">Este vídeo oficial está alojado numa plataforma externa auditada.</p>
                      </div>
                      <a 
                        href={activeVideoModal.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 font-extrabold text-xs text-white rounded-xl transition-all shadow-md active:scale-95 inline-block cursor-pointer"
                      >
                        Abrir Vídeo Noutro Separador →
                      </a>
                    </div>
                  )
                ) : (
                  <p className="text-xs text-slate-400 font-bold">Vídeo não disponível ou em processamento.</p>
                )}
              </div>

              {/* Bottom footer bar */}
              <div className="p-3 bg-slate-950/40 text-slate-400 text-[10px] font-bold text-center border-t border-slate-800/60 leading-relaxed flex items-center justify-center gap-1.5">
                <span>🛡️ Assinado digitalmente e encriptado no Firestore</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
