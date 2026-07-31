import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Check, Star, Crown, Store, Smile, ArrowRight, Sparkles, AlertCircle, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export default function Precos() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const isPromoActive = settings?.launchPromoActive !== false;

  // Detect selected country for secondary currency presentation
  const [selectedCountry, setSelectedCountry] = React.useState<'Portugal' | 'Reino Unido'>(() => {
    const saved = localStorage.getItem('selectedCountry');
    return saved === 'Reino Unido' ? 'Reino Unido' : 'Portugal';
  });

  const isUK = selectedCountry === 'Reino Unido';

  const handlePublishClick = () => {
    if (user) {
      navigate('/create-ad');
    } else {
      navigate('/login?mode=register');
    }
  };

  // Helper to format prices according to user preference, showing both but styling the active one
  const renderPrice = (eur: string, gbp: string, labelSuff?: string) => {
    const mainPrice = isUK ? `£${gbp}` : `€${eur}`;
    const altPrice = isUK ? `€${eur}` : `£${gbp}`;

    return (
      <div className="flex flex-col items-center">
        <div className="flex items-baseline justify-center">
          <span className="text-4xl font-brand font-black text-slate-900 tracking-tight">{mainPrice}</span>
          {labelSuff && <span className="text-slate-500 text-sm font-semibold ml-1">{labelSuff}</span>}
        </div>
        <span className="text-xs text-slate-400 font-semibold mt-1">~ {altPrice}{labelSuff}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#e3f6ea]/20">
      <Helmet>
        <title>Pricing Plans | ConnectBoat</title>
        <meta
          name="description"
          content="Explore ConnectBoat pricing plans. Free listings, Featured options, and Marine Showcase subscriptions for boating professionals."
        />
      </Helmet>

      {/* Header section with negative margin for deep integration */}
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-16">
        <div className="text-center max-w-3xl mx-auto mb-12">
          {/* Subtle Tag */}
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-sky-50 text-sky-700 text-xs font-black tracking-wider uppercase mb-4 shadow-sm border border-sky-100/50">
            <Sparkles size={12} className="text-sky-600" /> Pricing & Promotion
          </span>
          <h1 className="text-4xl md:text-5xl font-brand font-black text-slate-900 tracking-tight leading-tight">
            ConnectBoat Pricing Plans
          </h1>
          <p className="mt-3 text-slate-600 font-medium text-lg">
            Choose the best plan to showcase your boat or marine business.
          </p>
        </div>

        {isPromoActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-6 rounded-3xl bg-sky-50 border-2 border-sky-500/30 shadow-sm relative overflow-hidden"
          >
            {/* Subtle background decoration */}
            <div className="absolute right-0 bottom-0 w-32 h-32 bg-sky-500/5 blur-2xl rounded-full pointer-events-none" />
            
            <div className="flex flex-col md:flex-row items-start md:items-center gap-5 justify-between relative z-10">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 bg-sky-600 text-white text-[11px] font-black tracking-widest px-3 py-1 rounded-full uppercase shadow-xs">
                    🎁 Launch Offer
                  </span>
                </div>
                <p className="text-slate-800 font-extrabold text-base md:text-lg leading-snug">
                  For a limited time, key ConnectBoat promotion features are complimentary during our launch phase.
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 pt-1">
                  <span className="text-slate-500 text-[10px] font-black uppercase tracking-wider">Inclui:</span>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                      ⭐ Destaque Local
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                      👑 Destaque Nacional
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                      🏪 Vitrine Digital
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-emerald-100/70 border border-emerald-200 text-[#046a38] p-4 rounded-2xl md:max-w-xs shrink-0 self-stretch flex items-center justify-center font-bold text-xs text-center leading-relaxed">
                Os preços apresentados entrarão em vigor numa fase futura.
              </div>
            </div>
          </motion.div>
        )}

        {/* Highlighted trust indicators banner inside a modern layout */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-emerald-100 p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 mb-16"
        >
          <div className="space-y-1">
            <h3 className="font-brand font-black text-slate-900 text-lg flex items-center gap-2">
              <ShieldCheck className="text-emerald-600" size={22} /> Navegue com Confiança
            </h3>
            <p className="text-slate-500 text-sm font-medium">
              Transparência total. Nunca cobramos nada sem o seu consentimento explícito.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-x-8 md:gap-y-3 shrink-0">
            <div className="flex items-center gap-2.5 text-slate-700 text-xs sm:text-sm font-bold">
              <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px]">✓</span>
              <span>Criar conta é gratuito.</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 text-xs sm:text-sm font-bold">
              <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px]">✓</span>
              <span>Publicar anúncios normais é gratuito.</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 text-xs sm:text-sm font-bold">
              <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px]">✓</span>
              <span>Só paga se optar por funcionalidades premium.</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 text-xs sm:text-sm font-bold">
              <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px]">✓</span>
              <span>Não existem cobranças automáticas.</span>
            </div>
          </div>
        </motion.div>

        {/* Currency toggle picker to showcase dynamic detail orientation */}
        <div className="flex justify-center mb-10">
          <div className="bg-white/80 p-1.5 rounded-2xl border border-slate-200 shadow-sm flex gap-1">
            <button
              onClick={() => {
                setSelectedCountry('Portugal');
                localStorage.setItem('selectedCountry', 'Portugal');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedCountry === 'Portugal'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              🇵🇹 Portugal (€)
            </button>
            <button
              onClick={() => {
                setSelectedCountry('Reino Unido');
                localStorage.setItem('selectedCountry', 'Reino Unido');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedCountry === 'Reino Unido'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              🇬🇧 Reino Unido (£)
            </button>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          
          {/* Card 1: Normal Ad */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col bg-white rounded-3xl border border-slate-100 shadow-lg shadow-black/[0.02] p-6 hover:-translate-y-2 transition-all relative overflow-hidden"
          >
            {/* Top Border Accent - Green */}
            <div className="absolute top-0 inset-x-0 h-2 bg-[#046a38]"></div>

            <div className="mb-6 flex justify-between items-center">
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider">
                Grátis
              </span>
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500">
                <Smile size={20} />
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-brand font-black text-slate-900 mb-2">Anúncio Normal</h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Opção ideal para vender itens esporádicos, usados ou serviços locais simples.
              </p>
            </div>

            <div className="mb-8 text-center bg-slate-50 rounded-2xl py-5 border border-slate-100">
              <span className="text-3xl font-brand font-black text-[#046a38] tracking-tight">GRÁTIS</span>
              <span className="block text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-wider">Sem Limite de Tempo</span>
            </div>

            <div className="space-y-4 mb-8 flex-1">
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Até 2 fotos</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Aparece nas listagens normais</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Pesquisa normal</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Favoritos</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">WhatsApp / Interesse direto</span>
              </div>
            </div>

            <button
              onClick={handlePublishClick}
              className="w-full py-3.5 px-4 bg-slate-900 border border-slate-900 text-white hover:bg-slate-800 rounded-2xl font-black text-sm transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Criar Anúncio Grátis</span>
              <ArrowRight size={14} />
            </button>
          </motion.div>

          {/* Card 2: Local Highlight */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col bg-white rounded-3xl border border-amber-200/60 shadow-lg shadow-black/[0.02] p-6 hover:-translate-y-2 transition-all relative overflow-hidden"
          >
            {/* Top Border Accent - Gold */}
            <div className="absolute top-0 inset-x-0 h-2 bg-amber-500"></div>

            <div className="mb-6 flex justify-between items-center">
              <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider border border-amber-100">
                Mais Popular
              </span>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Star size={20} className="fill-amber-500 text-amber-500" />
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-brand font-black text-slate-900 mb-2 flex items-center gap-1.5">
                ⭐ Destaque Local
              </h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Aumente as suas vendas locais aparecendo em carrosséis prioritários específicos da sua região.
              </p>
            </div>

            <div className="mb-8 text-center bg-amber-50/50 rounded-2xl py-4 border border-amber-100/50">
              {renderPrice('4.99', '4.99')}
              <span className="block text-[10px] font-bold text-amber-600 uppercase mt-1.5 tracking-wider">Por 30 Dias</span>
            </div>

            <div className="space-y-4 mb-8 flex-1">
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Até 4 fotos</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Carrossel de Destaques</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Destaque apenas na cidade do anúncio</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug font-bold text-slate-900">Maior visibilidade local</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Etiqueta visual de Destaque</span>
              </div>
            </div>

            <button
              onClick={handlePublishClick}
              className="w-full py-3.5 px-4 bg-amber-500 text-white hover:bg-amber-600 rounded-2xl font-black text-sm transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Destacar meu Anúncio</span>
              <ArrowRight size={14} />
            </button>
          </motion.div>

          {/* Card 3: National Highlight */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col bg-slate-900 rounded-3xl border border-indigo-500/20 shadow-xl p-6 hover:-translate-y-2 transition-all relative overflow-hidden text-white"
          >
            {/* Top Border Accent - Indigo Premium */}
            <div className="absolute top-0 inset-x-0 h-2 bg-indigo-500"></div>

            <div className="mb-6 flex justify-between items-center">
              <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-wider border border-indigo-500/20">
                Maior Alcance
              </span>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Crown size={20} className="fill-indigo-500 text-indigo-400" />
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-brand font-black text-white mb-2 flex items-center gap-1.5">
                👑 Destaque Nacional
              </h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Alcance compradores em qualquer ponto do país com a máxima visibilidade e prioridade nacional.
              </p>
            </div>

            <div className="mb-8 text-center bg-white/5 rounded-2xl py-4 border border-white/5">
              <div className="flex flex-col items-center">
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-brand font-black text-white tracking-tight">{isUK ? '£7.99' : '€7.99'}</span>
                </div>
                <span className="text-xs text-slate-400 font-semibold mt-1">~ {isUK ? '€7.99' : '£7.99'}</span>
              </div>
              <span className="block text-[10px] font-bold text-indigo-400 uppercase mt-1.5 tracking-wider">Por 30 Dias</span>
            </div>

            <div className="space-y-4 mb-8 flex-1">
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-350 font-semibold leading-snug">Até 6 fotos</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-350 font-semibold leading-snug">Carrossel de Destaques nacional</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-350 font-semibold leading-snug">Visibilidade em todas as cidades</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-300 font-bold leading-snug">Prioridade superior ao Destaque Local</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-350 font-semibold leading-snug">Etiqueta Premium de alto destaque</span>
              </div>
            </div>

            <button
              onClick={handlePublishClick}
              className="w-full py-3.5 px-4 bg-indigo-600 text-white hover:bg-indigo-700 rounded-2xl font-black text-sm transition-all shadow-md shadow-indigo-900/30 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Ativar Destaque Nacional</span>
              <ArrowRight size={14} />
            </button>
          </motion.div>

          {/* Card 4: Digital Showcase (Vitrine) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex flex-col bg-white rounded-3xl border border-emerald-200 shadow-lg shadow-emerald-50/20 p-6 hover:-translate-y-2 transition-all relative overflow-hidden"
          >
            {/* Top Border Accent - Teal/Emerald Commercial */}
            <div className="absolute top-0 inset-x-0 h-2 bg-emerald-600"></div>

            <div className="mb-6 flex justify-between items-center">
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                Empresas e Profissionais
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Store size={20} className="text-emerald-600" />
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-brand font-black text-slate-900 mb-2 flex items-center gap-1.5">
                🏪 Vitrine Digital
              </h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Crie um catálogo digital personalizado, estabeleça a sua marca e receba leads diretamente do seu negócio.
              </p>
            </div>

            <div className="mb-8 text-center bg-emerald-50/50 rounded-2xl py-4 border border-emerald-100/50">
              {renderPrice('8.99', '8.99', ' /mês')}
              <span className="block text-[10px] font-bold text-emerald-700 uppercase mt-1.5 tracking-wider">Subscrição Mensal</span>
            </div>

            <div className="space-y-4 mb-8 flex-1">
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Página exclusiva do seu negócio (vitrine)</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Logo e banner personalizados</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Até 6 produtos/serviços no catálogo</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">WhatsApp e formulário direto de contacto</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Estatísticas básicas de visitas</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-650 font-bold text-slate-950 leading-snug">Presença garantida em Empreendedores</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/vitrine-comercial')}
              className="w-full py-3.5 px-4 bg-[#046a38] text-white hover:bg-[#03522b] rounded-2xl font-black text-sm transition-all shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Ver Benefícios da Vitrine</span>
              <ArrowRight size={14} />
            </button>
          </motion.div>

        </div>

        {/* CTA Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-16 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl p-8 md:p-12 text-center text-white relative overflow-hidden"
        >
          {/* Accent decoration */}
          <div className="absolute right-0 top-0 w-64 h-64 bg-[#046a38]/10 blur-3xl rounded-full"></div>
          <div className="absolute left-0 bottom-0 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full"></div>

          <div className="relative max-w-2xl mx-auto flex flex-col items-center">
            <h2 className="text-2xl md:text-3xl font-brand font-black tracking-tight mb-4 leading-tight">
              Pronto para divulgar o seu negócio ou aumentar a visibilidade dos seus anúncios?
            </h2>
            <p className="text-slate-350 text-sm font-medium mb-8 max-w-lg">
              Em apenas alguns minutos, pode configurar a sua vitrine ou ativar destaques para receber mais interessados diretamente no WhatsApp.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <button
                onClick={handlePublishClick}
                className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm md:text-base transition-all shadow-lg shadow-emerald-500/20 hover:scale-105 cursor-pointer"
              >
                Criar Anúncio
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
