import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, MessageCircle, Phone, Mail, Clock, ChevronLeft, ChevronRight, X, Heart, Star, 
  Trash2, Edit, AlertCircle, ShieldAlert, Eye, EyeOff, Award, Calendar, Share2, ExternalLink,
  Anchor, Compass, Gauge, ShieldCheck, Ruler, Fuel, Check, Bed, Tag, Play, Video, UserRound
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
import { ConnectBoatLogo } from '../components/ConnectBoatLogo';

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

  const [listingPageBackground, setListingPageBackground] = useState<{
    enabled: boolean;
    type: 'image' | 'video';
    mediaUrl: string;
    loop: boolean;
    overlayOpacity: number;
  }>({
    enabled: false,
    type: 'video',
    mediaUrl: '',
    loop: true,
    overlayOpacity: 28,
  });

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
      doc(db, 'settings', 'listingDetailsBackground'),
      (snapshot) => {
        if (!snapshot.exists()) {
          setListingPageBackground((current) => ({ ...current, enabled: false }));
          return;
        }
        const data = snapshot.data() || {};
        setListingPageBackground({
          enabled: data.enabled === true,
          type: data.type === 'image' ? 'image' : 'video',
          mediaUrl: String(data.mediaUrl || ''),
          loop: data.loop !== false,
          overlayOpacity: Number.isFinite(Number(data.overlayOpacity))
            ? Math.max(0, Math.min(70, Number(data.overlayOpacity)))
            : 28,
        });
      },
      (error) => console.warn('Unable to load listing details background:', error)
    );
    return () => unsubscribe();
  }, []);

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

        setListingAdCampaigns((previous) => {
          const previousKey = previous
            .map((campaign) => [
              campaign.id,
              campaign.enabled,
              campaign.imageUrl,
              campaign.targetUrl,
              campaign.altText,
              campaign.displaySeconds,
              campaign.startDate,
              campaign.endDate,
            ].join('|'))
            .join('||');

          const nextKey = campaigns
            .map((campaign) => [
              campaign.id,
              campaign.enabled,
              campaign.imageUrl,
              campaign.targetUrl,
              campaign.altText,
              campaign.displaySeconds,
              campaign.startDate,
              campaign.endDate,
            ].join('|'))
            .join('||');

          return previousKey === nextKey ? previous : campaigns;
        });

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
    listingAdCampaigns.forEach((campaign) => {
      if (!campaign?.imageUrl) return;
      const img = new Image();
      img.src = campaign.imageUrl;
    });
  }, [listingAdCampaigns]);

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
  const [showSellerProfileModal, setShowSellerProfileModal] = useState(false);
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
  const [showContactOptionsModal, setShowContactOptionsModal] = useState(false);
  const [selectedContactMethod, setSelectedContactMethod] = useState<'whatsapp' | 'phone' | 'email' | 'source' | null>(null);
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
        ratingCount,
        publicDescription: '',
        profileImageUrl: ''
      };

      // Public seller profile: photo/logo, description, public name and member information.
      // Keep ad data as fallback so older/imported listings continue to work.
      try {
        const publicProfileRef = doc(db, 'sellerPublicProfiles', sellerId);
        const publicProfileSnap = await getDoc(publicProfileRef);

        if (publicProfileSnap.exists()) {
          const publicData: any = publicProfileSnap.data();
          profileData.displayName = publicData.displayName || profileData.displayName;
          profileData.city = publicData.city || profileData.city;
          profileData.country = publicData.country || profileData.country;
          profileData.publicDescription = publicData.publicDescription || '';
          profileData.profileImageUrl = publicData.profileImageUrl || '';
          profileData.createdAt = publicData.createdAt || publicData.updatedAt || undefined;
        } else {
          // Fallback for profiles created before sellerPublicProfiles existed.
          const userProfileSnap = await getDoc(doc(db, 'users', sellerId));
          if (userProfileSnap.exists()) {
            const userData: any = userProfileSnap.data();
            profileData.displayName = userData.displayName || userData.name || profileData.displayName;
            profileData.city = userData.city || profileData.city;
            profileData.country = userData.country || profileData.country;
            profileData.publicDescription = userData.publicDescription || '';
            profileData.profileImageUrl = userData.profileImageUrl || '';
            profileData.createdAt = userData.createdAt || userData.acceptedTermsAt || undefined;
          }
        }
      } catch (profileErr) {
        console.warn('[AdDetails] Unable to load public seller profile; using listing fallback.', profileErr);
      }

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
    return phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  };

  type ContactMethod = 'whatsapp' | 'phone' | 'email' | 'source';

  const getContactMethods = (): ContactMethod[] => {
    if (!ad) return [];

    const a = ad as any;
    const hasNewVisibilityFlags =
      typeof a.showWhatsapp === 'boolean' ||
      typeof a.showPhone === 'boolean' ||
      typeof a.showEmail === 'boolean';

    const whatsappNumber = (a.contactWhatsapp || '').trim();
    const phoneNumber = (a.contactPhone || '').trim();
    const emailAddress = (a.contactEmail || '').trim();

    if (hasNewVisibilityFlags) {
      const methods: ContactMethod[] = [];
      if (a.showWhatsapp === true && whatsappNumber) methods.push('whatsapp');
      if (a.showPhone === true && phoneNumber) methods.push('phone');
      if (a.showEmail === true && emailAddress) methods.push('email');
      return methods;
    }

    // Backward compatibility for listings created before Contact Options.
    if ((ad.sellerPhone || '').trim()) return ['whatsapp'];
    if (emailAddress) return ['email'];
    if (hasSourceUrl && ad.sourceUrl) return ['source'];
    return [];
  };

  const getContactMethodLabel = (method: ContactMethod) => {
    if (method === 'whatsapp') return 'WhatsApp';
    if (method === 'phone') return 'Call Seller';
    if (method === 'email') return 'Email Seller';
    return 'Contact Seller';
  };

  const getContactMethodIcon = (method: ContactMethod) => {
    if (method === 'phone') return Phone;
    if (method === 'email') return Mail;
    if (method === 'source') return ExternalLink;
    return MessageCircle;
  };

  const getTargetContactUrl = (method: ContactMethod) => {
    if (!ad) return '';
    const a = ad as any;

    if (method === 'whatsapp') {
      const phone = cleanPhone((a.contactWhatsapp || ad.sellerPhone || '').trim());
      if (!phone) return '';
      return `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(`Hello, I saw your listing "${ad.title}" on ConnectBoat and I'm interested. Is it still available?`)}`;
    }

    if (method === 'phone') {
      const phone = cleanPhone((a.contactPhone || '').trim());
      return phone ? `tel:${phone}` : '';
    }

    if (method === 'email') {
      const email = (a.contactEmail || '').trim();
      if (!email) return '';
      const subject = encodeURIComponent(`ConnectBoat enquiry: ${ad.title}`);
      const body = encodeURIComponent(`Hello,\n\nI saw your listing "${ad.title}" on ConnectBoat and I'm interested. Is it still available?\n\nThank you.`);
      return `mailto:${email}?subject=${subject}&body=${body}`;
    }

    if (method === 'source' && hasSourceUrl && ad.sourceUrl) {
      return ad.sourceUrl;
    }

    return '';
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

  const openContactMethod = async (method: ContactMethod) => {
    if (!ad) return;

    const targetUrl = getTargetContactUrl(method);
    if (!targetUrl) {
      showToastMsg('error', 'This contact method is not available.');
      return;
    }

    if (method === 'whatsapp') {
      incrementWhatsappClicks();
    }

    if (user) {
      showToastMsg('loading', 'Registering your interest...');
      const res = await registerInterest(method);
      if (res.success) {
        showToastMsg('success', `${getContactMethodLabel(method)} opening...`, res.bypassed ? 2000 : 3000);
      } else {
        showToastMsg('error', `Could not register interest. Opening contact anyway...`, 3500);
      }
    }

    if (method === 'phone' || method === 'email') {
      window.location.href = targetUrl;
    } else {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const continueWithContactMethod = (method: ContactMethod) => {
    setSelectedContactMethod(method);
    setShowContactOptionsModal(false);

    const accepted = localStorage.getItem('safety_terms_accepted') === 'true';
    if (accepted) {
      void openContactMethod(method);
    } else {
      setShowContactWarning(true);
    }
  };

  const handleContactClick = () => {
    if (ad?.isClaimableBusiness && ad.claimStatus !== 'claimed') {
      setShowUnclaimedContactModal(true);
      return;
    }
    if (ad?.adStatus === 'sold' || ad?.status === 'sold') {
      showToastMsg('error', 'This listing has been sold. The seller cannot be contacted.');
      return;
    }
    if (!user) {
      navigate(`/login?message=${encodeURIComponent('To contact the seller, please log in or create a free account.')}`);
      return;
    }

    const methods = getContactMethods();
    if (methods.length === 0) {
      showToastMsg('error', 'No contact method is currently available for this listing.');
      return;
    }

    if (methods.length === 1) {
      continueWithContactMethod(methods[0]);
      return;
    }

    setShowContactOptionsModal(true);
  };

  const registerInterest = async (method: ContactMethod = 'whatsapp'): Promise<{ success: boolean; error?: string; bypassed?: boolean }> => {
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
      source: method
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
            message: `${truncatedName} used ${getContactMethodLabel(method)} for the listing "${ad.title}".`,
            createdAt: serverTimestamp(),
            read: false,
            adId: ad.id,
            type: 'contact_interest'
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

  const handleConfirmContact = async () => {
    if (ad?.adStatus === 'sold' || ad?.status === 'sold') {
      showToastMsg('error', 'This listing has been sold. The seller cannot be contacted.');
      return;
    }

    if (!acceptedContactTerms || !selectedContactMethod) return;

    localStorage.setItem('safety_terms_accepted', 'true');
    setShowContactWarning(false);
    await openContactMethod(selectedContactMethod);
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

  // More listings from the same seller.
  // For claimable listings still controlled by Admin/Moderator, do not expose
  // other listings uploaded from the same staff account.
  useEffect(() => {
    const isAwaitingClaim =
      !!ad?.isClaimableBusiness &&
      ad?.claimStatus !== 'claimed';

    if (!ad?.sellerId || isAwaitingClaim) {
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
  }, [ad?.id, ad?.sellerId, ad?.isClaimableBusiness, ad?.claimStatus]);

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

  // Only collapse the description when "More From This Seller" is present.
  const shouldCollapseDescription = sellerAds.length > 0;
  
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

  const isUnclaimed =
    (ad.isClaimableBusiness === true ||
      ad.isClaimable === true ||
      ad.listingType === 'claimable') &&
    ad.claimStatus !== 'claimed';

  return (
    <>
      {listingPageBackground.enabled && listingPageBackground.mediaUrl && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
          {listingPageBackground.type === 'video' ? (
            <video
              src={listingPageBackground.mediaUrl}
              autoPlay
              muted
              loop={listingPageBackground.loop}
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <img
              src={listingPageBackground.mediaUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div
            className="absolute inset-0 bg-slate-950"
            style={{ opacity: listingPageBackground.overlayOpacity / 100 }}
          />
        </div>
      )}
      <div className="relative z-10 w-full max-w-[1880px] mx-auto px-2 sm:px-3 lg:px-4 xl:px-5 2xl:px-6 pt-0 pb-5 sm:pt-0 sm:pb-5">
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

      {/* Sponsored carousel — Back | advertising | AD */}
      <section className="relative mt-1 mb-1 bg-transparent lg:-mt-[28px]">
        <div className="flex items-center gap-1 lg:gap-3 overflow-hidden py-0 px-1 lg:px-0">
          <button
            onClick={() => navigate(-1)}
            className="relative z-30 hidden lg:inline-flex shrink-0 h-[38px] min-w-[68px] items-center justify-center rounded-xl border-2 border-white bg-[#073b59]/75 px-3 text-sm font-black text-white shadow-[0_6px_16px_rgba(0,0,0,0.24)] backdrop-blur-sm transition-all hover:bg-[#073b59]/90 hover:scale-[1.02]"
            aria-label="Back"
          >
            Back
          </button>

          <div className="relative z-10 min-w-0 flex-1 overflow-hidden">
            {listingAdCampaigns.length > 0 ? (
              <div className="flex items-center overflow-hidden py-0">
                <div className="connectboat-ad-marquee flex w-max items-center gap-1.5 sm:gap-2 will-change-transform">
                  {[...listingAdCampaigns, ...listingAdCampaigns].map((campaign, index) => (
                    <React.Fragment key={`${campaign.id}-${index}`}>
                      {campaign.targetUrl ? (
                        <a
                          href={campaign.targetUrl}
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                          onClick={() => handleAdvertisingClick(campaign)}
                          className="group block shrink-0 w-[42vw] max-w-[170px] sm:w-[200px] sm:max-w-none lg:w-[240px] aspect-video overflow-hidden rounded-2xl border border-white/80 bg-white shadow-xl"
                          aria-label={campaign.altText || campaign.advertiserName || 'Advertising'}
                        >
                          <img
                            src={campaign.imageUrl}
                            alt={campaign.altText || campaign.advertiserName || 'ConnectBoat advertising'}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                            loading={index < 4 ? 'eager' : 'lazy'}
                          />
                        </a>
                      ) : (
                        <div className="shrink-0 w-[42vw] max-w-[170px] sm:w-[200px] sm:max-w-none lg:w-[240px] aspect-video overflow-hidden rounded-2xl border border-white/80 bg-white shadow-xl">
                          <img
                            src={campaign.imageUrl}
                            alt={campaign.altText || campaign.advertiserName || 'ConnectBoat advertising'}
                            className="h-full w-full object-cover"
                            loading={index < 4 ? 'eager' : 'lazy'}
                          />
                        </div>
                      )}
                      <div
                        className="shrink-0 h-7 w-7 sm:h-8 sm:w-8 lg:h-8 lg:w-8 rounded-full bg-[#0b1930]/95 border border-white/70 shadow-md flex items-center justify-center p-0.5"
                        aria-hidden="true"
                      >
                        <ConnectBoatLogo className="h-5 w-auto sm:h-6 shrink-0 text-white" />
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ) : (
              <div className="min-h-[92px] sm:min-h-[118px] lg:min-h-[135px] flex items-center justify-center px-6 text-center text-white">
                <div className="rounded-2xl bg-transparent border border-white/20 px-6 py-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">ConnectBoat Advertising</div>
                  <div className="mt-2 text-xl sm:text-2xl font-black">Your marine brand could be here</div>
                </div>
              </div>
            )}
          </div>

          <div
            className="relative z-30 inline-flex shrink-0 h-[20px] min-w-[28px] sm:h-[22px] sm:min-w-[31px] lg:h-[38px] lg:min-w-[68px] items-center justify-center rounded-md lg:rounded-xl border border-white/90 lg:border-2 bg-[#073b59]/55 lg:bg-[#073b59]/65 px-1 lg:px-3 text-[7px] sm:text-[8px] lg:text-sm font-black uppercase leading-none text-white shadow-[0_3px_8px_rgba(0,0,0,0.18)] lg:shadow-[0_6px_16px_rgba(0,0,0,0.24)] backdrop-blur-sm"
            aria-label="Advertisement"
          >
            AD
          </div>
        </div>

        <style>{`
          @keyframes connectboat-ad-marquee-right {
            from { transform: translateX(-50%); }
            to { transform: translateX(0); }
          }
          .connectboat-ad-marquee {
            animation: connectboat-ad-marquee-right 70s linear infinite;
          }
          .connectboat-ad-marquee:hover {
            animation-play-state: paused;
          }
          .seller-more-card {
            flex-basis: calc((100% - 0.75rem) / 2);
            max-width: calc((100% - 0.75rem) / 2);
          }
          @media (min-width: 1024px) {
            .seller-more-card {
              flex-basis: calc((100% - 2rem) / 3);
              max-width: calc((100% - 2rem) / 3);
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .connectboat-ad-marquee { animation: none; }
          }
        `}</style>
      </section>

      {/* DESKTOP LAYOUT */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-4 xl:gap-5">
        {/* LADO ESQUERDO: Imagens e Galeria */}
        <div className="lg:col-span-9 space-y-4">
          <div 
            className="relative aspect-[16/9] bg-slate-950 rounded-3xl overflow-hidden border-2 border-white/85 shadow-[0_10px_28px_rgba(4,18,38,0.24),0_0_0_1px_rgba(255,255,255,0.18)] group touch-pan-y flex items-center justify-center select-none"
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
                    validMediaIndex === i
                      ? 'border-violet-600 opacity-100 shadow-[0_0_0_2px_rgba(255,255,255,0.90),0_5px_14px_rgba(76,29,149,0.28)] ring-2 ring-violet-500'
                      : 'border-white/80 opacity-90 shadow-[0_2px_8px_rgba(4,18,38,0.14)] hover:border-white hover:opacity-100'
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


          {/* TITLE CARD — directly below thumbnails */}
          <div className="bg-[rgba(226,238,245,0.84)] backdrop-blur-[14px] rounded-[2rem] border border-white/70 shadow-[0_12px_32px_rgba(3,24,46,0.16),inset_0_1px_0_rgba(255,255,255,0.75)] p-6 md:p-7 mt-4 text-left space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
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
                  <div className="min-w-[150px] rounded-2xl border border-emerald-200 bg-white/85 px-5 py-3 text-right shadow-sm">
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-emerald-500">
                      Price
                    </span>
                    <span className="mt-1 block text-2xl md:text-3xl font-black leading-none text-emerald-600">
                      Free 💚
                    </span>
                  </div>
                ) : (
                  <div className="min-w-[150px] rounded-2xl border border-indigo-200/80 bg-white/88 px-5 py-3 text-right shadow-[0_8px_22px_rgba(79,70,229,0.10)]">
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      Price
                    </span>
                    <span className={`mt-1 block font-black leading-none text-indigo-600 ${
                      (ad as any).priceOnRequest || !hasPrice
                        ? 'text-lg md:text-xl uppercase'
                        : 'text-2xl md:text-3xl'
                    }`}>
                      {(ad as any).priceOnRequest || !hasPrice
                        ? 'On Request'
                        : formatPrice(ad.price, ad.country)}
                    </span>
                  </div>
                )}
              </div>
            </div>


          </div>

          {/* DESCRIPTION CARD — separate from title and seller */}
          <div className="bg-[rgba(226,238,245,0.84)] backdrop-blur-[14px] rounded-[2rem] border border-white/70 shadow-[0_12px_32px_rgba(3,24,46,0.16),inset_0_1px_0_rgba(255,255,255,0.75)] p-6 md:p-7 mt-4 text-left">
            <div className="space-y-2">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-[0.08em]">Detailed Description</h3>
              <p className="text-slate-700 text-[15px] leading-relaxed whitespace-pre-line break-words overflow-hidden bg-white/38 backdrop-blur-sm p-4 rounded-2xl border border-white/55">
                {shouldCollapseDescription && normalizedDescription.length > 400 && !descriptionExpanded
                  ? `${normalizedDescription.substring(0, 400).trim()}...`
                  : normalizedDescription}
              </p>
              {shouldCollapseDescription && normalizedDescription.length > 400 && (
                <button
                  onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                  className="text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                >
                  {descriptionExpanded ? 'Show Less' : 'Read Full Description'}
                </button>
              )}
            </div>


          </div>

          {/* ESPECIFICAÇÕES TÉCNICAS DO BARCO (GROUPED MARINE SPECS) */}
          {(ad.boatType || ad.manufacturer || ad.model || ad.year || ad.length || ad.beam || ad.draft || ad.hullMaterial || ad.engineBrand || ad.horsepower || ad.engineHours || ad.fuelType || ad.cabins || ad.berths || ad.bathrooms || ad.trailerIncluded || ad.vatPaid || ad.ceCertified) && (
            <div id="especificacoes-nauticas" className="bg-[rgba(226,238,245,0.84)] backdrop-blur-[14px] rounded-[2rem] border border-white/70 shadow-[0_12px_32px_rgba(3,24,46,0.16),inset_0_1px_0_rgba(255,255,255,0.75)] p-6 md:p-8 space-y-6 mt-6 text-left">
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Grupo 1: Embarcação / Vessel */}
                {(ad.boatType || ad.manufacturer || ad.model || ad.year || ad.condition) && (
                  <div className="space-y-3 lg:col-span-2">
                    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em] text-slate-800">
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
                    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em] text-slate-800">
                      <Ruler size={16} className="text-teal-600" />
                      <span>Dimensões & Casco</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em] text-slate-800">
                      <Gauge size={16} className="text-amber-600" />
                      <span>Motorização & Performance</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em] text-slate-800">
                      <Bed size={16} className="text-indigo-600" />
                      <span>Acomodações & Habitabilidade</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em] text-slate-800">
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


        </div>

        {/* LADO DIREITO: Dados, Vendedor e WhatsApp */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-[rgba(226,238,245,0.84)] backdrop-blur-[14px] rounded-[2rem] border border-white/70 shadow-[0_12px_32px_rgba(3,24,46,0.16),inset_0_1px_0_rgba(255,255,255,0.75)] p-6 md:p-8 space-y-6">

            {/* Contact actions — responsive and claim-aware */}
            <div className="bg-white/58 backdrop-blur-md rounded-2xl p-4 md:p-5 border border-white/70 space-y-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.60)]">
              <div className="flex flex-col gap-3">
                {(ad as any).moreInfoUrl && /^https?:\/\//i.test((ad as any).moreInfoUrl) && (
                  <a
                    href={(ad as any).moreInfoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3.5 text-center font-black text-white shadow-md transition-all hover:bg-indigo-700 active:scale-[0.98]"
                  >
                    <ExternalLink size={19} className="shrink-0" />
                    <span className="leading-tight">View Original Listing</span>
                  </a>
                )}

                {!((ad as any).moreInfoUrl && /^https?:\/\//i.test((ad as any).moreInfoUrl)) &&
                  (ad.externalListing || (hasSourceUrl && !ad.demoListing)) && (
                    <a
                      href={ad.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3.5 text-center font-black text-white shadow-md transition-all hover:bg-indigo-700 active:scale-[0.98]"
                    >
                      <ExternalLink size={19} className="shrink-0" />
                      <span className="leading-tight">View Original Listing</span>
                    </a>
                  )}

                {ad.demoListing ? (
                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3.5 text-center text-xs font-extrabold text-amber-800">
                    <Tag size={16} className="shrink-0 text-amber-600" />
                    <span>Demo Listing — Not Available for Sale</span>
                  </div>
                ) : ad.adStatus === 'sold' || ad.status === 'sold' ? (
                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3.5 text-sm font-black text-slate-500">
                    <Tag size={19} className="shrink-0 text-slate-400" />
                    <span>Listing Sold</span>
                  </div>
                ) : ad.isClaimableBusiness && ad.claimStatus !== 'claimed' ? (
                  <button
                    type="button"
                    onClick={() => setShowUnclaimedContactModal(true)}
                    className="flex w-full cursor-default items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-center font-black text-amber-800 shadow-sm"
                    title="Direct contact becomes available after the owner claims this listing"
                  >
                    <ShieldAlert size={19} className="shrink-0 text-amber-600" />
                    <span className="leading-tight">
                      {ad.claimStatus === 'pending'
                        ? 'Owner Verification Pending'
                        : 'Awaiting Owner Claim'}
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={handleContactClick}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3.5 text-center font-black text-white shadow-md transition-all hover:bg-emerald-600 active:scale-[0.98]"
                  >
                    {(() => {
                      const methods = getContactMethods();
                      const method = methods.length === 1 ? methods[0] : null;
                      const Icon = method ? getContactMethodIcon(method) : MessageCircle;
                      return <Icon size={19} className="shrink-0" />;
                    })()}
                    <span className="leading-tight">
                      {(() => {
                        const methods = getContactMethods();
                        return methods.length === 1 ? getContactMethodLabel(methods[0]) : 'Contact';
                      })()}
                    </span>
                  </button>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setShowSellerProfileModal(true)}
                    aria-label="View seller profile and reviews"
                    title="Seller profile"
                    className="min-w-0 rounded-xl border border-indigo-100 bg-indigo-50 px-2 py-3 text-indigo-700 transition-all hover:bg-indigo-100 active:scale-[0.98] flex flex-col items-center justify-center gap-1"
                  >
                    <UserRound size={18} />
                    <span className="text-[10px] font-black leading-tight">Profile</span>
                  </button>

                  <button
                    onClick={handleShare}
                    className={`min-w-0 rounded-xl border px-2 py-3 transition-all flex flex-col items-center justify-center gap-1 ${
                      shareCopied
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                    title="Share listing"
                  >
                    <Share2 size={18} className={shareCopied ? 'text-emerald-500 animate-bounce' : ''} />
                    <span className="text-[10px] font-black leading-tight">
                      {shareCopied ? 'Copied' : 'Share'}
                    </span>
                  </button>

                  <button
                    onClick={() => setShowReportModal(true)}
                    className="min-w-0 rounded-xl border border-rose-100 bg-rose-50/60 px-2 py-3 text-rose-500 transition-all hover:border-rose-200 hover:bg-rose-50 flex flex-col items-center justify-center gap-1"
                    title="Report listing"
                  >
                    <ShieldAlert size={18} />
                    <span className="text-[10px] font-black leading-tight">Report</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECÇÃO DE LOCALIZAÇÃO */}
          <div id="localizacao" className="bg-[rgba(226,238,245,0.84)] backdrop-blur-[14px] rounded-[2rem] border border-white/70 shadow-[0_12px_32px_rgba(3,24,46,0.16),inset_0_1px_0_rgba(255,255,255,0.75)] p-5 space-y-4 scroll-mt-24 text-left">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                <MapPin size={22} />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-900 leading-none">📍 Approximate Location</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1.5 font-sans">Reference region for the listing</p>
              </div>
            </div>

            {!(isService && (ad.serviceCoverage === 'online' || ad.serviceCoverage === 'uk' || ad.serviceCoverage === 'portugal')) && (
              <div className="grid grid-cols-2 gap-4 rounded-2xl bg-white/90 border border-white shadow-sm px-4 py-3.5 font-sans">
                <div className="min-w-0 text-left">
                  <span className="block text-[9px] text-slate-400 uppercase font-black tracking-wider">City</span>
                  <span className="mt-1 block truncate text-sm font-extrabold text-slate-900">{getAdLocationLabel(ad)}</span>
                </div>
                <div className="min-w-0 text-right">
                  <span className="block text-[9px] text-slate-400 uppercase font-black tracking-wider">Country</span>
                  <span className="mt-1 block truncate text-sm font-extrabold text-slate-900">
                    {ad.country === 'Reino Unido' ? 'United Kingdom' : ad.country || 'United Kingdom'}
                  </span>
                </div>
              </div>
            )}
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
                <div className="w-full h-72 rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-100 relative">
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
            className="relative aspect-[4/3] sm:aspect-[16/10] bg-slate-950 rounded-2xl overflow-hidden border-2 border-white/85 shadow-[0_10px_26px_rgba(4,18,38,0.24),0_0_0_1px_rgba(255,255,255,0.18)] group touch-pan-y flex items-center justify-center select-none"
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
                    validMediaIndex === i
                      ? 'border-violet-600 opacity-100 shadow-[0_0_0_2px_rgba(255,255,255,0.90),0_5px_14px_rgba(76,29,149,0.28)] ring-2 ring-violet-500'
                      : 'border-white/80 opacity-90 shadow-[0_2px_8px_rgba(4,18,38,0.14)] hover:border-white hover:opacity-100'
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
        <div className="bg-[rgba(226,238,245,0.84)] backdrop-blur-[14px] border border-white/70 shadow-[0_12px_32px_rgba(3,24,46,0.16),inset_0_1px_0_rgba(255,255,255,0.75)] rounded-3xl p-4 sm:p-5 space-y-4 text-left">
          
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
              ) : (ad as any).priceOnRequest || !hasPrice ? (
                <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-100 flex-shrink-0">
                  Price on Request
                </span>
              ) : (
                <div className="text-lg sm:text-xl font-black text-indigo-600 bg-indigo-50/50 py-0.5 px-2.5 rounded-lg border border-indigo-100/30 flex-shrink-0">
                  {formatPrice(ad.price, ad.country)}
                </div>
              )}
            </div>
          </div>

          {/* Descrição detalhada compacta */}
          <div className="space-y-1">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.08em]">Detailed Description</h3>
            <p className="text-slate-650 text-xs sm:text-sm leading-relaxed whitespace-pre-line break-words bg-slate-50/40 p-3 rounded-xl border border-slate-50">
              {shouldCollapseDescription && normalizedDescription.length > 250 && !descriptionExpanded
                ? `${normalizedDescription.substring(0, 250).trim()}...`
                : normalizedDescription}
            </p>
            {shouldCollapseDescription && normalizedDescription.length > 250 && (
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
            <div className="bg-[rgba(226,238,245,0.72)] backdrop-blur-[12px] rounded-2xl p-4 border border-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] space-y-4 text-left">
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
                  <span className="text-xs font-black uppercase text-slate-800 tracking-[0.08em] block">Vessel</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {ad.boatType && (
                      <div className="bg-white/55 backdrop-blur-sm p-2 rounded-xl border border-white/70">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Type</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.boatType}</span>
                      </div>
                    )}
                    {ad.manufacturer && (
                      <div className="bg-white/55 backdrop-blur-sm p-2 rounded-xl border border-white/70">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Make</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.manufacturer}</span>
                      </div>
                    )}
                    {ad.model && (
                      <div className="bg-white/55 backdrop-blur-sm p-2 rounded-xl border border-white/70">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Model</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.model}</span>
                      </div>
                    )}
                    {ad.year && (
                      <div className="bg-white/55 backdrop-blur-sm p-2 rounded-xl border border-white/70">
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
                  <span className="text-xs font-black uppercase text-slate-800 tracking-[0.08em] block">Dimensions</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {ad.length && (
                      <div className="bg-white/55 backdrop-blur-sm p-2 rounded-xl border border-white/70">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Length</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.length}</span>
                      </div>
                    )}
                    {ad.beam && (
                      <div className="bg-white/55 backdrop-blur-sm p-2 rounded-xl border border-white/70">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Beam</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.beam}</span>
                      </div>
                    )}
                    {ad.draft && (
                      <div className="bg-white/55 backdrop-blur-sm p-2 rounded-xl border border-white/70">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Draft</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.draft}</span>
                      </div>
                    )}
                    {ad.hullMaterial && (
                      <div className="bg-white/55 backdrop-blur-sm p-2 rounded-xl border border-white/70">
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
                  <span className="text-xs font-black uppercase text-slate-800 tracking-[0.08em] block">Engine</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {ad.engineBrand && (
                      <div className="bg-white/55 backdrop-blur-sm p-2 rounded-xl border border-white/70">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Make</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.engineBrand}</span>
                      </div>
                    )}
                    {ad.horsepower && (
                      <div className="bg-white/55 backdrop-blur-sm p-2 rounded-xl border border-white/70">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Power</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.horsepower}</span>
                      </div>
                    )}
                    {ad.engineHours && (
                      <div className="bg-white/55 backdrop-blur-sm p-2 rounded-xl border border-white/70">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Hours</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.engineHours}</span>
                      </div>
                    )}
                    {ad.fuelType && (
                      <div className="bg-white/55 backdrop-blur-sm p-2 rounded-xl border border-white/70">
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
                  <span className="text-xs font-black uppercase text-slate-800 tracking-[0.08em] block">Accommodations & Extras</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {ad.cabins && (
                      <div className="bg-white/55 backdrop-blur-sm p-2 rounded-xl border border-white/70">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Cabins</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.cabins}</span>
                      </div>
                    )}
                    {ad.berths && (
                      <div className="bg-white/55 backdrop-blur-sm p-2 rounded-xl border border-white/70">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Berths</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.berths}</span>
                      </div>
                    )}
                    {ad.bathrooms && (
                      <div className="bg-white/55 backdrop-blur-sm p-2 rounded-xl border border-white/70">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Toilets</span>
                        <span className="font-extrabold text-slate-900 block truncate">{ad.bathrooms}</span>
                      </div>
                    )}
                    {ad.trailerIncluded && (
                      <div className="bg-white/55 backdrop-blur-sm p-2 rounded-xl border border-white/70">
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

          {/* Highly visible ownership claim call-to-action */}
          {ad.isClaimableBusiness && ad.claimStatus !== 'claimed' && (
            <div className="bg-white/95 border-2 border-amber-300 rounded-2xl p-4 space-y-3 text-left animate-fade-in my-3 shadow-lg shadow-amber-100/60">
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <ShieldAlert size={20} />
                </div>
                <div className="min-w-0">
                  <p className="font-black text-[#030d32] text-sm">
                    Is this your boat?
                  </p>
                  <p className="text-xs text-slate-600 font-semibold leading-relaxed mt-1">
                    Claim this listing free to verify ownership, manage the advert and activate direct customer enquiries.
                  </p>
                </div>
              </div>

              {ad.claimStatus === 'pending' ? (
                <div className="w-full text-center py-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl font-black text-xs">
                  Ownership verification pending
                </div>
              ) : (
                <button
                  onClick={handleOpenClaimModal}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm transition-all cursor-pointer shadow-md active:scale-[0.98]"
                >
                  <ShieldCheck size={17} />
                  Claim This Listing — Free
                </button>
              )}
            </div>
          )}
        </div>

        {/* SECTION CARD 2: Localização aproximada */}
        <div className="bg-[rgba(226,238,245,0.84)] backdrop-blur-[14px] border border-white/70 shadow-[0_12px_32px_rgba(3,24,46,0.16),inset_0_1px_0_rgba(255,255,255,0.75)] rounded-3xl p-4 sm:p-5 space-y-3.5 text-left">
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

      </div> {/* closes block lg:hidden */}

      {/* MORE FROM THIS SELLER */}
      {sellerAds.length > 0 &&
        !(ad.isClaimableBusiness && ad.claimStatus !== 'claimed') && (
        <section className="mt-10 sm:mt-12 rounded-[1.75rem] sm:rounded-[2rem] border border-white/70 bg-[rgba(226,238,245,0.84)] backdrop-blur-[14px] shadow-[0_12px_32px_rgba(3,24,46,0.18)] overflow-hidden text-left">
          <div className="px-4 sm:px-6 lg:px-7 py-5 sm:py-6 border-b border-white/60 bg-white/10">
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
            <div className="flex gap-3 lg:gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-thin">
              {sellerAds.map((sellerAd) => (
                <div
                  key={sellerAd.id}
                  className="seller-more-card shrink-0 snap-start"
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

      {/* STICKY MOBILE ACTION BAR */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2.5 py-2.5 shadow-2xl flex items-center gap-2">
        <div className="flex flex-col shrink-0 min-w-[68px]">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Price</span>
          <span className="text-xs sm:text-sm font-black text-indigo-600 leading-tight">
            {(ad as any).priceOnRequest || !hasPrice
              ? 'On Request'
              : formatPrice(ad.price, ad.country)}
          </span>
        </div>

        <button
          onClick={handleShare}
          aria-label="Share listing"
          className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
            shareCopied
              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Share2 size={16} className={shareCopied ? 'text-emerald-500' : ''} />
        </button>

        <button
          onClick={() => setShowReportModal(true)}
          aria-label="Report listing"
          className="shrink-0 w-10 h-10 rounded-xl border border-rose-100 bg-rose-50/70 text-rose-500 hover:bg-rose-50 hover:border-rose-200 flex items-center justify-center transition-all"
        >
          <ShieldAlert size={16} />
        </button>

        <button
          onClick={() => setShowSellerProfileModal(true)}
          aria-label="View seller profile and reviews"
          title="Seller profile"
          className="shrink-0 w-10 h-10 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center justify-center transition-all active:scale-95"
        >
          <UserRound size={18} />
        </button>

        <button
          onClick={handleContactClick}
          disabled={ad.adStatus === 'sold' || ad.status === 'sold'}
          className={`flex-1 min-w-0 h-10 px-3 rounded-xl font-black text-[11px] text-white shadow-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
            ad.adStatus === 'sold' || ad.status === 'sold'
              ? 'bg-slate-400 cursor-not-allowed'
              : isUnclaimed
                ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
                : hasSourceUrl
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
          }`}
        >
          {isUnclaimed ? (
            <ShieldAlert size={15} className="shrink-0" />
          ) : (
            (() => {
              const methods = getContactMethods();
              const method = methods.length === 1 ? methods[0] : null;
              const Icon = method ? getContactMethodIcon(method) : MessageCircle;
              return <Icon size={15} className="shrink-0" />;
            })()
          )}
          <span className="truncate">
            {isUnclaimed
              ? 'Awaiting Owner Claim'
              : (() => {
                  const methods = getContactMethods();
                  return methods.length === 1 ? getContactMethodLabel(methods[0]) : 'Contact';
                })()}
          </span>
        </button>
      </div>

      {/* Seller profile + reviews popup */}
      <AnimatePresence>
        {showSellerProfileModal && (
          <div className="fixed inset-0 z-[185] flex items-center justify-center p-4">
            <motion.button
              type="button"
              aria-label="Close seller profile"
              className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSellerProfileModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              transition={{ duration: 0.18 }}
              className="relative z-10 w-full max-w-md max-h-[82vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-100 p-5 sm:p-6"
            >
              <button
                type="button"
                onClick={() => setShowSellerProfileModal(false)}
                aria-label="Close"
                className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition"
              >
                <X size={18} />
              </button>

              <div className="pr-11">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-500">Seller profile</p>
                <div className="flex items-start gap-3 mt-3">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-700 rounded-2xl overflow-hidden flex items-center justify-center font-black text-lg shrink-0 border border-indigo-100">
                    {sellerProfile?.profileImageUrl ? (
                      <img
                        src={sellerProfile.profileImageUrl}
                        alt={sellerProfile?.displayName || ad.sellerName || 'Seller'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (sellerProfile?.displayName || (hasSourceUrl ? 'Partner' : ad.sellerName) || 'Seller').slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-black text-slate-950 flex items-center gap-1.5 truncate">
                      {sellerProfile?.displayName || (hasSourceUrl ? 'Partner' : ad.sellerName)}
                      <Award size={15} className="text-indigo-500 shrink-0" />
                    </h3>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const ratingVal = sellerProfile?.ratingAverage || 0;
                          return (
                            <Star
                              key={star}
                              size={13}
                              className={star <= Math.round(ratingVal) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}
                            />
                          );
                        })}
                      </div>
                      <span className="text-[11px] text-slate-500 font-bold">({sellerProfile?.ratingCount || 0} reviews)</span>
                    </div>
                    {(sellerProfile?.city || sellerProfile?.country) && (
                      <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                        <MapPin size={12} className="shrink-0" />
                        <span>{[sellerProfile?.city, sellerProfile?.country].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {sellerProfile?.publicDescription && (
                  <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">About seller</p>
                    <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{sellerProfile.publicDescription}</p>
                  </div>
                )}
                {user && user.uid !== ad.sellerId && (
                  <button
                    onClick={() => {
                      setShowSellerProfileModal(false);
                      setShowReviewModal(true);
                    }}
                    className="mt-4 w-full text-[11px] font-black bg-indigo-50 text-indigo-700 py-2.5 px-3 rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-all"
                  >
                    Rate Seller
                  </button>
                )}
              </div>

              {sellerReviews.length > 0 && (
                <div className="mt-5 pt-5 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Seller Reviews</h4>
                    <span className="text-[10px] font-bold text-slate-400">{sellerReviews.length}</span>
                  </div>
                  <div className="space-y-2.5">
                    {sellerReviews.map((rev) => (
                      <div key={rev.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <span className="font-extrabold text-slate-800 truncate">{rev.buyerName}</span>
                          <div className="flex gap-0.5 shrink-0">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star key={star} size={10} className={star <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} />
                            ))}
                          </div>
                        </div>
                        {rev.comment && <p className="text-slate-600 italic leading-relaxed">“{rev.comment}”</p>}
                        <div className="text-[9px] text-slate-400 mt-2 flex justify-between gap-3">
                          <span className="font-semibold text-emerald-600">{rev.success ? '✓ Successful Deal' : 'ℹ Incomplete'}</span>
                          <span>{rev.createdAt?.toDate ? formatDistanceToNow(rev.createdAt.toDate(), { addSuffix: true, locale: pt }) : 'Recently'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      {/* Contact method chooser */}
      <AnimatePresence>
        {showContactOptionsModal && (
          <div className="fixed inset-0 z-[195] flex items-center justify-center p-4">
            <motion.button
              type="button"
              aria-label="Close contact options"
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowContactOptionsModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-5 text-center">
                <h3 className="text-xl font-black text-slate-950">Contact Seller</h3>
                <p className="mt-1 text-sm text-slate-500">Choose how you would like to contact the seller.</p>
              </div>

              <div className="space-y-2.5">
                {getContactMethods().map((method) => {
                  const Icon = getContactMethodIcon(method);
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => continueWithContactMethod(method)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left font-black text-slate-800 transition hover:border-indigo-200 hover:bg-indigo-50 active:scale-[0.99]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-indigo-600">
                        <Icon size={20} />
                      </span>
                      <span>{getContactMethodLabel(method)}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setShowContactOptionsModal(false)}
                className="mt-4 w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Contact safety notice */}
      <AnimatePresence>
        {showContactWarning && (
          <div className="fixed inset-0 z-[190] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowContactWarning(false); setSelectedContactMethod(null); }}
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
                    onClick={() => { setShowContactWarning(false); setSelectedContactMethod(null); }}
                    className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
                  >
                    Back
                  </button>
                  <button
                    disabled={!acceptedContactTerms}
                    onClick={handleConfirmContact}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl transition ${
                      acceptedContactTerms 
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {selectedContactMethod ? `Continue to ${getContactMethodLabel(selectedContactMethod)}` : 'Continue'}
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
    </>
  );
};

export default AdDetails;
