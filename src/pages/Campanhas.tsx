import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, getDocsWithCacheFallback } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, QrCode, MessageSquare, Ticket, Award, Users, Share2, Sparkles, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { calculateTotalPoints, calculateProgressPoints, POINTS_THRESHOLD, POINTS_PER_REFERRAL, POINTS_PER_AD } from '../utils/rewards';

const Campanhas = () => {
  const { user, profile } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [referralsCount, setReferralsCount] = useState(0);
  const [referralsLoading, setReferralsLoading] = useState(true);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [adsCount, setAdsCount] = useState(0);
  const [adsLoading, setAdsLoading] = useState(true);

  // Sync referrals count and approved ads to compute reward points
  useEffect(() => {
    if (!user) return;

    const fetchReferralStats = async () => {
      setReferralsLoading(true);
      try {
        const q = query(collection(db, 'referrals'), where('inviterId', '==', user.uid));
        const snap = await getDocsWithCacheFallback(q, `referrals/inviterId-${user.uid}`);
        setReferralsCount(snap.docs.length);
      } catch (err) {
        console.error("Error reading referrals status:", err);
      } finally {
        setReferralsLoading(false);
      }
    };

    const fetchMyAdsCount = async () => {
      setAdsLoading(true);
      try {
        const q = query(
          collection(db, 'ads'),
          where('sellerId', '==', user.uid)
        );
        const snap = await getDocs(q);
        const approvedCount = snap.docs.filter((doc) => doc.data().status === 'approved').length;
        setAdsCount(approvedCount);
      } catch (err) {
        console.error("Error checking ads:", err);
      } finally {
        setAdsLoading(false);
      }
    };

    fetchReferralStats();
    fetchMyAdsCount();
  }, [user]);

  // Points & Rewards Math
  const pointsFromReferrals = (referralsLoading ? 0 : referralsCount) * POINTS_PER_REFERRAL;
  const pointsFromAds = (adsLoading ? 0 : adsCount) * POINTS_PER_AD;
  const totalPoints = calculateTotalPoints(referralsLoading ? 0 : referralsCount, pointsFromAds);
  const progressPoints = calculateProgressPoints(totalPoints);
  const progressPercent = Math.min(100, Math.round((progressPoints / POINTS_THRESHOLD) * 100));
  const pointsNeeded = Math.max(0, POINTS_THRESHOLD - progressPoints);

  // Share invite via WhatsApp
  const inviteUrl = `${window.location.origin}/login?mode=register&ref=${profile?.referralCode || user?.uid || ''}`;
  const whatsappShareText = `Olá! 👋 Recomendo o Marketplace da nossa Comunidade Lusófona! Regista-te pelo meu link de convite para começares já a ver anúncios ou criar publicações, e ganharmos pontos de destaque grátis! 🎉 Abraço!\n\n${inviteUrl}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  const handleShareNavigator = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ConnectBoat',
          text: 'Join the premier boat & marine marketplace!',
          url: inviteUrl,
        });
      } catch (err) {
        console.log('Share canceled or failed', err);
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center">
            <Gift size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">🎁 Campanhas & Indicações</h1>
            <p className="text-xs text-slate-500 font-medium">Convide amigos, acumule pontos de impacto comunitário e ganhe destaques gratuitos para os seus anúncios!</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/profile')}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
        >
          ← Voltar ao Perfil
        </button>
      </div>

      {/* Rewards dynamic credit notification if credits available */}
      {profile?.referralCredits && profile.referralCredits > 0 ? (
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 p-6 rounded-3xl text-white shadow-lg border border-amber-300 relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-45 h-45 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-start gap-4">
            <span className="text-3xl animate-bounce shrink-0 mt-1">🎉</span>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight">Crédito de Destaque Ativo!</h3>
              <p className="font-bold text-sm">Dispõe presentemente de {profile.referralCredits} destaque(s) de 24 horas pronto(s) a aplicar nos seus anúncios.</p>
              <button
                onClick={() => navigate('/profile?tab=anuncios')}
                className="mt-3 px-4 py-2 bg-slate-900 text-white font-extrabold text-xs rounded-lg hover:bg-slate-800 transition-all"
              >
                Promover um Anúncio Agora
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Quick Access to Sorteios/Giveaways */}
      <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 p-6 rounded-3xl border border-slate-100 text-white shadow-xl flex items-center justify-between gap-6 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-400 font-black tracking-widest text-[9px] uppercase">
            <span>Sorteios & Bilhetes</span>
          </div>
          <h3 className="text-lg font-black text-yellow-300">🎉 Sorteios Ativos da Comunidade</h3>
          <p className="text-xs text-slate-300 leading-relaxed max-w-xl">Claim de bilhetes com pontos de convite e promoções especiais da nossa comunidade de empreendedores lusófonos.</p>
        </div>
        <button
          onClick={() => navigate('/sorteios')}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl transition-all shadow-md shrink-0 uppercase tracking-wider"
        >
          Participar nos Sorteios →
        </button>
      </div>

      {/* Sharing Invite Link & QR Code container (Bento Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Side: link & share buttons */}
        <div className="md:col-span-7 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-400 uppercase tracking-widest">
              <Share2 size={12} /> Partilhar Link Pessoal
            </div>
            <h3 className="text-base font-extrabold text-slate-900 leading-relaxed">Divulgue o seu código de convite único</h3>
            <p className="text-xs text-slate-500 leading-relaxed">Copie o link abaixo ou use as partilhas sociais diretas para que novos registos sejam atribuídos automaticamente ao seu perfil.</p>
            
            <div className="space-y-2 mt-4 pt-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-600 focus:outline-none select-all text-center md:text-left"
              />
              
              <div className="flex gap-2.5 pt-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-5 py-3.5 rounded-xl font-bold text-xs flex-1 transition-all ${
                    copiedReferral 
                      ? 'bg-emerald-600 text-white shadow-emerald-100' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {copiedReferral ? 'Copiado!' : 'Copiar Link'}
                </button>
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappShareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer whitespace-nowrap flex-1"
                >
                  <MessageSquare size={14} />
                  <span>whatsapp</span>
                </a>
                <button
                  onClick={handleShareNavigator}
                  className="px-4 py-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-xs shrink-0 flex items-center justify-center"
                  title="Partilha Geral"
                >
                  <Share2 size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-4 space-y-2 text-[11px] text-slate-400 font-semibold leading-relaxed">
            <span className="text-emerald-600 font-extrabold uppercase tracking-wider block">Como funciona?</span>
            <p>1. Partilha o teu link pessoal. </p>
            <p>2. Cada amigo que se registe pelo teu link soma 50 pontos à tua conta.</p>
            <p>3. Conquistas 24h de destaque de anúncios a cada 150 pontos!</p>
          </div>
        </div>

        {/* Right Side: QR Code Generator Card */}
        <div className="md:col-span-5 bg-slate-50/50 p-6 rounded-3xl border border-slate-100 flex flex-col items-center justify-center gap-4 text-center">
          <div className="flex items-center gap-1 text-[10px] text-purple-600 font-black uppercase tracking-wider">
            <QrCode size={12} /> QR Code de Convite
          </div>
          
          <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center">
            <QRCodeSVG
              value={inviteUrl}
              size={140}
              level="M"
              fgColor="#1e1b4b"
              includeMargin={false}
            />
          </div>

          <div className="space-y-1 px-1 mt-1">
            <h4 className="text-xs font-bold text-slate-800">Partilha Presencial</h4>
            <p className="text-[10px] text-slate-500 leading-normal">Basta que o seu amigo digitalize este QR Code com a câmara do telemóvel para se registar pela sua recomendação.</p>
          </div>
        </div>
      </div>

      {/* Rewards Bento Metrics dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Pontos de Convites</span>
            <span className="text-xl font-black text-emerald-600 block mt-1.5">{referralsLoading ? '...' : `${pointsFromReferrals} pts`}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-bold block mt-3 border-t border-slate-50 pt-1.5">{referralsCount} convites ({POINTS_PER_REFERRAL} pts/cada)</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Pontos de Anúncios</span>
            <span className="text-xl font-black text-indigo-600 block mt-1.5">{adsLoading ? '...' : `${pointsFromAds} pts`}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-bold block mt-3 border-t border-slate-50 pt-1.5">Aprovados ({POINTS_PER_AD} pts/cada)</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Próximo Destaque</span>
            <span className="text-xl font-black text-amber-500 block mt-1.5">{referralsLoading ? '...' : `${progressPoints} / 150`}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-bold block mt-3 border-t border-slate-50 pt-1.5">Faltam {pointsNeeded} pts para o destaque</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center flex flex-col justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Destaques Ganhos</span>
            <span className="text-xl font-black text-indigo-700 block mt-1.5">{profile?.referralCredits || 0}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-bold block mt-3 border-t border-slate-50 pt-1.5">Créditos de destaque ativos</span>
        </div>
      </div>

      {/* Visual reward progress scale */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="space-y-0.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Progresso do Destaque</span>
            <h4 className="text-xs font-bold text-slate-700">Faltam {pointsNeeded} pontos para resgatar 1 destaque grátis.</h4>
          </div>
          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
            {progressPercent}% CONCLUÍDO
          </span>
        </div>

        {/* Custom premium slider gradient */}
        <div className="relative w-full bg-slate-100 rounded-full h-4 overflow-hidden border border-slate-200/60 shadow-inner">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          </motion.div>
        </div>

        <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
          <span>0%</span>
          <span>50%</span>
          <span>100% 🎁</span>
        </div>
      </div>
    </div>
  );
};

export default Campanhas;
