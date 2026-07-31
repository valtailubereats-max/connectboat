import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, 
  MapPin, 
  DollarSign, 
  Clock, 
  Building, 
  Search, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  Mail, 
  Phone, 
  Home, 
  ExternalLink,
  ChevronLeft,
  AlertCircle
} from 'lucide-react';
import { db, withTimeout, getDocsWithCacheFallback } from '../firebase';
import { Ad, PORTUGAL_CITIES, UK_CITIES } from '../types';
import { useAuth } from '../context/AuthContext';

export default function Trabalhos() {
  const navigate = useNavigate();
  const { profile, isAdmin, isModerator } = useAuth();
  const isStaff = isAdmin || isModerator || profile?.role === 'admin' || profile?.role === 'moderator';

  // Country state synchronized with local preference
  const [country, setCountry] = useState<'Portugal' | 'Reino Unido'>(() => {
    const saved = localStorage.getItem('selectedCountry') as 'Portugal' | 'Reino Unido' | null;
    return saved === 'Portugal' || saved === 'Reino Unido' ? saved : 'Portugal';
  });

  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('Todas');
  const [selectedContract, setSelectedContract] = useState('Todos');
  const [selectedSchedule, setSelectedSchedule] = useState('Todos');
  const [selectedExperience, setSelectedExperience] = useState('Todos');

  // Expanded card state to show in-line details
  const [expandedAdId, setExpandedAdId] = useState<string | null>(null);

  // Load jobs from firestore
  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const q = query(
          collection(db, 'ads'),
          where('category', '==', 'Trabalho/Empregos'),
          where('status', '==', 'approved'),
          where('country', '==', country)
        );
        const snapshot = await withTimeout(getDocsWithCacheFallback(q, `trabalhos/approved-${country}`), 15000);
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));
        
        // Sort by creation date descending
        fetched.sort((a, b) => {
          const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return timeB - timeA;
        });

        setAds(fetched);
      } catch (err: any) {
        console.error('Error loading job ads:', err);
        setErrorMsg('Não foi possível carregar as vagas de trabalho em ' + country);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [country]);

  // Handle Country Change
  const handleCountryChange = (newCountry: 'Portugal' | 'Reino Unido') => {
    setCountry(newCountry);
    localStorage.setItem('selectedCountry', newCountry);
    // Reset filters
    setSelectedCity('Todas');
    setSelectedContract('Todos');
    setSelectedSchedule('Todos');
    setSelectedExperience('Todos');
    setExpandedAdId(null);
  };

  // Extract cities containing vacancies to dynamically build the filter list
  const availableCities = useMemo(() => {
    const list = new Set<string>();
    ads.forEach(ad => {
      if (ad.city) list.add(ad.city);
    });
    return Array.from(list).sort();
  }, [ads]);

  // Apply filters locally for instant searching
  const filteredAds = useMemo(() => {
    return ads.filter(ad => {
      // 1. Search Term
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch = !search || 
        ad.title?.toLowerCase().includes(search) || 
        ad.description?.toLowerCase().includes(search) || 
        ad.companyName?.toLowerCase().includes(search);

      // 2. City
      const matchesCity = selectedCity === 'Todas' || ad.city === selectedCity;

      // 3. Contract Type
      const matchesContract = selectedContract === 'Todos' || ad.contractType === selectedContract;

      // 4. Schedule
      const matchesSchedule = selectedSchedule === 'Todos' || ad.workSchedule === selectedSchedule;

      // 5. Experience
      const matchesExperience = selectedExperience === 'Todos' || ad.experienceRequired === selectedExperience;

      return matchesSearch && matchesCity && matchesContract && matchesSchedule && matchesExperience;
    });
  }, [ads, searchTerm, selectedCity, selectedContract, selectedSchedule, selectedExperience]);

  const toggleExpand = (id: string) => {
    setExpandedAdId(prev => (prev === id ? null : id));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-all w-fit cursor-pointer group"
        >
          <ChevronLeft size={20} className="transition-transform group-hover:-translate-x-1" />
          Voltar para Prateleira Principal
        </button>

        <div className="flex items-center gap-3">
          {/* Country Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => handleCountryChange('Portugal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all pointer-events-auto cursor-pointer ${
                country === 'Portugal' 
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' 
                  : 'text-slate-500 hover:text-slate-950'
              }`}
            >
              <span>🇵🇹</span> Portugal
            </button>
            <button
              onClick={() => handleCountryChange('Reino Unido')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all pointer-events-auto cursor-pointer ${
                country === 'Reino Unido' 
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' 
                  : 'text-slate-500 hover:text-slate-950'
              }`}
            >
              <span>🇬🇧</span> Reino Unido
            </button>
          </div>

          {/* New Job Vacancy Button (Restricted to Admins/Moderators as per requirement 5) */}
          {isStaff && (
            <button
              onClick={() => navigate('/create-ad?category=Trabalho%2FEmpregos')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-4 rounded-2xl font-black text-xs sm:text-sm shadow-indigo-600/20 shadow-lg cursor-pointer transition-transform hover:scale-[1.02]"
            >
              <Plus size={16} /> Publicar Vaga
            </button>
          )}
        </div>
      </div>

      {/* Hero Header Area */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden mb-8 border border-white/5 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest py-1.5 px-3 rounded-full mb-4 inline-block">
            ⛵ ConnectBoat Marine Jobs
          </span>
          <h1 className="font-sans text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Trabalho &amp; Oportunidades
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Descubra vagas de emprego, contratos temporários e ofertas na sua região. 
            Todas as vagas listadas são revisadas e moderadas para a segurança da nossa comunidade.
          </p>
        </div>
      </div>

      {/* Advanced Bento Filtering Panel */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-lg mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Main Keyword Search */}
          <div className="relative col-span-1 md:col-span-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="✨ Procurar por cargo, empresa ou palavra-chave..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all placeholder-slate-400 font-medium text-sm text-slate-800"
            />
          </div>

          {/* City Selector */}
          <div>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold text-xs text-slate-700 appearance-none h-full"
            >
              <option value="Todas">🌍 Todas as Cidades</option>
              {availableCities.map((c, i) => (
                <option key={`city-${i}`} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Clear Filters Quick Button */}
          {(searchTerm !== '' || selectedCity !== 'Todas' || selectedContract !== 'Todos' || selectedSchedule !== 'Todos' || selectedExperience !== 'Todos') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCity('Todas');
                setSelectedContract('Todos');
                setSelectedSchedule('Todos');
                setSelectedExperience('Todos');
              }}
              className="w-full text-center text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 py-3 rounded-2xl transition-all cursor-pointer"
            >
              Limpar Filtros 🧹
            </button>
          )}

        </div>

        {/* Supplementary Filters Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-50">
          
          {/* Contract Select */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Tipo de Contrato</label>
            <select
              value={selectedContract}
              onChange={(e) => setSelectedContract(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-xs font-semibold text-slate-700"
            >
              <option value="Todos">Todos os Contratos</option>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contrato de Trabalho">Contrato de Trabalho</option>
              <option value="Prestação de Serviços (Recibos Verdes)">Prestação de Serviços</option>
              <option value="Temporário / Sazonal">Temporário / Sazonal</option>
              <option value="Estágio">Estágio</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          {/* Schedule Select */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Horário</label>
            <select
              value={selectedSchedule}
              onChange={(e) => setSelectedSchedule(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-xs font-semibold text-slate-700"
            >
              <option value="Todos">Todos os Horários</option>
              <option value="Período Diário">Período Diário</option>
              <option value="Turnos">Turnos</option>
              <option value="Horário Flexível">Horário Flexível</option>
              <option value="Finais de Semana">Finais de Semana</option>
              <option value="Trabalho Noturno">Trabalho Noturno</option>
            </select>
          </div>

          {/* Experience Select */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Experiência Requerida</label>
            <select
              value={selectedExperience}
              onChange={(e) => setSelectedExperience(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none text-xs font-semibold text-slate-700"
            >
              <option value="Todos">Qualquer Experiência</option>
              <option value="Sem experiência">Sem experiência</option>
              <option value="1-2 anos">1-2 anos</option>
              <option value="3-5 anos">3-5 anos</option>
              <option value="Sénior (+5 anos)">Sénior (+5 anos)</option>
            </select>
          </div>

        </div>
      </div>

      {/* Listing Content Area */}
      {loading ? (
        // Simulating shimmering loading cards
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={`shimmer-${n}`} className="bg-slate-50 border border-slate-200 h-28 w-full rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : errorMsg ? (
        <div className="bg-rose-50 border border-rose-100 rounded-3xl p-6 text-center text-rose-800">
          <AlertCircle className="mx-auto text-rose-500 mb-2" size={32} />
          <p className="font-bold">{errorMsg}</p>
        </div>
      ) : filteredAds.length === 0 ? (
        // Beautiful empty feedback state
        <div className="bg-slate-50 rounded-3xl p-12 text-center border border-slate-100 max-w-md mx-auto mt-6">
          <Briefcase className="mx-auto text-slate-300 mb-4" size={48} />
          <h3 className="font-sans font-extrabold text-slate-700 text-lg mb-1">Nenhuma vaga encontrada</h3>
          <p className="text-slate-400 text-xs leading-relaxed">
            Não encontrámos anúncios para os filtros ativos em {country}. Tente alargar a sua pesquisa ou pesquisar outras cidades.
          </p>
        </div>
      ) : (
        // Structured JobList
        <div className="space-y-4 relative">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold px-2">
            <span>A exibir {filteredAds.length} {filteredAds.length === 1 ? 'vaga' : 'vagas'} de trabalho</span>
          </div>

          <div className="space-y-3">
            {filteredAds.map((ad) => {
              const hasSourceUrl = ad.sourceUrl && /^https?:\/\//i.test(ad.sourceUrl);
              const hasExternalUrl = ad.externalUrl && /^https?:\/\//i.test(ad.externalUrl);
              const targetUrl = hasSourceUrl ? ad.sourceUrl : hasExternalUrl ? ad.externalUrl : null;
              
              const isExpanded = expandedAdId === ad.id;

              return (
                <motion.div
                  key={ad.id}
                  layout="position"
                  id={`job-card-${ad.id}`}
                  className={`bg-white border-2 rounded-2xl hover:border-indigo-500/20 transition-all shadow-sm ${
                    isExpanded 
                      ? 'border-indigo-600/70 shadow-indigo-600/5 shadow-md' 
                      : 'border-slate-100'
                  }`}
                >
                  {/* Card Visible Area */}
                  <div 
                    onClick={() => toggleExpand(ad.id)}
                    className="p-5 sm:p-6 cursor-pointer select-none"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      {/* Job Main Information */}
                      <div className="space-y-2 max-w-3xl">
                        <div className="flex items-center gap-2 flex-wrap">
                          {ad.companyName ? (
                            <span className="flex items-center gap-1 text-slate-500 text-xs font-black uppercase tracking-tight">
                              <Building size={12} className="text-slate-400 shrink-0" />
                              {ad.companyName}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-tight">
                              Anunciante Particular
                            </span>
                          )}
                          
                          {/* Tag For Partner link source */}
                          {hasSourceUrl && (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                              Parceiro 🤝
                            </span>
                          )}
                        </div>

                        <h2 className="font-sans font-extrabold text-slate-900 text-base sm:text-lg tracking-tight leading-snug group-hover:text-indigo-600 transition-colors">
                          {ad.title}
                        </h2>

                        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                          <MapPin size={13} className="shrink-0" />
                          <span>{ad.city || 'Portugal'}</span>
                        </div>
                      </div>

                      {/* Job Price/Remuneration Highlight */}
                      <div className="shrink-0 self-start sm:self-center">
                        <div className="bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl px-4 py-2 text-right">
                          <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wide leading-none mb-1">
                            Remuneração
                          </p>
                          <p className="font-sans font-black text-xs sm:text-sm leading-none whitespace-nowrap">
                            {ad.salary || 'A negociar / ND'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Metadata Attribute Badges */}
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      {ad.contractType && (
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-tight">
                          💼 {ad.contractType}
                        </span>
                      )}
                      
                      {ad.workSchedule && (
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-tight">
                          🕐 {ad.workSchedule}
                        </span>
                      )}

                      {ad.experienceRequired && (
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-tight">
                          ⚡ Exp: {ad.experienceRequired}
                        </span>
                      )}

                      {/* Location context */}
                      <span className="bg-slate-50 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tight flex items-center gap-1">
                        🌍 {ad.country || 'Portugal'}
                      </span>
                    </div>

                    {/* Inline Expand Chevron Toggler */}
                    <div className="flex justify-end mt-4 pt-4 border-t border-slate-50 text-indigo-600 font-bold text-xs items-center gap-1">
                      <span>{isExpanded ? 'Ocultar detalhes' : 'Ver mais detalhes &amp; Contactar'}</span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Expandable Description and Contact Panel */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-slate-100 bg-slate-50/50 rounded-b-2xl"
                      >
                        <div className="p-5 sm:p-6 space-y-5">
                          {/* Rich Text style Job Description */}
                          <div className="space-y-2">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Descrição Detalhada</h3>
                            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                              {ad.description}
                            </p>
                          </div>

                          {/* Contact Methods Area */}
                          <div className="pt-4 border-t border-slate-100 space-y-3">
                            <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest text-slate-400">
                              Contactar Recrutador / Enviar Candidatura
                            </h3>
                            
                            <div className="flex flex-wrap gap-3">
                              {/* Direct External Link (High-Priority for import links as per guideline 7) */}
                              {targetUrl && (
                                <a
                                  href={targetUrl}
                                  target="_blank"
                                  referrerPolicy="no-referrer"
                                  rel="noopener noreferrer"
                                  id={`link-apply-${ad.id}`}
                                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-5 py-3 rounded-xl transition-all shadow-md shadow-emerald-600/10"
                                >
                                  Candidatar-se no Site Original <ExternalLink size={14} />
                                </a>
                              )}

                              {/* WhatsApp / Phone Click Call (As per standard seller details) */}
                              {ad.sellerPhone && (
                                <a
                                  href={`https://wa.me/${ad.sellerPhone.replace(/\s+/g, '')}`}
                                  target="_blank"
                                  referrerPolicy="no-referrer"
                                  rel="noopener noreferrer"
                                  id={`link-whatsapp-${ad.id}`}
                                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-3 rounded-xl transition-all"
                                >
                                  Conversar por WhatsApp <Phone size={14} />
                                </a>
                              )}

                              {/* Contact Email */}
                              {ad.contactEmail && (
                                <a
                                  href={`mailto:${ad.contactEmail}`}
                                  className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-3 rounded-xl transition-all"
                                >
                                  Enviar E-mail <Mail size={14} />
                                </a>
                              )}
                            </div>
                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
