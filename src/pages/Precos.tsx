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

  const isPromoActive = settings?.launchPromoActive === true;

  const enablePortugal = settings?.enablePortugalMarket === true;

  // Detect selected country for secondary currency presentation
  const [selectedCountry, setSelectedCountry] = React.useState<'Portugal' | 'Reino Unido'>(() => {
    if (!enablePortugal) return 'Reino Unido';
    const saved = localStorage.getItem('selectedCountry');
    return saved === 'Reino Unido' ? 'Reino Unido' : 'Portugal';
  });

  const isUK = !enablePortugal || selectedCountry === 'Reino Unido';

  const hasLoadedPlanPrices =
    settings?.planPrices?.standard !== undefined &&
    settings?.planPrices?.featured !== undefined &&
    settings?.planPrices?.premium !== undefined;

  const getPlanPrice = (plan: 'standard' | 'featured' | 'premium'): number | null => {
    if (!hasLoadedPlanPrices) return null;

    const value = Number(settings?.planPrices?.[plan]);
    return Number.isFinite(value) ? value : null;
  };

  const formatPlanPrice = (plan: 'standard' | 'featured' | 'premium'): string => {
    const price = getPlanPrice(plan);
    return price === null ? '—' : price.toFixed(2);
  };

  const getPlanDuration = (plan: 'standard' | 'featured' | 'premium'): number => {
    const value = Number(settings?.planDurations?.[plan]);
    return Number.isFinite(value) && value > 0 ? value : 30;
  };

  const formatDurationLabel = (plan: 'standard' | 'featured' | 'premium'): string => {
    const days = getPlanDuration(plan);
    return `${days} ${days === 1 ? 'Day' : 'Days'}`;
  };

  const getMaxPhotosForPlan = (planKey: string): number => {
    const normalized = (planKey || 'standard').toLowerCase();
    const targetPlan: 'standard' | 'featured' | 'premium' =
      ['premium', 'national'].includes(normalized)
        ? 'premium'
        : ['featured', 'highlight', 'local', 'intermediate'].includes(normalized)
          ? 'featured'
          : 'standard';

    const configured = Number(settings?.maxImages?.[targetPlan]);
    if (Number.isFinite(configured) && configured > 0) return configured;
    return targetPlan === 'premium' ? 25 : targetPlan === 'featured' ? 15 : 8;
  };

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
        {enablePortugal && <span className="text-xs text-slate-400 font-semibold mt-1">~ {altPrice}{labelSuff}</span>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#e3f6ea]/20">
      <Helmet>
        <title>Pricing Plans | ConnectBoat</title>
        <meta
          name="description"
          content={`Explore ConnectBoat pricing plans. Standard listings from £${formatPlanPrice('standard')}, Featured options, and Premium promotion for boats across the UK.`}
        />
        <link rel="canonical" href="https://connectboat.co.uk/pricing" />
        <meta property="og:url" content="https://connectboat.co.uk/pricing" />
        <meta property="og:title" content="Pricing Plans | ConnectBoat" />
        <meta property="og:image" content="https://connectboat.co.uk/api/og-image" />
        <meta name="twitter:image" content="https://connectboat.co.uk/api/og-image" />
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
            Choose the best plan to showcase your boat, marine product or service.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-5 md:p-6 shadow-sm"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-emerald-800 font-black text-sm uppercase tracking-wider">
                <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">£0</span>
                Marine products & services are free to list
              </div>
              <p className="mt-2 text-sm font-semibold text-emerald-800/90 leading-relaxed">
                Selling parts, engines, electronics, trailers or accessories, or advertising a marina or boat service? Your listing is free and includes up to 3 photos. Paid listing plans below apply only to Boats for Sale and Boats for Hire.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePublishClick}
              className="shrink-0 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black transition-colors flex items-center justify-center gap-2"
            >
              Create a Free Listing <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>

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
                  <span className="text-slate-500 text-[10px] font-black uppercase tracking-wider">Includes:</span>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                      ⭐ Featured Listing
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                      👑 Premium Featured
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-emerald-100/70 border border-emerald-200 text-[#046a38] p-4 rounded-2xl md:max-w-xs shrink-0 self-stretch flex items-center justify-center font-bold text-xs text-center leading-relaxed">
                Prices shown will take effect in a future phase.
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
              <ShieldCheck className="text-emerald-600" size={22} /> Browse with Confidence
            </h3>
            <p className="text-slate-500 text-sm font-medium">
              Full transparency. We never charge anything without your explicit consent.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-x-8 md:gap-y-3 shrink-0">
            <div className="flex items-center gap-2.5 text-slate-700 text-xs sm:text-sm font-bold">
              <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px]">✓</span>
              <span>Creating an account is free.</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 text-xs sm:text-sm font-bold">
              <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px]">✓</span>
              <span>Listing plans start from just £{formatPlanPrice('standard')}.</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 text-xs sm:text-sm font-bold">
              <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px]">✓</span>
              <span>Transparent fixed-fee pricing.</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 text-xs sm:text-sm font-bold">
              <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px]">✓</span>
              <span>No automatic recurring charges.</span>
            </div>
          </div>
        </motion.div>

        {/* Currency toggle picker to showcase dynamic detail orientation */}
        {enablePortugal && (
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
                🇬🇧 United Kingdom (£)
              </button>
            </div>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 rounded-3xl border-2 border-emerald-200 bg-emerald-50/60 p-6 md:p-7 shadow-sm"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Marine Marketplace</p>
              <h2 className="mt-1 text-xl md:text-2xl font-black text-slate-900">Your first eligible Marketplace listing is FREE</h2>
              <p className="mt-2 text-sm font-medium text-slate-600 max-w-2xl">
                Parts, engines, marine electronics, trailers, accessories, marinas, boat services and Wanted listings: your first listing is free once per account. Additional listings are £{Number(settings?.planPrices?.marketplaceAdditional ?? 1.99).toFixed(2)} each.
              </p>
            </div>
            <div className="shrink-0 rounded-2xl border border-emerald-200 bg-white px-5 py-4 text-center">
              <p className="text-2xl font-black text-emerald-700">3 photos</p>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">maximum per listing</p>
            </div>
          </div>
          <p className="mt-4 text-xs font-bold text-slate-600">Complete boats for sale or hire are not eligible for Marketplace pricing and must use a Boats for Sale or Boats for Hire plan.</p>
        </motion.div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          
          {/* Card 1: Standard Listing */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-5 rounded-3xl border-2 border-slate-200 bg-white hover:border-emerald-300 transition-all relative overflow-hidden flex flex-col text-left shadow-lg shadow-black/[0.02]"
          >
            <div className="absolute top-0 right-0 bg-slate-800 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Standard
            </div>
            <p className="font-black text-slate-900 text-base">Standard Listing</p>
            <p className="text-xs text-slate-500 mt-0.5">{formatDurationLabel('standard')} active listing in marketplace search</p>

            <ul className="text-xs text-slate-600 space-y-1.5 my-4 font-medium flex-1">
              <li>📷 <strong>Up to {getMaxPhotosForPlan('standard')} Photos</strong></li>
              <li>💬 Direct WhatsApp Contact</li>
              <li>🔍 Standard Search & Category</li>
            </ul>

            <div className="mt-auto pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-500">Duration: {formatDurationLabel('standard')}</span>
              <span className="font-black text-emerald-700 text-base">
                {isUK ? `£${formatPlanPrice('standard')}` : `€${formatPlanPrice('standard')}`}
              </span>
            </div>

            <button
              onClick={handlePublishClick}
              className="mt-4 w-full py-3.5 px-4 bg-slate-900 border border-slate-900 text-white hover:bg-slate-800 rounded-2xl font-black text-sm transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Create Standard Listing</span>
              <ArrowRight size={14} />
            </button>
          </motion.div>

          {/* Card 2: Featured Listing */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-5 rounded-3xl border-2 border-amber-300/80 bg-amber-50/20 hover:border-amber-400 transition-all relative overflow-hidden flex flex-col text-left shadow-lg shadow-black/[0.02]"
          >
            <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-yellow-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Featured ⭐
            </div>
            <p className="font-black text-slate-900 text-base">Featured Listing</p>
            <p className="text-xs text-slate-500 mt-0.5">Featured placement & priority above Standard listings</p>

            <ul className="text-xs text-slate-600 space-y-1.5 my-4 font-medium flex-1">
              <li>🌟 <strong>Includes Standard benefits</strong></li>
              <li>📷 <strong>Up to {getMaxPhotosForPlan('featured')} Photos</strong></li>
              <li>🌟 <strong>Featured placement in the relevant marketplace section</strong></li>
              <li>🌟 Priority above Standard listings</li>
            </ul>

            <div className="mt-auto pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-500">Duration: {formatDurationLabel('featured')}</span>
              <span className="font-black text-amber-600 text-base">
                {isUK ? `£${formatPlanPrice('featured')}` : `€${formatPlanPrice('featured')}`}
              </span>
            </div>

            <button
              onClick={handlePublishClick}
              className="mt-4 w-full py-3.5 px-4 bg-amber-500 text-white hover:bg-amber-600 rounded-2xl font-black text-sm transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Get Featured Listing</span>
              <ArrowRight size={14} />
            </button>
          </motion.div>

          {/* Card 3: Premium Featured */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-5 rounded-3xl border-2 border-indigo-200/80 bg-indigo-50/20 hover:border-indigo-300 transition-all relative overflow-hidden flex flex-col text-left shadow-lg shadow-black/[0.02]"
          >
            <div className="absolute top-0 right-0 bg-gradient-to-l from-indigo-600 to-indigo-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Premium 👑
            </div>
            <p className="font-black text-slate-900 text-base">Premium Featured</p>
            <p className="text-xs text-slate-500 mt-0.5">Highest listing priority across ConnectBoat</p>

            <ul className="text-xs text-slate-600 space-y-1.5 my-4 font-medium flex-1">
              <li>👑 <strong>Includes Featured benefits</strong></li>
              <li>📷 <strong>Up to {getMaxPhotosForPlan('premium')} Photos</strong></li>
              <li>🚀 <strong>Highest Listing Priority</strong></li>
              <li>👑 Top positions in Featured sections</li>
              <li>🏷️ Premium Badge</li>
            </ul>

            <div className="mt-auto pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-500">Duration: {formatDurationLabel('premium')}</span>
              <span className="font-black text-indigo-600 text-base">
                {isUK ? `£${formatPlanPrice('premium')}` : `€${formatPlanPrice('premium')}`}
              </span>
            </div>

            <button
              onClick={handlePublishClick}
              className="mt-4 w-full py-3.5 px-4 bg-indigo-600 text-white hover:bg-indigo-700 rounded-2xl font-black text-sm transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Activate Premium Featured</span>
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
              Ready to promote your business or boost listing visibility?
            </h2>
            <p className="text-slate-350 text-sm font-medium mb-8 max-w-lg">
              In just a few minutes, set up your showcase or activate features to receive inquiries directly on WhatsApp.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <button
                onClick={handlePublishClick}
                className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm md:text-base transition-all shadow-lg shadow-emerald-500/20 hover:scale-105 cursor-pointer"
              >
                Create Listing
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
