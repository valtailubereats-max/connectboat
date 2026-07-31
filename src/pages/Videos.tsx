import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { CommunityVideo } from '../types';
import { useAuth } from '../context/AuthContext';
import { Search, Play, Plus, SlidersHorizontal, Eye, Calendar, User, Film, Tag } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';

const CATEGORIES = [
  'Notícias',
  'Empreendedorismo',
  'Reino Unido',
  'Portugal',
  'Imigração',
  'Turismo',
  'Gastronomia',
  'Música',
  'Humor',
  'Educação',
  'Tecnologia',
  'Comunidade'
];

const COUNTRIES = [
  { code: 'UK', label: '🇬🇧 Reino Unido' },
  { code: 'PT', label: '🇵🇹 Portugal' }
];

export default function Videos() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  
  const [videos, setVideos] = useState<CommunityVideo[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'title'>('recent');

  useEffect(() => {
    // Escuta em tempo real os vídeos ativos
    const q = query(
      collection(db, 'videos'),
      where('active', '==', true)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CommunityVideo[];
      
      // Ordenar localmente por data de criação descrescente por padrão
      const sorted = list.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      
      setVideos(sorted);
      setLoading(false);
    }, (err) => {
      console.error('Erro ao ler vídeos:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter & Sort Logic
  const filteredVideos = React.useMemo(() => {
    let result = [...videos];

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(v => 
        v.title.toLowerCase().includes(term) ||
        v.channelName.toLowerCase().includes(term) ||
        v.description?.toLowerCase().includes(term)
      );
    }

    if (selectedCategory !== 'all') {
      result = result.filter(v => v.category === selectedCategory);
    }

    if (selectedCountry !== 'all') {
      result = result.filter(v => v.country.includes(selectedCountry));
    }

    if (sortBy === 'recent') {
      result.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
    } else if (sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [videos, searchTerm, selectedCategory, selectedCountry, sortBy]);

  // Encontra o vídeo em destaque (isFeatured == true)
  const featuredVideo = React.useMemo(() => {
    // Tenta encontrar o vídeo mais recente com isFeatured e active
    const featured = videos.find(v => v.isFeatured && v.active);
    if (featured) return featured;
    // Se não houver, pega o mais recente no geral
    return videos.length > 0 ? videos[0] : null;
  }, [videos]);

  // Remove o destaque da lista secundária para não duplicar se desejar, mas o YouTube normalmente mostra ambos.
  // Vamos manter todos os vídeos na listagem abaixo para maior descoberta de conteúdo.

  const formatDate = (dateObj: any) => {
    if (!dateObj) return 'Recentemente';
    try {
      const date = dateObj.toDate ? dateObj.toDate() : new Date(dateObj);
      return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return 'Recentemente';
    }
  };

  return (
    <div className="space-y-10" id="videos-page-container">
      <Helmet>
        <title>🎬 Marine Community Videos - ConnectBoat</title>
        <meta name="description" content="Discover and watch interesting boating, yachting, and marine videos from the ConnectBoat community." />
        <meta property="og:title" content="🎬 Marine Community Videos - ConnectBoat" />
        <meta property="og:description" content="Nautical, boating and marine video highlights." />
      </Helmet>

      {/* Header Section */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-150 px-3 py-1 rounded-full text-indigo-700 text-xs font-black uppercase tracking-widest">
          <span>🎬 Media Hub</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-brand font-black text-slate-900 tracking-tight leading-none">
          🎬 Vídeos da Comunidade
        </h1>
        <p className="text-slate-600 text-sm sm:text-base font-semibold max-w-xl mx-auto leading-relaxed">
          Descubra conteúdos produzidos pela comunidade lusófona. Tutoriais, notícias, gastronomia, imigração e muito mais para quem fala português.
        </p>
        
        {isAdmin && (
          <div className="flex justify-center pt-2">
            <Link
              to="/admin/videos"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm px-5 py-2.5 rounded-2xl shadow-lg shadow-indigo-100 transition-all transform hover:-translate-y-0.5"
              id="admin-videos-shortcut"
            >
              <Plus size={18} />
              <span>Gerir Vídeos (Admin)</span>
            </Link>
          </div>
        )}
      </div>

      {/* Video em Destaque (Destaque Grande) */}
      {featuredVideo && !loading && (
        <div className="space-y-4" id="featured-video-wrapper">
          <h2 className="text-xl font-brand font-black text-slate-800 tracking-tight flex items-center gap-2">
            ⭐ Vídeo em Destaque
          </h2>
          <div className="bg-white/80 backdrop-blur-md rounded-[2rem] overflow-hidden border border-slate-200/60 shadow-xl shadow-slate-100/50 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 hover:shadow-2xl transition-all duration-300">
            {/* Thumbnail */}
            <div className="lg:col-span-7 relative group aspect-video rounded-2xl overflow-hidden bg-slate-900 shadow-md">
              <img
                src={featuredVideo.thumbnailUrl}
                alt={featuredVideo.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-all duration-750"
              />
              <div className="absolute inset-0 bg-slate-900/40 opacity-80 group-hover:opacity-90 transition-all flex items-center justify-center">
                <button
                  onClick={() => navigate(`/videos/${featuredVideo.slug}`)}
                  className="w-16 h-16 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all cursor-pointer"
                  title="Assistir agora"
                >
                  <Play size={28} className="fill-current ml-1" />
                </button>
              </div>
              <div className="absolute top-4 left-4 bg-indigo-600 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-lg tracking-widest shadow-sm">
                Destaque
              </div>
            </div>

            {/* Info */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3.5">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-xl">
                    <Tag size={12} /> {featuredVideo.category}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-xl">
                    {featuredVideo.country}
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-brand font-black text-slate-900 leading-tight tracking-tight hover:text-indigo-600 transition-colors">
                  <Link to={`/videos/${featuredVideo.slug}`}>{featuredVideo.title}</Link>
                </h3>

                <p className="text-slate-500 font-semibold text-xs flex items-center gap-1.5">
                  <User size={14} className="text-slate-400" />
                  <span>{featuredVideo.channelName}</span>
                  <span className="text-slate-300">•</span>
                  <Calendar size={14} className="text-slate-400" />
                  <span>{formatDate(featuredVideo.createdAt)}</span>
                </p>

                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-medium line-clamp-3 lg:line-clamp-4">
                  {featuredVideo.description || 'Sem descrição fornecida.'}
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => navigate(`/videos/${featuredVideo.slug}`)}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-extrabold px-6 py-3.5 rounded-xl flex items-center justify-center gap-2.5 shadow-md active:scale-98 transition-all cursor-pointer"
                >
                  <Play size={18} className="fill-current" />
                  <span>Assistir Vídeo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters & Control Panel */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 sm:p-6 border border-slate-200/60 shadow-md space-y-5" id="videos-filter-panel">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Campo de Pesquisa */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Pesquisar por título, canal ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white text-sm px-11 py-3 rounded-2xl outline-none transition-all font-semibold text-slate-800"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filtro por País */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-2xl">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">País:</span>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="bg-transparent border-none text-xs font-black text-slate-800 outline-none pr-1.5 cursor-pointer"
              >
                <option value="all">🌐 Todos</option>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Ordenação */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-2xl">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Ordem:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'title')}
                className="bg-transparent border-none text-xs font-black text-slate-800 outline-none pr-1.5 cursor-pointer"
              >
                <option value="recent">📅 Mais Recentes</option>
                <option value="title">🔤 Título (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Categorias (Badge Filter com Scrolling horizontal) */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none scroll-smooth">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              🎥 Todos
            </button>
            {CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === category
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Listing Section */}
      <div className="space-y-6" id="video-grid-container">
        <h2 className="text-xl font-brand font-black text-slate-800 tracking-tight flex items-center justify-between">
          <span>📹 Lista de Vídeos ({filteredVideos.length})</span>
        </h2>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest">A carregar vídeos...</p>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="bg-white/70 border border-slate-200/50 rounded-3xl p-12 text-center max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <Film size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-800">Nenhum vídeo encontrado</h3>
            <p className="text-slate-500 text-xs font-medium leading-relaxed">
              Tente redefinir a sua pesquisa ou os filtros de país e categoria para ver outros conteúdos.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
                setSelectedCountry('all');
              }}
              className="text-xs font-black text-indigo-600 hover:underline"
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
          /* Grid do YouTube: 4~5 cols desktop, 3 cols tablet, 2 cols mobile */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {filteredVideos.map((video) => (
              <div
                key={video.id}
                className="bg-white rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col hover:-translate-y-1 group"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-slate-900 overflow-hidden">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                    <button
                      onClick={() => navigate(`/videos/${video.slug}`)}
                      className="w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all scale-90 group-hover:scale-100 active:scale-95 cursor-pointer"
                    >
                      <Play size={16} className="fill-current ml-0.5" />
                    </button>
                  </div>
                  
                  {/* Category and Country tags */}
                  <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
                    <span className="bg-slate-900/75 backdrop-blur-xs text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wider">
                      {video.category}
                    </span>
                    <span className="bg-indigo-900/75 backdrop-blur-xs text-white text-[9px] font-black px-1.5 py-0.5 rounded-md tracking-wider">
                      {video.country.split(' ')[0]} {/* Apenas bandeira para poupar espaço */}
                    </span>
                  </div>
                </div>

                {/* Info block */}
                <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <h3 className="font-brand font-black text-slate-900 text-xs sm:text-sm leading-tight line-clamp-2 hover:text-indigo-600 transition-colors">
                      <Link to={`/videos/${video.slug}`}>{video.title}</Link>
                    </h3>
                    
                    <p className="text-[10px] text-slate-500 font-bold line-clamp-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      <span>{video.channelName}</span>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[9px] sm:text-[10px] text-slate-400 font-semibold">
                    <span>{formatDate(video.createdAt)}</span>
                    <button
                      onClick={() => navigate(`/videos/${video.slug}`)}
                      className="text-red-600 font-black flex items-center gap-0.5 hover:underline"
                    >
                      <span>Assistir</span>
                      <Play size={8} className="fill-current" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
