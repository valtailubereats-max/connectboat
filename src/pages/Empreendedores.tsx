import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { motion } from 'motion/react';
import { Search, MapPin, Globe, ArrowRight, ShoppingBag, ExternalLink, Store } from 'lucide-react';

const CATEGORIES = [
  'Alimentação',
  'Beleza',
  'Construção',
  'Limpeza',
  'Automóvel',
  'Serviços',
  'Lojas',
  'Outros'
];

export const mapCategoryToNew = (cat: string): string => {
  if (!cat) return 'Outros';
  const c = cat.toLowerCase().trim();
  if (c.includes('alimentac') || c.includes('restaura') || c.includes('pizza') || c.includes('bolo') || c.includes('comida') || c.includes('bebida') || c.includes('alimento')) {
    return 'Alimentação';
  }
  if (c.includes('beleza') || c.includes('estetic') || c.includes('unha') || c.includes('cabelo') || c.includes('cosm')) {
    return 'Beleza';
  }
  if (c.includes('constru') || c.includes('reforma') || c.includes('obra')) {
    return 'Construção';
  }
  if (c.includes('limpeza') || c.includes('lavand') || c.includes('limp')) {
    return 'Limpeza';
  }
  if (c.includes('autom') || c.includes('carro') || c.includes('mecan')) {
    return 'Automóvel';
  }
  if (c.includes('servi') || c.includes('profission') || c.includes('tecnolog') || c.includes('digital') || c.includes('turism') || c.includes('lazer') || c.includes('consult')) {
    return 'Serviços';
  }
  if (c.includes('comerc') || c.includes('loja') || c.includes('venda') || c.includes('compr')) {
    return 'Lojas';
  }
  return 'Outros';
};

