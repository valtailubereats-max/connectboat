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
        setListingAdIndex((current) =>
          campaigns.length === 0 ? 0 : Math.min(current, campaigns.length - 1)
        );
      },
      (error) => {
        console.warn('[AdDetails] Advertising campaigns unavailable:', error);
      }
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
    }).catch((error) => {
      console.warn('[AdDetails] Unable to register banner impression:', error);
    });
  }, [listingAdCampaigns, listingAdIndex]);

  const handleAdvertisingClick = (campaign: any) => {
    if (!campaign?.id) return;

    updateDoc(doc(db, 'advertisingCampaigns', campaign.id), {
      clicks: increment(1),
    }).catch((error) => {
      console.warn('[AdDetails] Unable to register banner click:', error);
    });
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

          return (
            <div className="mb-5">
              {campaign.targetUrl ? (
                <a
                  href={campaign.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  onClick={() => handleAdvertisingClick(campaign)}
                  className="block w-full lg:w-[80%] mx-auto rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow"
                  aria-label={campaign.altText || campaign.advertiserName || 'Advertising'}
                >
                  <img
                    src={campaign.imageUrl}
                    alt={campaign.altText || campaign.advertiserName || 'ConnectBoat advertising banner'}
                    className="block w-full h-auto max-h-[170px] sm:max-h-[190px] lg:max-h-[150px] object-contain bg-white"
                    loading="eager"
                  />
                </a>
              ) : (
                <div className="w-full lg:w-[80%] mx-auto rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                  <img
                    src={campaign.imageUrl}
                    alt={campaign.altText || campaign.advertiserName || 'ConnectBoat advertising banner'}
                    className="block w-full h-auto max-h-[170px] sm:max-h-[190px] lg:max-h-[150px] object-contain bg-white"
                    loading="eager"
                  />
                </div>
              )}

              {listingAdCampaigns.length > 1 && (
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  {listingAdCampaigns.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setListingAdIndex(index)}
                      className={`h-1.5 rounded-full transition-all ${
                        index === listingAdIndex
                          ? 'w-6 bg-indigo-600'
                          : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                      }`}
                      aria-label={`Show advertising banner ${index + 1}`}
                    />
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

      {/* DESKTOP LAYOUT */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-4 xl:gap-5">
        {/* LADO ESQUERDO: Imagens e Galeria */}
        <div className="lg:col-span-9 space-y-4">
          <div 
            className="relative aspect-[16/9] bg-slate-950 rounded-3xl overflow-hidden shadow-lg group touch-pan-y flex items-center justify-center select-none"
            onTouchStart={handleGalleryTouchStart}
            onTouchMove={handleGalleryTouchMove}
            onTouchEnd={handleGalleryTouchEnd}
          >
            {currentMedia.type === 'video' ? (
              <video
                ref={mainVideoRef}
                src={currentMedia.url}
                controls
                preload="metadata"
                playsInline
                className="w-full h-full object-contain relative z-10 bg-black rounded-3xl"
              />
            ) : (
              <>
                {/* Ambient Background Blur Effect */}
                <div 
                  className="absolute inset-0 bg-cover bg-center blur-2xl opacity-25 select-none pointer-events-none scale-110"
                  style={{ backgroundImage: `url(${currentMedia.url})` }}
                />
                {/* Main Carousel Image */}
                <img
                  src={currentMedia.url}
                  alt={ad.title}
                  className="w-full h-full object-contain relative z-10 cursor-zoom-in"
                  onClick={() => setShowFullImage(true)}
                  referrerPolicy="no-referrer"
                  style={currentMedia.imageIndex === 0 ? {
                    objectPosition: ad.imagePositionX !== undefined && ad.imagePositionY !== undefined
                      ? `${ad.imagePositionX}% ${ad.imagePositionY}%`
                      : '50% 50%',
                    transform: `scale(${ad.imageZoom || 1}) translate(${
                      ad.imageZoom && ad.imageZoom > 1
                        ? ((ad.imagePositionX || 50) - 50) * (ad.imageZoom - 1) / ad.imageZoom
                        : 0
                    }%, ${
                      ad.imageZoom && ad.imageZoom > 1
                        ? ((ad.imagePositionY || 50) - 50) * (ad.imageZoom - 1) / ad.imageZoom
                        : 0
                    }%)`
                  } : undefined}
                />
              </>
            )}

            {/* Favorito Button */}
            <button
              onClick={handleToggleFavorite}
              aria-label={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
              className={`absolute top-4 right-4 p-3 rounded-full z-20 backdrop-blur-md transition-all shadow-md ${
                isFavorite ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-white/90 text-slate-400 hover:text-red-500 hover:bg-white'
              }`}
            >
              <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>

            {/* Carousel Buttons */}
            {mediaItems.length > 1 && (
              <>
                <button
                  onClick={() => {
                    pauseVideos();
                    setCurrentImageIndex((prev) => (prev === 0 ? mediaItems.length - 1 : prev - 1));
                  }}
                  aria-label="Anterior"
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/90 dark:bg-slate-900/90 hover:bg-white backdrop-blur-md rounded-full text-slate-900 shadow-md z-20"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => {
                    pauseVideos();
                    setCurrentImageIndex((prev) => (prev === mediaItems.length - 1 ? 0 : prev + 1));
                  }}
                  aria-label="Próximo"
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/90 dark:bg-slate-900/90 hover:bg-white backdrop-blur-md rounded-full text-slate-900 shadow-md z-20"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails strip */}
          {mediaItems.length > 1 && (
            <div className="flex gap-2 mr-1 overflow-x-auto py-2">
              {mediaItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    pauseVideos();
                    setCurrentImageIndex(i);
                  }}
                  className={`relative w-32 h-24 xl:w-36 xl:h-28 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                    validMediaIndex === i ? 'border-indigo-600 scale-95 shadow-sm ring-2 ring-indigo-500/30' : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                >
                  {item.type === 'video' ? (
                    <>
                      {images[0] ? (
                        <img src={images[0]} alt="Video Thumbnail" className="w-full h-full object-cover brightness-75" />
                      ) : (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-400">
                          <Video size={20} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                        <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                          <Play size={14} className="fill-white ml-0.5" />
                        </div>
                      </div>
                      <span className="absolute bottom-1 right-1 bg-indigo-900/90 text-white text-[9px] font-black px-1 py-0.5 rounded tracking-wider uppercase">
                        VIDEO
                      </span>
                    </>
                  ) : (
                    <img 
                      src={item.url} 
                      alt={`Miniatura ${i}`} 
                      className="w-full h-full object-cover" 
                      style={item.imageIndex === 0 ? {
                        objectPosition: ad.imagePositionX !== undefined && ad.imagePositionY !== undefined
                          ? `${ad.imagePositionX}% ${ad.imagePositionY}%`
                          : '50% 50%',
                        transform: `scale(${ad.imageZoom || 1}) translate(${
                          ad.imageZoom && ad.imageZoom > 1
                            ? ((ad.imagePositionX || 50) - 50) * (ad.imageZoom - 1) / ad.imageZoom
                            : 0
                        }%, ${
                          ad.imageZoom && ad.imageZoom > 1
                            ? ((ad.imagePositionY || 50) - 50) * (ad.imageZoom - 1) / ad.imageZoom
                            : 0
                        }%)`
                      } : undefined}
                    />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ESPECIFICAÇÕES TÉCNICAS DO BARCO (GROUPED MARINE SPECS) */}
          {(ad.boatType || ad.manufacturer || ad.model || ad.year || ad.length || ad.beam || ad.draft || ad.hullMaterial || ad.engineBrand || ad.horsepower || ad.engineHours || ad.fuelType || ad.cabins || ad.berths || ad.bathrooms || ad.trailerIncluded || ad.vatPaid || ad.ceCertified) && (
            <div id="especificacoes-nauticas" className="bg-white rounded-[2rem] p-6 md:p-8 border border-slate-100 shadow-xl space-y-6 mt-6 text-left">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600/10 text-indigo-700 rounded-2xl flex items-center justify-center font-bold">
                    <Anchor size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 leading-none">⚓ Marine Specifications</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1.5">Official ConnectBoat Specification</p>
                  </div>
                </div>
                {ad.condition && (
                  <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {ad.condition}
                  </span>
                )}
              </div>

              <div className="space-y-6">
                {/* Grupo 1: Embarcação / Vessel */}
                {(ad.boatType || ad.manufacturer || ad.model || ad.year || ad.condition) && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-sky-800 bg-sky-50/70 p-2.5 rounded-xl border border-sky-100/60">
                      <Anchor size={16} className="text-sky-600" />
                      <span>Vessel Information</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {ad.boatType && (
                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Boat Type</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{ad.boatType}</span>
                        </div>
                      )}
                      {ad.manufacturer && (
                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fabricante / Marca</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{ad.manufacturer}</span>
                        </div>
                      )}
                      {ad.model && (
                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Modelo</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{ad.model}</span>
                        </div>
                      )}
                      {ad.year && (
                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Year</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{ad.year}</span>
                        </div>
                      )}
                      {ad.condition && (
                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Condition</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{ad.condition}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Grupo 2: Dimensões & Casco / Dimensions */}
                {(ad.length || ad.beam || ad.draft || ad.hullMaterial) && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-teal-800 bg-teal-50/70 p-2.5 rounded-xl border border-teal-100/60">
                      <Ruler size={16} className="text-teal-600" />
                      <span>Dimensões & Casco</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {ad.length && (
                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Comprimento (LOA)</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{ad.length}</span>
                        </div>
                      )}
                      {ad.beam && (
                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Boca (Largura)</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{ad.beam}</span>
                        </div>
                      )}
                      {ad.draft && (
                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Calado (Draft)</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{ad.draft}</span>
                        </div>
                      )}
                      {ad.hullMaterial && (
                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Material do Casco</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{ad.hullMaterial}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Grupo 3: Motorização / Engine */}
                {(ad.engineBrand || ad.horsepower || ad.engineHours || ad.fuelType) && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-800 bg-amber-50/70 p-2.5 rounded-xl border border-amber-100/60">
                      <Gauge size={16} className="text-amber-600" />
                      <span>Motorização & Performance</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {ad.engineBrand && (
                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Marca do Motor</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{ad.engineBrand}</span>
                        </div>
                      )}
                      {ad.horsepower && (
                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Potência Total</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{ad.horsepower}</span>
                        </div>
                      )}
                      {ad.engineHours && (
                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Horas de Uso</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{ad.engineHours}</span>
                        </div>
                      )}
                      {ad.fuelType && (
                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Combustível</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{ad.fuelType}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Grupo 4: Acomodações & Habitabilidade / Accommodation */}
                {(ad.cabins || ad.berths || ad.bathrooms) && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-800 bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100/60">
                      <Bed size={16} className="text-indigo-600" />
                      <span>Acomodações & Habitabilidade</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {ad.cabins && (
                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cabines</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{ad.cabins}</span>
                        </div>
                      )}
                      {ad.berths && (
                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Camas (Berths)</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{ad.berths}</span>
                        </div>
                      )}
                      {ad.bathrooms && (
                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Casas de Banho (WCs)</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{ad.bathrooms}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Grupo 5: Conformidade & Extras */}
                {(ad.trailerIncluded || ad.vatPaid || ad.ceCertified) && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100/60">
                      <ShieldCheck size={16} className="text-emerald-600" />
                      <span>Conformidade & Equipamento</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {ad.trailerIncluded && (
                        <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 min-w-[140px]">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reboque Incluído</span>
                          <span className="text-xs sm:text-sm font-black text-slate-900 block mt-0.5">{ad.trailerIncluded === 'Yes' ? 'Sim' : ad.trailerIncluded === 'No' ? 'Não' : ad.trailerIncluded}</span>
                        </div>
                      )}
                      {ad.vatPaid === 'Yes' && (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-50 text-emerald-900 text-xs font-black border border-emerald-200">
                          <ShieldCheck size={16} className="text-emerald-600" /> IVA Pago (VAT Paid)
                        </span>
                      )}
                      {ad.ceCertified === 'Yes' && (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-indigo-50 text-indigo-900 text-xs font-black border border-indigo-200">
                          <Check size={16} className="text-indigo-600" /> Certificação CE Válida
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECÇÃO DE LOCALIZAÇÃO */}
          <div id="localizacao" className="bg-white rounded-[2rem] p-6 md:p-8 border border-slate-100 shadow-xl space-y-6 mt-6 scroll-mt-24 text-left">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <MapPin size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 leading-none">📍 Approximate Location</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1.5 font-sans">Reference region for the listing</p>
              </div>
            </div>

            <div className="flex flex-row items-center justify-between gap-4 bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-100 font-sans">
              <div className="space-y-0.5">
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider text-left">
                  {isService ? 'Service Area' : 'City'}
                </span>
                <span className="text-sm sm:text-lg font-extrabold text-slate-900 block text-left">
                  {isService && ad.serviceCoverage === 'online' ? (
                    '💻 Online Service'
                  ) : isService && ad.serviceCoverage === 'uk' ? (
                    '🌍 Entire UK'
                  ) : isService && ad.serviceCoverage === 'portugal' ? (
                    '🇵🇹 Entire Portugal'
                  ) : (
                    getAdLocationLabel(ad)
                  )}
                </span>
              </div>
              {!(isService && (ad.serviceCoverage === 'online' || ad.serviceCoverage === 'uk' || ad.serviceCoverage === 'portugal')) && (
                <div className="space-y-0.5 text-right">
                  <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Region</span>
                  <span className="text-sm sm:text-lg font-extrabold text-slate-900 block">
                    {ad.region || getRegionForCity(ad.city)}
                  </span>
                </div>
              )}
            </div>

            {isService && ad.serviceCoverage === 'online' ? (
              <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl text-center space-y-2">
                <span className="text-4xl">💻</span>
                <p className="text-base font-extrabold text-indigo-900">100% Online / Remote Service</p>
                <p className="text-xs text-indigo-700/80 font-semibold max-w-md">This professional operates entirely digitally. No physical travel or map coordinates required.</p>
              </div>
            ) : isService && (ad.serviceCoverage === 'uk' || ad.serviceCoverage === 'portugal') ? (
              <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-r from-teal-50 to-emerald-50 border border-emerald-100 rounded-2xl text-center space-y-2">
                <span className="text-4xl">⚓</span>
                <p className="text-base font-extrabold text-emerald-900">Active UK National Coverage</p>
                <p className="text-xs text-emerald-700/80 font-semibold max-w-md">This professional provides services nationwide across the United Kingdom.</p>
              </div>
            ) : (
              ad.city && ad.city.trim() !== '' && ad.city.toLowerCase() !== 'todas' && (
                <div className="w-full h-64 md:h-80 rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-100 relative">
                  <iframe
                    title={`Map of ${ad.city}`}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(ad.city + ', United Kingdom')}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                  />
                </div>
              )
            )}

            <div className="flex items-start gap-2.5 text-slate-500 bg-amber-50/40 border border-amber-100 rounded-2xl p-4 text-xs font-semibold font-sans">
              <span className="text-amber-500 text-lg leading-none mt-0.5">⚠️</span>
              <div className="space-y-1">
                <p className="leading-relaxed text-amber-900">
                  The location shown is approximate and serves strictly as a reference point.
                </p>
                <p className="leading-relaxed text-amber-800/80">
                  Approximate location based on the city provided by the seller.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* LADO DIREITO: Dados, Vendedor e WhatsApp */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-slate-100 shadow-xl space-y-6">
            
            {/* Categoria & Visualizações / Tempo */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <span className="bg-indigo-50 text-indigo-600 text-[11px] font-black px-3 py-1.5 rounded-xl uppercase tracking-wider border border-indigo-100">
                {ad.category}
              </span>
              <div className="flex items-center gap-3 text-slate-400 text-xs font-semibold">
                <span className="flex items-center gap-1">
                  <Eye size={14} /> {ad.isClaimableBusiness ? (ad.businessViews || 0) : (ad.views || 0)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} /> {timeStr}
                </span>
              </div>
            </div>

            {/* Selos de Negócio Reivindicável */}
            {ad.isClaimableBusiness && (
              <div className="flex flex-wrap gap-2 animate-fade-in">
                {(ad.claimStatus === 'unclaimed' || !ad.claimStatus) && (
                  <span className="bg-amber-50 text-amber-605 text-[11px] font-black px-3 py-1.5 rounded-xl uppercase tracking-wider border border-amber-200 flex items-center gap-1">
                    <AlertCircle size={12} /> Awaiting owner activation
                  </span>
                )}
                {ad.claimStatus === 'pending' && (
                  <span className="bg-indigo-50 text-indigo-600 text-[11px] font-black px-3 py-1.5 rounded-xl uppercase tracking-wider border border-indigo-200 flex items-center gap-1 animate-pulse">
                    <Clock size={12} /> Activation Pending Verification
                  </span>
                )}
                {ad.claimStatus === 'claimed' && (
                  <span className="bg-emerald-50 text-emerald-700 text-[11px] font-black px-3 py-1.5 rounded-xl uppercase tracking-wider border border-emerald-200 flex items-center gap-1">
                    <Award size={12} /> Verified & Active Business
                  </span>
                )}
              </div>
            )}

            {/* Título & Preço */}
            <div className="space-y-2">
              {ad.externalListing && (
                <div className="bg-indigo-50 border border-indigo-200/80 rounded-2xl p-4 flex items-start gap-3 mb-2">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shrink-0 mt-0.5">
                    <ExternalLink size={18} />
                  </div>
                  <div className="space-y-1 text-xs text-indigo-950">
                    <span className="font-extrabold text-indigo-900 block text-sm">
                      External Listing {ad.sourceSite ? `• ${ad.sourceSite}` : ''}
                    </span>
                    <p className="text-indigo-800 leading-relaxed font-medium">
                      This listing originated from a partner marketplace ({ad.sourceSite || 'External Source'}). ConnectBoat is not the seller of this item. Click "View Original Listing" to visit the seller's source page.
                    </p>
                  </div>
                </div>
              )}
              {ad.demoListing && (
                <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 mb-2">
                  <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0 mt-0.5">
                    <Tag size={18} />
                  </div>
                  <div className="space-y-1 text-xs text-amber-950">
                    <span className="font-extrabold text-amber-900 block text-sm">
                      Example Listing (Demonstration)
                    </span>
                    <p className="text-amber-800 leading-relaxed font-medium">
                      This is an example listing created for demonstration purposes and is not available for purchase.
                    </p>
                  </div>
                </div>
              )}
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                {ad.title}
              </h1>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-slate-500 font-bold text-sm">
                  {isService && ad.serviceCoverage === 'online' ? (
                    <span>💻 Online Service</span>
                  ) : isService && ad.serviceCoverage === 'uk' ? (
                    <span>🌍 Entire UK</span>
                  ) : isService && ad.serviceCoverage === 'portugal' ? (
                    <span>🇵🇹 Entire Portugal</span>
                  ) : (
                    <>
                      <MapPin size={16} className="text-indigo-600" />
                      <span>{getAdLocationLabel(ad)}</span>
                    </>
                  )}
                </div>
                {ad.category === '💚 Doações & Solidariedade' ? (
                  <div className="text-3.5xl font-black text-emerald-600 bg-emerald-50 py-1.5 px-4 rounded-2xl border border-emerald-200 flex items-center justify-center animate-pulse">
                    Free 💚
                  </div>
                ) : hasPrice ? (
                  <div className="text-3.5xl font-black text-indigo-600 bg-indigo-50/50 py-1.5 px-4 rounded-2xl border border-indigo-100/50 flex items-center justify-center">
                    {formatPrice(ad.price, ad.country)}
                  </div>
                ) : (
                  <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-100 flex items-center justify-center">
                    Price on Request
                  </span>
                )}
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detailed Description</h3>
              <p className="text-slate-600 text-[15px] leading-relaxed whitespace-pre-line break-words overflow-hidden bg-slate-50/40 p-4 rounded-2xl border border-slate-50">
                {normalizedDescription.length > 400 && !descriptionExpanded
                  ? `${normalizedDescription.substring(0, 400).trim()}...`
                  : normalizedDescription}
              </p>
              {normalizedDescription.length > 400 && (
                <button
                  onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                  className="text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                >
                  {descriptionExpanded ? 'Show Less' : 'Read Full Description'}
                </button>
              )}
            </div>

            {/* Cartão do Vendedor e Avaliações */}
            <div className="bg-slate-50 rounded-2xl p-4 md:p-5 border border-slate-100 space-y-4 overflow-hidden">
              <div className="flex flex-col gap-3 pb-3 border-b border-slate-200/60">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 bg-indigo-600/10 text-indigo-700 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0">
                    {(hasSourceUrl ? 'Partner' : ad.sellerName).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-slate-900 leading-tight flex items-center gap-1 truncate">
                      {hasSourceUrl ? 'Partner' : ad.sellerName}
                      <Award size={14} className="text-indigo-500 flex-shrink-0" />
                    </h4>
                    
                    {/* Estrelas */}
                    <div className="flex items-center gap-0.5 mt-1" title={`${sellerProfile?.ratingAverage || 0} / 5`}>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const ratingVal = sellerProfile?.ratingAverage || 0;
                          const isFilled = star <= Math.round(ratingVal);
                          return (
                            <Star
                              key={star}
                              size={12}
                              className={isFilled ? "text-amber-400 fill-amber-400" : "text-slate-200"}
                            />
                          );
                        })}
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold ml-1">
                        ({sellerProfile?.ratingCount || 0} reviews)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botão de Avaliar */}
                {user && user.uid !== ad.sellerId && (
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="w-full text-[11px] font-black bg-indigo-50 text-indigo-600 py-2 px-3 rounded-xl border border-indigo-100 hover:bg-indigo-100/80 hover:text-indigo-700 transition-all text-center"
                  >
                    Rate Seller
                  </button>
                )}
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-3">
                {ad.externalListing || (hasSourceUrl && !ad.demoListing) ? (
                  <a
                    href={ad.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 px-6 rounded-2xl font-black transition-all shadow-md active:scale-[0.98] w-full text-center"
                  >
                    <ExternalLink size={20} className="flex-shrink-0" />
                    <span className="leading-tight">View Original Listing</span>
                  </a>
                ) : ad.demoListing ? (
                  <div className="flex items-center justify-center gap-2 bg-amber-50 text-amber-800 py-3.5 px-6 rounded-2xl font-extrabold text-xs text-center border border-amber-200/80">
                    <Tag size={16} className="text-amber-600 shrink-0" />
                    <span>Demo Listing — Not Available for Sale</span>
                  </div>
                ) : ad.adStatus === 'sold' || ad.status === 'sold' ? (
                  <div className="flex items-center justify-center gap-2 bg-slate-100 text-slate-500 py-3.5 px-6 rounded-2xl font-black text-sm border border-slate-200">
                    <Tag size={20} className="flex-shrink-0 text-slate-400" />
                    <span className="leading-tight">Listing Sold</span>
                  </div>
                ) : (
                  <button
                    onClick={handleContactClick}
                    className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 px-6 rounded-2xl font-black transition-all shadow-md active:scale-[0.98] w-full text-center"
                  >
                    <MessageCircle size={20} className="flex-shrink-0" />
                    <span className="leading-tight">Contact via WhatsApp</span>
                  </button>
                )}

                <div className="flex gap-2">
                  {/* Share button */}
                  <button
                    onClick={handleShare}
                    className={`flex-1 flex items-center justify-center gap-2 border py-3 px-3 rounded-xl font-bold text-xs transition-all ${
                      shareCopied 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Share2 size={16} className={shareCopied ? 'text-emerald-500 animate-bounce' : ''} />
                    <span>{shareCopied ? 'Link copied!' : 'Share'}</span>
                  </button>

                  {/* Report Button */}
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="flex items-center justify-center gap-1.5 border border-rose-100 hover:border-rose-200 text-rose-500 bg-rose-50/50 hover:bg-rose-50 py-3 px-4 rounded-xl font-bold text-xs transition"
                  >
                    <ShieldAlert size={16} /> Report
                  </button>
                </div>
              </div>

              {/* Seção das avaliações do vendedor */}
              {sellerReviews.length > 0 && (
                <div className="pt-3 border-t border-slate-200/60 font-sans">
                  <button
                    onClick={() => setShowReviewsSection(!showReviewsSection)}
                    className="flex items-center justify-between w-full text-xs font-bold text-indigo-600 uppercase tracking-widest"
                  >
                    <span>Seller Reviews ({sellerReviews.length})</span>
                    <span className="text-slate-400 text-[10px] uppercase font-bold">{showReviewsSection ? 'Collapse' : 'Expand'}</span>
                  </button>

                  <AnimatePresence>
                    {showReviewsSection && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 space-y-3 max-h-56 overflow-y-auto pr-1"
                      >
                        {sellerReviews.map((rev) => (
                          <div key={rev.id} className="bg-white p-3 rounded-xl border border-slate-100 text-xs shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-extrabold text-slate-800">{rev.buyerName}</span>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star key={s} size={10} className={`${s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-100'}`} />
                                ))}
                              </div>
                            </div>
                            {rev.comment ? (
                              <p className="text-slate-600 italic">"{rev.comment}"</p>
                            ) : (
                              <p className="text-slate-400 italic">Rated without written comment.</p>
                            )}
                            <div className="text-[9px] text-slate-400 mt-1 flex justify-between">
                              <span className="font-semibold text-emerald-600">{rev.success ? '✓ Successful Deal' : 'ℹ Incomplete'}</span>
                              <span>{rev.createdAt?.toDate ? formatDistanceToNow(rev.createdAt.toDate(), { addSuffix: true, locale: pt }) : 'Recently'}</span>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* Reivindicar Card no Desktop */}
          {ad.isClaimableBusiness && (ad.claimStatus === 'unclaimed' || !ad.claimStatus) && (
            <div className="bg-gradient-to-br from-indigo-50/70 to-amber-50/20 border border-indigo-100 rounded-[2rem] p-6 md:p-8 shadow-xl space-y-4 text-left animate-fade-in">
              <div className="flex gap-3.5 items-start">
                <span className="text-3xl">💼</span>
                <div className="space-y-1">
                  <p className="font-extrabold text-[#030d32] text-base">Are you the owner of this business?</p>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                    Activate and claim this listing for free to start receiving direct WhatsApp enquiries!
                  </p>
                </div>
              </div>
              <button
                onClick={handleOpenClaimModal}
                className="w-full text-center py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95"
              >
                I am the owner of this business
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE OPTIMIZED LAYOUT (3 compact sequence card sections on phones) */}
      <div className="block lg:hidden space-y-5">
        
        {/* CAROUSEL FLOW */}
        <div className="space-y-3">
          <div 
            className="relative aspect-[4/3] sm:aspect-[16/10] bg-slate-950 rounded-2xl overflow-hidden shadow-md group touch-pan-y flex items-center justify-center select-none"
            onTouchStart={handleGalleryTouchStart}
            onTouchMove={handleGalleryTouchMove}
            onTouchEnd={handleGalleryTouchEnd}
          >
            {currentMedia.type === 'video' ? (
              <video
                ref={mobileVideoRef}
                src={currentMedia.url}
                controls
                preload="metadata"
                playsInline
                className="w-full h-full object-contain relative z-10 bg-black rounded-2xl"
              />
            ) : (
              <>
                <div 
                  className="absolute inset-0 bg-cover bg-center blur-2xl opacity-25 select-none pointer-events-none scale-110"
                  style={{ backgroundImage: `url(${currentMedia.url})` }}
                />
                <img
                  src={currentMedia.url}
                  alt={ad.title}
                  className="w-full h-full object-contain relative z-10 cursor-zoom-in"
                  onClick={() => setShowFullImage(true)}
                  referrerPolicy="no-referrer"
                  style={currentMedia.imageIndex === 0 ? {
                    objectPosition: ad.imagePositionX !== undefined && ad.imagePositionY !== undefined
                      ? `${ad.imagePositionX}% ${ad.imagePositionY}%`
                      : '50% 50%',
                    transform: `scale(${ad.imageZoom || 1}) translate(${
                      ad.imageZoom && ad.imageZoom > 1
                        ? ((ad.imagePositionX || 50) - 50) * (ad.imageZoom - 1) / ad.imageZoom
                        : 0
                    }%, ${
                      ad.imageZoom && ad.imageZoom > 1
                        ? ((ad.imagePositionY || 50) - 50) * (ad.imageZoom - 1) / ad.imageZoom
                        : 0
                    }%)`
                  } : undefined}
                />
              </>
            )}

            {/* Favorito Button */}
            <button
              onClick={handleToggleFavorite}
              className={`absolute top-4 right-4 p-2.5 rounded-full z-20 backdrop-blur-md transition-all shadow-md ${
                isFavorite ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-white/90 text-slate-400 hover:text-red-500 hover:bg-white'
              }`}
            >
              <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>

            {/* Carousel Buttons */}
            {mediaItems.length > 1 && (
              <>
                <button
                  onClick={() => {
                    pauseVideos();
                    setCurrentImageIndex((prev) => (prev === 0 ? mediaItems.length - 1 : prev - 1));
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/95 backdrop-blur-md rounded-full text-slate-900 shadow-md z-20"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => {
                    pauseVideos();
                    setCurrentImageIndex((prev) => (prev === mediaItems.length - 1 ? 0 : prev + 1));
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/95 backdrop-blur-md rounded-full text-slate-900 shadow-md z-20"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails list */}
          {mediaItems.length > 1 && (
            <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none">
              {mediaItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    pauseVideos();
                    setCurrentImageIndex(i);
                  }}
                  className={`relative w-20 h-16 sm:w-24 sm:h-18 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                    validMediaIndex === i ? 'border-indigo-600 scale-95 shadow-sm ring-2 ring-indigo-500/30' : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                >
                  {item.type === 'video' ? (
                    <>
                      {images[0] ? (
                        <img src={images[0]} alt="Video Thumbnail" className="w-full h-full object-cover brightness-75" />
                      ) : (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-400">
                          <Video size={16} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                          <Play size={10} className="fill-white ml-0.5" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img 
                      src={item.url} 
                      alt={`Miniatura ${i}`} 
                      className="w-full h-full object-cover"
                      style={item.imageIndex === 0 ? {
                        objectPosition: ad.imagePositionX !== undefined && ad.imagePositionY !== undefined
                          ? `${ad.imagePositionX}% ${ad.imagePositionY}%`
                          : '50% 50%',
                        transform: `scale(${ad.imageZoom || 1}) translate(${
                          ad.imageZoom && ad.imageZoom > 1
                            ? ((ad.imagePositionX || 50) - 50) * (ad.imageZoom - 1) / ad.imageZoom
                            : 0
                        }%, ${
                          ad.imageZoom && ad.imageZoom > 1
                            ? ((ad.imagePositionY || 50) - 50) * (ad.imageZoom - 1) / ad.imageZoom
                            : 0
                        }%)`
                      } : undefined}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* SECTION CARD 1: Descrição com valor, cidade e país + Dados e CTAs */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-lg space-y-4 text-left">
          
          {/* Categoria, views & time */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-100/70 pb-2.5">
            <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border border-indigo-100">
              {ad.category}
            </span>
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
              <span className="flex items-center gap-1">
                <Eye size={12} /> {ad.isClaimableBusiness ? (ad.businessViews || 0) : (ad.views || 0)}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} /> {timeStr}
              </span>
            </div>
          </div>

          {/* Selos de Negócio Reivindicável no Mobile */}
          {ad.isClaimableBusiness && (
            <div className="flex flex-wrap gap-1.5 pt-1 animate-fade-in">
              {(ad.claimStatus === 'unclaimed' || !ad.claimStatus) && (
                <span className="bg-amber-50 text-amber-640 text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider border border-amber-200 flex items-center gap-1">
                  <AlertCircle size={10} /> Awaiting owner activation
                </span>
              )}
              {ad.claimStatus === 'pending' && (
                <span className="bg-indigo-50 text-indigo-600 text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider border border-indigo-200 flex items-center gap-1 animate-pulse">
                  <Clock size={10} /> Activation Pending
                </span>
              )}
              {ad.claimStatus === 'claimed' && (
                <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider border border-emerald-200 flex items-center gap-1">
                  <Award size={10} /> Verified & Active
                </span>
              )}
            </div>
          )}

          {/* Title, Country/City, Price */}
          <div className="space-y-1.5">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
              {ad.title}
            </h1>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 text-slate-500 font-bold text-xs truncate">
                {isService && ad.serviceCoverage === 'online' ? (
                  <span className="truncate">💻 Online Service</span>
                ) : isService && ad.serviceCoverage === 'uk' ? (
                  <span className="truncate">🌍 Entire UK</span>
                ) : isService && ad.serviceCoverage === 'portugal' ? (
                  <span className="truncate">🇵🇹 Entire Portugal</span>
                ) : (
                  <>
                    <MapPin size={13} className="text-indigo-600 shrink-0" />
                    <span className="truncate">{getAdLocationLabel(ad)}</span>
                  </>
                )}
              </div>
              {ad.category === '💚 Doações & Solidariedade' ? (
                <div className="text-lg sm:text-xl font-black text-emerald-600 bg-emerald-50 py-0.5 px-2.5 rounded-lg border border-emerald-200 flex-shrink-0">
                  Free 💚
                </div>
              ) : hasPrice ? (
                <div className="text-lg sm:text-xl font-black text-indigo-600 bg-indigo-50/50 py-0.5 px-2.5 rounded-lg border border-indigo-100/30 flex-shrink-0">
                  {formatPrice(ad.price, ad.country)}
                </div>
              ) : (
                <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-100 flex-shrink-0">
                  Price on Request
                </span>
              )}
            </div>
          </div>

          {/* Descrição detalhada compacta */}
          <div className="space-y-1">
            <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Detailed Description</h3>
            <p className="text-slate-650 text-xs sm:text-sm leading-relaxed whitespace-pre-line break-words bg-slate-50/40 p-3 rounded-xl border border-slate-50">
              {normalizedDescription.length > 250 && !descriptionExpanded
                ? `${normalizedDescription.substring(0, 250).trim()}...`
                : normalizedDescription}
            </p>
            {normalizedDescription.length > 250 && (
              <button
                onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
              >
                {descriptionExpanded ? 'Show Less' : 'Read Full Description'}
              </button>
            )}
          </div>

          {/* ESPECIFICAÇÕES TÉCNICAS DO BARCO NO MOBILE */}
          {(ad.boatType || ad.manufacturer || ad.model || ad.year || ad.length || ad.beam || ad.draft || ad.hullMaterial || ad.engineBrand || ad.horsepower || ad.engineHours || ad.fuelType || ad.cabins || ad.berths || ad.bathrooms || ad.trailerIncluded || ad.vatPaid || ad.ceCertified) && (
            <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-100 space-y-4 text-left">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-indigo-600/10 text-indigo-700 rounded-lg flex items-center justify-center font-bold">
                    <Anchor size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs font-black text-slate-900 leading-none">⚓ Technical Specifications</h2>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">ConnectBoat Specs</p>
                  </div>
                </div>
                {ad.condition && (
                  <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {ad.condition}
                  </span>
                )}
              </div>

              {/* Embarcação */}
              {(ad.boatType || ad.manufacturer || ad.model || ad.year) && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-sky-800 tracking-wider block">Vessel</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {ad.boatType && (
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Type</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.boatType}</span>
                      </div>
                    )}
                    {ad.manufacturer && (
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Make</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.manufacturer}</span>
                      </div>
                    )}
                    {ad.model && (
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Model</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.model}</span>
                      </div>
                    )}
                    {ad.year && (
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Year</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.year}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dimensões */}
              {(ad.length || ad.beam || ad.draft || ad.hullMaterial) && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-teal-800 tracking-wider block">Dimensions</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {ad.length && (
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Length</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.length}</span>
                      </div>
                    )}
                    {ad.beam && (
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Beam</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.beam}</span>
                      </div>
                    )}
                    {ad.draft && (
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Draft</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.draft}</span>
                      </div>
                    )}
                    {ad.hullMaterial && (
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Hull</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.hullMaterial}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Motor */}
              {(ad.engineBrand || ad.horsepower || ad.engineHours || ad.fuelType) && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider block">Engine</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {ad.engineBrand && (
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Make</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.engineBrand}</span>
                      </div>
                    )}
                    {ad.horsepower && (
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Power</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.horsepower}</span>
                      </div>
                    )}
                    {ad.engineHours && (
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Hours</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.engineHours}</span>
                      </div>
                    )}
                    {ad.fuelType && (
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Fuel</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.fuelType}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Acomodações e Conformidade */}
              {(ad.cabins || ad.berths || ad.bathrooms || ad.trailerIncluded || ad.vatPaid || ad.ceCertified) && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-indigo-800 tracking-wider block">Accommodations & Extras</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {ad.cabins && (
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Cabins</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.cabins}</span>
                      </div>
                    )}
                    {ad.berths && (
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Berths</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.berths}</span>
                      </div>
                    )}
                    {ad.bathrooms && (
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Toilets</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.bathrooms}</span>
                      </div>
                    )}
                    {ad.trailerIncluded && (
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Trailer</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.trailerIncluded === 'Yes' ? 'Yes' : ad.trailerIncluded === 'No' ? 'No' : ad.trailerIncluded}</span>
                      </div>
                    )}
                  </div>
                  {(ad.vatPaid || ad.ceCertified) && (
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200/60">
                      {ad.vatPaid === 'Yes' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                          <ShieldCheck size={12} className="text-emerald-600" /> VAT Paid
                        </span>
                      )}
                      {ad.ceCertified === 'Yes' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-800 text-[10px] font-bold border border-indigo-200">
                          <Check size={12} className="text-indigo-600" /> CE Certified
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Cartão do Vendedor Compacto */}
          <div className="bg-slate-50 rounded-2xl p-3 sm:p-4 border border-slate-100 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200/50 pb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 bg-indigo-600/10 bg-indigo-50 text-indigo-700 rounded-lg flex items-center justify-center font-black text-xs shrink-0">
                  {(hasSourceUrl ? 'Partner' : ad.sellerName).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm leading-tight flex items-center gap-1 truncate">
                    {hasSourceUrl ? 'Partner' : ad.sellerName}
                    <Award size={11} className="text-indigo-500 shrink-0" />
                  </h4>
                  <div className="flex items-center gap-0.5 mt-0.5" title={`${sellerProfile?.ratingAverage || 0} / 5`}>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const ratingVal = sellerProfile?.ratingAverage || 0;
                        const isFilled = star <= Math.round(ratingVal);
                        return (
                          <Star
                            key={star}
                            size={9}
                            className={isFilled ? "text-amber-400 fill-amber-400" : "text-slate-200"}
                          />
                        );
                      })}
                    </div>
                    <span className="text-[9px] text-slate-500 font-bold ml-1">
                      ({sellerProfile?.ratingCount || 0} reviews)
                    </span>
                  </div>
                </div>
              </div>

              {/* Avaliar button */}
              {user && user.uid !== ad.sellerId && (
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="text-[9px] font-black bg-indigo-50 text-indigo-600 py-1 px-2.5 rounded-lg border border-indigo-100 shrink-0 text-center hover:bg-indigo-100/70"
                >
                  Rate
                </button>
              )}
            </div>

            {/* Reivindicar Card no Mobile */}
            {ad.isClaimableBusiness && (ad.claimStatus === 'unclaimed' || !ad.claimStatus) && (
              <div className="bg-gradient-to-br from-indigo-50 to-amber-50/10 border border-indigo-100 rounded-2xl p-4 space-y-2.5 text-left animate-fade-in my-2">
                <div className="flex gap-2 items-start">
                  <span className="text-xl">💼</span>
                  <div className="space-y-0.5">
                    <p className="font-extrabold text-[#030d32] text-xs">Are you the owner of this business?</p>
                    <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                      Activate and claim this listing for free to start receiving direct WhatsApp enquiries!
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleOpenClaimModal}
                  className="w-full text-center py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  Confirm Ownership
                </button>
              </div>
            )}

            {/* CTAs */}
            <div className="flex flex-col gap-2 pt-1">
              {ad.adStatus === 'sold' || ad.status === 'sold' ? (
                <div className="flex items-center justify-center gap-1 bg-slate-100 text-slate-500 py-2.5 px-4 rounded-xl font-black text-xs border border-slate-200">
                  <Tag size={14} className="text-slate-400" />
                  <span>Listing Sold</span>
                </div>
              ) : (
                <button
                  onClick={handleContactClick}
                  className={`flex items-center justify-center gap-1.5 ${
                    hasSourceUrl ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-500 hover:bg-emerald-600'
                  } text-white py-2.5 px-4 rounded-xl font-black text-xs transition-all shadow-md active:scale-[0.98] w-full text-center`}
                >
                  {hasSourceUrl ? <ExternalLink size={14} /> : <MessageCircle size={14} />}
                  <span>{hasSourceUrl ? 'Contact' : 'Contact via WhatsApp'}</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleShare}
                  className={`flex items-center justify-center gap-1 border px-2 py-2 rounded-lg font-bold text-[9px] transition-all truncate ${
                    shareCopied 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Share2 size={13} className={shareCopied ? 'text-emerald-500' : ''} />
                  <span>{shareCopied ? 'Copied!' : 'Share'}</span>
                </button>

                <button
                  onClick={() => setShowReportModal(true)}
                  className="flex items-center justify-center gap-1 border border-rose-100 hover:border-rose-200 text-rose-500 bg-rose-50/50 hover:bg-rose-50 py-2 px-2 rounded-lg font-bold text-[9px] transition"
                >
                  <ShieldAlert size={13} /> Report
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION CARD 2: Localização aproximada */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-lg space-y-3.5 text-left">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <MapPin size={14} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 leading-none">📍 Approximate Location</h2>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1 font-sans">Reference region for the listing</p>
            </div>
          </div>

          <div className="flex flex-row items-center justify-between gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100 font-sans">
            <div className="space-y-0.5">
              <span className="block text-[8px] text-slate-400 uppercase font-black tracking-wider text-left">
                {isService ? 'Service Area' : 'City'}
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 block text-left truncate">
                {isService && ad.serviceCoverage === 'online' ? (
                  '💻 Online Service'
                ) : isService && ad.serviceCoverage === 'uk' ? (
                  '🌍 Entire UK'
                ) : isService && ad.serviceCoverage === 'portugal' ? (
                  '🇵🇹 Entire Portugal'
                ) : (
                  getAdLocationLabel(ad)
                )}
              </span>
            </div>
            {!(isService && (ad.serviceCoverage === 'online' || ad.serviceCoverage === 'uk' || ad.serviceCoverage === 'portugal')) && (
              <div className="space-y-0.5 text-right">
                <span className="block text-[8px] text-slate-400 uppercase font-black tracking-wider">Country</span>
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 block truncate">
                  {ad.country === 'Reino Unido' ? 'United Kingdom' : 'Portugal'}
                </span>
              </div>
            )}
          </div>

          {isService && ad.serviceCoverage === 'online' ? (
            <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl text-center space-y-1">
              <span className="text-3xl">💻</span>
              <p className="text-sm font-extrabold text-indigo-900">100% Online Service</p>
              <p className="text-[10px] text-indigo-700/85 font-semibold max-w-xs leading-normal">This service is provided remotely / online.</p>
            </div>
          ) : isService && (ad.serviceCoverage === 'uk' || ad.serviceCoverage === 'portugal') ? (
            <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-r from-teal-50 to-emerald-50 border border-emerald-100 rounded-xl text-center space-y-1">
              <span className="text-3xl">🌍</span>
              <p className="text-sm font-extrabold text-emerald-900">National Coverage</p>
              <p className="text-[10px] text-emerald-700/85 font-semibold max-w-xs leading-normal">This service provides nationwide coverage ({ad.country === 'Reino Unido' ? 'United Kingdom' : 'Portugal'}).</p>
            </div>
          ) : (
            ad.city && ad.city.trim() !== '' && ad.city.toLowerCase() !== 'todas' && (
              <div className="w-full h-40 rounded-xl overflow-hidden border border-slate-100 shadow-sm bg-slate-100 relative">
                <iframe
                  title={`Map of ${ad.city}`}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(ad.city + ', ' + ad.country)}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                />
              </div>
            )
          )}

          <div className="flex items-start gap-1.5 text-slate-500 bg-amber-50/20 border border-amber-100/60 rounded-xl p-2.5 text-[10px] font-sans">
            <span className="text-amber-500 text-xs leading-none mt-0.5">⚠️</span>
            <p className="leading-relaxed text-amber-900">
              The location shown is approximate based on the city provided by the seller and serves strictly as a reference point.
            </p>
          </div>
        </div>

        {/* SECTION CARD 3: Avaliações do Vendedor (Feedback) */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-lg space-y-3.5 text-left">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <Star size={14} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 leading-none">⭐️ Seller Reviews</h2>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1 font-sans">Real feedback from other customers</p>
            </div>
          </div>

          {sellerReviews.length > 0 ? (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-0.5 scrollbar-none">
              {sellerReviews.map((rev) => (
                <div key={rev.id} className="bg-slate-50/60 p-2.5 rounded-xl border border-slate-100 text-xs shadow-sm">
                  <div className="flex justify-between items-start mb-1 gap-1.5">
                    <span className="font-extrabold text-slate-800 text-[11px] truncate">{rev.buyerName}</span>
                    <div className="flex gap-0.5 shrink-0">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={9} className={`${s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-100'}`} />
                      ))}
                    </div>
                  </div>
                  {rev.comment ? (
                    <p className="text-slate-600 text-[11px] italic leading-relaxed">"{rev.comment}"</p>
                  ) : (
                    <p className="text-slate-400 text-[10px] italic">Rated without written comment.</p>
                  )}
                  <div className="text-[8px] text-slate-400 mt-2 flex justify-between items-center">
                    <span className="font-semibold text-emerald-600">{rev.success ? '✓ Successful Deal' : 'ℹ Incomplete'}</span>
                    <span>{rev.createdAt?.toDate ? formatDistanceToNow(rev.createdAt.toDate(), { addSuffix: true, locale: pt }) : 'Recently'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-5 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-3.5">
              <span className="text-lg block mb-1">💬</span>
              <h4 className="text-xs font-bold text-slate-800">No reviews yet</h4>
              <p className="text-[9px] text-slate-400 mt-0.5 leading-normal">
                Transact safely with the seller or hire operator and be the first to leave feedback!
              </p>
            </div>
          )}
        </div>

      </div> {/* closes block lg:hidden */}

      {/* MORE FROM THIS SELLER */}
      {sellerAds.length > 0 && (
        <section className="mt-10 sm:mt-12 rounded-[1.75rem] sm:rounded-[2rem] border border-slate-200 bg-white shadow-sm overflow-hidden text-left">
          <div className="px-4 sm:px-6 lg:px-7 py-5 sm:py-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-indigo-50/50">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.22em] text-indigo-600 mb-1">
                  Seller collection
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  More From This Seller
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 font-semibold mt-1">
                  More active listings from {hasSourceUrl ? 'this partner' : (ad.sellerName || 'this seller')}.
                </p>
              </div>

              <div className="hidden sm:flex shrink-0 items-center justify-center min-w-12 h-10 px-3 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700">
                <span className="text-sm font-black">{sellerAds.length}</span>
                <span className="ml-1 text-[9px] font-black uppercase tracking-wide">more</span>
              </div>
            </div>
          </div>

          {/* Single-row horizontal carousel on all screen sizes */}
          <div className="p-4 sm:p-5 lg:p-6">
            <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-thin">
              {sellerAds.map((sellerAd) => (
                <div
                  key={sellerAd.id}
                  className="min-w-[76vw] xs:min-w-[260px] sm:min-w-[280px] md:min-w-[290px] lg:min-w-[270px] xl:min-w-[285px] max-w-[285px] snap-start"
                >
                  <AdCard ad={sellerAd} />
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400">
              <span>Swipe or scroll to see more listings</span>
              <ChevronRight size={13} />
            </div>
          </div>
        </section>
      )}

      {/* RELATED LISTINGS SECTION (Anúncios Náuticos Semelhantes) */}
      {relatedAds.length > 0 && (
        <div className="mt-12 pt-8 border-t border-slate-200/80 text-left">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                ⛵ Similar Vessels
              </h2>
              <p className="text-xs text-slate-500 font-bold mt-1">
                Recommended listings with similar features and specifications
              </p>
            </div>
            <Link
              to={`/marcas-modelos`}
              className="text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors hidden sm:inline-flex items-center gap-1"
            >
              Browse Nautical Market <ChevronRight size={14} />
            </Link>
          </div>

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
