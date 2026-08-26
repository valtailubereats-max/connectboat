import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CheckCircle2, CreditCard, Upload, Clock3, CalendarDays, ShieldCheck } from 'lucide-react';

type SalesSettings = {
  enabled?: boolean;
  price4s30d?: number;
  price6s30d?: number;
  price8s30d?: number;
  price10s30d?: number;
};

type OrderData = {
  id: string;
  paymentStatus?: string;
  workflowStatus?: string;
  advertiserName?: string;
  targetUrl?: string;
  businessCategory?: string;
  displaySeconds?: number;
  durationDays?: number;
  amountPaid?: number;
  selectedBannerUrl?: string;
  adminProposalUrl?: string;
  adminProposalMessage?: string;
  customerNote?: string;
  adminIntervened?: boolean;
  adminNote?: string;
};

const DEFAULT_SETTINGS: SalesSettings = {
  enabled: false,
  price4s30d: 0,
  price6s30d: 0,
  price8s30d: 0,
  price10s30d: 0,
};

const exposureOptions = [4, 6, 8, 10] as const;
const durationOptions = [7, 14, 30] as const;
const advertisingCategories = [
  'Boats & Yachts', 'Marine Services', 'Marinas', 'Boat Equipment & Electronics',
  'Fishing & Watersports', 'Coastal Hotels & Resorts', 'Waterfront Restaurants & Hospitality',
  'Luxury Travel & Tourism', 'Aviation & Helicopters', 'Marine Property & Real Estate',
  'Insurance & Finance', 'Automotive & Towing', 'Other Marine-Related Business',
] as const;