const Empreendedores = () => {
  const [showcases, setShowcases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<'' | 'Portugal' | 'Reino Unido'>('');
  
  // Estatísticas públicas
  const [activeEntrepreneursCount, setActiveEntrepreneursCount] = useState(0);
  const [availableProductsCount, setAvailableProductsCount] = useState(0);

  useEffect(() => {
    const fetchShowcasesData = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'sellerPublicProfiles'),
          where('showcaseActive', '==', true)
        );
        const snap = await getDocs(q);
        
        const rawShowcases = snap.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        })).filter((elem: any) => elem.showcaseApproved === true);

        let totalProducts = 0;
        const processed = await Promise.all(rawShowcases.map(async (elem: any) => {
          let productsCount = 0;
          try {
            const pRef = query(
              collection(db, 'sellerPublicProfiles', elem.uid, 'products'),
              where('active', '==', true)
            );
            const pSnap = await getDocs(pRef);
            productsCount = pSnap.size;
            totalProducts += productsCount;
          } catch (pErr) {
            console.error('Erro ao buscar produtos da vitrine para', elem.uid, pErr);
          }
          return {
            ...elem,
            productsCount
          };
        }));

        // Ordenação: priorizar mais produtos, depois updatedAt mais recente
        processed.sort((a: any, b: any) => {
          if (b.productsCount !== a.productsCount) {
            return b.productsCount - a.productsCount;
          }
          const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
          const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
          return timeB - timeA;
        });

        setShowcases(processed);
        setActiveEntrepreneursCount(processed.length);
        setAvailableProductsCount(totalProducts);
      } catch (err) {
        console.error('Erro ao buscar vitrines digitais:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchShowcasesData();
  }, []);

  // Filter showcases based on search and selected categories
  const filteredShowcases = showcases.filter(item => {
    const matchesSearch = 
      (item.showcaseName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.showcaseDescription || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.city || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === '' || mapCategoryToNew(item.showcaseCategory || '') === selectedCategory;
    const matchesCountry = selectedCountry === '' || item.country === selectedCountry;

    return matchesSearch && matchesCategory && matchesCountry;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4" id="entrepreneurs-page">
      {/* Header Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-950 text-white p-8 md:p-12 shadow-xl border border-indigo-950">
        <div className="absolute top-0 right-0 h-full w-1/3 opacity-10 bg-[radial-gradient(circle_at_right,_var(--tw-gradient-stops))] from-indigo-400 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-200 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider uppercase border border-indigo-400/30">
            <ShoppingBag size={14} />
            <span>Vitrine Digital</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none bg-gradient-to-r from-white to-indigo-100 bg-clip-text text-transparent">
            Espaço de Empreendedores
          </h1>
          <p className="text-indigo-200/90 text-sm md:text-base font-medium leading-relaxed">
            Consuma local, apoie pequenos negócios liderados por lusófonos na sua região. Conecte-se diretamente via WhatsApp e descubra talentos inovadores!
          </p>
        </div>
      </div>

      {/* Estatísticas Públicas */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5 sm:gap-4 transition-all hover:shadow-md">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg sm:text-xl">
            🏪
          </div>
          <div>
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none">Empreendedores Ativos</span>
            <span className="text-xl sm:text-2xl font-black text-slate-800 mt-1 block tracking-tight">{loading ? '...' : activeEntrepreneursCount}</span>
          </div>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5 sm:gap-4 transition-all hover:shadow-md">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg sm:text-xl">
            📦
          </div>
          <div>
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none">Produtos Disponíveis</span>
            <span className="text-xl sm:text-2xl font-black text-slate-800 mt-1 block tracking-tight">{loading ? '...' : availableProductsCount}</span>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search Term Input */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Pesquisar por negócio, descrição ou cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-medium text-slate-800"
            />
          </div>

          {/* Category Filter */}
          <div className="relative col-span-1">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-semibold text-slate-700 cursor-pointer appearance-none"
            >
              <option value="">Todas as Categorias</option>
              {CATEGORIES.map(cat => (
                <option key={`filter-cat-${cat}`} value={cat}>{cat}</option>
              ))}
            </select>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
          </div>

          {/* Country Filter */}
          <div className="relative col-span-1">
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value as any)}
              className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-semibold text-slate-700 cursor-pointer appearance-none"
            >
              <option value="">Todos os Países</option>
              <option value="Portugal">🇵🇹 Portugal</option>
              <option value="Reino Unido">🇬🇧 Reino Unido</option>
            </select>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
          </div>
        </div>
      </div>

      {/* List / Grid of Showcases */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(n => (
            <div key={`shw-shimmer-${n}`} className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm animate-pulse h-96">
              <div className="bg-slate-200 h-28 w-full" />
              <div className="p-6 space-y-4">
                <div className="w-16 h-16 bg-slate-300 rounded-2xl -mt-14 border-4 border-white" />
                <div className="h-6 bg-slate-200 rounded w-2/3" />
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="space-y-2 pt-2">
                  <div className="h-3 bg-slate-200 rounded" />
                  <div className="h-3 bg-slate-200 rounded w-5/6" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredShowcases.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center space-y-4 shadow-sm" id="empty-showcases">
          <span className="text-5xl block">🛍️</span>
          <h3 className="text-xl font-bold text-slate-800">Nenhum Empreendedor Encontrado</h3>
          <p className="text-slate-500 max-w-md mx-auto text-sm">
            Não encontramos nenhuma vitrine ativa correspondente aos critérios de pesquisa selecionados atualmente.
          </p>
          {searchTerm || selectedCategory || selectedCountry ? (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('');
                setSelectedCountry('');
              }}
              className="px-5 py-2.5 bg-indigo-50 text-indigo-600 font-bold rounded-xl text-sm hover:bg-indigo-100 transition-colors"
            >
              Limpar Filtros
            </button>
          ) : (
            <Link
              to="/profile?tab=vitrine"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white font-bold px-6 py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 text-sm"
            >
              Ativar Minha Vitrine
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      ) : (
        <div className="flex md:grid overflow-x-auto md:overflow-x-visible pb-6 md:pb-0 snap-x snap-mandatory gap-6 animate-fade-in [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" id="showcases-grid">
          {filteredShowcases.map((elem, idx) => {
            const linkTo = `/empreendedores/${elem.showcaseSlug}`;
            const fallbackCover = 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=600&q=80'; // professional back pattern
            
            return (
              <motion.div
                key={`showcase-card-${elem.uid || idx}`}
                className="shrink-0"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Link
                  to={linkTo}
                  className="group bg-[#0d0e12] rounded-[1.75rem] border border-slate-800/60 overflow-hidden shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between w-[270px] sm:w-[300px] md:w-auto h-[340px] shrink-0 snap-center md:shrink md:snap-align-none cursor-pointer"
                >
                  {/* Banner Cover taking ~80% of the card height */}
                  <div className="relative h-[275px] w-full bg-slate-900 overflow-hidden">
                    <img 
                      src={elem.showcaseCover || fallbackCover} 
                      alt={elem.showcaseName} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Centered circular logo at the top over the banner */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-white border-2 border-white shadow-md flex items-center justify-center overflow-hidden z-20">
                      {elem.showcaseLogo && elem.showcaseLogo.trim() !== '' ? (
                        <img src={elem.showcaseLogo || null} alt="Logo" className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-xl">🏬</span>
                      )}
                    </div>

                    {/* Dark gradient overlay on bottom of the image for text contrast */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent pt-16 p-4 flex flex-col justify-end z-10">
                      <div className="flex justify-between items-end gap-2 text-white">
                        <div className="min-w-0 flex-1">
                          {/* Name */}
                          <h3 className="font-extrabold text-white text-base sm:text-lg leading-tight line-clamp-1 truncate drop-shadow-md">
                            {elem.showcaseName}
                          </h3>
                          {/* Location */}
                          <div className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-350 font-medium mt-1 truncate drop-shadow-sm">
                            <MapPin size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate">{elem.city ? `${elem.city}, ` : ''}{elem.country === 'Portugal' ? '🇵🇹 pt' : '🇬🇧 uk'}</span>
                          </div>
                        </div>
                        
                        {/* Compact items badge on bottom right corner of image */}
                        <div className="px-2 py-1 bg-black/65 border border-white/10 text-white rounded-lg text-[10px] font-black flex items-center gap-1 shrink-0 shadow-xs">
                          <span>📦</span>
                          <span>{elem.productsCount} {elem.productsCount === 1 ? 'item' : 'itens'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom ~20% of the card - CTA button */}
                  <div className="p-3 bg-[#0d0e12] flex items-center justify-center h-[65px] shrink-0 border-t border-slate-900/35">
                    <div
                      className="w-full py-2 bg-[#136338] group-hover:bg-[#1a5e37] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 rounded-xl transition-all shadow-md text-center border border-emerald-800/10"
                    >
                      <Store size={14} className="text-white shrink-0" />
                      <span>Meu Negócio</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Empreendedores;
