import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  CalendarDays,
  MapPin,
  ExternalLink,
  Search,
  Ship,
  Trophy,
  Waves,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';

type EventCategory = 'Boat Shows' | 'Regattas' | 'Marine Events';

type MarineEvent = {
  id: string;
  title: string;
  category: EventCategory;
  startDate: string;
  endDate?: string;
  location: string;
  description: string;
  website: string;
  featured?: boolean;
};

const EVENTS: MarineEvent[] = [
  {
    id: 'southampton-international-boat-show-2026',
    title: 'Southampton International Boat Show',
    category: 'Boat Shows',
    startDate: '2026-09-18',
    endDate: '2026-09-27',
    location: 'Mayflower Park, Southampton',
    description:
      'The UK’s flagship boating and watersports festival, bringing together boats, marine brands, equipment, technology and on-water experiences.',
    website: 'https://www.southamptonboatshow.com/',
    featured: true,
  },
  {
    id: 'silicon-cup-regatta-2026',
    title: 'Silicon Cup Regatta',
    category: 'Regattas',
    startDate: '2026-09-15',
    endDate: '2026-09-16',
    location: 'Ocean Village Marina, Southampton',
    description:
      'Two days of yacht racing, networking and marine hospitality from Ocean Village Marina in Southampton.',
    website: 'https://thesiliconcup.com/event/',
  },
  {
    id: 'global-team-racing-regatta-2026',
    title: 'Global Team Racing Regatta',
    category: 'Regattas',
    startDate: '2026-09-17',
    endDate: '2026-09-20',
    location: 'Cowes, Isle of Wight',
    description:
      'Competitive team racing in Cowes, one of the United Kingdom’s best-known sailing destinations.',
    website: 'https://www.rys.org.uk/events/regattas',
  },
  {
    id: 'rc44-worlds-2026',
    title: 'RC44 Worlds',
    category: 'Regattas',
    startDate: '2026-09-23',
    endDate: '2026-09-27',
    location: 'Cowes, Isle of Wight',
    description:
      'World-class yacht racing hosted in Cowes, bringing high-performance sailing to the Solent.',
    website: 'https://www.rys.org.uk/events/regattas',
  },
  {
    id: 'asto-small-ships-race-2026',
    title: 'ASTO Small Ships Race',
    category: 'Marine Events',
    startDate: '2026-10-03',
    location: 'Cowes, Isle of Wight',
    description:
      'A sailing event in the Solent calendar bringing small ships and crews together for competition on the water.',
    website: 'https://www.rys.org.uk/events/regattas',
  },
  {
    id: 'j70-grand-slam-2026',
    title: 'J/70 Grand Slam',
    category: 'Regattas',
    startDate: '2026-10-03',
    endDate: '2026-10-04',
    location: 'Cowes, Isle of Wight',
    description:
      'A weekend of competitive J/70 racing in the waters around Cowes and the Solent.',
    website: 'https://www.rys.org.uk/events/regattas',
  },
];

const FILTERS = ['All Events', 'Boat Shows', 'Regattas', 'Marine Events'] as const;

const formatDate = (startDate: string, endDate?: string) => {
  const start = new Date(`${startDate}T12:00:00`);
  const end = endDate ? new Date(`${endDate}T12:00:00`) : undefined;

  const short = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  });

  const full = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (!end) return full.format(start);

  if (start.getFullYear() === end.getFullYear()) {
    return `${short.format(start)} – ${full.format(end)}`;
  }

  return `${full.format(start)} – ${full.format(end)}`;
};

const categoryIcon = (category: EventCategory) => {
  if (category === 'Boat Shows') return Ship;
  if (category === 'Regattas') return Trophy;
  return Waves;
};

