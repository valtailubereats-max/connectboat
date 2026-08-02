import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { ExternalLink, ArrowLeft, Globe, MapPin, Compass, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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

const UK_LINKS: CategoryLinks[] = [
  {
    category: '🛂 Immigration',
    icon: '🛂',
    links: [
      {
        name: 'GOV.UK Visas and Immigration',
        description: 'Official British government portal for visas, residence, and citizenship applications in the UK.',
        url: 'https://www.gov.uk/browse/visas-immigration',
      },
      {
        name: 'Office of the Immigration Services Commissioner (OISC)',
        description: 'Public body regulating immigration advisers to ensure safe, lawful advice.',
        url: 'https://www.gov.uk/government/organisations/office-of-the-immigration-services-commissioner',
      },
      {
        name: 'Migrant Help',
        description: 'UK charity offering free advice and support to migrants and refugees.',
        url: 'https://www.migranthelpuk.org/',
      }
    ]
  },
  {
    category: '💼 Employment',
    icon: '💼',
    links: [
      {
        name: 'Indeed UK',
        description: 'The UK\'s largest job site for finding employment opportunities across all sectors.',
        url: 'https://uk.indeed.com/',
      },
      {
        name: 'LinkedIn UK',
        description: 'Leading professional network for connecting with recruiters and applying for corporate roles.',
        url: 'https://www.linkedin.com/',
      },
      {
        name: 'National Careers Service',
        description: 'Government portal providing free careers advice, CV assistance, and skills guidance.',
        url: 'https://nationalcareersservice.direct.gov.uk/',
      }
    ]
  },
  {
    category: '🏠 Housing',
    icon: '🏠',
    links: [
      {
        name: 'Rightmove',
        description: 'The UK\'s leading property portal for renting or buying homes.',
        url: 'https://www.rightmove.co.uk/',
      },
      {
        name: 'Zoopla',
        description: 'Property search engine for market valuations, homes for sale, and rental properties.',
        url: 'https://www.zoopla.co.uk/',
      }
    ]
  },
  {
    category: '💰 Finance',
    icon: '💰',
    links: [
      {
        name: 'HM Revenue & Customs (HMRC)',
        description: 'UK tax authority. Used for managing National Insurance Numbers (NINo) and taxes.',
        url: 'https://www.gov.uk/government/organisations/hm-revenue-customs',
      },
      {
        name: 'Wise',
        description: 'Leading international transfer service offering competitive exchange rates between GBP and EUR.',
        url: 'https://wise.com/',
      }
    ]
  },
  {
    category: '🏥 Health',
    icon: '🏥',
    links: [
      {
        name: 'National Health Service (NHS)',
        description: 'Official UK public healthcare portal. Find your local GP surgery or medical services.',
        url: 'https://www.nhs.uk/',
      }
    ]
  },
  {
    category: '🚗 Vehicles',
    icon: '🚗',
    links: [
      {
        name: 'DVLA',
        description: 'Driver and Vehicle Licensing Agency. Essential for vehicle registration and driving licences.',
        url: 'https://www.gov.uk/government/organisations/driver-and-vehicle-licensing-agency',
      }
    ]
  },
  {
    category: '⚖️ Legal Support',
    icon: '⚖️',
    links: [
      {
        name: 'Citizens Advice',
        description: 'Independent charity offering free, confidential advice on employment rights, debt, and housing.',
        url: 'https://www.citizensadvice.org.uk/',
      }
    ]
  },
  {
    category: '🏛️ Government',
    icon: '🏛️',
    links: [
      {
        name: 'GOV.UK',
        description: 'The central official portal for all UK government services and public departments.',
        url: 'https://www.gov.uk/',
      }
    ]
  }
];

const PT_LINKS: CategoryLinks[] = [
  {
    category: '🛂 Immigration',
    icon: '🛂',
    links: [
      {
        name: 'Agência para a Integração, Migrações e Asilo (AIMA)',
        description: 'Portuguese government agency responsible for entry, stay, asylum, and migration matters.',
        url: 'https://aima.gov.pt/',
      },
      {
        name: 'Centros Locais de Apoio à Integração de Migrantes (CLAIM)',
        description: 'National network supporting migrant integration in local communities across Portugal.',
        url: 'https://www.acm.gov.pt/-/claim-centros-locais-de-apoio-a-integracao-de-migrantes',
      },
      {
        name: 'Centros Nacionais de Apoio à Integração de Migrantes (CNAIM)',
        description: 'Integrated public service centres providing support to immigrants in Lisbon, Porto, Algarve, and Beja.',
        url: 'https://www.acm.gov.pt/-/cnaim-centros-nacionais-de-apoio-a-integracao-de-migrantes',
      }
    ]
  },
  {
    category: '💼 Employment',
    icon: '💼',
    links: [
      {
        name: 'Instituto do Emprego e Formação Profissional (IEFP)',
        description: 'Public employment service providing job placement, training, and hiring assistance.',
        url: 'https://www.iefp.pt/',
      },
      {
        name: 'LinkedIn Portugal',
        description: 'Essential professional tool to expand networking and find job offers in Portugal.',
        url: 'https://www.linkedin.com/',
      }
    ]
  },
  {
    category: '🏠 Housing',
    icon: '🏠',
    links: [
      {
        name: 'Idealista Portugal',
        description: 'The largest property portal in Portugal for buying, selling, or renting properties.',
        url: 'https://www.idealista.pt/',
      },
      {
        name: 'Imovirtual',
        description: 'Popular online platform for property classifieds, homes for sale, and rentals.',
        url: 'https://www.imovirtual.com/',
      }
    ]
  },
  {
    category: '💰 Finance',
    icon: '💰',
    links: [
      {
        name: 'Portal das Finanças',
        description: 'Official tax authority portal (AT) to manage NIF tax numbers, IRS tax declarations, and invoices.',
        url: 'https://www.portaldasfinancas.gov.pt/',
      },
      {
        name: 'Segurança Social Direta',
        description: 'Official portal for Social Security (NISS), contribution history, and social benefits.',
        url: 'https://direta.seg-social.pt/',
      }
    ]
  },
  {
    category: '🏥 Health',
    icon: '🏥',
    links: [
      {
        name: 'SNS 24',
        description: 'Official Portuguese National Health Service (SNS) portal for triage, appointments, and medical guides.',
        url: 'https://www.sns24.gov.pt/',
      }
    ]
  },
  {
    category: '🚗 Vehicles',
    icon: '🚗',
    links: [
      {
        name: 'Instituto da Mobilidade e dos Transportes (IMT)',
        description: 'Institute for Mobility and Transport. Authority for driving licences, vehicle registration, and conversions.',
        url: 'https://www.imt-ip.pt/',
      }
    ]
  },
  {
    category: '⚖️ Legal Support',
    icon: '⚖️',
    links: [
      {
        name: 'Justiça.gov.pt',
        description: 'Central portal for nationality requests, legal acts, civil, commercial, and property registries.',
        url: 'https://justica.gov.pt/',
      }
    ]
  },
  {
    category: '🏛️ Government',
    icon: '🏛️',
    links: [
      {
        name: 'Portal do Cidadão (ePortugal)',
        description: 'Single point of contact for citizens and businesses to access online public services in Portugal.',
        url: 'https://eportugal.gov.pt/',
      }
    ]
  }
];

export default function Links() {
  const navigate = useNavigate();
  const [activeCountry, setActiveCountry] = useState<'Portugal' | 'Reino Unido'>('Reino Unido');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync with global user-selected country
  useEffect(() => {
    const saved = localStorage.getItem('selectedCountry') as 'Portugal' | 'Reino Unido' | null;
    if (saved === 'Reino Unido') {
      setActiveCountry(saved);
    } else {
      setActiveCountry('Reino Unido');
    }
  }, []);

  const linksData = activeCountry === 'Portugal' ? PT_LINKS : UK_LINKS;

  // Search filter
  const filteredCategories = linksData
    .map((cat) => {
      const matchingLinks = cat.links.filter(
        (link) =>
          link.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          link.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cat.category.toLowerCase().includes(searchQuery.toLowerCase())
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
        <title>Useful Marine & UK Resources | ConnectBoat</title>
        <meta name="description" content="Official directory of UK marine, maritime, and public service resources provided by ConnectBoat." />
        <link rel="canonical" href="https://connectboat.co.uk/links" />
        <meta property="og:url" content="https://connectboat.co.uk/links" />
        <meta property="og:title" content="Useful Links | ConnectBoat" />
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

        {/* Country Picker Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200" id="tabs-country-links">
          <button
            onClick={() => {
              setActiveCountry('Portugal');
              localStorage.setItem('selectedCountry', 'Portugal');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCountry === 'Portugal'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            id="tab-portugal"
          >
            <span>🇵🇹</span> Portugal
          </button>
          <button
            onClick={() => {
              setActiveCountry('Reino Unido');
              localStorage.setItem('selectedCountry', 'Reino Unido');
            }}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCountry === 'Reino Unido'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            id="tab-uk"
          >
            <span>🇬🇧</span> United Kingdom
          </button>
        </div>
      </div>

      {/* Hero Banner Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden shadow-xl border border-slate-100 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white py-12 px-8 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-6"
        id="links-hero-banner"
      >
        <div className="space-y-4 text-center sm:text-left max-w-xl">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md text-indigo-300 font-black text-[10px] uppercase tracking-wider py-1.5 px-3.5 rounded-full border border-white/10" id="hero-badge">
            <Compass size={12} />
            Marine & Community Guide
          </div>
          <h1 className="text-3xl sm:text-4xl font-brand font-black tracking-tight" id="hero-title">
            Useful Links ({activeCountry === 'Portugal' ? 'Portugal 🇵🇹' : 'United Kingdom 🇬🇧'})
          </h1>
          <p className="text-slate-300 text-sm max-w-lg leading-relaxed" id="hero-subtitle">
            A curated collection of official government portals, marine organisations, professional networks, and public resources.
          </p>
        </div>
        <div className="text-6xl sm:text-8xl select-none filter drop-shadow-md animate-pulse shrink-0" id="hero-flag">
          {activeCountry === 'Portugal' ? '🇵🇹' : '🇬🇧'}
        </div>
      </motion.div>

      {/* Search Bar Input */}
      <div className="relative max-w-md mx-auto" id="search-links-container">
        <input
          type="text"
          placeholder="Search websites, categories, services..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border-2 border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600/50 focus:border-indigo-600 transition-all shadow-md shadow-indigo-50/20"
          id="links-search-input"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} id="search-links-icon" />
      </div>

      {/* Display Grid Categories & Links */}
      {filteredCategories.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl text-center border-2 border-dashed border-slate-200" id="no-links-found">
          <span className="text-4xl">🔍</span>
          <h3 className="text-lg font-black text-slate-700 mt-4">No links found</h3>
          <p className="text-slate-400 text-xs mt-1">Try searching for different terms or select another region.</p>
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
                <span className="text-xl shrink-0" id={`cat-icon-${catIdx}`}>{cat.icon}</span>
                <h3 className="text-lg font-black text-slate-800" id={`cat-title-${catIdx}`}>{cat.category}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id={`cat-grid-${catIdx}`}>
                {cat.links.map((link, linkIdx) => (
                  <div
                    key={`link-item-${linkIdx}-${link.name}`}
                    className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-300 flex flex-col justify-between space-y-4"
                    id={`link-card-${catIdx}-${linkIdx}`}
                  >
                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 text-sm flex items-center justify-between" id={`link-title-${catIdx}-${linkIdx}`}>
                        <span>{link.name}</span>
                        <Globe size={14} className="text-slate-400 shrink-0 ml-1" />
                      </h4>
                      <p className="text-slate-500 text-xs leading-relaxed" id={`link-desc-${catIdx}-${linkIdx}`}>
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
    </div>
  );
}
