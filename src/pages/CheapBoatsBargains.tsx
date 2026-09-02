import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { Anchor, ArrowRight, Search, ShipWheel } from 'lucide-react';
import { db, getDocsWithCacheFallback } from '../firebase';
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

const normalise = (value: unknown) => String(value ?? '').trim().toLowerCase();

const getNumericPrice = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  // Accept values such as "£1", "1", "£420.00" or "1,000" but reject words.
  if (!/^[£\s]*\d[\d,]*(?:\.\d{1,2})?\s*$/.test(raw)) return null;
  const parsed = Number(raw.replace(/[£,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const isRealCheapBoatForSale = (ad: Ad): { ok: boolean; price: number | null } => {
  const category = normalise(ad.category);
  const listingIntent = normalise((ad as any).listingIntent);
  const title = normalise(ad.title);
  const description = normalise(ad.description);
  const country = normalise(ad.country);
  const price = getNumericPrice(ad.price);

  const exactSaleCategory = category === 'boats for sale';
  const isHire = category === 'boats for hire' || listingIntent === 'hire' || Boolean((ad as any).rentalPrice);
  const isService = category.includes('service') || Boolean((ad as any).serviceCoverage);
  const isRequestPrice =
    (ad as any).priceOnApplication === true ||
    (ad as any).priceOnRequest === true ||
    (ad as any).priceRequiresReview === true ||
    /\b(price|upon)\s+on\s+request\b/.test(`${title} ${description}`) ||
    /\bpoa\b/.test(`${title} ${description}`);

  const active = ad.adStatus === 'active' || !ad.adStatus;
  const ukListing =
    !country ||
    country === 'united kingdom' ||
    country === 'reino unido' ||
    country === 'uk';

  const bargainPrice = price !== null && price >= 0 && price <= 1000;

  return {
    ok:
      exactSaleCategory &&
      !isHire &&
      !isService &&
      !isRequestPrice &&
      active &&
      !ad.isHidden &&
      ukListing &&
      bargainPrice,
    price,
  };
};

const CheapBoats: React.FC = () => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PriceFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    let mounted = true;

    const load = async () => {
      try {
        // IMPORTANT: filter at Firestore level as well as again in the browser.
        // This prevents Hire/Services from ever entering this landing page.
        const q = query(
          collection(db, 'ads'),
          where('status', '==', 'approved'),
          where('category', '==', 'Boats for Sale')
        );

        const snapshot = await getDocsWithCacheFallback(q, 'cheap_boats_sale_only_v3');
        if (!mounted) return;

        const list: Ad[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Ad;
          const validation = isRealCheapBoatForSale(data);
          if (!validation.ok || validation.price === null) return;

          list.push({
            ...data,
            id: docSnap.id,
            price: validation.price,
          });
        });

        list.sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0));
        setAds(list);
      } catch (error) {
        console.error('Error loading cheap boats:', error);
        if (mounted) setAds([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleAds = useMemo(() => {
    const term = search.trim().toLowerCase();

    return ads.filter((ad) => {
      // Final safety check before rendering each card.
      const validation = isRealCheapBoatForSale(ad);
      if (!validation.ok || validation.price === null) return false;

      const price = validation.price;
      if (filter === 'free' && price !== 0) return false;
      if (filter === 'one' && price !== 1) return false;
      if (filter === '500' && price > 500) return false;
      if (filter === '1000' && price > 1000) return false;

      if (!term) return true;
      return [ad.title, ad.description, ad.city, ad.region, (ad as any).county, (ad as any).manufacturer, (ad as any).model]
        .some((value) => normalise(value).includes(term));
    });
  }, [ads, filter, search]);

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Helmet>
        <title>Cheap & Free Boats UK | ConnectBoat</title>
        <meta
          name="description"
          content="Discover free boats, £1 boats and bargain project boats for sale across the United Kingdom on ConnectBoat."
        />
        <link rel="canonical" href="https://connectboat.co.uk/cheap-boats" />
        <meta property="og:title" content="Cheap & Free Boats UK | ConnectBoat" />
        <meta property="og:description" content="Find free, £1 and bargain boats across the UK." />
        <meta property="og:url" content="https://connectboat.co.uk/cheap-boats" />
      </Helmet>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-200">
              <Anchor size={16} /> UK BOAT BARGAINS
            </div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Cheap & Free Boats UK</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Discover free boats, £1 boats and low-cost project boats across the United Kingdom.
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-cyan-300 hover:text-cyan-200"
            >
              Explore all ConnectBoat listings <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bargain boats, locations or brands..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-500"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  filter === item.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 mt-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Current bargains</h2>
            <p className="mt-1 text-sm text-slate-500">
              Only Boats for Sale with a confirmed price from £0 to £1,000 are shown here.
            </p>
          </div>
          {!loading && (
            <span className="shrink-0 text-sm font-semibold text-slate-500">
              {visibleAds.length} found
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-80 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        ) : visibleAds.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleAds.map((ad) => (
              <AdCard key={ad.id} ad={ad} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <ShipWheel className="mx-auto text-slate-400" size={42} />
            <h3 className="mt-4 text-xl font-black text-slate-800">No matching bargain boats right now</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              New free and low-cost boats can appear at any time. Try another filter or explore the main marketplace.
            </p>
            <Link
              to="/"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
            >
              Browse ConnectBoat <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

export default CheapBoats;
