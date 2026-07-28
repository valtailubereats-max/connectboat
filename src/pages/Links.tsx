import React, { useState, useEffect } from 'react';
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
    category: '🛂 Imigração',
    icon: '🛂',
    links: [
      {
        name: 'GOV.UK Visas and Immigration',
        description: 'Serviço oficial do governo britânico para pedidos de visto, residência e cidadania no Reino Unido.',
        url: 'https://www.gov.uk/browse/visas-immigration',
      },
      {
        name: 'Office of the Immigration Services Commissioner (OISC)',
        description: 'Órgão público que regula consultores de imigração para garantir aconselhamento seguro e legal.',
        url: 'https://www.gov.uk/government/organisations/office-of-the-immigration-services-commissioner',
      },
      {
        name: 'Migrant Help',
        description: 'Organização de caridade britânica que oferece apoio e aconselhamento gratuito a migrantes e refugiados.',
        url: 'https://www.migranthelpuk.org/',
      }
    ]
  },
  {
    category: '💼 Trabalho',
    icon: '💼',
    links: [
      {
        name: 'Indeed UK',
        description: 'O maior portal de emprego do Reino Unido para pesquisa de vagas de trabalho em múltiplos setores.',
        url: 'https://uk.indeed.com/',
      },
      {
        name: 'LinkedIn UK',
        description: 'Rede profissional líder para conectar-se com recrutadores e candidatar-se a vagas corporativas.',
        url: 'https://www.linkedin.com/',
      },
      {
        name: 'National Careers Service',
        description: 'Portal do governo que oferece aconselhamento profissional gratuito, ajuda com currículos e carreiras.',
        url: 'https://nationalcareersservice.direct.gov.uk/',
      }
    ]
  },
  {
    category: '🏠 Habitação',
    icon: '🏠',
    links: [
      {
        name: 'Rightmove',
        description: 'O principal portal imobiliário do Reino Unido para arrendamento ou compra de casas e apartamentos.',
        url: 'https://www.rightmove.co.uk/',
      },
      {
        name: 'Zoopla',
        description: 'Excelente plataforma para consultar preços de propriedades, casas para arrendar e valores de mercado.',
        url: 'https://www.zoopla.co.uk/',
      }
    ]
  },
  {
    category: '💰 Finanças',
    icon: '💰',
    links: [
      {
        name: 'HM Revenue & Customs (HMRC)',
        description: 'Autoridade fiscal do Reino Unido. Use para obter o seu National Insurance Number (NINo) e impostos.',
        url: 'https://www.gov.uk/government/organisations/hm-revenue-customs',
      },
      {
        name: 'Wise',
        description: 'Serviço líder de transferências internacionais com excelentes taxas de câmbio entre GBP e EUR.',
        url: 'https://wise.com/',
      }
    ]
  },
  {
    category: '🏥 Saúde',
    icon: '🏥',
    links: [
      {
        name: 'National Health Service (NHS)',
        description: 'Portal do serviço de saúde pública do Reino Unido. Encontre o seu médico de família (GP) local.',
        url: 'https://www.nhs.uk/',
      }
    ]
  },
  {
    category: '🚗 Veículos',
    icon: '🚗',
    links: [
      {
        name: 'DVLA',
        description: 'Agência de licenciamento de condutores e veículos. Essencial para registar carros ou converter carta de condução.',
        url: 'https://www.gov.uk/government/organisations/driver-and-vehicle-licensing-agency',
      }
    ]
  },
  {
    category: '⚖️ Apoio Jurídico',
    icon: '⚖️',
    links: [
      {
        name: 'Citizens Advice',
        description: 'Rede de caridade independente que oferece apoio confidencial gratuito sobre direitos laborais, dívidas e lei civil.',
        url: 'https://www.citizensadvice.org.uk/',
      }
    ]
  },
  {
    category: '🏛️ Governo',
    icon: '🏛️',
    links: [
      {
        name: 'GOV.UK',
        description: 'O portal oficial centralizado de todos os serviços públicos e ministérios do governo do Reino Unido.',
        url: 'https://www.gov.uk/',
      }
    ]
  }
];

