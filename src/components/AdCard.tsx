import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ad } from '../types';
import { MapPin, MessageCircle, Clock, X, User, Phone, AlertTriangle, Heart, Flag, Search, ChevronLeft, ChevronRight, Tag, Star, ShoppingBag, Mail, Globe, Share2, ExternalLink, Anchor, Gauge, Ruler, Bed, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { formatPrice, getAdUrl, getAdLocationLabel } from '../utils';
import { sendEmailGeneric, getSellerEmail } from '../utils/emailService';
import OptimizedImage from './OptimizedImage';
import ReviewModal from './ReviewModal';

import { doc, updateDoc, increment, setDoc, deleteDoc, collection, query, where, limit, serverTimestamp } from 'firebase/firestore';
import { db, getDocWithCacheFallback, getDocsWithCacheFallback } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { triggerShare } from '../utils/shareUtils';

interface AdCardProps {
  ad: Ad;
  variant?: 'normal' | 'featured';
}

const AdCard: React.FC<AdCardProps> = ({ ad, variant = 'normal' }) => {
  const { user, profile, favorites, toggleFavoriteGlobal } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showContactWarning, setShowContactWarning] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [acceptedContactTerms, setAcceptedContactTerms] = useState(() => {
    return localStorage.getItem('safety_terms_accepted') === 'true';
  });
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [sellerReviews, setSellerReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showReviewsSection, setShowReviewsSection] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error' | 'loading'; message: string } | null>(null);

  // Estados da Vitrine
  const [showcaseActive, setShowcaseActive] = useState(false);
  const [showcaseSlug, setShowcaseSlug] = useState('');

  const showToastMsg = (type: 'success' | 'error' | 'loading', message: string, duration = 4000) => {
    setToast({ show: true, type, message });
    if (type !== 'loading') {
      setTimeout(() => {
        setToast(prev => prev && prev.message === message ? null : prev);
      }, duration);
    }
  };

  const isFavorite = favorites.includes(ad.id);

  const isAdFeatured = ad.isFeatured && ad.featuredUntil && (
    ad.featuredUntil.seconds 
      ? ad.featuredUntil.toDate() > new Date() 
      : new Date(ad.featuredUntil) > new Date()
  );

  const isNationalHighlight = isAdFeatured && (ad.featuredLevel === 'national' || ad.plan === 'national' || !ad.featuredLevel);

  const isCompactActive = settings?.compactCardMode === true;
  const isFeaturedVariant = variant === 'featured';
  const useCompactMode = isCompactActive && !isFeaturedVariant;

  const rawImages = ad.images && ad.images.length > 0 ? ad.images : [ad.imageUrl];
  const images = rawImages.filter((img): img is string => typeof img === 'string' && img.trim() !== '');
  if (images.length === 0) {
    images.push('https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=600&q=80');
  }
  const hasSourceUrl = !!(ad.sourceUrl && /^https?:\/\//i.test(ad.sourceUrl));

  const hasPrice =
    ad.category !== 'Imigração' &&
    ad.category !== 'Apoio ao Imigrante' &&
    ad.category !== 'Serviços Gratuitos' &&
    ad.category !== 'Informação' &&
    ad.price !== undefined &&
    ad.price !== null &&
    String(ad.price).trim() !== '' &&
    Number(ad.price) > 0;

  const isDetailsOpenRef = useRef(false);
  const isPopStateChange = useRef(false);

  React.useEffect(() => {
    if (showDetails) {
      isDetailsOpenRef.current = true;
      window.history.pushState({ modalOpen: true }, '', '');

      const handlePopState = (event: PopStateEvent) => {
        isPopStateChange.current = true;
        setShowDetails(false);
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    } else {
      if (isDetailsOpenRef.current && !isPopStateChange.current) {
        if (window.history.state?.modalOpen) {
          window.history.back();
        }
      }
      isDetailsOpenRef.current = false;
      isPopStateChange.current = false;
    }
  }, [showDetails]);

  React.useEffect(() => {
    if (showDetails && ad.sellerId) {
      fetchSellerProfile();
    }
  }, [ad.sellerId, showDetails]);

  React.useEffect(() => {
    let active = true;
    const checkShowcaseActive = async () => {
      if (!ad.sellerId) return;
      try {
        const docRef = doc(db, 'sellerPublicProfiles', ad.sellerId);
        const docSnap = await getDocWithCacheFallback(docRef, `sellerPublicProfiles/${ad.sellerId}`);
        if (active && docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.showcaseActive) {
            setShowcaseActive(true);
            setShowcaseSlug(data.showcaseSlug || '');
          } else {
            setShowcaseActive(false);
            setShowcaseSlug('');
          }
        } else {
          setShowcaseActive(false);
          setShowcaseSlug('');
        }
      } catch (err) {
        console.error('Error checking showcase active:', err);
      }
    };
    checkShowcaseActive();
    return () => { active = false; };
  }, [ad.sellerId]);

  const brandHeader = React.useMemo(() => {
    const mfr = (ad.manufacturer || '').trim();
    const mdl = (ad.model || '').trim();
    if (!mfr && !mdl) return null;

    if (mfr && mdl) {
      const mfrLower = mfr.toLowerCase();
      const mdlLower = mdl.toLowerCase();

      if (mdlLower === mfrLower || mdlLower.startsWith(mfrLower)) {
        return mfr;
      }

      const titleLower = (ad.title || '').toLowerCase();
      if (titleLower.includes(mfrLower)) {
        return mfr;
      }

      return `${mfr} • ${mdl}`;
    }

    return mfr || mdl;
  }, [ad.manufacturer, ad.model, ad.title]);

  const displayTitle = React.useMemo(() => {
    if (!ad.title) return '';
    let clean = ad.title.trim();

    if (ad.year) {
      const yearPattern = new RegExp(`\\s*\\(${ad.year}\\)\\s*$`, 'i');
      clean = clean.replace(yearPattern, '');
    }

    return clean;
  }, [ad.title, ad.year]);

  const fetchSellerProfile = async () => {
    try {
      setReviewsLoading(true);
      const ratingCount = (ad as any).sellerReviewCount !== undefined ? (ad as any).sellerReviewCount : ((ad as any).reviewCount !== undefined ? (ad as any).reviewCount : 0);
      const ratingAverage = (ad as any).sellerRating !== undefined ? (ad as any).sellerRating : ((ad as any).rating !== undefined ? (ad as any).rating : 0);

      const profileData: any = {
        uid: ad.sellerId,
        displayName: hasSourceUrl ? 'Parceiro' : (ad.sellerName || 'Vendedor'),
        city: ad.city || '',
        country: ad.country || 'Portugal',
        ratingAverage,
        ratingCount
      };

      console.log(`[AdCard] Evitando consultas Firestore para o vendedor ${ad.sellerId}. Usando dados integrados no documento de anúncio.`);
      setSellerProfile(profileData);
      setSellerReviews([]);
    } catch (err) {
      console.error('Error configuring seller profile fallback:', err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await toggleFavoriteGlobal(ad.id);
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    triggerShare({
      type: 'anuncio',
      title: ad.title,
      price: ad.price,
      country: ad.country,
      city: ad.city,
      url: `${window.location.origin}${getAdUrl(ad)}`
    });
  };

  const getAdPhone = () => {
    if (ad.useProfilePhone === false && ad.contactPhone) {
      return ad.contactPhone;
    }
    return ad.sellerPhone || '';
  };

  const cleanPhone = getAdPhone().replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello ${hasSourceUrl ? 'Partner' : ad.sellerName}, I am interested in your listing "${ad.title}" on ConnectBoat.`)}`;
  const targetContactUrl = hasSourceUrl ? ad.sourceUrl : whatsappUrl;

  const incrementViews = async () => {
    try {
      await updateDoc(doc(db, 'ads', ad.id), {
        views: increment(1)
      });
    } catch (err) {
      console.error('Error incrementing views:', err);
    }
  };

  const incrementClicks = async () => {
    try {
      await updateDoc(doc(db, 'ads', ad.id), {
        whatsappClicks: increment(1)
      });
    } catch (err) {
      console.error('Error incrementing clicks:', err);
    }
  };

  const handleContactClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (ad.demoListing) {
      showToastMsg('error', 'Este é um anúncio de demonstração e não está disponível para contacto ou compra.');
      return;
    }
    if (ad.adStatus === 'sold') {
      showToastMsg('error', 'Este anúncio já foi vendido. Não é possível contactar o vendedor.');
      return;
    }
    if (!user) {
      navigate(`/login?message=${encodeURIComponent('Para contactar o vendedor, faça login ou crie uma conta gratuita.')}`);
      return;
    }

    const accepted = localStorage.getItem('safety_terms_accepted') === 'true';
    if (accepted) {
      console.log('[AdCard] Safety terms already accepted. Registering interest directly.');
      incrementClicks();
      showToastMsg('loading', 'A registar o seu interesse no anúncio...');
      registerInterest().then((res: any) => {
        if (res.success) {
          if (res.bypassed) {
            showToastMsg('success', hasSourceUrl ? 'A abrir o link de contacto...' : 'A abrir o WhatsApp...', 2000);
          } else {
            showToastMsg('success', hasSourceUrl ? '👥 Interesse registado! A abrir o contacto...' : '👥 Interesse registado! A abrir o WhatsApp...', 3000);
          }
          setTimeout(() => {
            window.open(targetContactUrl, '_blank', 'noopener,noreferrer');
          }, 1000);
        } else {
          showToastMsg('error', `⚠️ Erro na BD: ${res.error || 'Falha ao registar'}. A abrir contacto...`, 6000);
          setTimeout(() => {
            window.open(targetContactUrl, '_blank', 'noopener,noreferrer');
          }, 2500);
        }
      });
    } else {
      setShowContactWarning(true);
    }
  };

  const registerInterest = async (): Promise<{ success: boolean; error?: string; bypassed?: boolean }> => {
    if (!user) {
      console.warn('[AdCard] Cannot register interest: No authenticated user.');
      return { success: false, error: 'Utilizador não autenticado. Faça login primeiro.' };
    }

    // 3. Em adInterests: não usar sellerId vazio. se ad.sellerId estiver ausente, não gravar adInterest e registrar erro claro no console. não tentar notification. abrir WhatsApp normalmente.
    if (!ad.sellerId || !ad.sellerId.trim()) {
      console.error(`[AdCard] Erro de Integridade: ad.sellerId está ausente ou vazio para o anúncio ID "${ad.id}". Registro de adInterests cancelado e abertura de WhatsApp liberada.`);
      return { success: true, bypassed: true };
    }

    const docId = `${ad.id}_${user.uid}`;
    const rawName = (profile?.name || user.displayName || user.email || '').trim();
    const sanitizedName = rawName.length > 0 ? rawName : 'ConnectBoat User';
    const truncatedName = sanitizedName.substring(0, 95); // Ensure it's under 100 character limit of rules
    
    const interestData = {
      id: docId,
      adId: ad.id,
      sellerId: ad.sellerId.trim(),
      interestedUserId: user.uid,
      interestedUserName: truncatedName,
      createdAt: serverTimestamp(),
      source: 'whatsapp'
    };
    
    // 5. Logs obrigatórios
    console.log(`[AdCard] Iniciando gravação de adInterest.`);
    console.log(`- user.uid: "${user.uid}"`);
    console.log(`- ad.id: "${ad.id}"`);
    console.log(`- ad.sellerId: "${ad.sellerId.trim()}"`);
    console.log(`- interestId: "${docId}"`);
    console.log(`- payload:`, JSON.stringify(interestData, null, 2));

    try {
      await setDoc(doc(db, 'adInterests', docId), interestData);
      console.log(`[AdCard] Sucesso ao gravar adInterest na coleção: "${docId}".`);

      const cacheKey = `interest_reg_${ad.id}_${user.uid}`;
      localStorage.setItem(cacheKey, 'true');

      // 2. Separar completamente: gravar adInterest e criar notification. O erro de notification NÃO pode impedir o registro de adInterest.
      // Tentar criar notification em bloco separado; se notification falhar, apenas console.warn
      if (ad.sellerId && ad.sellerId.trim() !== user.uid) {
        try {
          const notifId = `interest_${ad.id}_${user.uid}_${Date.now()}`;
          const notifData = {
            userId: ad.sellerId.trim(),
            title: 'Novo interesse em ' + ad.title.substring(0, 25) + '...',
            message: `${truncatedName} clicou no botão para o contactar via WhatsApp para o anúncio "${ad.title}".`,
            createdAt: serverTimestamp(),
            read: false,
            adId: ad.id,
            type: 'whatsapp_interest'
          };
          console.log('[AdCard] Tentando criar notificação em bloco separado:', notifData);
          await setDoc(doc(db, 'notifications', notifId), notifData);
          console.log('[AdCard] Notificação gravada com sucesso!');
        } catch (notifErr) {
          console.warn('[AdCard] Falha não bloqueante ao criar notificação de interesse:', notifErr);
        }

        // Desparar email de interesse de forma assíncrona
        getSellerEmail(ad.sellerId.trim()).then((sellerEmail) => {
          if (sellerEmail) {
            sendEmailGeneric('interesse_contacto', sellerEmail, {
              sellerName: ad.sellerName || 'Anunciante',
              adTitle: ad.title,
              interestedName: truncatedName,
              adId: ad.id
            }).catch(e => console.warn('[AdCard] Erro ao enviar email de interesse:', e));
          }
        }).catch(err => console.warn('[AdCard] Erro ao obter email de vendedor para interesse:', err));
      }

      return { success: true };
    } catch (err) {
      console.error(`[AdCard] Erro ao gravar adInterest com ID ${docId}:`, err);
      const errMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: errMsg };
    }
  };

  const confirmContact = async () => {
    if (ad.adStatus === 'sold') {
      showToastMsg('error', 'Este anúncio já foi vendido. Não é possível contactar o vendedor.');
      return;
    }
    if (acceptedContactTerms) {
      localStorage.setItem('safety_terms_accepted', 'true');
      incrementClicks();
      if (user) {
        showToastMsg('loading', 'A registar o seu interesse no anúncio...');
        const res = await registerInterest();
        if (res.success) {
          if (res.bypassed) {
            showToastMsg('success', hasSourceUrl ? 'A abrir o link de contacto...' : 'A abrir o WhatsApp...', 2000);
          } else {
            showToastMsg('success', hasSourceUrl ? '👥 Interesse registado! A abrir o contacto...' : '👥 Interesse registado! A abrir o WhatsApp...', 3000);
          }
          setTimeout(() => {
            window.open(targetContactUrl, '_blank', 'noopener,noreferrer');
          }, 1000);
        } else {
          showToastMsg('error', `⚠️ Erro na BD: ${res.error || 'Falha ao registar'}. A abrir contacto...`, 6000);
          setTimeout(() => {
            window.open(targetContactUrl, '_blank', 'noopener,noreferrer');
          }, 2500);
        }
      } else {
        window.open(targetContactUrl, '_blank', 'noopener,noreferrer');
      }
      setShowContactWarning(false);
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Faça login para denunciar!');
      return;
    }
    if (!reportReason) {
      alert('Selecione um motivo para a denúncia.');
      return;
    }

    setReporting(true);
    try {
      const reportId = `rep_${Date.now()}_${user.uid}`;
      await setDoc(doc(db, 'reports', reportId), {
        id: reportId,
        adId: ad.id,
        userId: user.uid,
        reason: reportReason,
        details: reportDetails,
        status: 'pending',
        createdAt: new Date()
      });
      alert('Listing reported successfully. Our team will review it.');
      setShowReportModal(false);
      setReportReason('');
      setReportDetails('');
    } catch (err) {
      console.error('Error submitting report:', err);
      alert('Error submitting report. Please try again.');
    } finally {
      setReporting(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => {
          if (ad.listingType === 'informativo') {
            navigate(ad.targetUrl || '/links');
          } else {
            navigate(getAdUrl(ad));
          }
        }}
        className={`card-flutuante overflow-hidden group flex flex-col h-full cursor-pointer relative transition-all duration-300 ${
          isFeaturedVariant
            ? (ad.category === '💚 Doações & Solidariedade' || ad.donationBadge || ad.featuredReason === 'donation')
              ? '!bg-gradient-to-br !from-[#f0fdf4] !to-[#dcfce7]/60 !border-emerald-200 shadow-lg shadow-emerald-100/40 hover:!border-emerald-400 hover:shadow-xl hover:shadow-emerald-100/60'
              : isNationalHighlight
                ? '!bg-gradient-to-br !from-[#f5f8ff] !to-[#eef2ff] !border-indigo-200 shadow-lg shadow-indigo-100/40 hover:!border-indigo-400 hover:shadow-xl hover:shadow-indigo-100/60'
                : '!bg-gradient-to-br !from-[#fffdf4] !to-[#faf5e6] !border-amber-200/80 shadow-lg shadow-amber-100/40 hover:!border-amber-300 hover:shadow-xl hover:shadow-amber-100/60'
            : isAdFeatured 
              ? (ad.category === '💚 Doações & Solidariedade' || ad.donationBadge || ad.featuredReason === 'donation')
                ? 'ring-2 ring-emerald-500 border border-emerald-450 shadow-md shadow-emerald-100/50 scale-[1.01]'
                : isNationalHighlight
                  ? 'ring-2 ring-indigo-500 border border-indigo-400 shadow-md shadow-indigo-100/50 scale-[1.01]'
                  : 'ring-2 ring-amber-400 border border-amber-300 shadow-md shadow-amber-100/50 scale-[1.01]' 
              : ''
        }`}
      >
        <div className={`relative aspect-square overflow-hidden transition-colors ${
          ad.listingType === 'informativo'
            ? 'bg-slate-100 flex items-center justify-center p-2'
            : isFeaturedVariant ? 'bg-slate-900 flex items-center justify-center' : 'bg-slate-900 flex items-center justify-center'
        }`}>
          {isAdFeatured && (
            <div className={`absolute z-20 bg-gradient-to-r ${
              (ad.category === '💚 Doações & Solidariedade' || ad.donationBadge || ad.featuredReason === 'donation')
                ? 'from-emerald-600 to-emerald-500 text-white font-sans'
                : isNationalHighlight
                  ? 'from-indigo-600 to-indigo-500 text-white font-sans'
                  : 'from-amber-500 to-yellow-400 text-white font-sans'
            } font-black rounded-full shadow-md flex items-center justify-center ${
              isFeaturedVariant 
                ? 'top-1 left-1 text-[8px] w-4.5 h-4.5' 
                : 'top-1.5 left-1.5 text-[9px] w-5 h-5'
            }`}>
              <span>{(ad.category === '💚 Doações & Solidariedade' || ad.donationBadge || ad.featuredReason === 'donation') ? '💚' : isNationalHighlight ? '👑' : '⭐'}</span>
            </div>
          )}
          {ad.externalListing && (
            <div className="absolute top-1.5 left-1.5 z-20 bg-indigo-900/90 backdrop-blur-md text-indigo-100 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm border border-indigo-400/30 flex items-center gap-1">
              <ExternalLink size={10} className="text-indigo-300 shrink-0" />
              <span>External Listing</span>
            </div>
          )}
          {ad.demoListing && !ad.externalListing && (
            <div className="absolute top-1.5 left-1.5 z-20 bg-amber-900/90 backdrop-blur-md text-amber-100 text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm border border-amber-400/30 flex items-center gap-1">
              <Tag size={10} className="text-amber-300 shrink-0" />
              <span>Example Listing</span>
            </div>
          )}
          {ad.boatType && (
            <div className="absolute top-1.5 right-1.5 z-20 bg-slate-900/80 backdrop-blur-md text-white text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm border border-white/20 flex items-center gap-1">
              <Anchor size={10} className="text-sky-400" />
              <span>{ad.boatType}</span>
            </div>
          )}
          {ad.listingType === 'informativo' && (
            <div className="absolute top-1 right-1 z-20 bg-emerald-600 text-white text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded shadow-sm">
              💡 Guia Útil
            </div>
          )}
          {(ad.status === 'sold' || ad.adStatus === 'sold') && (
            <div className="absolute inset-x-0 bottom-0 top-0 bg-slate-900/60 z-30 flex items-center justify-center backdrop-blur-[1.5px] pointer-events-none">
              <span className="bg-rose-600 text-white text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-lg border border-rose-500 flex items-center gap-1.5 animate-scale-in">
                <ShoppingBag size={12} className="fill-current text-white shrink-0" /> VENDIDO
              </span>
            </div>
          )}
          {ad.imageUrl && ad.listingType !== 'informativo' && (
            <img
              src={ad.imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-md opacity-40 scale-110 pointer-events-none z-0"
              referrerPolicy="no-referrer"
            />
          )}
          <OptimizedImage
            src={ad.imageUrl}
            alt={ad.title}
            className="w-full h-full object-contain transition-transform duration-500 relative z-10"
            referrerPolicy="no-referrer"
            style={ad.listingType === 'informativo' ? {
              objectPosition: 'center',
              transform: `scale(${isHovered ? 1.03 : 1})`
            } : {
              objectPosition: ad.imagePositionX !== undefined && ad.imagePositionY !== undefined
                ? `${ad.imagePositionX}% ${ad.imagePositionY}%`
                : '50% 50%',
              transform: `scale(${(ad.imageZoom || 1) * (isHovered ? 1.08 : 1)}) translate(${
                ad.imageZoom && ad.imageZoom > 1
                  ? ((ad.imagePositionX || 50) - 50) * (ad.imageZoom - 1) / ad.imageZoom
                  : 0
              }%, ${
                ad.imageZoom && ad.imageZoom > 1
                  ? ((ad.imagePositionY || 50) - 50) * (ad.imageZoom - 1) / ad.imageZoom
                  : 0
              }%)`
            }}
          />
        </div>

        <div className={
          useCompactMode 
            ? "p-2 pb-2.5 flex-1 flex flex-col justify-between min-w-0" 
            : isFeaturedVariant 
              ? "p-2 md:p-3 flex-1 flex flex-col min-w-0" 
              : "p-2.5 md:p-3.5 flex-1 flex flex-col min-w-0"
        }>
          <div className="flex justify-between items-start mb-1 md:mb-1.5 w-full min-w-0">
            <div className="w-full min-w-0">
              {brandHeader && (
                <span className="block text-[10px] md:text-[11px] font-black uppercase tracking-wider text-sky-700 truncate mb-0.5">
                  {brandHeader}
                </span>
              )}
              <h3 className={`font-extrabold text-slate-900 line-clamp-2 leading-snug group-hover:text-pt-green transition-colors tracking-tight break-words ${
                useCompactMode
                  ? 'text-xs'
                  : isFeaturedVariant 
                    ? 'text-xs md:text-sm' 
                    : 'text-sm md:text-[15px]'
              }`}>
                {displayTitle}
              </h3>
            </div>
          </div>

          <div className={`flex flex-col gap-0.5 text-slate-400 font-medium ${
            useCompactMode
              ? 'text-[10px] md:text-[11px] mb-0'
              : isFeaturedVariant 
                ? 'text-[9px] md:text-[10px] mb-1.5 md:mb-2' 
                : 'text-[10px] md:text-[11px] mb-2 md:mb-3'
          }`}>
            <div className="flex items-center gap-1 text-slate-600">
              {(ad.category === 'Boat Services' || ad.category === 'Serviços' || ad.category?.includes('Services') || ad.category?.includes('Serviços')) && ad.serviceCoverage === 'online' ? (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded border border-indigo-100 shadow-sm">
                  <span>💻</span> Online Service
                </span>
              ) : (ad.category === 'Boat Services' || ad.category === 'Serviços' || ad.category?.includes('Services') || ad.category?.includes('Serviços')) && (ad.serviceCoverage === 'uk' || ad.serviceCoverage === 'portugal') ? (
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded border border-emerald-100 shadow-sm">
                  <span>🌍</span> Nationwide Service
                </span>
              ) : (
                <>
                  <MapPin size={(useCompactMode || isFeaturedVariant) ? 10 : 12} className="text-indigo-500 shrink-0 opacity-75" />
                  <span className="truncate">
                    <span className="mr-1">{ad.country?.toLowerCase().includes('portugal') || ad.country?.toLowerCase().includes('pt') ? '🇵🇹' : '🇬🇧'}</span>{' '}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        if (ad.listingType === 'informativo') {
                          navigate(ad.targetUrl || '/links');
                        } else {
                          navigate(`${getAdUrl(ad)}#localizacao`);
                        }
                      }}
                      className="text-indigo-600 font-extrabold cursor-pointer hover:underline transition-colors"
                      title={ad.listingType === 'informativo' ? "View links" : "View location in listing"}
                    >
                      {getAdLocationLabel(ad)}
                    </span>
                  </span>
                </>
              )}
            </div>
            {!useCompactMode && (
              <div className="flex items-center gap-1 text-slate-500">
                <Tag size={isFeaturedVariant ? 10 : 12} className="text-teal-600 shrink-0 opacity-75" />
                <span className="truncate">{ad.category}</span>
              </div>
            )}
          </div>

          {!useCompactMode && (
            <>
              {/* Linha horizontal de ações */}
              <div className={`flex items-center justify-center border-t border-b border-dashed border-slate-100 ${
                isFeaturedVariant ? 'gap-3 py-1 mb-1.5' : 'gap-5 py-1.5 mb-2'
              }`}>
                {/* Favoritar */}
                <button
                  onClick={toggleFavorite}
                  className={`transition-all border shadow-sm cursor-pointer hover:scale-110 active:scale-95 ${
                    isFeaturedVariant ? 'p-1.5' : 'p-2'
                  } ${
                    isFavorite
                      ? 'bg-rose-50 border-rose-100 text-rose-600'
                      : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-rose-50 hover:border-rose-100 hover:text-rose-600'
                  }`}
                  title={isFavorite ? "Remove from saved" : "Save listing"}
                >
                  <Heart size={isFeaturedVariant ? 12 : 14} fill={isFavorite ? 'currentColor' : 'none'} className={isFavorite ? "text-rose-500" : ""} />
                </button>

                {/* Partilhar */}
                <button
                  onClick={handleShare}
                  className={`transition-all border shadow-sm cursor-pointer hover:scale-110 active:scale-95 bg-slate-50 border-slate-100 text-slate-400 hover:bg-sky-50 hover:border-sky-100 hover:text-sky-600 ${
                    isFeaturedVariant ? 'p-1.5' : 'p-2'
                  }`}
                  title="Share Listing"
                >
                  <Share2 size={isFeaturedVariant ? 12 : 14} />
                </button>

                {/* WhatsApp ou Contato */}
                {ad.listingType !== 'informativo' && ((getAdPhone() && getAdPhone().trim() !== '') || hasSourceUrl) && ad.adStatus !== 'sold' && ad.status !== 'sold' && (
                  <button
                    onClick={handleContactClick}
                    className={`transition-all border shadow-sm cursor-pointer hover:scale-110 active:scale-95 bg-slate-50 border-slate-100 ${
                      hasSourceUrl
                        ? 'text-indigo-400 hover:bg-indigo-50 hover:border-indigo-100 hover:text-indigo-600'
                        : 'text-slate-400 hover:bg-emerald-50 hover:border-emerald-100 hover:text-emerald-600'
                    } ${isFeaturedVariant ? 'p-1.5' : 'p-2'}`}
                    title={hasSourceUrl ? "Contato" : "Contactar via WhatsApp"}
                  >
                    {hasSourceUrl ? (
                      <ExternalLink size={isFeaturedVariant ? 12 : 14} className="text-indigo-600" />
                    ) : (
                      <MessageCircle size={isFeaturedVariant ? 12 : 14} className="text-[#25D366]" />
                    )}
                  </button>
                )}
              </div>

              {/* Preço (Elemento final de maior destaque) */}
              <div className="mt-auto pt-1 flex flex-col items-center justify-center text-center">
                {ad.listingType === 'informativo' ? (
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[9px] sm:text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 flex items-center gap-1">
                      💡 Links Úteis
                    </span>
                  </div>
                ) : (ad.category === '💚 Doações & Solidariedade' || ad.donationBadge) ? (
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[9px] sm:text-[10px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-150 flex items-center gap-1">
                      Grátis 💚
                    </span>
                  </div>
                ) : hasPrice ? (
                  <div className="flex flex-col items-center justify-center">
                    <div className={`font-black text-indigo-600 tracking-tight leading-none ${
                      isFeaturedVariant ? 'text-sm md:text-base' : 'text-base md:text-lg'
                    }`}>
                      {formatPrice(ad.price, ad.country)}
                    </div>
                    {(ad.status === 'sold' || ad.adStatus === 'sold') && ad.price !== undefined && Number(ad.price) > 0 && (
                      <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-tight flex items-center justify-center gap-1 mt-1">
                        <ShoppingBag size={10} /> Vendido
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <div className={`font-extrabold text-[#111111] uppercase tracking-wide leading-none ${
                      isFeaturedVariant ? 'text-[10px] md:text-xs' : 'text-xs md:text-sm'
                    }`}>
                      Sob Consulta
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Details Modal */}
      <AnimatePresence>
        {showDetails && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetails(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <button
                onClick={() => setShowDetails(false)}
                className="absolute top-4 right-4 z-20 p-2 bg-white/80 backdrop-blur-md rounded-full text-slate-900 hover:bg-white transition-colors shadow-sm"
              >
                <X size={24} />
              </button>

              <div className="overflow-y-auto flex-1 min-h-0">
                <div className="h-72 md:h-96 bg-slate-950 relative group/img overflow-hidden touch-none flex items-center justify-center">
                  {/* Backdrop com desfoque ambiente premium para fotos verticais/horizontais se integrarem sem cortes */}
                  <div 
                    className="absolute inset-0 bg-cover bg-center blur-xl opacity-35 select-none pointer-events-none scale-110"
                    style={{ backgroundImage: `url(${images[currentImageIndex]})` }}
                  />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentImageIndex}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="w-full h-full relative z-10 flex items-center justify-center"
                    >
                      <img
                        src={images[currentImageIndex]}
                        alt={ad.title}
                        className="max-w-full max-h-full object-contain cursor-grab active:cursor-grabbing"
                        onClick={() => setShowFullImage(true)}
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                  </AnimatePresence>

                  {images.length > 1 && (
                    <>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                        {images.map((_, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                              currentImageIndex === i ? 'bg-white w-4 shadow-sm' : 'bg-white/40'
                            }`}
                          />
                        ))}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 backdrop-blur-md rounded-full text-slate-900 opacity-0 group-hover/img:opacity-100 transition-opacity shadow-lg z-10"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 backdrop-blur-md rounded-full text-slate-900 opacity-0 group-hover/img:opacity-100 transition-opacity shadow-lg z-10"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </>
                  )}
                </div>

                <div className="p-4 md:p-6 pb-12 md:pb-16 font-sans">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {isAdFeatured && (
                      <span className={`${
                        (ad.category === '💚 Doações & Solidariedade' || ad.donationBadge || ad.featuredReason === 'donation')
                          ? 'bg-emerald-600 text-white'
                          : isNationalHighlight
                            ? 'bg-indigo-600 text-white'
                            : 'bg-amber-500 text-white'
                      } text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-sm flex items-center gap-1 animate-pulse`}>
                        <span>{(ad.category === '💚 Doações & Solidariedade' || ad.donationBadge || ad.featuredReason === 'donation') ? '💚' : isNationalHighlight ? '👑' : '⭐'}</span>
                        <span>{(ad.category === '💚 Doações & Solidariedade' || ad.donationBadge || ad.featuredReason === 'donation') ? 'Doação' : isNationalHighlight ? 'Destaque Nacional' : 'Destaque Local'}</span>
                      </span>
                    )}
                    <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider border border-indigo-100">
                      {ad.category}
                    </span>
                    {(ad.category === 'Serviços' || ad.category?.startsWith('Serviços') || ad.category?.includes('Serviços')) && ad.serviceCoverage === 'online' && (
                      <span className="bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-700 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border border-indigo-100 shadow-sm flex items-center gap-1">
                        <span>💻</span> Atendimento Online
                      </span>
                    )}
                    {(ad.category === 'Serviços' || ad.category?.startsWith('Serviços') || ad.category?.includes('Serviços')) && (ad.serviceCoverage === 'uk' || ad.serviceCoverage === 'portugal') && (
                      <span className="bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border border-emerald-100 shadow-sm flex items-center gap-1">
                        <span>🌍</span> Atendimento Nacional
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                    <div>
                      <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-tight mb-1">
                        {ad.title}
                      </h2>
                      <div className="flex items-center gap-3 text-slate-500 text-xs font-medium">
                        <div className="flex items-center gap-1">
                          {(ad.category === 'Serviços' || ad.category?.startsWith('Serviços') || ad.category?.includes('Serviços')) && ad.serviceCoverage === 'online' ? (
                            <span className="text-sm font-bold text-indigo-600">💻 Atendimento Online</span>
                          ) : (ad.category === 'Serviços' || ad.category?.startsWith('Serviços') || ad.category?.includes('Serviços')) && ad.serviceCoverage === 'uk' ? (
                            <span className="text-sm font-bold text-indigo-600">🌍 Todo o Reino Unido</span>
                          ) : (ad.category === 'Serviços' || ad.category?.startsWith('Serviços') || ad.category?.includes('Serviços')) && ad.serviceCoverage === 'portugal' ? (
                            <span className="text-sm font-bold text-indigo-600">🇵🇹 Todo Portugal</span>
                          ) : (
                            <>
                              <MapPin size={14} className="text-indigo-600" />
                              <span>{ad.country === 'Reino Unido' ? '🇬🇧' : '🇵🇹'} {getAdLocationLabel(ad)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {ad.category !== 'Imigração' && (
                      <div className="text-2xl md:text-3xl font-black text-indigo-600 flex items-center justify-center">
                        {ad.category === '💚 Doações & Solidariedade' ? (
                          <span className="text-emerald-600 font-extrabold flex items-center gap-1.5">Grátis 💚</span>
                        ) : (
                          formatPrice(ad.price, ad.country)
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Descrição</h4>
                      <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap break-words overflow-hidden">
                        {ad.description.length > 200 && !descriptionExpanded
                          ? `${ad.description.substring(0, 200).trim()}...`
                          : ad.description}
                      </p>
                      {ad.description.length > 200 && (
                        <button
                          onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors mt-1 active:scale-95 duration-200"
                        >
                          {descriptionExpanded ? 'Ver menos' : 'Ver mais'}
                        </button>
                      )}
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 md:p-6 space-y-4 border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vendedor</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="text-base font-bold text-slate-900">{hasSourceUrl ? 'Parceiro' : ad.sellerName}</span>
                            <div className="flex items-center gap-0.5 text-amber-500" title={`${sellerProfile?.ratingAverage || sellerProfile?.rating || 0} / 5`}>
                              {[1, 2, 3, 4, 5].map((star) => {
                                const ratingVal = sellerProfile?.ratingAverage || sellerProfile?.rating || 0;
                                const isFilled = star <= Math.round(ratingVal);
                                return (
                                  <Star
                                    key={star}
                                    size={12}
                                    className={isFilled ? "text-amber-400 fill-amber-400" : "text-slate-200"}
                                  />
                                );
                              })}
                              <span className="text-[10px] text-slate-500 font-bold ml-1">
                                ({sellerProfile?.ratingCount || 0})
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {showcaseActive && (
                        <div className="bg-indigo-50/70 border border-indigo-150 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 animate-fade-in text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🏪</span>
                            <div>
                              <span className="font-extrabold text-indigo-950 text-xs block">Este vendedor possui uma Vitrine Digital.</span>
                              <span className="text-[9px] text-indigo-600 block leading-tight">Conheça todos os seus produtos e serviços especiais.</span>
                            </div>
                          </div>
                          <Link
                            to={`/empreendedores/${showcaseSlug}`}
                            onClick={(e) => {
                              // Closes modal or stops propagation if needed
                              setShowDetails(false);
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black rounded-lg transition-all shadow-md text-center shrink-0 hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <span>Ver Vitrine</span>
                          </Link>
                        </div>
                      )}

                      <div className="flex flex-col gap-3">
                        {ad.status === 'sold' || ad.adStatus === 'sold' ? (
                          <div className="flex items-center justify-center gap-2 bg-slate-100 text-slate-500 py-3.5 px-4 rounded-xl font-bold text-sm border border-slate-200">
                            <ShoppingBag size={18} className="flex-shrink-0 text-slate-400" />
                            <span className="leading-tight">Listing Sold</span>
                          </div>
                        ) : (
                          <button
                            onClick={handleContactClick}
                            className={`flex items-center justify-center gap-2 ${
                              hasSourceUrl ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-500 hover:bg-emerald-600'
                            } text-white py-3 px-4 rounded-xl font-bold transition-all shadow-md text-sm active:scale-95 text-center`}
                          >
                            {hasSourceUrl ? (
                              <ExternalLink size={18} className="flex-shrink-0" />
                            ) : (
                              <MessageCircle size={18} className="flex-shrink-0" />
                            )}
                            <span className="leading-tight">{hasSourceUrl ? 'Contato' : 'Contactar via WhatsApp'}</span>
                          </button>
                        )}
                      </div>

                      {sellerReviews.length > 0 && (
                        <div className="pt-4 border-t border-slate-200">
                          <button
                            onClick={() => setShowReviewsSection(!showReviewsSection)}
                            className="flex items-center justify-between w-full text-xs font-bold text-indigo-600 uppercase tracking-wider"
                          >
                            <span>Avaliações do Vendedor ({sellerReviews.length})</span>
                            <span className="text-slate-400">{showReviewsSection ? 'Ocultar' : 'Mostrar'}</span>
                          </button>
                          
                          {showReviewsSection && (
                            <div className="mt-3 space-y-3 max-h-48 overflow-y-auto pr-1">
                              {sellerReviews.map((rev) => (
                                <div key={rev.id} className="bg-white p-3 rounded-xl border border-slate-100 text-xs shadow-sm">
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-slate-800">{rev.buyerName}</span>
                                    <div className="flex gap-0.5">
                                      {[1, 2, 3, 4, 5].map((s) => (
                                        <Star key={s} size={10} className={`${s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-100'}`} />
                                      ))}
                                    </div>
                                  </div>
                                  {rev.comment ? (
                                    <p className="text-slate-600 italic">"{rev.comment}"</p>
                                  ) : (
                                    <p className="text-slate-400 italic">Sem comentário escrito.</p>
                                  )}
                                  <div className="text-[9px] text-slate-400 mt-1">
                                    {rev.createdAt?.toDate ? formatDistanceToNow(rev.createdAt.toDate(), { addSuffix: true, locale: pt }) : 'Recentemente'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showReviewModal && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          adId={ad.id}
          adTitle={ad.title}
          adCategory={ad.category}
          sellerId={ad.sellerId}
          sellerName={hasSourceUrl ? 'Parceiro' : ad.sellerName}
          isBuyerRating={true}
          onSuccess={() => {
            alert('A sua avaliação foi enviada com sucesso!');
            fetchSellerProfile();
          }}
        />
      )}

      {/* Modal de Aviso de Contacto (Simpificado para o código não ficar gigante) */}
      <AnimatePresence>
        {showContactWarning && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowContactWarning(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl text-center"
            >
              <AlertTriangle className="mx-auto text-amber-500 mb-4" size={48} />
              <h3 className="text-xl font-bold mb-4">Aviso de Segurança</h3>
              <p className="text-slate-600 mb-6 text-sm">
                When contacting the seller, remember that ConnectBoat only facilitates the initial connection. 
                Never send payments in advance without verifying the vessel or equipment in person.
              </p>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 cursor-pointer justify-center text-sm">
                  <input 
                    type="checkbox" 
                    checked={acceptedContactTerms} 
                    onChange={(e) => setAcceptedContactTerms(e.target.checked)}
                  />
                  <span>I understand the safety guidelines</span>
                </label>
                <button
                  disabled={!acceptedContactTerms}
                  onClick={confirmContact}
                  className={`py-3 rounded-xl font-bold transition-all ${acceptedContactTerms ? (hasSourceUrl ? 'bg-sky-600 text-white' : 'bg-emerald-600 text-white') : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                  {hasSourceUrl ? 'Confirm & Open Link' : 'Confirm & Open WhatsApp'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Image Modal */}
      <AnimatePresence>
        {showFullImage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full h-full flex items-center justify-center"
              onClick={() => setShowFullImage(false)}
            >
              <button
                onClick={() => setShowFullImage(false)}
                className="absolute top-4 right-4 p-3 text-white/70 hover:text-white transition-colors z-10 bg-black/40 rounded-full"
              >
                <X size={24} />
              </button>
              <img
                src={images[currentImageIndex]}
                alt={ad.title}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Toast Proof of Interest */}
      {toast && toast.show && (
        <div className="fixed top-24 right-4 z-[400] max-w-sm w-full bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-bounce">
          {toast.type === 'loading' && (
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0"></div>
          )}
          {toast.type === 'success' && (
            <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white shrink-0 font-bold text-xs">✓</div>
          )}
          {toast.type === 'error' && (
            <div className="w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white shrink-0 font-bold text-xs text-center">✕</div>
          )}
          <div className="flex-1">
            <p className="text-xs font-bold tracking-tight">{toast.message}</p>
            {toast.type === 'success' && (
              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">The seller has been notified on ConnectBoat.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AdCard;