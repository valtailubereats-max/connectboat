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
          content="Explore ConnectBoat pricing plans. Standard £2.99 listings, Featured options, and Marine Showcase subscriptions for boating professionals."
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
                  <span className="text-slate-500 text-[10px] font-black uppercase tracking-wider">Includes:</span>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                      ⭐ Local Featured
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                      👑 National Featured
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
              <span>Transparent fixed-fee listings (£2.99).</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 text-xs sm:text-sm font-bold">
              <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px]">✓</span>
              <span>Only pay if you choose premium features.</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-700 text-xs sm:text-sm font-bold">
              <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px]">✓</span>
              <span>No automatic recurring charges.</span>
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
              🇬🇧 United Kingdom (£)
            </button>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          
          {/* Card 1: Standard Listing */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col bg-white rounded-3xl border border-slate-100 shadow-lg shadow-black/[0.02] p-6 hover:-translate-y-2 transition-all relative overflow-hidden"
          >
            {/* Top Border Accent - Green */}
            <div className="absolute top-0 inset-x-0 h-2 bg-emerald-600"></div>

            <div className="mb-6 flex justify-between items-center">
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                Standard
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Store size={20} />
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-brand font-black text-slate-900 mb-2">Standard Listing</h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Full 30-day active listing for boats for sale or hire, engines, parts, and marine services.
              </p>
            </div>

            <div className="mb-8 text-center bg-emerald-50/50 rounded-2xl py-4 border border-emerald-100/50">
              {renderPrice('2.99', '2.99')}
              <span className="block text-[10px] font-bold text-emerald-700 uppercase mt-1.5 tracking-wider">For 30 Days</span>
            </div>

            <div className="space-y-4 mb-8 flex-1">
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">30 Days Active Listing</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">High Resolution Photos</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Full Details & Specs Page</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Standard Search & Category</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Direct WhatsApp Inquiry Button</span>
              </div>
            </div>

            <button
              onClick={handlePublishClick}
              className="w-full py-3.5 px-4 bg-slate-900 border border-slate-900 text-white hover:bg-slate-800 rounded-2xl font-black text-sm transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
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
            className="flex flex-col bg-white rounded-3xl border border-amber-200/60 shadow-lg shadow-black/[0.02] p-6 hover:-translate-y-2 transition-all relative overflow-hidden"
          >
            {/* Top Border Accent - Gold */}
            <div className="absolute top-0 inset-x-0 h-2 bg-amber-500"></div>

            <div className="mb-6 flex justify-between items-center">
              <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider border border-amber-100">
                Most Popular ⭐
              </span>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Star size={20} className="fill-amber-500 text-amber-500" />
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-brand font-black text-slate-900 mb-2 flex items-center gap-1.5">
                ⭐ Featured Listing
              </h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Featured section highlight on the homepage and priority ranking across searches.
              </p>
            </div>

            <div className="mb-8 text-center bg-amber-50/50 rounded-2xl py-4 border border-amber-100/50">
              {renderPrice('4.99', '4.99')}
              <span className="block text-[10px] font-bold text-amber-600 uppercase mt-1.5 tracking-wider">For 30 Days</span>
            </div>

            <div className="space-y-4 mb-8 flex-1">
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug font-bold">Everything in Standard</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Homepage Featured Highlight</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Featured Star Badge ⭐</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Priority Search Ranking</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-600 font-semibold leading-snug">Up to 3x More Views</span>
              </div>
            </div>

            <button
              onClick={handlePublishClick}
              className="w-full py-3.5 px-4 bg-amber-500 text-white hover:bg-amber-600 rounded-2xl font-black text-sm transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
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
            className="flex flex-col bg-slate-900 rounded-3xl border border-indigo-500/20 shadow-xl p-6 hover:-translate-y-2 transition-all relative overflow-hidden text-white"
          >
            {/* Top Border Accent - Indigo Premium */}
            <div className="absolute top-0 inset-x-0 h-2 bg-indigo-500"></div>

            <div className="mb-6 flex justify-between items-center">
              <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-wider border border-indigo-500/20">
                Maximum Exposure 👑
              </span>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Crown size={20} className="fill-indigo-500 text-indigo-400" />
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-brand font-black text-white mb-2 flex items-center gap-1.5">
                👑 Premium Featured
              </h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Top position priority inside featured carousels and maximum nationwide visibility.
              </p>
            </div>

            <div className="mb-8 text-center bg-white/5 rounded-2xl py-4 border border-white/5">
              {renderPrice('9.99', '9.99')}
              <span className="block text-[10px] font-bold text-indigo-400 uppercase mt-1.5 tracking-wider">For 30 Days</span>
            </div>

            <div className="space-y-4 mb-8 flex-1">
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-350 font-semibold leading-snug font-bold">Everything in Featured</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-350 font-semibold leading-snug">Top Spots inside Featured Section</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-350 font-semibold leading-snug">Premium Crown Badge 👑</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-300 font-bold leading-snug">Maximum Search Priority</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Check size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-350 font-semibold leading-snug">Up to 10x Exposure</span>
              </div>
            </div>

            <button
              onClick={handlePublishClick}
              className="w-full py-3.5 px-4 bg-indigo-600 text-white hover:bg-indigo-700 rounded-2xl font-black text-sm transition-all shadow-md shadow-indigo-900/30 flex items-center justify-center gap-1.5 cursor-pointer"
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
