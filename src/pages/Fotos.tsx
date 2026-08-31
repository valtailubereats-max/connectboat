import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  CalendarDays,
  ExternalLink,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Star,
  Ticket,
} from 'lucide-react';
import { db } from '../firebase';

type EventPlan = 'standard' | 'featured' | 'premium';
type EventStatus = 'draft' | 'published' | 'ended';
type EventCategory = 'Boat Shows' | 'Regattas' | 'Marine Events' | 'Festivals' | 'Other';

type MarineEvent = {
  id: string;
  title: string;
  description?: string;
  category: EventCategory;
  startDate: string;
  endDate?: string;
  country?: string;
  city: string;
  venue?: string;
  website?: string;
  ticketUrl?: string;
  imageUrl?: string;
  plan: EventPlan;
  status: EventStatus;
  active: boolean;
};

const FILTERS = ['All Events', 'Boat Shows', 'Regattas', 'Marine Events', 'Festivals'] as const;

const planPriority: Record<EventPlan, number> = {
  premium: 3,
  featured: 2,
  standard: 1,
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateRange = (startDate: string, endDate?: string) => {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  return end && end !== start ? `${start} – ${end}` : start;
};

export default function Fotos() {
  const [events, setEvents] = useState<MarineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<(typeof FILTERS)[number]>('All Events');
  const [search, setSearch] = useState('');

  useEffect(() => {
    document.title = 'Marine Events | ConnectBoat';

    const loadEvents = async () => {
      setLoading(true);
      try {
        const eventsQuery = query(
          collection(db, 'marineEvents'),
          where('active', '==', true),
          where('status', '==', 'published')
        );

        const snapshot = await getDocs(eventsQuery);
        const list = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as MarineEvent[];

        list.sort((a, b) => {
          const planDifference =
            (planPriority[b.plan || 'standard'] || 1) -
            (planPriority[a.plan || 'standard'] || 1);

          if (planDifference !== 0) return planDifference;
          return (a.startDate || '').localeCompare(b.startDate || '');
        });

        setEvents(list);
      } catch (error) {
        console.error('Error loading public Marine Events:', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  const visibleEvents = useMemo(() => {
    const term = search.trim().toLowerCase();

    return events.filter((event) => {
      const matchesCategory =
        selectedFilter === 'All Events' || event.category === selectedFilter;

      const searchableText = [
        event.title,
        event.description,
        event.category,
        event.city,
        event.venue,
        event.country,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesCategory && (!term || searchableText.includes(term));
    });
  }, [events, search, selectedFilter]);

  const featuredEvent = visibleEvents.find((event) => event.plan === 'premium') || null;
  const remainingEvents = featuredEvent
    ? visibleEvents.filter((event) => event.id !== featuredEvent.id)
    : visibleEvents;

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_#38bdf8,_transparent_40%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-sky-300 text-xs font-black uppercase tracking-[0.2em]">
              <CalendarDays size={17} />
              ConnectBoat
            </div>
            <h1 className="mt-4 text-4xl sm:text-5xl font-black tracking-tight">
              Marine Events
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
              Discover boat shows, regattas and marine events across the UK and beyond.
            </p>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-black transition ${
                    selectedFilter === filter
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="relative w-full lg:w-80">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search marine events..."
                className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:border-sky-500 bg-white"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="min-h-[360px] flex flex-col items-center justify-center">
            <Loader2 size={38} className="animate-spin text-sky-600" />
            <p className="mt-4 text-sm font-bold text-slate-500">Loading Marine Events...</p>
          </div>
        ) : visibleEvents.length === 0 ? (
          <div className="mt-8 bg-white border border-slate-200 rounded-3xl py-16 px-6 text-center shadow-sm">
            <CalendarDays size={42} className="mx-auto text-slate-300" />
            <h2 className="mt-4 text-xl font-black text-slate-900">No events found</h2>
            <p className="mt-2 text-sm text-slate-500">
              Try another category or search term.
            </p>
          </div>
        ) : (
          <>
            {featuredEvent && (
              <section className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={20} className="text-amber-500" />
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                    Featured Event
                  </h2>
                </div>

                <article className="overflow-hidden bg-white border border-amber-200 rounded-3xl shadow-sm grid lg:grid-cols-[1.05fr_1fr]">
                  <div className="min-h-64 lg:min-h-[390px] bg-slate-100">
                    {featuredEvent.imageUrl ? (
                      <img
                        src={featuredEvent.imageUrl}
                        alt={featuredEvent.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full min-h-64 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 text-white">
                        <CalendarDays size={70} className="opacity-70" />
                      </div>
                    )}
                  </div>

                  <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-wider font-black">
                        <Sparkles size={13} />
                        Premium
                      </span>
                      <span className="bg-sky-50 text-sky-700 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-wider font-black">
                        {featuredEvent.category}
                      </span>
                    </div>

                    <h3 className="mt-5 text-2xl sm:text-3xl font-black text-slate-950 leading-tight">
                      {featuredEvent.title}
                    </h3>

                    <div className="mt-5 space-y-3 text-sm font-bold text-slate-600">
                      <div className="flex items-start gap-2">
                        <CalendarDays size={18} className="text-sky-600 shrink-0 mt-0.5" />
                        <span>{formatDateRange(featuredEvent.startDate, featuredEvent.endDate)}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin size={18} className="text-sky-600 shrink-0 mt-0.5" />
                        <span>
                          {[featuredEvent.venue, featuredEvent.city, featuredEvent.country]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    </div>

                    {featuredEvent.description && (
                      <p className="mt-5 text-slate-600 leading-relaxed">
                        {featuredEvent.description}
                      </p>
                    )}

                    <div className="mt-7 flex flex-wrap gap-3">
                      {featuredEvent.website && (
                        <a
                          href={featuredEvent.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-5 py-3 text-sm font-black"
                        >
                          View Event
                          <ExternalLink size={16} />
                        </a>
                      )}
                      {featuredEvent.ticketUrl && (
                        <a
                          href={featuredEvent.ticketUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl px-5 py-3 text-sm font-black"
                        >
                          <Ticket size={16} />
                          Tickets
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              </section>
            )}

            {remainingEvents.length > 0 && (
              <section className="mt-10">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                      Upcoming Events
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 font-medium">
                      Explore upcoming events from the marine community.
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {remainingEvents.map((event) => (
                    <article
                      key={event.id}
                      className={`bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col ${
                        event.plan === 'featured'
                          ? 'border-2 border-indigo-200'
                          : 'border border-slate-200'
                      }`}
                    >
                      <div className="aspect-[16/9] bg-slate-100 overflow-hidden relative">
                        {event.imageUrl ? (
                          <img
                            src={event.imageUrl}
                            alt={event.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
                            <CalendarDays size={48} />
                          </div>
                        )}

                        {event.plan === 'featured' && (
                          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-white/95 text-indigo-700 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-wider font-black shadow-sm">
                            <Star size={12} />
                            Featured
                          </span>
                        )}
                      </div>

                      <div className="p-5 flex-1 flex flex-col">
                        <div className="text-[11px] uppercase tracking-wider font-black text-sky-700">
                          {event.category}
                        </div>
                        <h3 className="mt-2 text-lg font-black text-slate-900 leading-snug">
                          {event.title}
                        </h3>

                        <div className="mt-4 space-y-2 text-xs font-bold text-slate-500">
                          <div className="flex items-start gap-2">
                            <CalendarDays size={15} className="shrink-0 text-sky-600" />
                            <span>{formatDateRange(event.startDate, event.endDate)}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin size={15} className="shrink-0 text-sky-600" />
                            <span>
                              {[event.venue, event.city, event.country]
                                .filter(Boolean)
                                .join(', ')}
                            </span>
                          </div>
                        </div>

                        {event.description && (
                          <p className="mt-4 text-sm text-slate-500 leading-relaxed line-clamp-3">
                            {event.description}
                          </p>
                        )}

                        <div className="mt-auto pt-5 flex gap-2">
                          {event.website && (
                            <a
                              href={event.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-4 py-2.5 text-xs font-black"
                            >
                              View Event
                              <ExternalLink size={14} />
                            </a>
                          )}
                          {event.ticketUrl && (
                            <a
                              href={event.ticketUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl px-4 py-2.5 text-xs font-black"
                            >
                              <Ticket size={14} />
                              Tickets
                            </a>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
