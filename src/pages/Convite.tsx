import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ShoppingBag, ArrowRight, Sparkles, Shield, Compass, Heart } from 'lucide-react';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const Convite: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const campaign = searchParams.get('campanha') || 'direto';
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. Registar visita ao carregar a página com proteção contra escrita repetida
    const registerPageVisit = async () => {
      try {
        const lastVisitStr = localStorage.getItem('ml_last_invite_visit');
        const now = Date.now();
        const tenMinutesMs = 10 * 60 * 1000;

        if (lastVisitStr) {
          const lastVisitTime = parseInt(lastVisitStr, 10);
          if (now - lastVisitTime < tenMinutesMs) {
            // Visitante recente, não regista no firestore para evitar spam
            return;
          }
        }

        // Determinar país/comunidade ativa se disponível
        const savedCountry = localStorage.getItem('selectedCountry') || 'Não selecionado';

        // Detetar tipo de dispositivo de forma simples no userAgent
        const ua = navigator.userAgent;
        let device = 'Desktop';
        if (/Mobi|Android|iPhone|iPad/i.test(ua)) {
          device = 'Mobile';
        } else if (/Tablet/i.test(ua)) {
          device = 'Tablet';
        }

        const visitDocRef = doc(collection(db, 'invitationVisits'));
        const visitData = {
          id: visitDocRef.id,
          action: 'visit',
          campaign: campaign,
          country: savedCountry,
          userAgent: ua.substring(0, 200),
          userAgentSimplified: device,
          createdAt: serverTimestamp()
        };

        // Grava no Firestore
        await setDoc(visitDocRef, visitData);
        localStorage.setItem('ml_last_invite_visit', now.toString());
      } catch (err) {
        console.error('Erro ao registar visita na plataforma:', err);
      }
    };

    registerPageVisit();
  }, [campaign]);

  // Função para registar clique e depois navegar
  const handleActionClick = async (action: 'register_click' | 'login_click', destinationUrl: string) => {
    if (loading) return;
    setLoading(true);

    try {
      const savedCountry = localStorage.getItem('selectedCountry') || 'Não selecionado';
      const ua = navigator.userAgent;
      let device = 'Desktop';
      if (/Mobi|Android|iPhone|iPad/i.test(ua)) {
        device = 'Mobile';
      }

      const actionDocRef = doc(collection(db, 'invitationVisits'));
      const actionData = {
        id: actionDocRef.id,
        action: action,
        campaign: campaign,
        country: savedCountry,
        userAgent: ua.substring(0, 200),
        userAgentSimplified: device,
        createdAt: serverTimestamp()
      };

      await setDoc(actionDocRef, actionData);
    } catch (err) {
      console.error('Erro ao registar clique de convite:', err);
    } finally {
      setLoading(false);
      navigate(destinationUrl);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center py-6 px-4 md:px-8 font-sans">
      <div className="max-w-2xl w-full bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-slate-100 text-center space-y-8 relative overflow-hidden">
        {/* Adorno decorativo de fundo */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-pt-green/5 rounded-full blur-2xl pointer-events-none -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-pt-red/5 rounded-full blur-2xl pointer-events-none -ml-16 -mb-16" />

        {/* LOGOTIPO */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-[#046a38] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
            <ShoppingBag size={34} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-brand font-bold tracking-tight text-slate-900">
              <span className="text-sky-600">Connect</span>
              <span className="text-slate-900">Boat</span>
            </h1>
            <p className="text-xs uppercase tracking-widest font-black text-slate-400 mt-1">
              Buy, Sell & Charter Boats
            </p>
          </div>
        </div>

        {/* SEÇÃO PRINCIPAL */}
        <div className="space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-sky-50 text-sky-700 tracking-wider uppercase">
            <Sparkles size={12} /> You've Been Invited!
          </span>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
            Join the Premier Boat & Marine Marketplace
          </h2>
          <p className="text-slate-600 font-medium leading-relaxed max-w-lg mx-auto md:text-md text-sm">
            <strong>ConnectBoat</strong> connects boat owners, buyers, brokers, and marine service providers. Post listings, feature your marine business, and connect directly with the boating community.
          </p>
        </div>

        {/* QUICK BENEFITS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2 text-left">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Compass size={16} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Community</h4>
              <p className="text-xs text-slate-500 font-medium leading-normal mt-0.5">Connected across international markets.</p>
            </div>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Shield size={16} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Security</h4>
              <p className="text-xs text-slate-500 font-medium leading-normal mt-0.5">Verified accounts and dedicated support.</p>
            </div>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
              <Heart size={16} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Marine Showcase</h4>
              <p className="text-xs text-slate-500 font-medium leading-normal mt-0.5">Dedicated pages for marine businesses.</p>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row items-stretch justify-center gap-4 max-w-md mx-auto">
          <button
            onClick={() => handleActionClick('register_click', '/login?mode=register')}
            disabled={loading}
            className="flex-1 bg-[#046a38] text-white py-4 px-6 rounded-2xl font-black text-base hover:bg-[#03552d] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-800/10 cursor-pointer"
          >
            <span>Create Account</span>
            <ArrowRight size={18} />
          </button>
          
          <button
            onClick={() => handleActionClick('login_click', '/login?mode=login')}
            disabled={loading}
            className="flex-1 bg-slate-100 text-slate-800 py-4 px-6 rounded-2xl font-black text-base hover:bg-slate-200 transition-all cursor-pointer"
          >
            Sign In
          </button>
        </div>

        {/* LINK TO HOME */}
        <div className="pt-4 border-t border-slate-100 flex flex-col items-center gap-1.5">
          <p className="text-xs text-slate-400 font-bold">Just browsing around?</p>
          <Link
            to="/"
            className="text-xs font-black text-slate-600 hover:text-[#046a38] transition-colors underline uppercase tracking-wider"
          >
            Browse as Guest
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Convite;
