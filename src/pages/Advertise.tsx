import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CheckCircle2, CreditCard, Image as ImageIcon, Sparkles, Upload, WandSparkles, Clock3, CalendarDays, ArrowRight, ShieldCheck } from 'lucide-react';

type SalesSettings = {
  enabled?: boolean;
  price4s30d?: number;
  price6s30d?: number;
  price8s30d?: number;
  price10s30d?: number;
  aiGenerationsIncluded?: number;
};

type OrderData = {
  id: string;
  paymentStatus?: string;
  workflowStatus?: string;
  advertiserName?: string;
  targetUrl?: string;
  displaySeconds?: number;
  durationDays?: number;
  amountPaid?: number;
  selectedBannerUrl?: string;
  generatedBanners?: string[];
  accessToken?: string;
  adminNote?: string;
};

const DEFAULT_SETTINGS: SalesSettings = {
  enabled: false,
  price4s30d: 0,
  price6s30d: 0,
  price8s30d: 0,
  price10s30d: 0,
  aiGenerationsIncluded: 3,
};

const exposureOptions = [4, 6, 8, 10] as const;
const durationOptions = [7, 14, 30] as const;

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function Advertise() {
  const params = new URLSearchParams(window.location.search);
  const orderIdFromUrl = params.get('order_id') || '';
  const tokenFromUrl = params.get('access_token') || '';
  const paymentResult = params.get('payment') || '';

  const [settings, setSettings] = useState<SalesSettings>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const [advertiserName, setAdvertiserName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [displaySeconds, setDisplaySeconds] = useState<number>(4);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const [order, setOrder] = useState<OrderData | null>(null);
  const [orderLoading, setOrderLoading] = useState(!!orderIdFromUrl);
  const [orderError, setOrderError] = useState('');

  const [headline, setHeadline] = useState('');
  const [subheadline, setSubheadline] = useState('');
  const [cta, setCta] = useState('Learn More');
  const [style, setStyle] = useState('Premium Marine');
  const [brief, setBrief] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [designError, setDesignError] = useState('');
  const [submittingSelection, setSubmittingSelection] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'advertisingSales'));
        if (snap.exists()) {
          setSettings({ ...DEFAULT_SETTINGS, ...(snap.data() as SalesSettings) });
        }
      } catch (error) {
        console.warn('Unable to load advertising sales settings:', error);
      } finally {
        setSettingsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const loadOrder = async () => {
    if (!orderIdFromUrl || !tokenFromUrl) return;
    try {
      setOrderLoading(true);
      setOrderError('');
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'advertising_get_order',
          orderId: orderIdFromUrl,
          accessToken: tokenFromUrl,
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.success !== true) {
        throw new Error(data?.errorMessage || data?.error || 'Unable to load advertising order.');
      }
      setOrder(data.order);
      setGenerated(Array.isArray(data.order?.generatedBanners) ? data.order.generatedBanners : []);
      setSelected(data.order?.selectedBannerUrl || '');
      if (!advertiserName && data.order?.advertiserName) setAdvertiserName(data.order.advertiserName);
      if (!targetUrl && data.order?.targetUrl) setTargetUrl(data.order.targetUrl);
    } catch (error: any) {
      setOrderError(error?.message || 'Unable to load advertising order.');
    } finally {
      setOrderLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [orderIdFromUrl, tokenFromUrl]);

  useEffect(() => {
    if (!orderIdFromUrl || !tokenFromUrl || paymentResult !== 'success') return;
    if (order?.paymentStatus === 'paid') return;

    const timer = window.setInterval(() => {
      loadOrder();
    }, 1800);

    return () => window.clearInterval(timer);
  }, [orderIdFromUrl, tokenFromUrl, paymentResult, order?.paymentStatus]);

  const price30 = useMemo(() => {
    if (displaySeconds === 4) return Number(settings.price4s30d || 0);
    if (displaySeconds === 6) return Number(settings.price6s30d || 0);
    if (displaySeconds === 8) return Number(settings.price8s30d || 0);
    return Number(settings.price10s30d || 0);
  }, [displaySeconds, settings]);

  const estimatedPrice = useMemo(() => {
    return Math.round((price30 * durationDays / 30) * 100) / 100;
  }, [price30, durationDays]);

  const startCheckout = async () => {
    setCheckoutError('');
    if (!advertiserName.trim() || !contactEmail.trim()) {
      setCheckoutError('Enter your business name and contact email.');
      return;
    }
    if (!targetUrl.trim().startsWith('http://') && !targetUrl.trim().startsWith('https://')) {
      setCheckoutError('Website URL must start with http:// or https://');
      return;
    }
    if (estimatedPrice <= 0) {
      setCheckoutError('Advertising prices are not configured yet.');
      return;
    }

    try {
      setCheckoutLoading(true);
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'advertising_create_checkout',
          advertiserName: advertiserName.trim(),
          contactEmail: contactEmail.trim(),
          targetUrl: targetUrl.trim(),
          displaySeconds,
          durationDays,
          successUrl: `${window.location.origin}/advertise?payment=success`,
          cancelUrl: `${window.location.origin}/advertise?payment=cancelled`,
        }),
      });

      const data = await response.json();
      if (!response.ok || data?.success !== true || !data.checkoutUrl) {
        throw new Error(data?.errorMessage || data?.error || 'Unable to start checkout.');
      }

      window.location.href = data.checkoutUrl;
    } catch (error: any) {
      setCheckoutError(error?.message || 'Unable to start checkout.');
      setCheckoutLoading(false);
    }
  };

  const generateBanners = async () => {
    if (!orderIdFromUrl || !tokenFromUrl || order?.paymentStatus !== 'paid') return;
    if (!headline.trim()) {
      setDesignError('Add a main headline for your banner.');
      return;
    }

    try {
      setGenerating(true);
      setDesignError('');

      const [logoDataUrl, referenceDataUrl] = await Promise.all([
        logoFile ? fileToDataUrl(logoFile) : Promise.resolve(''),
        referenceFile ? fileToDataUrl(referenceFile) : Promise.resolve(''),
      ]);

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'advertising_generate_banner',
          orderId: orderIdFromUrl,
          accessToken: tokenFromUrl,
          advertiserName: order?.advertiserName || advertiserName,
          headline: headline.trim(),
          subheadline: subheadline.trim(),
          cta: cta.trim(),
          style,
          brief: brief.trim(),
          logoDataUrl,
          referenceDataUrl,
        }),
      });

      const data = await response.json();
      if (!response.ok || data?.success !== true) {
        throw new Error(data?.errorMessage || data?.error || 'AI banner generation failed.');
      }

      const urls = Array.isArray(data.bannerUrls) ? data.bannerUrls : [];
      setGenerated(urls);
      setOrder((prev) => prev ? { ...prev, generatedBanners: urls, workflowStatus: 'design_generated' } : prev);
      setSelected('');
    } catch (error: any) {
      setDesignError(error?.message || 'AI banner generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const submitSelection = async () => {
    if (!selected || !orderIdFromUrl || !tokenFromUrl) return;

    try {
      setSubmittingSelection(true);
      setDesignError('');
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'advertising_select_banner',
          orderId: orderIdFromUrl,
          accessToken: tokenFromUrl,
          selectedBannerUrl: selected,
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.success !== true) {
        throw new Error(data?.errorMessage || data?.error || 'Unable to submit banner.');
      }
      setOrder((prev) => prev ? { ...prev, selectedBannerUrl: selected, workflowStatus: 'pending_approval' } : prev);
    } catch (error: any) {
      setDesignError(error?.message || 'Unable to submit banner.');
    } finally {
      setSubmittingSelection(false);
    }
  };

  const paid = order?.paymentStatus === 'paid';
  const awaitingApproval = order?.workflowStatus === 'pending_approval';
  const approved = order?.workflowStatus === 'approved';
  const changesRequested = order?.workflowStatus === 'changes_requested';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-[#0b2d55] to-indigo-700 text-white p-6 sm:p-10 shadow-xl">
        <div className="max-w-3xl">
          <div className="text-[10px] uppercase tracking-[0.28em] font-black text-sky-300 mb-2">ConnectBoat Advertising</div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight">Advertise to boat buyers across ConnectBoat</h1>
          <p className="mt-4 text-slate-200 text-sm sm:text-base">
            Choose your exposure time, pay securely with Stripe, then create your professional banner with AI.
          </p>
        </div>
      </div>

      {!orderIdFromUrl ? (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5 sm:p-7 space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">1. Choose your campaign</h2>
              <p className="text-sm text-slate-500 mt-1">Longer display time gives your banner more attention in each rotation.</p>
            </div>

            <div>
              <p className="text-xs font-black text-slate-600 mb-3">Display time per rotation</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {exposureOptions.map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => setDisplaySeconds(seconds)}
                    className={`rounded-2xl border p-4 text-center transition-all ${
                      displaySeconds === seconds
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <Clock3 className="mx-auto mb-2" size={18} />
                    <div className="text-lg font-black">{seconds}s</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-black text-slate-600 mb-3">Campaign duration</p>
              <div className="grid grid-cols-3 gap-3">
                {durationOptions.map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setDurationDays(days)}
                    className={`rounded-2xl border p-4 text-center transition-all ${
                      durationDays === days
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <CalendarDays className="mx-auto mb-2" size={18} />
                    <div className="font-black">{days} days</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-600 mb-2">Business / advertiser name</label>
                <input value={advertiserName} onChange={(e) => setAdvertiserName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Your business name" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-600 mb-2">Contact email</label>
                <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="you@company.co.uk" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 mb-2">Destination website</label>
              <input type="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://yourcompany.co.uk" />
            </div>

            {checkoutError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm font-bold text-rose-700">{checkoutError}</div>
            )}
          </div>

          <div className="bg-slate-950 text-white rounded-[2rem] border border-slate-800 shadow-xl p-6 h-fit lg:sticky lg:top-24">
            <div className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">Campaign total</div>
            <div className="text-4xl font-black mt-2">
              {settingsLoading ? '—' : `£${estimatedPrice.toFixed(2)}`}
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>{displaySeconds} seconds per rotation</p>
              <p>{durationDays} days</p>
              <p>{settings.aiGenerationsIncluded || 3} AI banner options included</p>
            </div>
            <button
              type="button"
              onClick={startCheckout}
              disabled={checkoutLoading || settings.enabled !== true || estimatedPrice <= 0}
              className="mt-6 w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-700 disabled:text-slate-400 px-5 py-3.5 font-black flex items-center justify-center gap-2"
            >
              <CreditCard size={18} />
              {checkoutLoading ? 'Opening Stripe...' : 'Pay & Create Banner'}
            </button>
            {settings.enabled !== true && !settingsLoading && (
              <p className="mt-3 text-xs text-amber-300 font-bold">Online advertising sales are currently being configured.</p>
            )}
            <div className="mt-5 pt-5 border-t border-slate-800 flex items-start gap-2 text-xs text-slate-400">
              <ShieldCheck size={16} className="shrink-0 text-emerald-400" />
              Secure Stripe payment. Your banner will not go live until ConnectBoat approves the final design.
            </div>
          </div>
        </div>
      ) : orderLoading ? (
        <div className="mt-8 bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-500">Confirming your campaign...</div>
      ) : orderError ? (
        <div className="mt-8 bg-rose-50 rounded-3xl border border-rose-200 p-6 text-rose-700 font-bold">{orderError}</div>
      ) : paymentResult === 'cancelled' && !paid ? (
        <div className="mt-8 bg-amber-50 rounded-3xl border border-amber-200 p-6">
          <h2 className="font-black text-amber-900">Payment cancelled</h2>
          <p className="text-sm text-amber-800 mt-1">No campaign was activated.</p>
        </div>
      ) : !paid ? (
        <div className="mt-8 bg-white rounded-3xl border border-slate-200 p-8 text-center">
          <div className="animate-pulse text-slate-500 font-bold">Waiting for Stripe payment confirmation...</div>
        </div>
      ) : approved ? (
        <div className="mt-8 bg-emerald-50 rounded-3xl border border-emerald-200 p-8 text-center">
          <CheckCircle2 size={48} className="mx-auto text-emerald-600 mb-3" />
          <h2 className="text-2xl font-black text-emerald-900">Your campaign is live</h2>
          <p className="text-sm text-emerald-800 mt-2">ConnectBoat approved your banner and activated the campaign.</p>
        </div>
      ) : awaitingApproval ? (
        <div className="mt-8 bg-indigo-50 rounded-3xl border border-indigo-200 p-8 text-center">
          <CheckCircle2 size={48} className="mx-auto text-indigo-600 mb-3" />
          <h2 className="text-2xl font-black text-indigo-900">Banner submitted for approval</h2>
          <p className="text-sm text-indigo-800 mt-2">Your payment is confirmed. ConnectBoat will review the banner before it goes live.</p>
          {selected && <img src={selected} alt="Selected banner" className="mt-6 w-full max-w-4xl mx-auto rounded-2xl border border-indigo-200 bg-white" />}
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
            <CheckCircle2 className="text-emerald-600 shrink-0" size={22} />
            <div>
              <p className="font-black text-emerald-900">Payment confirmed</p>
              <p className="text-xs text-emerald-800">Now create your banner. It will still require final ConnectBoat approval.</p>
            </div>
          </div>

          {changesRequested && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-black text-amber-900">Changes requested by ConnectBoat</p>
              <p className="text-sm text-amber-800 mt-1">{order?.adminNote || 'Please generate or select a different banner.'}</p>
            </div>
          )}

          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5 sm:p-7 space-y-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-black text-indigo-600">AI Banner Creator</div>
              <h2 className="text-2xl font-black text-slate-900 mt-1">Create your professional banner</h2>
              <p className="text-sm text-slate-500 mt-1">The final output is automatically formatted for the ConnectBoat advertising space.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-600 mb-2">Main headline</label>
                <input value={headline} onChange={(e) => setHeadline(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Make Your Boat Ready to Impress" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-600 mb-2">Call to action</label>
                <input value={cta} onChange={(e) => setCta(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Learn More" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 mb-2">Supporting text</label>
              <input value={subheadline} onChange={(e) => setSubheadline(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Professional service across Southampton and surrounding marinas" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-600 mb-2">Visual style</label>
                <select value={style} onChange={(e) => setStyle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>Premium Marine</option>
                  <option>Clean & Minimal</option>
                  <option>Bold & Modern</option>
                  <option>Luxury</option>
                  <option>Professional Corporate</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-600 mb-2">Logo (optional)</label>
                <label className="w-full px-4 py-3 rounded-xl border border-dashed border-slate-300 flex items-center justify-center gap-2 cursor-pointer text-sm font-bold text-slate-600">
                  <Upload size={16} />
                  {logoFile ? logoFile.name : 'Upload logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 mb-2">Reference image (optional)</label>
              <label className="w-full px-4 py-3 rounded-xl border border-dashed border-slate-300 flex items-center justify-center gap-2 cursor-pointer text-sm font-bold text-slate-600">
                <ImageIcon size={16} />
                {referenceFile ? referenceFile.name : 'Upload a photo to inspire the background'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setReferenceFile(e.target.files?.[0] || null)} />
              </label>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 mb-2">Describe your business / desired look</label>
              <textarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Example: Boat detailing service, premium, navy and white, Southampton..." />
            </div>

            {designError && <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm font-bold text-rose-700">{designError}</div>}

            <button type="button" onClick={generateBanners} disabled={generating}
              className="w-full sm:w-auto rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white px-6 py-3 font-black flex items-center justify-center gap-2">
              <WandSparkles size={18} />
              {generating ? 'AI is creating your banners...' : `Generate ${settings.aiGenerationsIncluded || 3} Options`}
            </button>
          </div>

          {generated.length > 0 && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5 sm:p-7">
              <h3 className="text-xl font-black text-slate-900">Choose your favourite</h3>
              <div className="mt-5 space-y-4">
                {generated.map((url, index) => (
                  <button key={url} type="button" onClick={() => setSelected(url)}
                    className={`block w-full rounded-2xl border-2 overflow-hidden transition-all ${
                      selected === url ? 'border-indigo-500 ring-4 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'
                    }`}>
                    <img src={url} alt={`AI banner option ${index + 1}`} className="w-full h-auto bg-white" />
                  </button>
                ))}
              </div>

              <button type="button" onClick={submitSelection} disabled={!selected || submittingSelection}
                className="mt-6 w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-6 py-3 font-black flex items-center justify-center gap-2">
                <CheckCircle2 size={18} />
                {submittingSelection ? 'Submitting...' : 'Submit Selected Banner for Approval'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