const PT_LINKS: CategoryLinks[] = [
  {
    category: '🛂 Imigração',
    icon: '🛂',
    links: [
      {
        name: 'Agência para a Integração, Migrações e Asilo (AIMA)',
        description: 'Entidade governamental portuguesa responsável pelas questões de entrada, permanência, asilo e migração.',
        url: 'https://aima.gov.pt/',
      },
      {
        name: 'Centros Locais de Apoio à Integração de Migrantes (CLAIM)',
        description: 'Rede nacional que acolhe e apoia os cidadãos migrantes no seu processo de integração local em todo o país.',
        url: 'https://www.acm.gov.pt/-/claim-centros-locais-de-apoio-a-integracao-de-migrantes',
      },
      {
        name: 'Centros Nacionais de Apoio à Integração de Migrantes (CNAIM)',
        description: 'Centros integrados de serviços públicos para fornecer respostas céleres a imigrantes em Lisboa, Porto, Algarve e Beja.',
        url: 'https://www.acm.gov.pt/-/cnaim-centros-nacionais-de-apoio-a-integracao-de-migrantes',
      }
    ]
  },
  {
    category: '💼 Trabalho',
    icon: '💼',
    links: [
      {
        name: 'Instituto do Emprego e Formação Profissional (IEFP)',
        description: 'Serviço público de emprego responsável por apoiar a contratação, reinserção profissional e formação profissional.',
        url: 'https://www.iefp.pt/',
      },
      {
        name: 'LinkedIn Portugal',
        description: 'Ferramenta profissional essencial para expandir o seu networking e encontrar ofertas de trabalho em Portugal.',
        url: 'https://www.linkedin.com/',
      }
    ]
  },
  {
    category: '🏠 Habitação',
    icon: '🏠',
    links: [
      {
        name: 'Idealista Portugal',
        description: 'O maior portal de imóveis do país para comprar, vender ou arrendar apartamentos, quartos e moradias.',
        url: 'https://www.idealista.pt/',
      },
      {
        name: 'Imovirtual',
        description: 'Famosa plataforma online dedicada a classificados de casas e imobiliários para arrendar e vender.',
        url: 'https://www.imovirtual.com/',
      }
    ]
  },
  {
    category: '💰 Finanças',
    icon: '💰',
    links: [
      {
        name: 'Portal das Finanças',
        description: 'Site oficial da Autoridade Tributária e Aduaneira (AT) para gerir NIF, declaração de IRS, passaportes fiscais e faturas.',
        url: 'https://www.portaldasfinancas.gov.pt/',
      },
      {
        name: 'Segurança Social Direta',
        description: 'Canal oficial para consultar carreiras contributivas, obter número de segurança social (NISS) e requerer apoios.',
        url: 'https://direta.seg-social.pt/',
      }
    ]
  },
  {
    category: '🏥 Saúde',
    icon: '🏥',
    links: [
      {
        name: 'SNS 24',
        description: 'Contacto oficial e portal do Serviço Nacional de Saúde português para triagem, agendamento de consultas e guias médicos.',
        url: 'https://www.sns24.gov.pt/',
      }
    ]
  },
  {
    category: '🚗 Veículos',
    icon: '🚗',
    links: [
      {
        name: 'Instituto da Mobilidade e dos Transportes (IMT)',
        description: 'Autoridade para registo de cartas de condução, homologações de veículos, matrículas e conversão de títulos estrangeiros.',
        url: 'https://www.imt-ip.pt/',
      }
    ]
  },
  {
    category: '⚖️ Apoio Jurídico',
    icon: '⚖️',
    links: [
      {
        name: 'Justiça.gov.pt',
        description: 'Portal oficial central para requerer nacionalidade, consultar atos jurídicos, registo civil, comercial e de propriedades.',
        url: 'https://justica.gov.pt/',
      }
    ]
  },
  {
    category: '🏛️ Governo',
    icon: '🏛️',
    links: [
      {
        name: 'Portal do Cidadão (ePortugal)',
        description: 'Ponto único de contacto para cidadãos e empresas obterem serviços públicos online simplificados em Portugal.',
        url: 'https://eportugal.gov.pt/',
      }
    ]
  }
];

export default function Links() {
  const navigate = useNavigate();
  const [activeCountry, setActiveCountry] = useState<'Portugal' | 'Reino Unido'>('Reino Unido');
  const [searchQuery, setSearchQuery] = useState('');

  // Sincronizar com o país selecionado pelo utilizador globalmente
  useEffect(() => {
    const saved = localStorage.getItem('selectedCountry') as 'Portugal' | 'Reino Unido' | null;
    if (saved === 'Portugal' || saved === 'Reino Unido') {
      setActiveCountry(saved);
    }
  }, []);

  const linksData = activeCountry === 'Portugal' ? PT_LINKS : UK_LINKS;

  // Filtragem dos links por pesquisa
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
      {/* Top Navigation Row */}
      <div className="flex items-center justify-between" id="links-header-row">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors cursor-pointer text-sm"
          id="btn-back-links"
        >
          <ArrowLeft size={16} /> Voltar
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
            <span>🇬🇧</span> Reino Unido
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
            Guia de Integração Lusa
          </div>
          <h1 className="text-3xl sm:text-4xl font-brand font-black tracking-tight" id="hero-title">
            Links Úteis {activeCountry === 'Portugal' ? 'Portugal 🇵🇹' : 'Reino Unido 🇬🇧'}
          </h1>
          <p className="text-slate-300 text-sm max-w-lg leading-relaxed" id="hero-subtitle">
            Uma coleção oficial de portais governamentais, redes profissionais e recursos públicos selecionados para apoiar a nossa comunidade lusa em {activeCountry === 'Portugal' ? 'Portugal' : 'terras britânicas'}.
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
          placeholder="Pesquisar por sites, categorias, vistos..."
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
          <h3 className="text-lg font-black text-slate-700 mt-4">Nenhum link encontrado</h3>
          <p className="text-slate-400 text-xs mt-1">Experimente pesquisar por termos diferentes ou selecione outra comunidade.</p>
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
                      <span>Visitar Site</span>
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
