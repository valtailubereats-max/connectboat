import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ExternalLink, ArrowLeft, Globe, Compass, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

interface UsefulLink {
  name: string;
  description: string;
  url: string;
}

interface CategoryLinks {
  category: string;
  icon: string;
  links: UsefulLink[];
}

const MARINE_LINKS: CategoryLinks[] = [
  {
    category: '🛥️ Boat Dealers',
    icon: '🛥️',
    links: [
      {
        name: 'British Marine — Find a Member',
        description: 'Search British Marine member businesses by product, service, brand, keyword or location across the UK.',
        url: 'https://www.britishmarine.co.uk/membership/find-member',
      },
    ],
  },
  {
    category: '⚙️ Marine Parts & Accessories',
    icon: '⚙️',
    links: [
      {
        name: 'British Marine — Find Parts & Equipment Suppliers',
        description: 'Use the British Marine member directory to find marine retailers, distributors and equipment suppliers.',
        url: 'https://www.britishmarine.co.uk/membership/find-member',
      },
    ],
  },
  {
    category: '🔧 Engines & Maintenance',
    icon: '🔧',
    links: [
      {
        name: 'British Marine — Find Marine Services',
        description: 'Search for engine specialists, repair businesses, boatyards, maintenance providers and marine engineers.',
        url: 'https://www.britishmarine.co.uk/membership/find-member',
      },
    ],
  },
  {
    category: '⚓ Marinas & Moorings',
    icon: '⚓',
    links: [
      {
        name: 'British Marine — Find Marinas & Boatyards',
        description: 'Find British Marine member marinas, boatyards and marine facilities throughout the United Kingdom.',
        url: 'https://www.britishmarine.co.uk/membership/find-member',
      },
    ],
  },
  {
    category: '🛡️ Boat Insurance',
    icon: '🛡️',
    links: [
      {
        name: 'British Marine — Find Marine Insurance Services',
        description: 'Search the British Marine member network for marine insurance and related professional services.',
        url: 'https://www.britishmarine.co.uk/membership/find-member',
      },
    ],
  },
  {
    category: '🎓 Training & Licences',
    icon: '🎓',
    links: [
      {
        name: 'RYA Training',
        description: 'Explore RYA boating, sailing, powerboat, navigation, marine radio and safety courses and qualifications.',
        url: 'https://www.rya.org.uk/training',
      },
      {
        name: 'RYA Course Finder',
        description: 'Search RYA courses and training options by activity, level and course type.',
        url: 'https://www.rya.org.uk/course-finder/',
      },
    ],
  },
  {
    category: '📡 Marine Electronics',
    icon: '📡',
    links: [
      {
        name: 'British Marine — Find Marine Electronics Suppliers',
        description: 'Search the British Marine directory for navigation, communications and marine electronics businesses.',
        url: 'https://www.britishmarine.co.uk/membership/find-member',
      },
    ],
  },
  {
    category: '🚚 Transport & Delivery',
    icon: '🚚',
    links: [
      {
        name: 'British Marine — Find Boat Transport Services',
        description: 'Search for marine transport, logistics, lifting and specialist boat movement services in the UK.',
        url: 'https://www.britishmarine.co.uk/membership/find-member',
      },
    ],
  },
  {
    category: '✨ Boat Cleaning & Detailing',
    icon: '✨',
    links: [
      {
        name: 'British Marine — Find Boat Care Services',
        description: 'Search for boat cleaning, valeting, detailing, antifouling and other marine care providers.',
        url: 'https://www.britishmarine.co.uk/membership/find-member',
      },
    ],
  },
  {
    category: '🇬🇧 Useful UK Marine Resources',
    icon: '🇬🇧',
    links: [
      {
        name: 'GOV.UK — Register a Boat',
        description: 'Official UK guidance on boat registration and licensing for inland waterways and use at sea.',
        url: 'https://www.gov.uk/register-a-boat',
      },
      {
        name: 'UK Ship Register',
        description: 'Official information about registering commercial, pleasure, fishing, small and charter vessels in the UK.',
        url: 'https://www.gov.uk/register-a-boat/the-uk-ship-register',
      },
      {
        name: 'British Marine',
        description: 'UK leisure marine trade association and member directory for marine products and services.',
        url: 'https://www.britishmarine.co.uk/',
      },
      {
        name: 'Royal Yachting Association (RYA)',
        description: 'UK boating organisation providing training, safety information, qualifications and boating guidance.',
        url: 'https://www.rya.org.uk/',
      },
    ],
  },
];

