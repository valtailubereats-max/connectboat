import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, ChevronLeft, Check, Play, MessageSquare, Tag, Eye, ArrowRight, ShieldCheck, HelpCircle, Sparkles, Star, Smartphone, Laptop, Database, CreditCard, RefreshCcw, X } from 'lucide-react';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const VitrineComercial = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { settings } = useSettings();
  const isPromoActive = settings?.launchPromoActive !== false;
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/29');
  const [cardCvc, setCardCvc] = useState('888');
  const [cardName, setCardName] = useState('');

  // Determine user currency
  const currencySymbol = profile?.country === 'Reino Unido' ? '£' : '€';
  const price = '8.99';

  const handleCheckoutSuccess = async () => {
    if (!user) {
      alert('Please log in or register on ConnectBoat to activate your Marine Showcase.');
      navigate('/login?redirect=/vitrine-comercial');
      return;
    }
    setLoading(true);
    try {
      const finalShowcaseName = profile?.name || 'A Minha Vitrine';
      let generatedSlug = '';
      if (finalShowcaseName) {
        const cleanedSlug = finalShowcaseName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()
          .replace(/(^-|-$)+/g, '');
        generatedSlug = `${cleanedSlug}-${user.uid.substring(0, 5)}`;
      }

      const finalCountry = profile?.country || 'Portugal';
      const finalCity = profile?.city || '';

      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        showcasePaid: true,
        showcaseActive: true,
        showcasePlan: 'premium',
        showcaseName: finalShowcaseName,
        showcaseSlug: generatedSlug,
        country: finalCountry,
        city: finalCity
      }, { merge: true });

      const profileRef = doc(db, 'sellerPublicProfiles', user.uid);
      await setDoc(profileRef, {
        showcasePaid: true,
        showcaseActive: true,
        showcasePlan: 'premium',
        showcaseName: finalShowcaseName,
        showcaseSlug: generatedSlug,
        showcaseCategory: 'Outros',
        showcaseApproved: true,
        country: finalCountry,
        city: finalCity,
        displayName: profile?.name || user?.displayName || 'Empreendedor'
      }, { merge: true });

      if (refreshProfile) {
        await refreshProfile();
      }

      if (isPromoActive) {
        alert(`Parabéns! A sua entrada na Vitrine Digital foi ativada gratuitamente através da Oferta de Lançamento! 🎁`);
      } else {
        alert(`Parabéns! Subscrição da sua Vitrine Digital ativada com sucesso! Vantagens e limites ativos.`);
      }
      setShowCheckout(false);
      navigate('/profile?tab=vitrine');
    } catch (err) {
      console.error(err);
      alert('Erro ao processar o seu pagamento simulado.');
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    {
      icon: <Laptop size={22} className="text-indigo-600" />,
      title: "Página Exclusiva Própria",
      desc: "Tenha um link limpo e direto (mercado-luso.com/empreendedores/seu-negocio) para divulgar aos seus clientes nas redes sociais."
    },
    {
      icon: <Smartphone size={22} className="text-indigo-600" />,
      title: "Catálogo de Produtos Moderno",
      desc: "Cadastre até 6 produtos ou serviços em destaque com imagens bem enquadradas, descrições detalhadas e preços claros."
    },
    {
      icon: <MessageSquare size={22} className="text-indigo-600" />,
      title: "Telemóvel & WhatsApp Direto",
      desc: "Um botão chamativo de contacto que abre instantaneamente a conversa de WhatsApp para fechar mais vendas de imediato."
    },
    {
      icon: <Eye size={22} className="text-indigo-600" />,
      title: "Painel de Estatísticas Fáceis",
      desc: "Saiba exatamente quantas visualizações adicionais a sua vitrine recebeu e quantos potenciais clientes clicaram no seu telemóvel."
    },
    {
      icon: <Sparkles size={22} className="text-indigo-600" />,
      title: "Logótipo e Capa Customizáveis",
      desc: "Traga a identidade visual única da sua marca! Defina um logótipo redondo polido e uma imagem de capa de destaque impressionante."
    },
    {
      icon: <ShieldCheck size={22} className="text-indigo-600" />,
      title: "Selo de Verificação de Empreendedor",
      desc: "Destaque-se de comerciantes comuns e transmita credibilidade absoluta para toda a comunidade lusitana."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-950 pb-20">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white py-20 px-4 md:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_50%)]" />
        
        <div className="max-w-5xl mx-auto relative z-10 space-y-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-xs font-bold text-indigo-300 hover:text-white transition-all bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-full"
          >
            <ChevronLeft size={14} /> Voltar atrás
          </button>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-black uppercase tracking-wider">
            <Sparkles size={12} className="animate-pulse" /> ConnectBoat Feature
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight max-w-3xl">
            Create the Ultimate Marine Showcase for Your Business
          </h1>

          <p className="text-base md:text-lg text-slate-300 max-w-2xl font-medium leading-relaxed">
            Elevate your marine presence. Get a dedicated showcase page for your boat charter, brokerage, or marine services on ConnectBoat with direct customer contact.
          </p>

          {isPromoActive && (
            <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-sm font-semibold flex items-center gap-2.5 max-w-2xl">
              <span className="text-xl">🎁</span>
              <span>Marine Showcase subscription is complimentary during the ConnectBoat launch phase.</span>
            </div>
          )}

          <div className="flex flex-wrap gap-4 pt-4">
            {user ? (
              profile?.showcasePaid ? (
                <button
                  onClick={() => navigate('/profile?tab=vitrine')}
                  className="px-8 py-4.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm transition-all shadow-xl shadow-indigo-950/40 flex items-center gap-2"
                >
                  Gerir a Minha Vitrine Ativa <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  onClick={isPromoActive ? handleCheckoutSuccess : () => setShowCheckout(true)}
                  className={`px-8 py-4.5 rounded-2xl ${isPromoActive ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'} text-white font-extrabold text-sm transition-all shadow-xl shadow-indigo-950/40 flex items-center gap-2`}
                >
                  {isPromoActive ? "Ativar Vitrine Profissional Grátis 🎁" : "Ativar Vitrine Profissional Agora"} <ArrowRight size={16} />
                </button>
              )
            ) : (
              <button
                onClick={() => navigate('/login?redirect=/vitrine-comercial')}
                className="px-8 py-4.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm transition-all shadow-xl shadow-indigo-950/40 flex items-center gap-2"
              >
                Registe-se para Criar a Sua <ArrowRight size={16} />
              </button>
            )}
            <a
              href="#beneficios"
              className="px-8 py-4.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition-all border border-white/10"
            >
              Conhecer Funcionalidades ↓
            </a>
          </div>
        </div>
      </div>

      {/* Benefits Content */}
      <div id="beneficios" className="max-w-5xl mx-auto px-4 md:px-8 mt-20 space-y-16">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">O que oferece a Vitrine Digital Comercial?</h2>
          <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
            Todas as ferramentas vitais embaladas numa subscrição justa de valor fixo. Sem comissões por venda.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, i) => (
            <div key={i} className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  {benefit.icon}
                </div>
                <h3 className="font-extrabold text-slate-900 text-base leading-snug">{benefit.title}</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">{benefit.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing block */}
        <div className="p-8 md:p-12 rounded-3xl bg-gradient-to-br from-indigo-50 via-white to-slate-50 border-2 border-indigo-200/50 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
          <div className="space-y-4 max-w-lg">
            <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-150 text-indigo-700 px-3 py-1.5 rounded-full inline-block">Plano Único Completo</span>
            <h3 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">Um investimento que cabe no seu bolso</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Diferente de marketplaces caros ou percentagens elevadas, na Vitrine Digital o utilizador paga um valor fixo honesto mensal, mantendo 100% das suas margens de lucro de vendas!
            </p>
            {isPromoActive && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[#046a38] text-xs font-bold flex items-center gap-2">
                <span>🎁 A Vitrine Digital encontra-se gratuita durante o período de lançamento do Mercado Luso.</span>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm w-full md:max-w-xs text-center space-y-4 shrink-0">
            <div>
              <span className="text-xs font-bold text-slate-400 block uppercase">Subscrição Profissional</span>
              <span className="text-4xl font-black text-indigo-600 block mt-1 tracking-tight">
                <span className={isPromoActive ? "line-through text-slate-300 mr-2 text-2xl" : ""}>
                  {currencySymbol}{price}
                </span>
                {isPromoActive && (
                  <span className="text-emerald-600 font-extrabold text-3xl">Grátis 🎁</span>
                )}
                {!isPromoActive && <span className="text-xs font-bold text-slate-400">/mês</span>}
              </span>
            </div>
            <ul className="text-xs text-slate-600 font-semibold space-y-2 text-left bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
              <li className="flex items-center gap-2 text-emerald-600 font-bold">✓ Sem período de fidelidade</li>
              <li className="flex items-center gap-2 text-emerald-600 font-bold">✓ Cancele quando quiser no perfil</li>
              <li className="flex items-center gap-2">✓ Suporte premium de ajuda</li>
            </ul>

            {user ? (
              profile?.showcasePaid ? (
                <button
                  disabled
                  className="w-full bg-slate-200 text-slate-500 font-bold py-3.5 rounded-xl cursor-not-allowed text-xs uppercase tracking-wide"
                >
                  ✓ Subscrição Ativa
                </button>
              ) : (
                <button
                  onClick={isPromoActive ? handleCheckoutSuccess : () => setShowCheckout(true)}
                  className={`w-full ${isPromoActive ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/20' : 'bg-indigo-650 hover:bg-indigo-700'} text-white font-extrabold py-3.5 rounded-xl transition-all shadow-md text-xs uppercase tracking-wide`}
                >
                  {isPromoActive ? "Subscrever Gratuitamente 🎁" : "Subscrever Agora por Stripe"}
                </button>
              )
            ) : (
              <button
                onClick={() => navigate('/login?redirect=/vitrine-comercial')}
                className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-xl transition-all shadow-md text-xs uppercase tracking-wide"
              >
                Criar Conta para Subscrever
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stripe checkout modal simulation */}
      <AnimatePresence>
        {showCheckout && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100"
            >
              {/* Header */}
              <div className="relative p-6 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white">
                <button
                  onClick={() => setShowCheckout(false)}
                  className="absolute top-4 right-4 text-white/75 hover:text-white bg-white/10 p-2 rounded-full transition-all"
                >
                  <X size={16} />
                </button>
                <div className="flex items-center gap-2 text-indigo-400 font-black tracking-widest text-[10px] uppercase">
                  <span>Stripe Secure Subscription</span>
                </div>
                <h3 className="text-xl font-bold mt-2">Ativar Minha Vitrine</h3>
                <p className="text-xs text-slate-300 mt-1">Inscreva o seu negócio por apenas {currencySymbol}{price} por mês.</p>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                {/* Summary */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Subscrição Mensal Vitrine</span>
                    <span className="font-bold text-slate-900">{currencySymbol}{price}/mês</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Configuração e ativação única</span>
                    <span className="font-semibold text-emerald-600">Grátis</span>
                  </div>
                  <div className="border-t border-slate-200/50 pt-2 flex justify-between text-sm font-bold text-slate-900">
                    <span>Total Debitável Hoje</span>
                    <span className="text-indigo-600">{currencySymbol}{price}</span>
                  </div>
                </div>

                {/* Card Fields */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">Dados do Cartão (Simulação)</span>
                  
                  <div className="border-2 border-slate-200 focus-within:border-indigo-600 rounded-2xl px-4 py-3 bg-white space-y-3 transition-all shadow-sm">
                    {/* Card Number */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Número do Cartão</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full bg-transparent border-none p-0 outline-none text-sm text-slate-900 font-medium placeholder-slate-300"
                        placeholder="4242 4242 4242 4243"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-2">
                      {/* Exp */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Validade</label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full bg-transparent border-none p-0 outline-none text-sm text-slate-900 font-medium placeholder-slate-300"
                          placeholder="MM/AA"
                        />
                      </div>
                      {/* CVC */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CVC</label>
                        <input
                          type="password"
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                          className="w-full bg-transparent border-none p-0 outline-none text-sm text-slate-900 font-medium placeholder-slate-300"
                          placeholder="CVC"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Name on Card */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nome do Titular</label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 text-sm"
                      placeholder="Ex: Manuel Silva"
                    />
                  </div>
                </div>

                {/* Security trust badges */}
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">🔒 Processamento 256-bit SSL</span>
                  <div className="flex gap-1.5 opacity-60">
                    <span className="px-1 py-0.5 border border-slate-200 rounded bg-slate-50 font-black text-[8px]">VISA</span>
                    <span className="px-1 py-0.5 border border-slate-200 rounded bg-slate-50 font-black text-[8px]">MC</span>
                    <span className="px-1 py-0.5 border border-slate-200 rounded bg-slate-50 font-black text-[8px]">STRIPE</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleCheckoutSuccess}
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <RefreshCcw className="animate-spin" size={16} /> A processar subscrição...
                      </span>
                    ) : (
                      <span>Subscrever por {currencySymbol}{price}/mês</span>
                    )}
                  </button>
                  
                  <button
                    onClick={() => setShowCheckout(false)}
                    className="w-full text-center py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-all"
                  >
                    Mudar de ideias
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VitrineComercial;
