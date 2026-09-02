import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Anchor, ArrowRight, Search, ShipWheel } from 'lucide-react';
import { db } from '../firebase';
import { Ad } from '../types';
import AdCard from '../components/AdCard';

type PriceFilter = 'all' | 'free' | 'one' | '500' | '1000';

const FILTERS: { id: PriceFilter; label: string }[] = [
  { id: 'all', label: 'All Bargains' },
  { id: 'free', label: 'Free Boats' },
  { id: 'one', label: '£1 Boats' },
  { id: '500', label: 'Under £500' },
  { id: '1000', label: 'Under £1,000' },
];

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();

const numericPrice = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw || !/^[£\s]*\d[\d,]*(?:\.\d{1,2})?\s*$/.test(raw)) return null;
  const n = Number(raw.replace(/[£,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const classify = (ad: Ad) => {
  const category = norm(ad.category);
  const title = norm(ad.title);
  const description = norm(ad.description);
  const country = norm(ad.country);
  const price = numericPrice(ad.price);

  const explicitFree =
    (ad as any).isFree === true ||
    (ad as any).free === true ||
    norm((ad as any).priceType) === 'free' ||
    /^free\b/.test(title) ||
    /\bfree boat\b/.test(title);

  const requestPrice =
    (ad as any).priceOnRequest === true ||
    (ad as any).priceOnApplication === true ||
    norm((ad as any).priceType).includes('request') ||
    norm((ad as any).priceType) === 'poa' ||
    /\bpoa\b|\bprice on request\b|\bupon request\b/.test(`${title} ${description}`);

  const validSale = category === 'boats for sale';
  const validUk = !country || ['uk', 'united kingdom', 'reino unido', 'england', 'scotland', 'wales', 'northern ireland'].includes(country);
  const active = !ad.isHidden && (ad.adStatus === 'active' || !ad.adStatus);

  const paidBargain = price !== null && price > 0 && price <= 1000;
  const freeBargain = price === 0 && explicitFree;

  return {
    ok: validSale && validUk && active && !requestPrice && (paidBargain || freeBargain),
    price,
    free: freeBargain,
  };
};

const CheapBoatsFinal: React.FC = () => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PriceFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    let mounted = true;

    const load = async () => {
      try {
        // Direct Firestore read: no app cache/fallback for this campaign page.
        const q = query(
          collection(db, 'ads'),
          where('status', '==', 'approved'),
          where('category', '==', 'Boats for Sale')
        );
        const snapshot = await getDocs(q);
        if (!mounted) return;

        const clean: Ad[] = [];
        snapshot.forEach((docSnap) => {
          const raw = { ...(docSnap.data() as Ad), id: docSnap.id } as Ad;
          const c = classify(raw);
          if (!c.ok || c.price === null) return;

          // Sanitize what AdCard receives so its displayed price matches this page's filter.
          clean.push({
            ...raw,
            price: c.price,
            priceOnRequest: false,
            ...(c.free ? { donationBadge: true } : {}),
          } as Ad);
        });

        clean.sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0));
        setAds(clean);
      } catch (error) {
        console.error('Cheap boats load failed:', error);
        if (mounted) setAds([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  const visibleAds = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ads.filter((ad) => {
      const c = classify(ad);
      if (!c.ok || c.price === null) return false;
      const price = c.price;

      if (filter === 'free' && price !== 0) return false;
      if (filter === 'one' && price !== 1) return false;
      if (filter === '500' && price > 500) return false;
      if (filter === '1000' && price > 1000) return false;

      if (!term) return true;
      return [ad.title, ad.description, ad.city, ad.region, (ad as any).county, (ad as any).manufacturer, (ad as any).model]
        .some((v) => norm(v).includes(term));
    });
  }, [ads, filter, search]);

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Helmet>
        <title>Cheap & Free Boats UK | ConnectBoat</title>
        <meta name="description" content="Discover free boats, £1 boats and bargain project boats for sale across the United Kingdom on ConnectBoat." />
        <link rel="canonical" href="https://connectboat.co.uk/cheap-boats" />
      </Helmet>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-200">
              <Anchor size={16} /> UK BOAT BARGAINS
            </div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Cheap & Free Boats UK</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Discover free boats, £1 boats and low-cost project boats across the United Kingdom.</p>
            <Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-cyan-300 hover:text-cyan-200">
              Explore all ConnectBoat listings <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bargain boats, locations or brands..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-500" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`rounded-full px-4 py-2 text-sm font-bold transition ${filter === item.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{item.label}</button>
            ))}
          </div>
        </div>

        <div className="mb-5 mt-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Current bargains</h2>
            <p className="mt-1 text-sm text-slate-500">Only boats with a confirmed displayed price from Free to £1,000 are shown here.</p>
          </div>
          {!loading && <span className="shrink-0 text-sm font-semibold text-slate-500">{visibleAds.length} found</span>}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0,1,2].map(i => <div key={i} className="h-80 animate-pulse rounded-2xl bg-slate-200" />)}</div>
        ) : visibleAds.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{visibleAds.map(ad => <AdCard key={ad.id} ad={ad} />)}</div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <ShipWheel className="mx-auto text-slate-400" size={42} />
            <h3 className="mt-4 text-xl font-black text-slate-800">No matching bargain boats right now</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">New free and low-cost boats can appear at any time. Try another filter or explore the main marketplace.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default CheapBoatsFinal;