export default function Fotos() {
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>('All Events');
  const [searchTerm, setSearchTerm] = useState('');

  const visibleEvents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return EVENTS.filter((event) => {
      const matchesFilter = activeFilter === 'All Events' || event.category === activeFilter;
      const matchesSearch =
        !query ||
        event.title.toLowerCase().includes(query) ||
        event.location.toLowerCase().includes(query) ||
        event.category.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    }).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [activeFilter, searchTerm]);

  const featuredEvent = EVENTS.find((event) => event.featured);

  return (
    <div className="min-h-screen bg-slate-50/60" id="pagina-marine-events">
      <Helmet>
        <title>Marine Events UK | ConnectBoat</title>
        <meta
          name="description"
          content="Discover upcoming boat shows, regattas and marine events across the UK with ConnectBoat."
        />
        <link rel="canonical" href="https://connectboat.co.uk/photos" />
        <meta property="og:url" content="https://connectboat.co.uk/photos" />
        <meta property="og:title" content="Marine Events UK | ConnectBoat" />
        <meta
          property="og:description"
          content="Discover boat shows, regattas and marine events across the UK."
        />
        <meta property="og:image" content="https://connectboat.co.uk/api/og-image" />
        <meta name="twitter:image" content="https://connectboat.co.uk/api/og-image" />
      </Helmet>

      <section className="relative overflow-hidden bg-[#0c223f] text-white">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full border border-white/20" />
          <div className="absolute top-16 right-24 w-52 h-52 rounded-full border border-white/10" />
          <div className="absolute -bottom-28 left-10 w-72 h-72 rounded-full border border-white/10" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-18">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] mb-5">
              <CalendarDays size={16} />
              ConnectBoat Events
            </div>

            <h1 className="font-brand text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight">
              Marine Events
            </h1>

            <p className="mt-4 text-base sm:text-lg text-slate-200 font-medium leading-relaxed max-w-2xl">
              Discover boat shows, regattas and marine events across the UK.
              Find your next reason to get closer to the water.
            </p>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {featuredEvent && (
          <motion.article
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[2rem] bg-white border border-slate-200 shadow-sm mb-8"
          >
            <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
              <div className="bg-gradient-to-br from-[#0c223f] to-[#173d69] p-8 sm:p-10 text-white min-h-[260px] flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest">
                    <Sparkles size={14} />
                    Featured Event
                  </div>

                  <div className="mt-7 text-5xl sm:text-6xl font-black tracking-tight">
                    {new Date(`${featuredEvent.startDate}T12:00:00`).getDate()}
                  </div>
                  <div className="text-sm font-black uppercase tracking-[0.2em] text-slate-300">
                    {new Date(`${featuredEvent.startDate}T12:00:00`).toLocaleDateString('en-GB', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-200 font-semibold mt-8">
                  <MapPin size={17} />
                  {featuredEvent.location}
                </div>
              </div>

              <div className="p-8 sm:p-10 flex flex-col justify-center">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-pt-green">
                  {featuredEvent.category}
                </p>
                <h2 className="mt-2 text-2xl sm:text-3xl font-brand font-black text-slate-900">
                  {featuredEvent.title}
                </h2>
                <p className="mt-3 text-sm font-bold text-slate-500">
                  {formatDate(featuredEvent.startDate, featuredEvent.endDate)}
                </p>
                <p className="mt-5 text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
                  {featuredEvent.description}
                </p>

                <div className="mt-7">
                  <a
                    href={featuredEvent.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 bg-[#0c223f] hover:bg-[#14365f] text-white rounded-xl px-5 py-3 text-sm font-black transition-colors"
                  >
                    View Event
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>
            </div>
          </motion.article>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                    activeFilter === filter
                      ? 'bg-[#0c223f] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="relative w-full lg:w-80">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search events or locations..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#0c223f]/10 focus:border-[#0c223f]"
              />
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-pt-green">
              Calendar
            </p>
            <h2 className="text-2xl font-brand font-black text-slate-900 mt-1">
              Upcoming Events
            </h2>
          </div>
          <p className="text-xs font-bold text-slate-400">
            {visibleEvents.length} {visibleEvents.length === 1 ? 'event' : 'events'}
          </p>
        </div>

        {visibleEvents.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-[2rem] py-16 px-6 text-center">
            <CalendarDays size={36} className="mx-auto text-slate-300 mb-4" />
            <h3 className="font-brand font-black text-slate-900 text-xl">No events found</h3>
            <p className="text-sm text-slate-500 font-medium mt-2">
              Try another category or search term.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {visibleEvents.map((event) => {
              const Icon = categoryIcon(event.category);
              const start = new Date(`${event.startDate}T12:00:00`);

              return (
                <motion.article
                  layout
                  key={event.id}
                  className="bg-white rounded-[1.6rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
                >
                  <div className="p-6 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-[#0c223f] text-white flex flex-col items-center justify-center shrink-0">
                        <span className="text-xl leading-none font-black">{start.getDate()}</span>
                        <span className="text-[9px] mt-1 uppercase tracking-widest font-black text-slate-300">
                          {start.toLocaleDateString('en-GB', { month: 'short' })}
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[10px] uppercase tracking-wider font-black text-slate-600">
                        <Icon size={13} />
                        {event.category}
                      </div>
                    </div>

                    <h3 className="mt-5 text-lg font-brand font-black text-slate-900 leading-snug">
                      {event.title}
                    </h3>

                    <div className="mt-3 space-y-2">
                      <div className="flex items-start gap-2 text-xs font-bold text-slate-500">
                        <CalendarDays size={15} className="shrink-0 mt-0.5" />
                        <span>{formatDate(event.startDate, event.endDate)}</span>
                      </div>
                      <div className="flex items-start gap-2 text-xs font-bold text-slate-500">
                        <MapPin size={15} className="shrink-0 mt-0.5" />
                        <span>{event.location}</span>
                      </div>
                    </div>

                    <p className="mt-4 text-sm text-slate-500 font-medium leading-relaxed">
                      {event.description}
                    </p>
                  </div>

                  <div className="px-6 pb-6">
                    <a
                      href={event.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 hover:border-[#0c223f] hover:bg-slate-50 text-slate-800 py-3 text-sm font-black transition-all"
                    >
                      View Event
                      <ExternalLink size={15} />
                    </a>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}

        <div className="mt-10 rounded-[2rem] bg-white border border-slate-200 p-7 sm:p-8 text-center">
          <Ship size={30} className="mx-auto text-pt-green mb-3" />
          <h2 className="font-brand font-black text-slate-900 text-xl">
            Organising a marine event?
          </h2>
          <p className="mt-2 text-sm text-slate-500 font-medium max-w-xl mx-auto">
            ConnectBoat is building a dedicated place for the UK marine community to discover
            events. Event submissions and featured placements are coming next.
          </p>
        </div>
      </main>
    </div>
  );
}
