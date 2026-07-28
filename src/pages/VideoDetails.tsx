import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, limit, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { CommunityVideo } from '../types';
import { ChevronLeft, Youtube, Tag, Globe, Calendar, User, Film, Share2, Play } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function VideoDetails() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  
  const [video, setVideo] = useState<CommunityVideo | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<CommunityVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    if (!slug) return;
    
    setLoading(true);
    // Busca o vídeo baseado no slug
    const q = query(
      collection(db, 'videos'),
      where('slug', '==', slug),
      where('active', '==', true),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const videoDoc = snapshot.docs[0];
        const videoData = { id: videoDoc.id, ...videoDoc.data() } as CommunityVideo;
        setVideo(videoData);
        
        // Carrega vídeos relacionados (mesma categoria ou país, exceto o atual)
        const relQ = query(
          collection(db, 'videos'),
          where('active', '==', true),
          limit(10)
        );
        
        getDocs(relQ).then((relSnap) => {
          const list = relSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }) as CommunityVideo)
            .filter(v => v.id !== videoData.id);
            
          // Ordena de forma inteligente: mesma categoria primeiro, depois país
          const sortedRel = list.sort((a, b) => {
            const catA = a.category === videoData.category ? 1 : 0;
            const catB = b.category === videoData.category ? 1 : 0;
            return catB - catA;
          });
          
          setRelatedVideos(sortedRel.slice(0, 5));
        }).catch(err => {
          console.error('Erro ao ler relacionados:', err);
        });

      } else {
        setVideo(null);
      }
      setLoading(false);
    }, (err) => {
      console.error('Erro ao escutar vídeo:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [slug]);

  const formatDate = (dateObj: any) => {
    if (!dateObj) return '';
    try {
      const date = dateObj.toDate ? dateObj.toDate() : new Date(dateObj);
      return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4" id="video-details-loader">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">A carregar reprodutor...</p>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-6" id="video-not-found">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
          <Film size={28} />
        </div>
        <h2 className="text-2xl font-brand font-black text-slate-900 leading-none">Vídeo não encontrado</h2>
        <p className="text-slate-500 text-sm font-medium">
          O conteúdo que procura pode ter sido removido ou o link está incorreto.
        </p>
        <Link
          to="/videos"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm px-6 py-3 rounded-xl shadow-md transition-all"
        >
          <ChevronLeft size={16} />
          <span>Voltar aos Vídeos</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="video-details-container">
      <Helmet>
        <title>{video.title} - Community Videos - ConnectBoat</title>
        <meta name="description" content={video.description || `Watch "${video.title}" created by ${video.channelName} on ConnectBoat.`} />
        <meta property="og:title" content={`${video.title} - ConnectBoat`} />
        <meta property="og:description" content={video.description} />
        <meta property="og:image" content={video.thumbnailUrl} />
        <meta property="og:type" content="video.other" />
      </Helmet>

      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/videos"
          className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-extrabold text-xs transition-colors"
        >
          <ChevronLeft size={16} />
          <span>Voltar aos Vídeos</span>
        </Link>
        
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
        >
          <Share2 size={14} />
          <span>{copiedShare ? 'Copiado!' : 'Partilhar Link'}</span>
        </button>
      </div>

      {/* Grid Layout: Player Left, Related Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main Column: Player & Info */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* 16:9 Video Player */}
          <div className="bg-slate-950 aspect-video rounded-3xl overflow-hidden shadow-2xl relative border border-slate-900">
            <iframe
              src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&modestbranding=1&rel=0`}
              title={video.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full absolute inset-0"
            />
          </div>

          {/* Details Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black px-3 py-1 rounded-xl">
                <Tag size={12} /> {video.category}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-black px-3 py-1 rounded-xl">
                <Globe size={12} /> {video.country}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-brand font-black text-slate-900 leading-tight">
              {video.title}
            </h1>

            {/* Author/Channel Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-y border-slate-100 py-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold">
                  <Youtube size={20} />
                </div>
                <div>
                  <p className="font-brand font-black text-slate-900 text-sm leading-none">{video.channelName}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Autor do Conteúdo</p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                <Calendar size={14} />
                <span>Adicionado a {formatDate(video.createdAt)}</span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2 pt-1">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Descrição do Vídeo</h3>
              <p className="text-slate-700 font-medium text-xs sm:text-sm leading-relaxed whitespace-pre-line bg-slate-50/50 p-4 rounded-2xl border border-slate-150">
                {video.description || 'Nenhuma descrição fornecida.'}
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar Column: Related Videos */}
        <div className="lg:col-span-4 space-y-5" id="related-videos-column">
          <h2 className="text-base font-brand font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Film size={18} className="text-slate-500" />
            <span>Vídeos Recomendados</span>
          </h2>

          {relatedVideos.length === 0 ? (
            <div className="bg-white/50 border border-slate-200/50 rounded-2xl p-6 text-center text-slate-400 text-xs font-semibold">
              Sem mais vídeos na mesma categoria.
            </div>
          ) : (
            <div className="space-y-4">
              {relatedVideos.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/videos/${item.slug}`)}
                  className="bg-white border border-slate-200/50 hover:border-slate-300 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer flex gap-3 p-2.5 group"
                >
                  {/* Thumbnail */}
                  <div className="relative w-28 sm:w-32 aspect-video shrink-0 bg-slate-900 rounded-lg overflow-hidden">
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                      <Play size={12} className="text-white fill-current" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div className="space-y-1">
                      <h3 className="font-brand font-black text-slate-900 text-[11px] sm:text-xs leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold truncate">{item.channelName}</p>
                    </div>
                    
                    <div className="flex gap-1">
                      <span className="bg-indigo-50 text-indigo-700 text-[9px] font-black px-1.5 py-0.5 rounded">
                        {item.category}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
