import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  MapPin, 
  MessageSquare, 
  Globe, 
  Facebook, 
  Instagram, 
  Share2, 
  ShoppingBag, 
  Tag, 
  Calendar,
  Check,
  X
} from 'lucide-react';
import { 
  incrementShowcaseView, 
  incrementWhatsappClick, 
  incrementProductView 
} from '../services/showcaseStatsService';
import { triggerShare } from '../utils/shareUtils';

const PageProductCard = ({ p, profile }: { p: any; profile: any; key?: any }) => {
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const navigate = useNavigate();
  const hasPrice = p.price != null && p.price !== "";
  
  const handleOpenDetails = () => {
    navigate(`/empreendedores/${profile.showcaseSlug}/produto/${p.id}`);
  };

  return (
    <div className="bg-white border border-slate-150 rounded-3xl shadow-xs overflow-hidden flex flex-col hover:border-indigo-100 transition-all group">
      {/* Product Image Viewer */}
      <div 
        onClick={handleOpenDetails}
        className="aspect-[4/3] w-full bg-slate-50 overflow-hidden relative border-b border-slate-100 shrink-0 cursor-pointer"
      >
        {p.images && p.images[activeImgIndex] ? (
          <img 
            src={p.images[activeImgIndex]} 
            alt={p.name} 
            className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <span className="text-4xl">🏬</span>
          </div>
        )}
        {hasPrice && (
          <span className="absolute bottom-3 right-3 bg-indigo-600 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-md">
            {p.price} €
          </span>
        )}

        {/* Multi-images Thumbnail Tracker */}
        {p.images && p.images.length > 1 && (
          <div className="absolute top-3 left-3 flex gap-1.5 bg-slate-900/40 backdrop-blur-xs p-1.5 rounded-xl z-10" onClick={(e) => e.stopPropagation()}>
            {p.images.map((img: string, idx: number) => (
              <button
                key={`idx-img-thumb-${idx}`}
                type="button"
                onClick={() => setActiveImgIndex(idx)}
                className={`w-3 h-3 rounded-full border border-white transition-all ${
                  activeImgIndex === idx ? 'bg-indigo-600 scale-110' : 'bg-white/80'
                }`}
                title={`Ver foto ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product details */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-1.5 cursor-pointer" onClick={handleOpenDetails}>
          <div className="flex items-center justify-between gap-1.5 pt-0.5">
            <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-base line-clamp-1">{p.name}</h3>
            <span className="text-[10px] text-indigo-600 font-extrabold shrink-0 hover:underline">Ver detalhes</span>
          </div>
          <p className="text-xs text-slate-550 font-medium line-clamp-3 leading-relaxed">{p.description}</p>
        </div>

        <button
          onClick={handleOpenDetails}
          className="w-full py-3.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white font-extrabold text-xs flex items-center justify-center gap-2 border border-emerald-100 transition-all cursor-pointer shadow-xs"
        >
          <MessageSquare size={14} />
          Pedir pelo WhatsApp
        </button>
      </div>
    </div>
  );
};

const EmpreendedorDetalhes = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isModerator } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const fetchShowcaseDetail = async () => {
      if (!slug) return;
      setLoading(true);
      setProductsLoading(true);
      try {
        const q = query(
          collection(db, 'sellerPublicProfiles'),
          where('showcaseSlug', '==', slug),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docData = snap.docs[0].data();
          const userId = snap.docs[0].id;
          setProfile({
            uid: userId,
            ...docData
          } as unknown as UserProfile);

          // Registrar visualização na base de dados
          incrementShowcaseView(userId);

          // Fetch products/services associated with this seller
          try {
            const pQuery = query(
              collection(db, 'sellerPublicProfiles', userId, 'products'),
              where('active', '==', true)
            );
            const pSnap = await getDocs(pQuery);
            const pList = pSnap.docs.map(pDoc => ({ id: pDoc.id, ...pDoc.data() }));
            pList.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
            setProducts(pList);
          } catch (pErr) {
            console.error('Erro ao buscar produtos da vitrine:', pErr);
          }
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error('Erro ao buscar particularidades do empreendedor:', err);
      } finally {
        setLoading(false);
        setProductsLoading(false);
      }
    };

    fetchShowcaseDetail();
  }, [slug]);

  useEffect(() => {
    const handleGlobalShareRequest = (e: Event) => {
      if (!profile) return;
      const customEvent = e as CustomEvent<{ onHandled: () => void }>;
      if (customEvent.detail && typeof customEvent.detail.onHandled === 'function') {
        customEvent.detail.onHandled();
      }
      handleCopyLink();
    };
    window.addEventListener('request-share-current-page', handleGlobalShareRequest);
    return () => {
      window.removeEventListener('request-share-current-page', handleGlobalShareRequest);
    };
  }, [profile]);

  const handleCopyLink = () => {
    if (!profile) return;
    triggerShare({
      type: 'vitrine',
      title: profile.showcaseName || profile.name,
      description: profile.showcaseDescription || profile.bio || '',
      url: window.location.href
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-4 animate-pulse">
        <div className="h-64 bg-slate-200 rounded-3xl" />
        <div className="h-10 bg-slate-200 rounded w-1/3 mx-auto" />
        <div className="h-6 bg-slate-200 rounded w-2/3 mx-auto" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6" id="not-found-showcase">
        <span className="text-6xl block">🏬</span>
        <h2 className="text-2xl font-black text-slate-800">Vitrine Indisponível</h2>
        <p className="text-slate-500 text-sm">
          A vitrine que procura não existe ou foi temporariamente desativada pelo proprietário.
        </p>
        <Link 
          to="/empreendedores" 
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-2xl transition-all shadow-md shadow-indigo-100 text-sm"
        >
          <ArrowLeft size={16} />
          Voltar a Empreendedores
        </Link>
      </div>
    );
  }

  const isOwner = user && user.uid === profile.uid;
  const isStaff = isAdmin || isModerator;
  const isPending = profile.showcaseApproved !== true;

  if (isPending && !isOwner && !isStaff) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6" id="pending-showcase">
        <span className="text-6xl block">⏳</span>
        <h2 className="text-2xl font-black text-slate-800">Vitrine em Moderação</h2>
        <p className="text-slate-500 text-sm leading-relaxed">
          Esta vitrine de negócios acabou de ser criada ou editada e está em análise pela equipe de moderação. 
          Ficará visível para o público em geral assim que for aprovada!
        </p>
        <Link 
          to="/empreendedores" 
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-2xl transition-all shadow-md shadow-indigo-100 text-sm"
        >
          <ArrowLeft size={16} />
          Voltar a Empreendedores
        </Link>
      </div>
    );
  }

  const fallbackCover = 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80';
  const rawCountry = profile.country || '';
  const countryFormatted = rawCountry === 'Portugal' ? '🇵🇹 Portugal' : rawCountry === 'Reino Unido' ? '🇬🇧 Reino Unido' : rawCountry;

  // Format WhatsApp Link
  const numericPhone = profile.showcaseWhatsapp ? profile.showcaseWhatsapp.replace(/\+/g, '').replace(/\D/g, '') : '';
  const whatsappUrl = `https://wa.me/${numericPhone}?text=${encodeURIComponent(
    `Olá! 👋 Encontrei a sua Vitrine Digital "${profile.showcaseName}" no Mercado Luso e gostava de obter mais informações sobre os seus serviços/produtos.`
  )}`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-8" id="showcase-detail">
      {isPending && (isOwner || isStaff) && (
        <div className="bg-amber-550 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-xs font-bold flex items-start gap-2.5 shadow-sm">
          <span className="text-base">⏳</span>
          <div className="space-y-1">
            <p className="font-extrabold text-amber-950">MODO PREVIEW DICA</p>
            <p className="font-medium text-amber-800">Esta vitrine ainda não foi aprovada pela administração e está oculta do público. Apenas você por ser o dono ou um moderador/admin consegue visualizar esta página.</p>
          </div>
        </div>
      )}
      {/* Visual Back Arrow Container */}
      <div className="flex justify-between items-center">
        <Link
          to="/empreendedores"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-indigo-600 text-sm font-black transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Explorar Empreendedores</span>
        </Link>

        {/* Share Button */}
        <button
          onClick={handleCopyLink}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 hover:text-indigo-600 border border-slate-200 hover:border-indigo-100 rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer"
        >
          {copiedLink ? <Check size={14} className="text-emerald-500" /> : <Share2 size={14} />}
          <span>{copiedLink ? 'Ligação Copiada!' : 'Partilhar Vitrine'}</span>
        </button>
      </div>

      {/* Visual Header Block */}
      <div className="relative rounded-3xl overflow-hidden bg-white border border-slate-100 shadow-md">
        {/* Capa */}
        <div className="h-56 sm:h-72 md:h-80 w-full bg-slate-900 overflow-hidden relative">
          <img 
            src={profile.showcaseCover || fallbackCover} 
            alt="Capa do negócio" 
            className="w-full h-full object-cover" 
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none z-10" />
        </div>

        {/* Floating Logo overlay */}
        <div className="relative px-6 sm:px-8 pb-6 flex flex-col sm:flex-row sm:items-end gap-5 -mt-10 sm:-mt-14">
          <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl bg-white border-4 border-white shadow-lg flex items-center justify-center overflow-hidden shrink-0 z-10">
            {profile.showcaseLogo && profile.showcaseLogo.trim() !== '' ? (
              <img 
                src={profile.showcaseLogo || null} 
                alt="Logo do negócio" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-3xl sm:text-4xl">🏬</span>
            )}
          </div>

          <div className="space-y-1 sm:mb-2 flex-1">
            <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md uppercase tracking-wider block w-fit">
              {profile.showcaseCategory || 'Outros'}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-snug">
              {profile.showcaseName}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 font-semibold text-xs sm:text-sm">
              <div className="flex items-center gap-1">
                <MapPin size={14} className="text-slate-400" />
                <span>{profile.city ? `${profile.city}, ` : ''}{countryFormatted}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Structured Bento Columns Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left main: Quem Somos / Description & Products Catalogue */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-4">
              <span className="text-xl">✍️</span>
              <h2 className="text-xl font-bold text-slate-950">Quem Somos</h2>
            </div>
            
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed whitespace-pre-line font-medium">
              {profile.showcaseDescription}
            </p>
          </div>

          {/* SECÇÃO DE PRODUTOS E SERVIÇOS */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-50 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛒</span>
                <h2 className="text-xl font-bold text-slate-950">Produtos & Serviços da Vitrine</h2>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 font-mono">
                {products.length} {products.length === 1 ? 'disponível' : 'disponíveis'}
              </span>
            </div>

            {productsLoading ? (
              <div className="text-center py-12 text-slate-400 text-xs">A carregar catálogo de itens...</div>
            ) : products.length === 0 ? (
              <div className="p-12 border-2 border-dashed border-slate-100 rounded-2xl text-center text-slate-400 text-sm font-medium">
                Esta vitrine ainda não cadastrou produtos ou serviços no seu catálogo.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {products.map((p) => (
                  <PageProductCard key={p.id} p={p} profile={profile} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side: Contact & Actions box */}
        <div className="space-y-6">
          {/* Main call to contact */}
          <div className="bg-gradient-to-b from-indigo-50/10 via-white to-white p-6 rounded-3xl border border-indigo-100/40 shadow-md space-y-6">
            <h3 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Tag size={16} className="text-indigo-600" />
              <span>Contacto Direto</span>
            </h3>

            {/* Main Action buttons */}
            <a
              href={whatsappUrl}
              target="_blank"
              onClick={() => {
                if (profile && profile.uid) {
                  incrementWhatsappClick(profile.uid);
                }
              }}
              rel="noopener noreferrer"
              className="w-full py-4 px-6 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-100 hover:scale-[1.01] transition-all cursor-pointer text-sm"
            >
              <MessageSquare size={18} />
              <span>Contactar no WhatsApp</span>
            </a>

            {/* Social Medias block */}
            {(profile.showcaseFacebook || profile.showcaseInstagram) && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Redes Sociais</span>
                <div className="flex flex-col gap-2.5">
                  {profile.showcaseFacebook && (
                    <a
                      href={profile.showcaseFacebook.startsWith('http') ? profile.showcaseFacebook : `https://${profile.showcaseFacebook}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-xs text-slate-700 hover:text-indigo-600 font-bold transition-colors"
                    >
                      <Facebook size={16} className="text-blue-600" />
                      <span>Visitar Página Facebook</span>
                    </a>
                  )}
                  {profile.showcaseInstagram && (
                    <a
                      href={profile.showcaseInstagram.startsWith('http') ? profile.showcaseInstagram : `https://${profile.showcaseInstagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-xs text-slate-700 hover:text-indigo-600 font-bold transition-colors"
                    >
                      <Instagram size={16} className="text-pink-600" />
                      <span>Seguir no Instagram</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick info specs widget */}
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-xs text-slate-500 font-semibold space-y-3">
            <div className="flex justify-between items-center py-1">
              <span>Membro desde:</span>
              <span className="text-slate-800 flex items-center gap-1">
                <Calendar size={12} className="text-slate-400" />
                {profile.createdAt ? (
                  new Date(profile.createdAt.toDate ? profile.createdAt.toDate() : profile.createdAt).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
                ) : 'Recente'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-t border-slate-100/50">
              <span>Status da Vitrine:</span>
              <span className="text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase border border-emerald-100">
                Ativa
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmpreendedorDetalhes;