const STANDARD_RATIO = 16 / 9;
const RATIO_TOLERANCE = 0.025;
const MIN_WIDTH = 1280;
const MIN_HEIGHT = 720;
const MAX_WIDTH = 3840;
const MAX_HEIGHT = 2160;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const readImage = (file: File): Promise<{ image: HTMLImageElement; url: string }> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unable to read this image.')); };
    image.src = url;
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
  const [businessCategory, setBusinessCategory] = useState('');
  const [displaySeconds, setDisplaySeconds] = useState<number>(4);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const [order, setOrder] = useState<OrderData | null>(null);
  const [orderLoading, setOrderLoading] = useState(!!orderIdFromUrl);
  const [orderError, setOrderError] = useState('');

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceWidth, setSourceWidth] = useState(0);
  const [sourceHeight, setSourceHeight] = useState(0);
  const [designError, setDesignError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [customerMessage, setCustomerMessage] = useState('');
  const [reviewingProposal, setReviewingProposal] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'advertisingSales'))
      .then((snap) => { if (snap.exists()) setSettings({ ...DEFAULT_SETTINGS, ...(snap.data() as SalesSettings) }); })
      .catch((error) => console.warn('Unable to load advertising sales settings:', error))
      .finally(() => setSettingsLoading(false));
  }, []);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);

  const loadOrder = async () => {
    if (!orderIdFromUrl || !tokenFromUrl) return;
    try {
      setOrderLoading(true);
      setOrderError('');
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advertising_get_order', orderId: orderIdFromUrl, accessToken: tokenFromUrl }),
      });
      const data = await response.json();
      if (!response.ok || data?.success !== true) throw new Error(data?.errorMessage || data?.error || 'Unable to load advertising order.');
      setOrder(data.order);
      if (!advertiserName && data.order?.advertiserName) setAdvertiserName(data.order.advertiserName);
      if (!targetUrl && data.order?.targetUrl) setTargetUrl(data.order.targetUrl);
      if (!businessCategory && data.order?.businessCategory) setBusinessCategory(data.order.businessCategory);
      if (data.order?.customerNote) setCustomerMessage(data.order.customerNote);
    } catch (error: any) {
      setOrderError(error?.message || 'Unable to load advertising order.');
    } finally { setOrderLoading(false); }
  };

  useEffect(() => { loadOrder(); }, [orderIdFromUrl, tokenFromUrl]);
  useEffect(() => {
    if (!orderIdFromUrl || !tokenFromUrl || paymentResult !== 'success' || order?.paymentStatus === 'paid') return;
    const timer = window.setInterval(loadOrder, 1800);
    return () => window.clearInterval(timer);
  }, [orderIdFromUrl, tokenFromUrl, paymentResult, order?.paymentStatus]);

  const price30 = useMemo(() => displaySeconds === 4 ? Number(settings.price4s30d || 0) : displaySeconds === 6 ? Number(settings.price6s30d || 0) : displaySeconds === 8 ? Number(settings.price8s30d || 0) : Number(settings.price10s30d || 0), [displaySeconds, settings]);
  const estimatedPrice = useMemo(() => Math.round((price30 * durationDays / 30) * 100) / 100, [price30, durationDays]);

  const startCheckout = async () => {
    setCheckoutError('');
    if (!advertiserName.trim() || !contactEmail.trim()) return setCheckoutError('Enter your business name and contact email.');
    if (!businessCategory) return setCheckoutError('Choose your business category.');
    if (!/^https?:\/\//i.test(targetUrl.trim())) return setCheckoutError('Website URL must start with http:// or https://');
    if (estimatedPrice <= 0) return setCheckoutError('Advertising prices are not configured yet.');
    try {
      setCheckoutLoading(true);
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advertising_create_checkout', advertiserName: advertiserName.trim(), contactEmail: contactEmail.trim(), targetUrl: targetUrl.trim(), businessCategory, displaySeconds, durationDays, successUrl: `${window.location.origin}/advertise?payment=success`, cancelUrl: `${window.location.origin}/advertise?payment=cancelled` }),
      });
      const data = await response.json();
      if (!response.ok || data?.success !== true || !data.checkoutUrl) throw new Error(data?.errorMessage || data?.error || 'Unable to start checkout.');
      window.location.href = data.checkoutUrl;
    } catch (error: any) { setCheckoutError(error?.message || 'Unable to start checkout.'); setCheckoutLoading(false); }
  };

  const chooseImage = async (file?: File | null) => {
    if (!file) return;
    setDesignError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setDesignError('Use a PNG, JPG/JPEG or WebP image.');
    if (file.size > MAX_FILE_BYTES) return setDesignError('The image must be 8MB or smaller.');
    try {
      const { image, url } = await readImage(file);
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const ratio = width / Math.max(1, height);
      if (width <= height) { URL.revokeObjectURL(url); return setDesignError(`Vertical images are not accepted. This image is ${width}×${height}px. Please choose a horizontal image.`); }
      if (width < MIN_WIDTH || height < MIN_HEIGHT) { URL.revokeObjectURL(url); return setDesignError(`This image is ${width}×${height}px. Please use a 16:9 image of at least ${MIN_WIDTH}×${MIN_HEIGHT}px.`); }
      if (width > MAX_WIDTH || height > MAX_HEIGHT) { URL.revokeObjectURL(url); return setDesignError(`This image is ${width}×${height}px. Maximum accepted size is ${MAX_WIDTH}×${MAX_HEIGHT}px.`); }
      if (Math.abs(ratio - STANDARD_RATIO) > RATIO_TOLERANCE) { URL.revokeObjectURL(url); return setDesignError(`This image is ${width}×${height}px. Advertising artwork must use the standard 16:9 proportion (for example 1280×720 or 1920×1080).`); }
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      setSourceFile(file); setSourceUrl(url); setSourceWidth(width); setSourceHeight(height);
    } catch (error: any) { setDesignError(error?.message || 'Unable to read this image.'); }
  };

  const submitPreparedBanner = async () => {
    if (!sourceFile || !orderIdFromUrl || !tokenFromUrl || order?.paymentStatus !== 'paid') return;
    if (order?.adminIntervened && !customerMessage.trim()) return setDesignError('Add a short message to ConnectBoat explaining your new version.');
    try {
      setSubmitting(true); setDesignError('');
      const blob = sourceFile;
      const prepareResponse = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advertising_prepare_ready_banner_upload', orderId: orderIdFromUrl, accessToken: tokenFromUrl, fileName: sourceFile.name || 'advertising-artwork.jpg', mimeType: sourceFile.type, fileSize: sourceFile.size, width: sourceWidth, height: sourceHeight }),
      });
      const prepareData = await prepareResponse.json();
      if (!prepareResponse.ok || prepareData?.success !== true || !prepareData.uploadUrl) throw new Error(prepareData?.errorMessage || prepareData?.error || 'Unable to prepare the banner upload.');
      const uploadResponse = await fetch(prepareData.uploadUrl, { method: 'PUT', headers: { 'Content-Type': sourceFile.type }, body: sourceFile });
      if (!uploadResponse.ok) throw new Error(`Banner upload failed (${uploadResponse.status}).`);
      const finalResponse = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advertising_finalize_ready_banner_upload', orderId: orderIdFromUrl, accessToken: tokenFromUrl, objectPath: prepareData.objectPath, customerNote: customerMessage.trim() }),
      });
      const finalData = await finalResponse.json();
      if (!finalResponse.ok || finalData?.success !== true) throw new Error(finalData?.errorMessage || finalData?.error || 'Unable to submit your banner.');
      await loadOrder(); setSourceFile(null); if (sourceUrl) URL.revokeObjectURL(sourceUrl); setSourceUrl('');
    } catch (error: any) { setDesignError(error?.message || 'Unable to submit your banner.'); }
    finally { setSubmitting(false); }
  };

  const reviewAdminProposal = async (decision: 'approve' | 'reject') => {
    if (decision === 'reject' && !customerMessage.trim()) return setDesignError('Tell ConnectBoat what you would like changed.');
    try {
      setReviewingProposal(true); setDesignError('');
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advertising_customer_review_admin_proposal', orderId: orderIdFromUrl, accessToken: tokenFromUrl, decision, customerMessage: customerMessage.trim() }),
      });
      const data = await response.json();
      if (!response.ok || data?.success !== true) throw new Error(data?.errorMessage || data?.error || 'Unable to save your response.');
      await loadOrder();
    } catch (error: any) { setDesignError(error?.message || 'Unable to save your response.'); }
    finally { setReviewingProposal(false); }
  };

  const paid = order?.paymentStatus === 'paid';
  const approved = order?.workflowStatus === 'approved';
  const awaitingApproval = order?.workflowStatus === 'pending_approval';
  const customerReview = order?.workflowStatus === 'customer_review';
  const customerRejected = order?.workflowStatus === 'customer_rejected_admin_proposal';
  const changesRequested = order?.workflowStatus === 'changes_requested';




  return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-[#0b2d55] to-indigo-700 text-white p-6 sm:p-10 shadow-xl">
      <div className="max-w-3xl"><div className="text-[10px] uppercase tracking-[0.28em] font-black text-sky-300 mb-2">ConnectBoat Advertising</div><h1 className="text-3xl sm:text-5xl font-black tracking-tight">Advertise to boat buyers across ConnectBoat</h1><p className="mt-4 text-slate-200 text-sm sm:text-base">Choose your campaign, pay securely, then upload your finished 16:9 advertising image. ConnectBoat will display it without cropping, stretching or adding background.</p></div>
    </div>

    {!orderIdFromUrl ? <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5 sm:p-7 space-y-6">
        <div><h2 className="text-xl font-black text-slate-900">1. Choose your campaign</h2><p className="text-sm text-slate-500 mt-1">Longer display time gives your banner more attention in each rotation.</p></div>
        <div><p className="text-xs font-black text-slate-600 mb-3">Display time per rotation</p><div className="grid grid-cols-4 gap-2 sm:gap-3">{exposureOptions.map((seconds) => <button key={seconds} type="button" onClick={() => setDisplaySeconds(seconds)} className={`rounded-xl sm:rounded-2xl border px-1.5 py-2.5 sm:p-4 text-center ${displaySeconds === seconds ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100' : 'border-slate-200 text-slate-700'}`}><Clock3 className="mx-auto mb-1 sm:mb-2" size={16}/><div className="text-sm sm:text-lg font-black">{seconds}s</div></button>)}</div></div>
        <div><p className="text-xs font-black text-slate-600 mb-3">Campaign duration</p><div className="grid grid-cols-3 gap-3">{durationOptions.map((days) => <button key={days} type="button" onClick={() => setDurationDays(days)} className={`rounded-2xl border p-4 text-center ${durationDays === days ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100' : 'border-slate-200 text-slate-700'}`}><CalendarDays className="mx-auto mb-2" size={18}/><div className="font-black">{days} days</div></button>)}</div></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block text-xs font-black text-slate-600 mb-2">Business / advertiser name</label><input value={advertiserName} onChange={(e) => setAdvertiserName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300" placeholder="Your business name"/></div><div><label className="block text-xs font-black text-slate-600 mb-2">Contact email</label><input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300" placeholder="you@company.co.uk"/></div></div>
        <div><label className="block text-xs font-black text-slate-600 mb-2">Business category</label><select value={businessCategory} onChange={(e) => setBusinessCategory(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white"><option value="">Choose a category</option>{advertisingCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select><p className="text-xs text-slate-500 mt-1">Marine businesses and brands with clear synergy with the ConnectBoat audience.</p></div>
        <div><label className="block text-xs font-black text-slate-600 mb-2">Destination website</label><input type="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300" placeholder="https://yourcompany.co.uk"/></div>
        {checkoutError && <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm font-bold text-rose-700">{checkoutError}</div>}
      </div>
      <div className="bg-slate-950 text-white rounded-[2rem] border border-slate-800 shadow-xl p-6 h-fit"><div className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">Campaign total</div><div className="text-4xl font-black mt-2">{settingsLoading ? '—' : `£${estimatedPrice.toFixed(2)}`}</div><div className="mt-4 space-y-2 text-sm text-slate-300"><p>{displaySeconds} seconds per rotation</p><p>{durationDays} days</p><p>Use standard 16:9 artwork</p></div><button type="button" onClick={startCheckout} disabled={checkoutLoading || settings.enabled !== true || estimatedPrice <= 0} className="mt-6 w-full rounded-xl bg-indigo-500 disabled:bg-slate-700 px-5 py-3.5 font-black flex items-center justify-center gap-2"><CreditCard size={18}/>{checkoutLoading ? 'Opening Stripe...' : 'Pay & Submit Artwork'}</button><div className="mt-5 pt-5 border-t border-slate-800 flex gap-2 text-xs text-slate-400"><ShieldCheck size={16} className="text-emerald-400"/>Your banner only goes live after approval.</div></div>
    </div> : orderLoading ? <div className="mt-8 bg-white rounded-3xl border p-8 text-center text-slate-500">Confirming your campaign...</div> : orderError ? <div className="mt-8 bg-rose-50 rounded-3xl border border-rose-200 p-6 text-rose-700 font-bold">{orderError}</div> : !paid ? <div className="mt-8 bg-white rounded-3xl border p-8 text-center">Waiting for Stripe payment confirmation...</div> : approved ? <div className="mt-8 bg-emerald-50 rounded-3xl border border-emerald-200 p-8 text-center"><CheckCircle2 size={48} className="mx-auto text-emerald-600 mb-3"/><h2 className="text-2xl font-black text-emerald-900">Your campaign is live</h2></div> : customerReview ? <div className="mt-8 bg-white rounded-[2rem] border border-indigo-200 p-5 sm:p-7 space-y-5"><div><div className="text-[10px] uppercase tracking-[0.2em] font-black text-indigo-600">ConnectBoat proposal</div><h2 className="text-2xl font-black text-slate-900 mt-1">Review the revised banner</h2><p className="text-sm text-slate-600 mt-2">{order?.adminProposalMessage}</p></div>{order?.adminProposalUrl && <img src={order.adminProposalUrl} alt="ConnectBoat proposed banner" className="w-full rounded-2xl border"/>}<textarea value={customerMessage} onChange={(e) => setCustomerMessage(e.target.value)} placeholder="Message to ConnectBoat (required if you request changes)" className="w-full min-h-24 rounded-xl border border-slate-300 p-3"/>{designError && <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm font-bold text-rose-700">{designError}</div>}<div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><button onClick={() => reviewAdminProposal('reject')} disabled={reviewingProposal} className="rounded-xl border border-amber-300 bg-amber-50 text-amber-800 px-5 py-3 font-black">Request Changes</button><button onClick={() => reviewAdminProposal('approve')} disabled={reviewingProposal} className="rounded-xl bg-emerald-600 text-white px-5 py-3 font-black">Approve & Publish</button></div></div> : awaitingApproval ? <div className="mt-8 bg-indigo-50 rounded-3xl border border-indigo-200 p-8 text-center"><CheckCircle2 size={48} className="mx-auto text-indigo-600 mb-3"/><h2 className="text-2xl font-black text-indigo-900">Banner submitted for approval</h2><p className="text-sm text-indigo-800 mt-2">ConnectBoat will review it before it goes live.</p>{order?.selectedBannerUrl && <img src={order.selectedBannerUrl} alt="Submitted banner" className="mt-6 w-full rounded-2xl border"/>}</div> : <div className="mt-8 space-y-6">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3"><CheckCircle2 className="text-emerald-600" size={22}/><div><p className="font-black text-emerald-900">Payment confirmed</p><p className="text-xs text-emerald-800">Test your banner as many times as you want before submitting it.</p></div></div>
      {(changesRequested || customerRejected) && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="font-black text-amber-900">Changes requested</p><p className="text-sm text-amber-800 mt-1">{order?.adminNote || order?.adminProposalMessage || 'Please prepare a new version.'}</p>{order?.customerNote && <p className="mt-2 text-xs text-amber-700"><strong>Your last message:</strong> {order.customerNote}</p>}</div>}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5 sm:p-7 space-y-5"><div><div className="text-[10px] uppercase tracking-[0.2em] font-black text-indigo-600">Advertising artwork</div><h2 className="text-2xl font-black text-slate-900 mt-1">Upload your 16:9 image</h2><p className="text-sm text-slate-500 mt-1">Use the common 16:9 format, such as 1280×720 or 1920×1080. Vertical images are not accepted and ConnectBoat will not crop, stretch or add background to your artwork.</p></div>
      <label className="w-full px-4 py-5 rounded-xl border border-dashed border-indigo-300 bg-indigo-50 flex items-center justify-center gap-2 cursor-pointer text-sm font-bold text-slate-700"><Upload size={18}/>{sourceFile ? 'Try another image' : 'Choose 16:9 image'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => chooseImage(e.target.files?.[0])}/></label>
      {sourceUrl && <div className="space-y-3"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950"><img src={sourceUrl} alt="Advertising preview" className="block w-full aspect-video object-contain" /></div><div className="text-xs text-slate-500 text-center">Preview: {sourceWidth}×{sourceHeight}px · nothing has been submitted yet.</div></div>}
      {order?.adminIntervened && <div><label className="block text-xs font-black text-slate-700 mb-2">Message to ConnectBoat</label><textarea value={customerMessage} onChange={(e) => setCustomerMessage(e.target.value)} placeholder="Explain what you changed or what you want the admin to know." className="w-full min-h-24 rounded-xl border border-slate-300 p-3"/></div>}
      {designError && <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm font-bold text-rose-700">{designError}</div>}
      <button type="button" onClick={submitPreparedBanner} disabled={!sourceFile || submitting} className="w-full rounded-xl bg-indigo-600 disabled:bg-slate-300 text-white px-6 py-3.5 font-black flex items-center justify-center gap-2"><CheckCircle2 size={18}/>{submitting ? 'Submitting...' : 'Submit for Approval'}</button></div>
    </div>}
  </div>;
}
