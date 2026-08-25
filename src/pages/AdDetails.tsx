import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, MessageCircle, Clock, ChevronLeft, ChevronRight, X, Heart, Star, 
  Trash2, Edit, AlertCircle, ShieldAlert, Eye, EyeOff, Award, Calendar, Share2, ExternalLink,
  Anchor, Compass, Gauge, ShieldCheck, Ruler, Fuel, Check, Bed, Tag, Play, Video
} from 'lucide-react';
import { 
  doc, updateDoc, increment, setDoc, collection, query, where, limit, getDoc, serverTimestamp, Timestamp, onSnapshot 
} from 'firebase/firestore';
import { db, getDocWithCacheFallback, getDocsWithCacheFallback, parseFirestoreDate, handleFirestoreError, OperationType } from '../firebase';
import { Ad, UserProfile, Review, getRegionForCity } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatPrice, getAdUrl, extractIdFromSlug, getAdLocationLabel } from '../utils';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import ReviewModal from '../components/ReviewModal';
import AdCard from '../components/AdCard';
import ImageLightboxModal from '../components/ImageLightboxModal';
import { normalizeDescription } from '../utils/textFormatter';
import { triggerShare } from '../utils/shareUtils';

export interface MediaItem {
  type: 'video' | 'image';
  url: string;
  thumbUrl?: string;
  imageIndex?: number;
}

const AdDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile, favorites, toggleFavoriteGlobal, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [ad, setAd] = useState<Ad | null>(null);
  const isService = ad ? (ad.category === 'Boat Services' || ad.category === 'Serviços' || ad.category?.includes('Services') || ad.category?.includes('Serviços')) : false;
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [listingAdCampaigns, setListingAdCampaigns] = useState<any[]>([]);
  const [listingAdIndex, setListingAdIndex] = useState(0);

  // Imagens e galeria
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFullImage, setShowFullImage] = useState(false);
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);
  const mobileVideoRef = useRef<HTMLVideoElement | null>(null);

  // Smart Touch Gesture Handling for Main Gallery Photo
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchDirectionRef = useRef<'horizontal' | 'vertical' | null>(null);

  const handleGalleryTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
    touchDirectionRef.current = null;
  };

  const handleGalleryTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartRef.current.x;
    const deltaY = currentY - touchStartRef.current.y;

    // Determine gesture direction once movement exceeds threshold (8px)
    if (!touchDirectionRef.current) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX > 8 || absY > 8) {
        if (absX > absY) {
          touchDirectionRef.current = 'horizontal';
        } else {
          touchDirectionRef.current = 'vertical';
        }
      }
    }
  };

  const handleGalleryTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const endX = e.changedTouches[0]?.clientX ?? touchStartRef.current.x;
    const deltaX = endX - touchStartRef.current.x;
    const duration = Date.now() - touchStartRef.current.time;

    // Navigate photos ONLY if the gesture direction was predominantly horizontal
    if (touchDirectionRef.current === 'horizontal' && mediaItems.length > 1) {
      const minSwipeDistance = 40;
      if (Math.abs(deltaX) >= minSwipeDistance && duration < 800) {
        pauseVideos();
        if (deltaX < 0) {
          // Swiped Left -> Next image
          setCurrentImageIndex((prev) => (prev === mediaItems.length - 1 ? 0 : prev + 1));
        } else {
          // Swiped Right -> Previous image
          setCurrentImageIndex((prev) => (prev === 0 ? mediaItems.length - 1 : prev - 1));
        }
      }
    }

    touchStartRef.current = null;
    touchDirectionRef.current = null;
  };

  const pauseVideos = () => {
    if (mainVideoRef.current) mainVideoRef.current.pause();
    if (mobileVideoRef.current) mobileVideoRef.current.pause();
  };

  useEffect(() => {
    pauseVideos();
  }, [currentImageIndex]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'advertisingCampaigns'),
      (snapshot) => {
        const todayString = new Date().toISOString().slice(0, 10);
        const campaigns = snapshot.docs
          .map((campaignDoc) => ({ id: campaignDoc.id, ...campaignDoc.data() } as any))
          .filter((campaign) => {
            if (campaign.enabled !== true || !campaign.imageUrl) return false;
            if (campaign.startDate && campaign.startDate > todayString) return false;
            if (campaign.endDate && campaign.endDate < todayString) return false;
            return true;
          })
          .sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return aTime - bTime;
          });

        setListingAdCampaigns(campaigns);
        setListingAdIndex((current) => campaigns.length === 0 ? 0 : Math.min(current, campaigns.length - 1));
      },
      (error) => console.warn('[AdDetails] Advertising campaigns unavailable:', error)
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (listingAdCampaigns.length <= 1) return;

    const campaign = listingAdCampaigns[listingAdIndex];
    const seconds = Math.min(60, Math.max(2, Number(campaign?.displaySeconds || 4)));

    const timer = window.setTimeout(() => {
      setListingAdIndex((current) => (current + 1) % listingAdCampaigns.length);
    }, seconds * 1000);

    return () => window.clearTimeout(timer);
  }, [listingAdCampaigns, listingAdIndex]);

  useEffect(() => {
    const campaign = listingAdCampaigns[listingAdIndex];
    if (!campaign?.id) return;

    updateDoc(doc(db, 'advertisingCampaigns', campaign.id), {
      impressions: increment(1),
    }).catch((error) => console.warn('[AdDetails] Unable to register banner impression:', error));
  }, [listingAdCampaigns, listingAdIndex]);

  const handleAdvertisingClick = (campaign: any) => {
    if (!campaign?.id) return;
    updateDoc(doc(db, 'advertisingCampaigns', campaign.id), {
      clicks: increment(1),
    }).catch((error) => console.warn('[AdDetails] Unable to register banner click:', error));
  };

  // Vendedor e avaliações gerais
  const [sellerProfile, setSellerProfile] = useState<UserProfile | null>(null);
  const [sellerReviews, setSellerReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showReviewsSection, setShowReviewsSection] = useState(true);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error' | 'loading'; message: string } | null>(null);

  // Related Ads & Swipe Gestures
  const [relatedAds, setRelatedAds] = useState<Ad[]>([]);
  const [sellerAds, setSellerAds] = useState<Ad[]>([]);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    pauseVideos();
    if (diff > 50 && mediaItems.length > 1) {
      setCurrentImageIndex((prev) => (prev === mediaItems.length - 1 ? 0 : prev + 1));
    } else if (diff < -50 && mediaItems.length > 1) {
      setCurrentImageIndex((prev) => (prev === 0 ? mediaItems.length - 1 : prev - 1));
    }
    setTouchStartX(null);
  };

  const showToastMsg = (type: 'success' | 'error' | 'loading', message: string, duration = 4000) => {
    setToast({ show: true, type, message });
    if (type !== 'loading') {
      setTimeout(() => {
        setToast(prev => prev && prev.message === message ? null : prev);
      }, duration);
    }
  };

  // Segurança de Contacto WhatsApp
  const [showContactWarning, setShowContactWarning] = useState(false);
  const [acceptedContactTerms, setAcceptedContactTerms] = useState(() => {
    return localStorage.getItem('safety_terms_accepted') === 'true';
  });

  // Denúncia
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);

  // Conditions para Negócios Reivindicáveis/Claimable
  const [showUnclaimedContactModal, setShowUnclaimedContactModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimName, setClaimName] = useState('');
  const [claimPhone, setClaimPhone] = useState('');
  const [claimEmail, setClaimEmail] = useState('');
  const [claimMessage, setClaimMessage] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  // Auto-preencher dados de reivindicação baseados no perfil do utilizador logado
  useEffect(() => {
    if (user && profile && showClaimModal) {
      setClaimName(profile.name || user.displayName || '');
      setClaimEmail(profile.email || user.email || '');
      setClaimPhone(profile.phone || '');
    }
  }, [user, profile, showClaimModal]);

  const handleOpenClaimModal = () => {
    if (!user) {
      navigate(`/login?message=${encodeURIComponent('Para reivindicar este negócio, faça login ou crie uma conta gratuita.')}&redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setShowClaimModal(true);
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ad || !user) return;
    if (!claimName.trim() || !claimPhone.trim() || !claimEmail.trim()) {
      showToastMsg('error', 'Por favor preencha todos os campos obrigatórios.');
      return;
    }
    setClaimSubmitting(true);
    try {
      const claimId = `${ad.id}_${user.uid}_${Date.now()}_claim`;
      const claimRef = doc(db, 'businessClaimRequests', claimId);

      const claimPayload = {
        id: claimId,
        adId: ad.id,
        adTitle: ad.title,
        userId: user.uid,
        name: claimName,
        phone: claimPhone,
        email: claimEmail,
        message: claimMessage,
        status: 'pending',
        createdAt: serverTimestamp()
      };
      
      try {
        await setDoc(claimRef, claimPayload);
      } catch (writeErr) {
        handleFirestoreError(writeErr, OperationType.WRITE, `businessClaimRequests/${claimId}`);
        throw writeErr;
      }
      
      showToastMsg('success', 'Pedido de referência submetido com sucesso! Será analisado pela administração.');
      setShowClaimModal(false);
    } catch (err) {
      console.error('Erro ao submeter pedido de reivindicação:', err);
      const rawMsg = err instanceof Error ? err.message : String(err);
      let displayError = 'Ocorreu um erro ao submeter o seu pedido. Tente novamente mais tarde.';
      try {
        const parsed = JSON.parse(rawMsg);
        if (parsed && parsed.error) {
          displayError = `Erro na BD: ${parsed.error}`;
        }
      } catch (_) {
        if (rawMsg) {
          displayError = `Erro: ${rawMsg}`;
        }
      }
      showToastMsg('error', displayError);
    } finally {
      setClaimSubmitting(false);
    }
  };

  const isFavorite = ad ? favorites.includes(ad.id) : false;

  // Carregar anúncio e incrementar visualização
  useEffect(() => {
    if (!id) return;

    let active = true;
    const fetchAdData = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const realId = extractIdFromSlug(id);
        const adRef = doc(db, 'ads', realId);
        const adSnap = await getDocWithCacheFallback(adRef, `ads/${realId}`);

        if (!active) return;

        if (!adSnap.exists()) {
          setErrorMsg('Anúncio não encontrado ou já expirado.');
          setLoading(false);
          return;
        }

        const adData = { id: adSnap.id, ...adSnap.data() } as Ad;

        if (adData.isHidden && user?.email !== 'valtailubereats@gmail.com' && user?.uid !== adData.sellerId) {
          setErrorMsg('Este anúncio encontra-se temporariamente em standby / oculto pela administração.');
          setLoading(false);
          return;
        }

        // --- NEW BUSINESS VIEWS & MILESTONES LOGIC ---
        if (adData.isClaimableBusiness) {
          const sessionKey = `last_viewed_claimable_${adData.id}`;
          const lastViewedStr = sessionStorage.getItem(sessionKey);
          const now = Date.now();
          const cooldownPeriod = 3600000; // 1 hour cooldown (3,600,000 ms)
          
          if (!lastViewedStr || now - parseInt(lastViewedStr, 10) > cooldownPeriod) {
            sessionStorage.setItem(sessionKey, now.toString());
            
            const currentBusinessViews = Number(adData.businessViews || 0) + 1;
            const updatesToApply: Record<string, any> = {
              businessViews: increment(1)
            };
            
            adData.businessViews = currentBusinessViews;
            
            try {
              await updateDoc(adRef, updatesToApply);
            } catch (bvErr) {
              console.error('Erro ao incrementar visualizações do negócio/milestones:', bvErr);
            }
          }
        }
        // --- END OF NEW LOGIC ---

        setAd(adData);

        // Incrementar visualização no Firestore
        try {
          await updateDoc(adRef, { views: increment(1) });
        } catch (vErr) {
          console.error('Erro ao incrementar visualizações:', vErr);
        }

        // Carregar vendedor e avaliações
        if (adData.sellerId) {
          fetchSellerDetails(adData.sellerId);
        }
      } catch (err) {
        console.error('Erro ao carregar anúncio:', err);
        setErrorMsg('Erro de rede ao conectar à base de dados. Tente novamente.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchAdData();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!loading && ad && location.hash === '#localizacao') {
      const timer = setTimeout(() => {
        const element = document.getElementById('localizacao');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loading, ad, location.hash]);

  const fetchSellerDetails = async (sellerId: string) => {
    try {
      setReviewsLoading(true);
      
      const ratingAverage = (ad as any)?.sellerRating !== undefined ? (ad as any).sellerRating : ((ad as any)?.rating !== undefined ? (ad as any).rating : 0);
      const ratingCount = (ad as any)?.sellerReviewCount !== undefined ? (ad as any).sellerReviewCount : ((ad as any)?.reviewCount !== undefined ? (ad as any).reviewCount : 0);

      const profileData: any = {
        uid: sellerId,
        displayName: (ad && ad.sourceUrl && /^https?:\/\//i.test(ad.sourceUrl)) ? 'Parceiro' : (ad?.sellerName || 'Vendedor'),
        city: ad?.city || '',
        country: ad?.country || 'Reino Unido',
        ratingAverage,
        ratingCount
      };

      console.log(`[AdDetails] Evitando fetch de sellerPublicProfiles para o vendedor ${sellerId} para poupar leituras Firestore.`);

      // Carregar reviews enviadas a este vendedor se o utilizador estiver autenticado
      let reviewsData: Review[] = [];
      if (user) {
        try {
          const q = query(collection(db, 'reviews'), where('sellerId', '==', sellerId), limit(8));
          const snap = await getDocsWithCacheFallback(q, `reviews/sellerId-${sellerId}`);
          reviewsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
          
          // Ordenação decrescente de data
          reviewsData.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
          });
        } catch (reviewErr) {
          console.warn('Erro ao carregar avaliações do vendedor:', reviewErr);
        }
      }

      setSellerReviews(reviewsData);

      // Calcular fallback de estatísticas se campos inexistirem no doc principal
      let finalCount = profileData.ratingCount;
      let finalAverage = profileData.ratingAverage;

      if (reviewsData.length > 0 && (finalCount === 0 || finalAverage === 0)) {
        finalCount = reviewsData.length;
        const totalStars = reviewsData.reduce((sum, rev) => sum + (rev.rating || 0), 0);
        finalAverage = parseFloat((totalStars / finalCount).toFixed(1));
      }

      setSellerProfile({
        ...profileData,
        ratingAverage: finalAverage,
        ratingCount: finalCount
      } as UserProfile);

    } catch (err) {
      console.error('Erro ao carregar detalhes do vendedor:', err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!ad) return;
    try {
      await toggleFavoriteGlobal(ad.id);
    } catch (err) {
      console.error('Erro ao favoritar:', err);
    }
  };

  const getAdPhone = () => {
    if (!ad) return '';
    if (ad.useProfilePhone === false && ad.contactPhone) {
      return ad.contactPhone;
    }
    return ad.sellerPhone || '';
  };

  const cleanPhone = (phone: string) => {
    return phone.replace(/\D/g, '');
  };

  const getWhatsappUrl = () => {
    if (!ad) return '';
    const phone = cleanPhone(getAdPhone());
    return `https://wa.me/${phone}?text=${encodeURIComponent(`Hello, I saw your listing "${ad.title}" on ConnectBoat and I'm interested. Is it still available?`)}`;
  };

  const hasSourceUrl = !!(ad && ad.sourceUrl && /^https?:\/\//i.test(ad.sourceUrl));

  const getTargetContactUrl = () => {
    if (!ad) return '';
    if (hasSourceUrl && ad.sourceUrl) {
      return ad.sourceUrl;
    }
    return getWhatsappUrl();
  };

  const incrementWhatsappClicks = async () => {
    if (!ad) return;
    try {
      await updateDoc(doc(db, 'ads', ad.id), {
        whatsappClicks: increment(1)
      });
    } catch (err) {
      console.error('Erro ao registar clique no WhatsApp:', err);
    }
  };

  const handleContactClick = () => {
    if (ad?.isClaimableBusiness && (ad.claimStatus === 'unclaimed' || !ad.claimStatus)) {
      setShowUnclaimedContactModal(true);
      return;
    }
    if (ad?.adStatus === 'sold' || ad?.status === 'sold') {
      showToastMsg('error', 'Este anúncio já foi vendido. Não é possível contactar o vendedor.');
      return;
    }
    if (!user) {
      navigate(`/login?message=${encodeURIComponent('Para contactar o vendedor, faça login ou crie uma conta gratuita.')}`);
      return;
    }

    const accepted = localStorage.getItem('safety_terms_accepted') === 'true';
    if (accepted && ad) {
      console.log('[AdDetails] Safety terms already accepted. Registering interest directly.');
      incrementWhatsappClicks();
      showToastMsg('loading', 'A registar o seu interesse no anúncio...');
      registerInterest().then((res: any) => {
        if (res.success) {
          if (res.bypassed) {
            showToastMsg('success', hasSourceUrl ? 'A abrir o link de contacto...' : 'A abrir o WhatsApp...', 2000);
          } else {
            showToastMsg('success', hasSourceUrl ? '👥 Interesse registado! A abrir o contacto...' : '👥 Interesse registado! A abrir o WhatsApp...', 3000);
          }
          setTimeout(() => {
            window.open(getTargetContactUrl(), '_blank', 'noopener,noreferrer');
          }, 1000);
        } else {
          showToastMsg('error', `⚠️ Erro na BD: ${res.error || 'Falha ao registar'}. A abrir contacto...`, 6000);
          setTimeout(() => {
            window.open(getTargetContactUrl(), '_blank', 'noopener,noreferrer');
          }, 2500);
        }
      });
    } else {
      setShowContactWarning(true);
    }
  };

  const registerInterest = async (): Promise<{ success: boolean; error?: string; bypassed?: boolean }> => {
    if (!user || !ad) {
      console.warn('[AdDetails] Cannot register interest: user or ad is missing.');
      return { success: false, error: 'Sessão expirada ou anúncio indisponível.' };
    }

    // 3. Em adInterests: não usar sellerId vazio. se ad.sellerId estiver ausente, não gravar adInterest e registrar erro claro no console. não tentar notification. abrir WhatsApp normalmente.
    if (!ad.sellerId || !ad.sellerId.trim()) {
      console.error(`[AdDetails] Erro de Integridade: ad.sellerId está ausente ou vazio para o anúncio ID "${ad.id}". Registro de adInterests cancelado e abertura de WhatsApp liberada.`);
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
    console.log(`[AdDetails] Iniciando gravação de adInterest.`);
    console.log(`- user.uid: "${user.uid}"`);
    console.log(`- ad.id: "${ad.id}"`);
    console.log(`- ad.sellerId: "${ad.sellerId.trim()}"`);
    console.log(`- interestId: "${docId}"`);
    console.log(`- payload:`, JSON.stringify(interestData, null, 2));

    try {
      await setDoc(doc(db, 'adInterests', docId), interestData);
      console.log(`[AdDetails] Sucesso ao gravar adInterest na coleção: "${docId}".`);

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
          console.log('[AdDetails] Tentando criar notificação em bloco separado:', notifData);
          await setDoc(doc(db, 'notifications', notifId), notifData);
          console.log('[AdDetails] Notificação gravada com sucesso!');
        } catch (notifErr) {
          console.warn('[AdDetails] Falha não bloqueante ao criar notificação de interesse:', notifErr);
        }
      }

      return { success: true };
    } catch (err) {
      console.error(`[AdDetails] Erro ao gravar adInterest com ID ${docId}:`, err);
      const errMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: errMsg };
    }
  };

  const handleConfirmWhatsapp = async () => {
    if (ad?.adStatus === 'sold' || ad?.status === 'sold') {
      showToastMsg('error', 'Este anúncio já foi vendido. Não é possível contactar o vendedor.');
      return;
    }
    if (acceptedContactTerms && ad) {
      localStorage.setItem('safety_terms_accepted', 'true');
      incrementWhatsappClicks();
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
            window.open(getTargetContactUrl(), '_blank', 'noopener,noreferrer');
          }, 1000);
        } else {
          showToastMsg('error', `⚠️ Erro na BD: ${res.error || 'Falha ao registar'}. A abrir contacto...`, 6000);
          setTimeout(() => {
            window.open(getTargetContactUrl(), '_blank', 'noopener,noreferrer');
          }, 2500);
        }
      } else {
        window.open(getTargetContactUrl(), '_blank', 'noopener,noreferrer');
      }
      setShowContactWarning(false);
    }
  };

  useEffect(() => {
    const handleGlobalShareRequest = (e: Event) => {
      if (!ad) return;
      const customEvent = e as CustomEvent<{ onHandled: () => void }>;
      if (customEvent.detail && typeof customEvent.detail.onHandled === 'function') {
        customEvent.detail.onHandled();
      }
      handleShare();
    };
    window.addEventListener('request-share-current-page', handleGlobalShareRequest);
    return () => {
      window.removeEventListener('request-share-current-page', handleGlobalShareRequest);
    };
  }, [ad]);

  // More listings from the same seller
  useEffect(() => {
    if (!ad?.sellerId) {
      setSellerAds([]);
      return;
    }

    const fetchSellerListings = async () => {
      try {
        const sellerQuery = query(
          collection(db, 'ads'),
          where('sellerId', '==', ad.sellerId),
          limit(12)
        );
        const snap = await getDocsWithCacheFallback(sellerQuery, `seller_listings_${ad.sellerId}`);
        const items = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Ad))
          .filter((item: any) => {
            if (item.id === ad.id || item.isHidden) return false;

            const isActive =
              item.adStatus === 'active' ||
              item.status === 'active' ||
              item.status === 'approved';

            const isExpired =
              item.expirationDate?.toDate
                ? item.expirationDate.toDate().getTime() < Date.now()
                : item.expirationDate
                  ? new Date(item.expirationDate).getTime() < Date.now()
                  : false;

            return isActive && !isExpired;
          })
          .sort((a: any, b: any) => {
            const dateA = a.createdAt?.toDate
              ? a.createdAt.toDate().getTime()
              : a.createdAt
                ? new Date(a.createdAt).getTime()
                : 0;
            const dateB = b.createdAt?.toDate
              ? b.createdAt.toDate().getTime()
              : b.createdAt
                ? new Date(b.createdAt).getTime()
                : 0;
            return dateB - dateA;
          })
          .slice(0, 6);
        setSellerAds(items);
      } catch (err) {
        console.warn('Error fetching seller listings:', err);
        setSellerAds([]);
      }
    };

    fetchSellerListings();
  }, [ad?.id, ad?.sellerId]);

  // Fetch and similarity-score related listings
  useEffect(() => {
    if (!ad) return;
    const fetchRelatedListings = async () => {
      try {
        const q = query(
          collection(db, 'ads'),
          where('status', '==', 'active'),
          limit(16)
        );
        const snap = await getDocsWithCacheFallback(q, `related_${ad.id}_${ad.category || 'all'}`);
        const rawList = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Ad))
          .filter(item => item.id !== ad.id);

        // Similarity scoring
        rawList.sort((a, b) => {
          let scoreA = 0;
          let scoreB = 0;

          if (ad.boatType && a.boatType === ad.boatType) scoreA += 5;
          if (ad.boatType && b.boatType === ad.boatType) scoreB += 5;

          if (ad.category && a.category === ad.category) scoreA += 4;
          if (ad.category && b.category === ad.category) scoreB += 4;

          if (ad.manufacturer && a.manufacturer?.toLowerCase() === ad.manufacturer?.toLowerCase()) scoreA += 3;
          if (ad.manufacturer && b.manufacturer?.toLowerCase() === ad.manufacturer?.toLowerCase()) scoreB += 3;

          if (ad.city && a.city?.toLowerCase() === ad.city?.toLowerCase()) scoreA += 2;
          if (ad.city && b.city?.toLowerCase() === ad.city?.toLowerCase()) scoreB += 2;

          if (ad.price && a.price && Math.abs(a.price - ad.price) < ad.price * 0.3) scoreA += 2;
          if (ad.price && b.price && Math.abs(b.price - ad.price) < ad.price * 0.3) scoreB += 2;

          return scoreB - scoreA;
        });

        setRelatedAds(rawList.slice(0, 4));
      } catch (err) {
        console.warn('Error fetching related listings:', err);
      }
    };

    fetchRelatedListings();
  }, [ad]);

  const handleShare = () => {
    if (!ad) return;
    triggerShare({
      type: 'anuncio',
      title: ad.title,
      price: ad.price,
      country: ad.country,
      city: ad.city,
      url: `${window.location.origin}${getAdUrl(ad)}`
    });
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ad) return;
    if (!user) {
      alert('Faça login primeiro para denunciar este anúncio.');
      return;
    }
    if (!reportReason) {
      alert('Por favor, selecione o motivo da denúncia.');
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
      alert('Denúncia enviada à nossa equipa. Agradecemos a ajuda na segurança!');
      setShowReportModal(false);
      setReportReason('');
      setReportDetails('');
    } catch (err) {
      console.error('Erro ao registar denúncia:', err);
      alert('Erro inesperado ao enviar. Tente novamente.');
    } finally {
      setReporting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-slate-500 font-medium">A carregar anúncio...</span>
      </div>
    );
  }

  if (errorMsg || !ad) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Oops! A problem occurred</h1>
        <p className="text-slate-600 mb-8 leading-relaxed">{errorMsg || 'Listing unavailable.'}</p>
        <Link 
          to="/"
          className="inline-flex items-center justify-center bg-indigo-600 font-bold text-white px-6 py-3 rounded-2xl shadow-md hover:bg-indigo-700 transition"
        >
          Return to Home
        </Link>
      </div>
    );
  }

  const rawImages = ad.images && ad.images.length > 0 ? ad.images : [ad.imageUrl];
  const images = rawImages.filter((img): img is string => typeof img === 'string' && img.trim() !== '');
  if (images.length === 0) {
    images.push('https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=600&q=80');
  }

  const hasValidVideo = Boolean(
    (ad.videoPaid || ad.mediaBoostEnabled) && 
    ad.videoUrl && 
    typeof ad.videoUrl === 'string' && 
    ad.videoUrl.trim() !== ''
  );

  if ((ad.videoPaid || ad.mediaBoostEnabled) && (!ad.videoUrl || typeof ad.videoUrl !== 'string' || !ad.videoUrl.trim())) {
    console.warn('[AdDetails] Listing has videoPaid/mediaBoostEnabled set to true, but videoUrl is missing or invalid.', { adId: ad.id, videoUrl: ad.videoUrl });
  }

  const mediaItems: MediaItem[] = [];

  if (hasValidVideo) {
    mediaItems.push({
      type: 'video',
      url: ad.videoUrl!.trim(),
      thumbUrl: images[0] || undefined
    });
  }

  images.forEach((imgUrl, idx) => {
    mediaItems.push({
      type: 'image',
      url: imgUrl,
      imageIndex: idx
    });
  });

  const validMediaIndex = Math.min(Math.max(0, currentImageIndex), mediaItems.length - 1);
  const currentMedia = mediaItems[validMediaIndex] || mediaItems[0];

  const normalizedDescription = normalizeDescription(ad.description);
  
  const hasPrice =
    ad.category !== 'Imigração' &&
    ad.category !== 'Apoio ao Imigrante' &&
    ad.category !== 'Serviços Gratuitos' &&
    ad.category !== 'Informação' &&
    ad.price !== undefined &&
    ad.price !== null &&
    String(ad.price).trim() !== '' &&
    Number(ad.price) > 0;

  const dateObject = parseFirestoreDate(ad.createdAt);
  const timeStr = dateObject 
    ? formatDistanceToNow(dateObject, { addSuffix: true, locale: pt }) 
    : 'data indisponível';

  const isUnclaimed = ad.isClaimable === true || ad.listingType === 'claimable';

  return (
    <div className="w-full max-w-[1880px] mx-auto px-2 sm:px-3 lg:px-4 xl:px-5 2xl:px-6 py-5">
      {ad && (
        <Helmet>
          <title>{ad.title} - {ad.city || 'United Kingdom'} | ConnectBoat</title>
          <meta name="description" content={normalizedDescription.substring(0, 160)} />
          <meta name="robots" content="index, follow" />
          <link rel="canonical" href={`https://connectboat.co.uk${location.pathname.startsWith('/listing/') ? location.pathname : getAdUrl(ad)}`} />
          <meta property="og:type" content="product" />
          <meta property="og:site_name" content="ConnectBoat" />
          <meta property="og:url" content={`https://connectboat.co.uk${location.pathname.startsWith('/listing/') ? location.pathname : getAdUrl(ad)}`} />
          <meta property="og:title" content={`${ad.title} | ConnectBoat`} />
          <meta property="og:description" content={normalizedDescription.substring(0, 160)} />
          <meta property="og:image" content={images[0] || ad.imageUrl || 'https://connectboat.co.uk/api/og-image'} />
          {ad.price && <meta property="product:price:amount" content={String(ad.price)} />}
          {ad.price && <meta property="product:price:currency" content={ad.country === 'Reino Unido' ? 'GBP' : 'EUR'} />}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={`${ad.title} | ConnectBoat`} />
          <meta name="twitter:description" content={normalizedDescription.substring(0, 160)} />
          <meta name="twitter:image" content={images[0] || ad.imageUrl || 'https://connectboat.co.uk/api/og-image'} />
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org/",
              "@type": "Product",
              "name": ad.title,
              "image": images,
              "description": normalizedDescription.substring(0, 300),
              "category": ad.boatType || ad.category || "Boats",
              "brand": ad.manufacturer ? { "@type": "Brand", "name": ad.manufacturer } : undefined,
              "model": ad.model || undefined,
              "offers": {
                "@type": "Offer",
                "url": `https://connectboat.co.uk${location.pathname.startsWith('/listing/') ? location.pathname : getAdUrl(ad)}`,
                "priceCurrency": ad.country === 'Reino Unido' ? 'GBP' : 'EUR',
                "price": ad.price || 0,
                "itemCondition": ad.condition === 'Novo' ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
                "availability": (ad.status === 'active' && ad.adStatus !== 'sold') ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                "seller": {
                  "@type": "Person",
                  "name": ad.sellerName || "ConnectBoat Seller"
                }
              }
            })}
          </script>
        </Helmet>
      )}

      {ad.isHidden && (
        <div className="mb-6 bg-amber-500 text-white p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-md">
          <EyeOff size={18} />
          <span>⚠️ ESTE ANÚNCIO ENCONTRA-SE EM STANDBY / OCULTO AO PÚBLICO PELA ADMINISTRAÇÃO</span>
        </div>
      )}

      {/* Back Button */}
      <div className="mb-3">
        <button 
          onClick={() => navigate(-1)} 
          className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-all p-2 hover:bg-slate-50 rounded-xl"
        >
          <ChevronLeft size={20} /> Back
        </button>
      </div>

      {/* Rotating advertising campaigns */}
      {listingAdCampaigns.length > 0 ? (
        (() => {
          const campaign = listingAdCampaigns[listingAdIndex] || listingAdCampaigns[0];
          const bannerImage = (
            <img
              src={campaign.imageUrl}
              alt={campaign.altText || campaign.advertiserName || 'ConnectBoat advertising banner'}
              className="block w-full h-auto max-h-[170px] sm:max-h-[190px] lg:max-h-[150px] object-contain bg-white"
              loading="eager"
            />
          );

          return (
            <div className="mb-5">
              {campaign.targetUrl ? (
                <a href={campaign.targetUrl} target="_blank" rel="noopener noreferrer sponsored"
                  onClick={() => handleAdvertisingClick(campaign)}
                  className="block rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                  {bannerImage}
                </a>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">{bannerImage}</div>
              )}

              {listingAdCampaigns.length > 1 && (
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  {listingAdCampaigns.map((item, index) => (
                    <button key={item.id} type="button" onClick={() => setListingAdIndex(index)}
                      className={`h-1.5 rounded-full transition-all ${index === listingAdIndex ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-300 hover:bg-slate-400'}`}
                      aria-label={`Show advertising banner ${index + 1}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })()
      ) : (
        <div className="hidden lg:flex mb-5 min-h-[92px] rounded-2xl overflow-hidden border border-slate-200 bg-gradient-to-r from-slate-950 via-[#0b2d55] to-indigo-700 shadow-sm items-center justify-between px-8 py-4 text-white">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-300 mb-1">ConnectBoat Advertising</div>
            <div className="text-xl font-black tracking-tight">Put your marine brand in front of boat buyers</div>
            <div className="text-xs text-slate-300 mt-1">Premium banner space for marine businesses, dealers and services.</div>
          </div>
          <div className="shrink-0 rounded-xl bg-white/10 border border-white/20 px-5 py-3 text-sm font-black backdrop-blur-sm">Advertising Space</div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {relatedAds.map((relatedAd) => (
              <AdCard key={relatedAd.id} ad={relatedAd} />
            ))}
          </div>
        </div>
      )}

      {/* STICKY MOBILE CONTACT BAR */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 shadow-2xl flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Price</span>
          <span className="text-sm font-black text-indigo-600">
            {hasPrice ? formatPrice(ad.price, ad.country) : 'Price on Request'}
          </span>
        </div>
        <button
          onClick={() => {
            if (isUnclaimed) {
              setShowUnclaimedContactModal(true);
            } else if (acceptedContactTerms) {
              handleConfirmWhatsapp();
            } else {
              setShowContactWarning(true);
            }
          }}
          disabled={ad.adStatus === 'sold' || ad.status === 'sold'}
          className={`flex-1 py-3 px-4 rounded-xl font-black text-xs text-white shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${
            ad.adStatus === 'sold' || ad.status === 'sold'
              ? 'bg-slate-400 cursor-not-allowed'
              : hasSourceUrl
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
          }`}
        >
          <MessageCircle size={16} />
          <span>{hasSourceUrl ? 'Contact Seller' : 'Contact via WhatsApp'}</span>
        </button>
      </div>

      {/* Review Modal para deixar novas review*/}
      {showReviewModal && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          adId={ad.id}
          adTitle={ad.title}
          adCategory={ad.category}
          sellerId={ad.sellerId}
          sellerName={hasSourceUrl ? 'Partner' : ad.sellerName}
          isBuyerRating={true}
          onSuccess={() => {
            alert('Your review was submitted successfully!');
            fetchSellerDetails(ad.sellerId);
          }}
        />
      )}

      {/* Lightbox full screen */}
      <ImageLightboxModal
        isOpen={showFullImage}
        onClose={() => setShowFullImage(false)}
        images={images}
        mediaItems={mediaItems}
        currentIndex={validMediaIndex}
        onIndexChange={(idx) => {
          pauseVideos();
          setCurrentImageIndex(idx);
        }}
        title={ad?.title}
      />

      {/* Aviso de Contacto WhatsApp */}
      <AnimatePresence>
        {showContactWarning && (
          <div className="fixed inset-0 z-[190] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowContactWarning(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl text-center z-10"
            >
              <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} />
              <h3 className="text-xl font-black text-slate-950 mb-2">Safety Notice</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                When contacting this seller, please note that ConnectBoat operates strictly as a free classifieds platform. Never send advance payments or deposits without inspecting the item and verifying the seller in person.
              </p>
              <div className="flex flex-col gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-left text-xs text-slate-500">
                  <input 
                    type="checkbox" 
                    checked={acceptedContactTerms} 
                    onChange={(e) => setAcceptedContactTerms(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                  />
                  <span>I fully understand and agree to follow these safety guidelines.</span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowContactWarning(false)}
                    className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
                  >
                    Back
                  </button>
                  <button
                    disabled={!acceptedContactTerms}
                    onClick={handleConfirmWhatsapp}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl transition ${
                      acceptedContactTerms 
                        ? hasSourceUrl ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md' : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {hasSourceUrl ? 'Open Contact' : 'Open WhatsApp'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Denúncia */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-[190] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReportModal(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl z-10"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-black text-slate-900">Report Listing</h3>
                <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded-full border border-slate-200">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleReportSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Primary reason</label>
                  <select
                    required
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-sm font-medium focus:ring-2 focus:ring-red-500 focus:bg-white focus:outline-none transition"
                  >
                    <option value="">-- Select a reason --</option>
                    <option value="fraude">Fake Listing or Fraud</option>
                    <option value="spam">Spam / Irrelevant Content</option>
                    <option value="arma">Weapons, drugs or violence</option>
                    <option value="ofensivo">Offensive Language / Racism</option>
                    <option value="outro">Other Reason</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Additional details (optional)</label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    rows={4}
                    placeholder="Briefly explain what is wrong with this listing..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm font-medium focus:ring-2 focus:ring-red-500 focus:bg-white focus:outline-none transition resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="py-2.5 px-5 text-sm font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reporting}
                    className="py-2.5 px-6 text-sm font-extrabold bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-md transition disabled:opacity-50"
                  >
                    {reporting ? 'Sending...' : 'Report Listing'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal: Unclaimed Contact Warning */}
        {showUnclaimedContactModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 overflow-y-auto font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-md w-full border border-slate-100 shadow-2xl relative space-y-6"
            >
              <div className="flex justify-between items-start">
                <div className="bg-amber-50 text-amber-600 p-3 rounded-2xl border border-amber-100 font-bold">
                  <AlertCircle size={28} />
                </div>
                <button
                  onClick={() => setShowUnclaimedContactModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 bg-slate-50 border border-slate-150 rounded-full transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2 text-left">
                <h3 className="text-xl font-black text-slate-950">Contact Unavailable</h3>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  This listing was created for service providers on ConnectBoat and is **awaiting activation by its owner**. Direct WhatsApp contact will be enabled as soon as the business is activated.
                </p>
                <p className="text-xs text-indigo-950 font-extrabold leading-relaxed bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100">
                  💡 If you are the owner or manager of this business, click "Claim Business" below to activate it for free!
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => {
                    setShowUnclaimedContactModal(false);
                    handleOpenClaimModal();
                  }}
                  className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider text-center transition cursor-pointer shadow-md"
                >
                  Claim Business 💼
                </button>
                <button
                  onClick={() => setShowUnclaimedContactModal(false)}
                  className="py-3 px-5 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl font-black text-xs uppercase border border-slate-150 text-center transition cursor-pointer"
                >
                  Back
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal: Claim Form */}
        {showClaimModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 overflow-y-auto font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-lg w-full border border-slate-100 shadow-2xl relative space-y-6"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">💼</span>
                  <div className="text-left">
                    <h3 className="text-lg font-black text-slate-950">Activate my Business</h3>
                    <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Verification Form</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowClaimModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 bg-slate-50 border border-slate-150 rounded-full transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100 text-left">
                <p className="text-xs text-indigo-950 font-semibold leading-relaxed">
                  To ensure community safety, business activation requests are verified manually by ConnectBoat management before being approved.
                </p>
              </div>

              <form onSubmit={handleClaimSubmit} className="space-y-4 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-bold">My Name *</label>
                    <input
                      required
                      type="text"
                      value={claimName}
                      onChange={(e) => setClaimName(e.target.value)}
                      placeholder="e.g. John Smith"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-bold">Mobile / WhatsApp *</label>
                    <input
                      required
                      type="tel"
                      value={claimPhone}
                      onChange={(e) => setClaimPhone(e.target.value)}
                      placeholder="e.g. +44 7123 456789"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-bold">Contact Email *</label>
                  <input
                    required
                    type="email"
                    value={claimEmail}
                    onChange={(e) => setClaimEmail(e.target.value)}
                    placeholder="e.g. john.smith@example.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-bold font-bold">Additional message (optional)</label>
                  <textarea
                    value={claimMessage}
                    onChange={(e) => setClaimMessage(e.target.value)}
                    rows={3}
                    placeholder="Specify social media accounts or your website to speed up approval..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowClaimModal(false)}
                    className="py-2.5 px-5 text-xs font-black uppercase tracking-wider text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-150 transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={claimSubmitting}
                    className="py-2.5 px-6 text-xs font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {claimSubmitting ? 'Sending...' : 'Activate & Claim'}
                  </button>
                </div>
              </form>
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
            <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white shrink-0 font-bold text-xs font-sans">✓</div>
          )}
          {toast.type === 'error' && (
            <div className="w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white shrink-0 font-bold text-xs font-sans text-center">✕</div>
          )}
          <div className="flex-1 font-sans">
            <p className="text-xs font-bold tracking-tight">{toast.message}</p>
            {toast.type === 'success' && (
              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">The seller has been notified on ConnectBoat.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdDetails;