export default function Links() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = MARINE_LINKS
    .map((cat) => {
      const query = searchQuery.toLowerCase().trim();

      if (!query) {
        return cat;
      }

      const matchingLinks = cat.links.filter(
        (link) =>
          link.name.toLowerCase().includes(query) ||
          link.description.toLowerCase().includes(query) ||
          cat.category.toLowerCase().includes(query)
      );

      return {
        ...cat,
        links: matchingLinks,
      };
    })
    .filter((cat) => cat.links.length > 0);

  return (
    <div className="max-w-6xl mx-auto py-4 px-2 space-y-8" id="links-page-container">
      <Helmet>
        <title>Marine Directory & Useful UK Links | ConnectBoat</title>
        <meta
          name="description"
          content="Find marine businesses, services, training and useful boating resources across the United Kingdom with ConnectBoat."
        />
        <link rel="canonical" href="https://connectboat.co.uk/links" />
        <meta property="og:url" content="https://connectboat.co.uk/links" />
        <meta property="og:title" content="Marine Directory & Useful UK Links | ConnectBoat" />
        <meta
          property="og:description"
          content="Marine businesses, services, training and useful boating resources across the United Kingdom."
        />
        <meta property="og:image" content="https://connectboat.co.uk/api/og-image" />
        <meta name="twitter:image" content="https://connectboat.co.uk/api/og-image" />
      </Helmet>

      {/* Top Navigation Row */}
      <div className="flex items-center justify-between" id="links-header-row">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors cursor-pointer text-sm"
          id="btn-back-links"
        >
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      {/* Hero Banner Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden shadow-xl border border-slate-100 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white py-12 px-8 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-6"
        id="links-hero-banner"
      >
        <div className="space-y-4 text-center sm:text-left max-w-xl">
          <div
            className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md text-indigo-300 font-black text-[10px] uppercase tracking-wider py-1.5 px-3.5 rounded-full border border-white/10"
            id="hero-badge"
          >
            <Compass size={12} />
            UK Marine Directory
          </div>

          <h1 className="text-3xl sm:text-4xl font-brand font-black tracking-tight" id="hero-title">
            Marine Directory & Useful Links
          </h1>

          <p className="text-slate-300 text-sm max-w-lg leading-relaxed" id="hero-subtitle">
            Find useful marine businesses, services, training and boating resources across the United Kingdom.
          </p>
        </div>

        <div className="text-6xl sm:text-8xl select-none filter drop-shadow-md shrink-0" id="hero-flag">
          ⚓
        </div>
      </motion.div>

      {/* Search Bar Input */}
      <div className="relative max-w-md mx-auto" id="search-links-container">
        <input
          type="text"
          placeholder="Search marine services, categories, resources..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border-2 border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600/50 focus:border-indigo-600 transition-all shadow-md shadow-indigo-50/20"
          id="links-search-input"
        />
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          size={18}
          id="search-links-icon"
        />
      </div>

      {/* Display Grid Categories & Links */}
      {filteredCategories.length === 0 ? (
        <div
          className="bg-white p-16 rounded-3xl text-center border-2 border-dashed border-slate-200"
          id="no-links-found"
        >
          <span className="text-4xl">🔍</span>
          <h3 className="text-lg font-black text-slate-700 mt-4">No links found</h3>
          <p className="text-slate-400 text-xs mt-1">
            Try searching for a different marine service or category.
          </p>
        </div>
      ) : (
        <div className="space-y-12" id="links-grid-blocks">
          {filteredCategories.map((cat, catIdx) => (
            <motion.div
              key={`cat-links-${cat.category}-${catIdx}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: catIdx * 0.05 }}
              className="space-y-4"
              id={`cat-block-${catIdx}`}
            >
              <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                <span className="text-xl shrink-0" id={`cat-icon-${catIdx}`}>
                  {cat.icon}
                </span>
                <h3 className="text-lg font-black text-slate-800" id={`cat-title-${catIdx}`}>
                  {cat.category}
                </h3>
              </div>

              <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                id={`cat-grid-${catIdx}`}
              >
                {cat.links.map((link, linkIdx) => (
                  <div
                    key={`link-item-${linkIdx}-${link.name}`}
                    className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300 flex flex-col justify-between space-y-4"
                    id={`link-card-${catIdx}-${linkIdx}`}
                  >
                    <div className="space-y-2">
                      <h4
                        className="font-bold text-slate-900 group-hover:text-indigo-600 text-sm flex items-center justify-between"
                        id={`link-title-${catIdx}-${linkIdx}`}
                      >
                        <span>{link.name}</span>
                        <Globe size={14} className="text-slate-400 shrink-0 ml-1" />
                      </h4>

                      <p
                        className="text-slate-500 text-xs leading-relaxed"
                        id={`link-desc-${catIdx}-${linkIdx}`}
                      >
                        {link.description}
                      </p>
                    </div>

                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-4 rounded-xl text-xs font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-all border border-indigo-100/50"
                      id={`btn-visit-${catIdx}-${linkIdx}`}
                    >
                      <ExternalLink size={12} />
                      <span>Visit Website</span>
                    </a>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Future partner area */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 text-center shadow-sm">
        <div className="max-w-2xl mx-auto space-y-2">
          <h2 className="text-lg sm:text-xl font-black text-slate-900">
            Marine business in the UK?
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            ConnectBoat will soon offer enhanced directory placements for marine businesses and service providers.
          </p>
        </div>
      </div>
    </div>
  );
}
