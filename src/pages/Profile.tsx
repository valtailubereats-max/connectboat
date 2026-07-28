import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, deleteDoc, writeBatch, increment, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType, getDocsWithCacheFallback } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { clearHomeCache } from '../utils/cache';
import { Ad, UserProfile, COUNTRY_CODES, CITIES } from '../types';
import { SearchableCitySelect } from '../components/SearchableCitySelect';
import { motion, AnimatePresence } from 'motion/react';
import { User, Phone, Mail, Edit, Trash2, Clock, CheckCircle, XCircle, Globe, RefreshCcw, Archive, AlertTriangle, Eye, MessageSquare, MapPin, ShoppingBag, Star, Plus, X } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { formatPrice } from '../utils';
import OptimizedImage from '../components/OptimizedImage';
import ReviewModal from '../components/ReviewModal';
import AdCard from '../components/AdCard';
import ShowcaseStats from '../components/ShowcaseStats';
import ShowcaseInterests from '../components/ShowcaseInterests';
import { InstallButton } from '../components/InstallButton';
import { calculateTotalPoints, calculateProgressPoints, POINTS_THRESHOLD, POINTS_PER_REFERRAL, POINTS_PER_AD } from '../utils/rewards';

const Profile = () => {
  const { user, profile, refreshProfile, favorites } = useAuth();
  const { settings } = useSettings();
  const isPromoActive = settings?.launchPromoActive !== false;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightAdId = searchParams.get('highlight');
  const rawTab = searchParams.get('tab') || 'perfil';
  const currentTab = rawTab === 'ads' ? 'anuncios' : rawTab;

  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+351');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState<'Portugal' | 'Reino Unido' | ''>('');
  const [loading, setLoading] = useState(false);
  const [ads, setAds] = useState<Ad[]>([]);
  const [adsLoading, setAdsLoading] = useState(true);
  const [selectedAdForReview, setSelectedAdForReview] = useState<Ad | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [referralsCount, setReferralsCount] = useState(0);
  const [referralsLoading, setReferralsLoading] = useState(true);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [favoriteAds, setFavoriteAds] = useState<Ad[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [purchasedAds, setPurchasedAds] = useState<Ad[]>([]);
  const [purchasedAdsLoading, setPurchasedAdsLoading] = useState(true);
  const [isBuyerRating, setIsBuyerRating] = useState(false);
  const [reviewedAdIds, setReviewedAdIds] = useState<Set<string>>(new Set());
  const [adsCountryTab, setAdsCountryTab] = useState<'Portugal' | 'Reino Unido'>('Portugal');

  const [showcaseActive, setShowcaseActive] = useState(false);
  const [showcaseName, setShowcaseName] = useState('');
  const [showcaseCategory, setShowcaseCategory] = useState('');
  const [showcaseLogo, setShowcaseLogo] = useState('');
  const [showcaseCover, setShowcaseCover] = useState('');
  const [showcaseDescription, setShowcaseDescription] = useState('');
  const [showcaseWhatsapp, setShowcaseWhatsapp] = useState('');
  const [showcaseFacebook, setShowcaseFacebook] = useState('');
  const [showcaseInstagram, setShowcaseInstagram] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [showcasePlan, setShowcasePlan] = useState<'basic' | 'premium'>('premium');
  const [showcasePaid, setShowcasePaid] = useState(false);
  const [showShowcasePaymentModal, setShowShowcasePaymentModal] = useState(false);
  const [showcasePaymentLoading, setShowcasePaymentLoading] = useState(false);
  const [showcaseCardNumber, setShowcaseCardNumber] = useState('4242 •••• •••• 4242');
  const [showcaseCardExpiry, setShowcaseCardExpiry] = useState('12/29');
  const [showcaseCardCVC, setShowcaseCardCVC] = useState('789');
  const [showcaseCardName, setShowcaseCardName] = useState('');
  const [showcaseProducts, setShowcaseProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState<string>('');
  const [productActive, setProductActive] = useState(true);
  const [productOrder, setProductOrder] = useState(0);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isUploadingProductImg, setIsUploadingProductImg] = useState<boolean[]>([false, false]);
  const [profileSaved, setProfileSaved] = useState(false);
  const [productSavedSuccess, setProductSavedSuccess] = useState(false);

  // Phase 5: User verification code states
  const [userClaims, setUserClaims] = useState<any[]>([]);
  const [userClaimsLoading, setUserClaimsLoading] = useState(true);
  const [claimVerificationCode, setClaimVerificationCode] = useState<{[claimId: string]: string}>({});
  const [claimVerificationError, setClaimVerificationError] = useState<{[claimId: string]: string}>({});
  const [claimVerificationSuccess, setClaimVerificationSuccess] = useState<{[claimId: string]: boolean}>({});
  const [verifyingClaimId, setVerifyingClaimId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'businessClaimRequests'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUserClaims(data);
      setUserClaimsLoading(false);
    }, (error) => {
      console.error("Error fetching user claims:", error);
      setUserClaimsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const fetchShowcaseProducts = async () => {
    if (!user) return;
    setProductsLoading(true);
    try {
      const q = query(
        collection(db, 'sellerPublicProfiles', user.uid, 'products')
      );
      const snap = await getDocs(q);
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      items.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      setShowcaseProducts(items);

      // Sincronizar e auto-corrigir productsCount para prevenir desvios com dados antigos ou inconsistências
      const activeCount = items.filter((p: any) => p.active !== false).length;
      const profileRef = doc(db, 'sellerPublicProfiles', user.uid);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        const dbCount = profileSnap.data().productsCount;
        if (dbCount !== activeCount) {
          await setDoc(profileRef, { productsCount: activeCount }, { merge: true });
        }
      } else {
        await setDoc(profileRef, { productsCount: activeCount }, { merge: true });
      }
    } catch (err) {
      console.error('Error fetching showcase products:', err);
    } finally {
      setProductsLoading(false);
    }
  };

  const handleAddProductClick = () => {
    const limitMax = 6;
    if (showcaseProducts.length >= limitMax) {
      alert(`Atingiu o limite de ${limitMax} produtos/serviços ativos.`);
      return;
    }
    const newDocRef = doc(collection(db, 'sellerPublicProfiles', user!.uid, 'products'));
    setEditingProduct({
      id: newDocRef.id,
      userId: user!.uid,
      name: '',
      description: '',
      price: null,
      images: [],
      active: true,
      order: showcaseProducts.length,
      createdAt: null
    });
    setProductName('');
    setProductDescription('');
    setProductPrice('');
    setProductActive(true);
    setProductOrder(showcaseProducts.length);
    setProductImages([]);
    setShowProductModal(true);
  };

  const handleEditProductClick = (product: any) => {
    setEditingProduct(product);
    setProductName(product.name || '');
    setProductDescription(product.description || '');
    setProductPrice(product.price != null ? String(product.price) : '');
    setProductActive(product.active !== false);
    setProductOrder(product.order || 0);
    setProductImages(product.images || []);
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!user) return;
    if (!window.confirm('Tem a certeza que deseja eliminar este item?')) return;
    try {
      const existingProd = showcaseProducts.find(p => p.id === productId);
      const wasActive = existingProd ? existingProd.active !== false : false;

      if (wasActive) {
        const profileRef = doc(db, 'sellerPublicProfiles', user.uid);
        const profileSnap = await getDoc(profileRef);
        let currentCount = 0;
        if (profileSnap.exists()) {
          currentCount = profileSnap.data().productsCount || 0;
        }
        const nextCount = Math.max(0, currentCount - 1);
        await setDoc(profileRef, { productsCount: nextCount }, { merge: true });
      }

      await deleteDoc(doc(db, 'sellerPublicProfiles', user.uid, 'products', productId));
      alert('Item eliminado com sucesso!');
      fetchShowcaseProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
      handleFirestoreError(err, OperationType.DELETE, `sellerPublicProfiles/${user.uid}/products/${productId}`);
    }
  };

  const uploadProductImage = async (file: File, index: number, targetProductId: string) => {
    if (!user) return;
    const updatedUploading = [...isUploadingProductImg];
    updatedUploading[index] = true;
    setIsUploadingProductImg(updatedUploading);

    try {
      const fileName = `image_${index}_${Date.now()}__${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const fileRef = ref(storage, `showcases/${user.uid}/products/${targetProductId}/${fileName}`);
      const uploadSnapshot = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(uploadSnapshot.ref);

      const newImages = [...productImages];
      newImages[index] = url;
      // Filter out empty spaces and limit to 2
      const cleanedImages = newImages.filter(val => val);
      setProductImages(cleanedImages);
    } catch (err) {
      console.error('Error uploading product image:', err);
      alert('Erro ao carregar imagem: ' + err);
    } finally {
      const updatedUploadingDone = [...isUploadingProductImg];
      updatedUploadingDone[index] = false;
      setIsUploadingProductImg(updatedUploadingDone);
    }
  };

  const removeProductImage = (index: number) => {
    const newImages = [...productImages];
    newImages.splice(index, 1);
    setProductImages(newImages);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingProduct) return;
    if (isSavingProduct) return; // Impedir duplo clique / múltiplos envios simultâneos

    if (!productName.trim()) {
      alert('O nome do item é mandatório.');
      return;
    }
    if (!productDescription.trim()) {
      alert('A descrição do item é mandatória.');
      return;
    }

    setIsSavingProduct(true);
    try {
      // 1. Validar e atualizar productsCount na sellerPublicProfiles/{userId} antes de guardar
      const profileRef = doc(db, 'sellerPublicProfiles', user.uid);
      const profileSnap = await getDoc(profileRef);
      let currentCount = 0;
      if (profileSnap.exists()) {
        currentCount = profileSnap.data().productsCount || 0;
      }

      const isNew = !showcaseProducts.some(p => p.id === editingProduct.id);
      const existingProd = showcaseProducts.find(p => p.id === editingProduct.id);
      const oldActive = existingProd ? existingProd.active !== false : false;

      let countDiff = 0;
      if (isNew) {
        if (productActive) {
          countDiff = 1;
        }
      } else {
        if (oldActive && !productActive) {
          countDiff = -1;
        } else if (!oldActive && productActive) {
          countDiff = 1;
        }
      }

      // Validar limite de 6 produtos/serviços ativos
      if (countDiff > 0 && currentCount >= 6) {
        alert("Não é possível mudar o estado para ativo ou criar este produto/serviço. Já atingiu o limite de 6 itens ativos na sua Vitrine Digital.");
        setIsSavingProduct(false);
        return;
      }

      const parsedPrice = productPrice.trim() !== '' ? parseFloat(productPrice) : null;
      const productRef = doc(db, 'sellerPublicProfiles', user.uid, 'products', editingProduct.id);
      
      const payload: any = {
        id: editingProduct.id,
        userId: user.uid,
        name: productName.trim(),
        description: productDescription.trim(),
        price: parsedPrice,
        images: productImages,
        active: productActive,
        order: Number(productOrder),
        createdAt: editingProduct.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Atualizar o productsCount da Vitrine
      const nextProductsCount = Math.max(0, currentCount + countDiff);
      await setDoc(profileRef, { productsCount: nextProductsCount }, { merge: true });

      await setDoc(productRef, payload, { merge: true });
      setProductSavedSuccess(true);
      fetchShowcaseProducts();
      setTimeout(() => {
        setProductSavedSuccess(false);
        setShowProductModal(false);
        setEditingProduct(null);
      }, 2000);
    } catch (err) {
      console.error('Error saving product:', err);
      handleFirestoreError(err, OperationType.WRITE, `sellerPublicProfiles/${user.uid}/products/${editingProduct.id}`);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleVerifyClaimCode = async (claimId: string, enteredCode: string, actualCode: string) => {
    if (!enteredCode || enteredCode.trim() === '') {
      setClaimVerificationError(prev => ({ ...prev, [claimId]: 'Por favor, digite o código de confirmação.' }));
      return;
    }

    setVerifyingClaimId(claimId);
    setClaimVerificationError(prev => ({ ...prev, [claimId]: '' }));

    try {
      if (enteredCode.trim().toUpperCase() === actualCode.trim().toUpperCase()) {
        const claimRef = doc(db, 'businessClaimRequests', claimId);
        await updateDoc(claimRef, {
          verificationStatus: 'confirmed',
          verificationConfirmedAt: serverTimestamp()
        });

        setClaimVerificationSuccess(prev => ({ ...prev, [claimId]: true }));
      } else {
        setClaimVerificationError(prev => ({ ...prev, [claimId]: 'Código inválido. Tente novamente.' }));
      }
    } catch (err: any) {
      console.error('Erro ao verificar o código da reivindicação:', err);
      setClaimVerificationError(prev => ({ ...prev, [claimId]: `Erro ao salvar confirmação: ${err?.message || String(err)}` }));
    } finally {
      setVerifyingClaimId(null);
    }
  };

  useEffect(() => {
    if (profile?.country === 'Reino Unido' || profile?.country === 'Portugal') {
      setAdsCountryTab(profile.country);
    }
  }, [profile?.country]);

  const ptAds = React.useMemo(() => {
    return ads.filter(ad => !ad.country || ad.country === 'Portugal');
  }, [ads]);

  const ukAds = React.useMemo(() => {
    return ads.filter(ad => ad.country === 'Reino Unido');
  }, [ads]);

  const [adInterests, setAdInterests] = useState<Record<string, { loading: boolean, data: any[] }>>({});
  const [expandedInterestsAdId, setExpandedInterestsAdId] = useState<string | null>(null);

  const handleToggleInterests = async (adId: string) => {
    if (expandedInterestsAdId === adId) {
      setExpandedInterestsAdId(null);
      return;
    }
    setExpandedInterestsAdId(adId);

    if (!user) return;

    setAdInterests(prev => ({ ...prev, [adId]: { loading: true, data: [] } }));
    try {
      const q = query(
        collection(db, 'adInterests'),
        where('adId', '==', adId),
        where('sellerId', '==', user.uid),
        limit(50)
      );
      
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setAdInterests(prev => ({
        ...prev,
        [adId]: { loading: false, data: list }
      }));
    } catch (err) {
      console.error('[Profile] Erro ao buscar manual adInterests:', err);
      setAdInterests(prev => ({
        ...prev,
        [adId]: { loading: false, data: [] }
      }));
      handleFirestoreError(err, OperationType.GET, `adInterests/${adId}`);
    }
  };

  useEffect(() => {
    const fetchFavoriteAds = async () => {
      if (!user || !favorites || favorites.length === 0) {
        setFavoriteAds([]);
        setFavoritesLoading(false);
        return;
      }
      setFavoritesLoading(true);
      try {
        const q = query(
          collection(db, 'ads'),
          where('__name__', 'in', favorites.slice(0, 30))
        );
        const snapshot = await getDocsWithCacheFallback(q, `favorites/profile-${user.uid}`);
        const adsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));
        setFavoriteAds(adsData);
      } catch (err) {
        console.error('Error loading favorite ads:', err);
        handleFirestoreError(err, OperationType.LIST, 'ads');
      } finally {
        setFavoritesLoading(false);
      }
    };

    if (currentTab === 'favorites') {
      fetchFavoriteAds();
    }
  }, [favorites, currentTab, user]);

  const fetchPurchasedAds = async () => {
    if (!user) return;
    setPurchasedAdsLoading(true);
    try {
      // Fetch reviewed ads by this user (to show "Já avaliado")
      const revQuery = query(
        collection(db, 'reviews'),
        where('reviewerId', '==', user.uid)
      );
      const revSnap = await getDocs(revQuery);
      const reviewedIds = new Set(revSnap.docs.map(doc => doc.data().adId));
      setReviewedAdIds(reviewedIds);

      const q = query(
        collection(db, 'ads'),
        where('buyerId', '==', user.uid),
       
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      const adsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));
      adsData.sort((a, b) => {
        const timeA = a.soldAt?.seconds ? a.soldAt.seconds * 1000 : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.soldAt?.seconds ? b.soldAt.seconds * 1000 : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return (timeB || 0) - (timeA || 0);
      });
      setPurchasedAds(adsData);
    } catch (err) {
      console.error('Error fetching purchased ads:', err);
      handleFirestoreError(err, OperationType.LIST, 'ads');
    } finally {
      setPurchasedAdsLoading(false);
    }
  };

  useEffect(() => {
  if (user) {
    fetchPurchasedAds();
  }
}, [user]);

  const updateReferralStatsAndCredits = async () => {
    if (!user || !profile) return;
    try {
      const q = query(collection(db, 'referrals'), where('inviterId', '==', user.uid));
      const snap = await getDocsWithCacheFallback(q, `referrals/inviterId-${user.uid}`);
      const realCount = snap.size;
      setReferralsCount(realCount);
      setReferralsLoading(false);

      const profileCount = profile.referredUsersCount || 0;
      const pointsFromAds = (profile as any).pointsFromAds || 0;
      const currentCredits = profile.referralCredits || 0;

      if (realCount !== profileCount) {
        const oldPoints = calculateTotalPoints(profileCount, pointsFromAds);
        const newPoints = calculateTotalPoints(realCount, pointsFromAds);
        
        const oldCreditsEarned = Math.floor(oldPoints / POINTS_THRESHOLD);
        const newCreditsEarned = Math.floor(newPoints / POINTS_THRESHOLD);
        const creditsToGrant = Math.max(0, newCreditsEarned - oldCreditsEarned);
        const nextCredits = currentCredits + creditsToGrant;

        await updateDoc(doc(db, 'users', user.uid), {
          referredUsersCount: realCount,
          referralCredits: nextCredits
        });

        await refreshProfile();
      }
    } catch (err) {
      console.error("Error updating referral stats:", err);
      setReferralsLoading(false);
    }
  };

  const handleFeatureAd = async (ad: Ad) => {
    if (!user || !profile) return;
    
    const credits = profile.referralCredits || 0;
    if (credits <= 0) {
      alert("Não possui Créditos de Destaque disponíveis. Convide mais amigos para ganhar!");
      return;
    }
    
    if (!window.confirm("Would you like to use 1 Featured Credit to highlight this listing for 24 hours? It will receive priority placement on ConnectBoat!")) {
      return;
    }
    
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      await updateDoc(doc(db, 'ads', ad.id), {
        isFeatured: true,
        featuredUntil: tomorrow
      });
      clearHomeCache();
      
      await updateDoc(doc(db, 'users', user.uid), {
        referralCredits: credits - 1
      });
      
      alert("Anúncio destacado com sucesso por 24 horas!");
      
      await refreshProfile();
      await fetchUserAds();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `ads/${ad.id}`);
    }
  };

  useEffect(() => {
    if (!highlightAdId) {
      window.scrollTo(0, 0);
    }
  }, [highlightAdId]);

  useEffect(() => {
    if (!adsLoading && ads.length > 0 && highlightAdId) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`ad-profile-${highlightAdId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [adsLoading, ads, highlightAdId]);

  useEffect(() => {
    if (profile) {
      const fullPhone = profile.phone || '';
      const foundCode = COUNTRY_CODES.find(c => fullPhone.startsWith(c.code));
      if (foundCode) {
        setCountryCode(foundCode.code);
        setPhone(fullPhone.replace(foundCode.code, '').trim());
      } else {
        setCountryCode('+351');
        setPhone(fullPhone);
      }
      setName(profile.name || '');
      setCity(profile.city || '');
      if (profile.country === 'Portugal' || profile.country === 'Reino Unido') {
        setCountry(profile.country);
      } else {
        // Primeira vez: Deixa em branco para forçar o utilizador a escolher o país
        setCountry('');
      }
      setShowcaseActive(profile.showcaseActive || false);
      setShowcaseName(profile.showcaseName || '');
      setShowcaseCategory(profile.showcaseCategory || '');
      setShowcaseLogo(profile.showcaseLogo || '');
      setShowcaseCover(profile.showcaseCover || '');
      setShowcaseDescription(profile.showcaseDescription || '');
      setShowcaseWhatsapp(profile.showcaseWhatsapp || profile.phone || '');
      setShowcaseFacebook(profile.showcaseFacebook || '');
      setShowcaseInstagram(profile.showcaseInstagram || '');
      setShowcasePlan(profile.showcasePlan || 'premium');
      setShowcasePaid(profile.showcasePaid || false);
      fetchUserAds();
      fetchUserReviews(user?.uid || '');
      updateReferralStatsAndCredits();
      fetchShowcaseProducts();
    }
  }, [profile]);

  useEffect(() => {
    if (currentTab === 'vitrine') {
      const scrollTimer = setTimeout(() => {
        const el = document.getElementById('vitrine-comercial-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 350);
      return () => clearTimeout(scrollTimer);
    }
  }, [currentTab]);

  useEffect(() => {
    const healShowcaseData = async () => {
      if (user && profile && (profile.showcaseActive || profile.showcasePaid)) {
        const needsSlug = !profile.showcaseSlug;
        const needsCountry = !profile.country;
        
        if (needsSlug || needsCountry) {
          console.log('[Heal] Healing showcase fields for active showcase');
          const finalShowcaseName = profile.showcaseName || profile.name || 'A Minha Vitrine';
          let generatedSlug = profile.showcaseSlug || '';
          if (!generatedSlug && finalShowcaseName) {
            const cleanedSlug = finalShowcaseName
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .trim()
              .replace(/(^-|-$)+/g, '');
            generatedSlug = `${cleanedSlug}-${user.uid.substring(0, 5)}`;
          }
          
          const finalCountry = profile.country || country || 'Portugal';
          const finalCity = profile.city || city || '';
          
          try {
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, {
              showcaseSlug: generatedSlug,
              country: finalCountry,
              city: finalCity
            }, { merge: true });
            
            const profileRef = doc(db, 'sellerPublicProfiles', user.uid);
            await setDoc(profileRef, {
              showcaseSlug: generatedSlug,
              country: finalCountry,
              city: finalCity,
              showcaseActive: true,
              showcaseApproved: profile.showcaseApproved !== undefined ? profile.showcaseApproved : true,
              displayName: profile.name || user.displayName || 'Empreendedor'
            }, { merge: true });
            
            if (refreshProfile) {
              await refreshProfile();
            }
          } catch (err) {
            console.error('[Heal] Failed to automatically heal showcase data:', err);
          }
        }
      }
    };
    healShowcaseData();
  }, [profile, user, country, city]);

  const handleMockShowcasePaymentSuccess = async () => {
    if (!user) return;
    setShowcasePaymentLoading(true);
    try {
      const finalShowcaseName = showcaseName || profile?.name || 'A Minha Vitrine';
      let generatedSlug = '';
      if (finalShowcaseName) {
        const cleanedSlug = finalShowcaseName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()
          .replace(/(^-|-$)+/g, '');
        generatedSlug = `${cleanedSlug}-${user.uid.substring(0, 5)}`;
      }

      const finalCountry = country || profile?.country || 'Portugal';
      const finalCity = city || profile?.city || '';

      const userRef = doc(db, 'users', user.uid);
      const updatePayload = {
        showcasePaid: true,
        showcasePlan: 'premium',
        showcaseActive: true,
        showcaseName: finalShowcaseName,
        showcaseSlug: generatedSlug,
        country: finalCountry,
        city: finalCity
      };
      
      await setDoc(userRef, updatePayload, { merge: true });
      if (refreshProfile) {
        await refreshProfile();
      }
      
      const profileRef = doc(db, 'sellerPublicProfiles', user.uid);
      const isPortugal = finalCountry === 'Portugal';
      
      await setDoc(profileRef, {
        showcasePaid: true,
        showcasePlan: 'premium',
        showcaseActive: true,
        showcaseName: finalShowcaseName,
        showcaseSlug: generatedSlug,
        showcaseCategory: showcaseCategory || 'Outros',
        showcaseLogo: showcaseLogo || '',
        showcaseCover: showcaseCover || '',
        showcaseDescription: showcaseDescription || '',
        showcaseWhatsapp: showcaseWhatsapp || profile?.phone || '',
        showcaseFacebook: showcaseFacebook || '',
        showcaseInstagram: showcaseInstagram || '',
        showcaseApproved: true, // Auto approved for test or simulation ease
        country: finalCountry,
        city: finalCity,
        displayName: profile?.name || user?.displayName || 'Empreendedor'
      }, { merge: true });

      setShowcasePaid(true);
      setShowcasePlan('premium');
      setShowcaseActive(true);
      
      if (isPromoActive) {
        alert('Parabéns! A sua Vitrine Digital foi ativada gratuitamente durante o período de lançamento! 🎁');
      } else {
        alert(isPortugal 
          ? 'Adesão à Vitrine Digital com sucesso via Stripe! Pagamento mensal de €8.99 confirmado.' 
          : 'Adesão à Vitrine Digital com sucesso via Stripe! Pagamento mensal de £8.99 confirmado.'
        );
      }
      
      setShowShowcasePaymentModal(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao processar ativação de Vitrine Digital.');
    } finally {
      setShowcasePaymentLoading(false);
    }
  };

  const fetchUserReviews = async (sellerId: string) => {
    if (!sellerId) return;
    setReviewsLoading(true);
    try {
      const q = query(collection(db, 'reviews'), where('sellerId', '==', sellerId), limit(5));
      const snap = await getDocsWithCacheFallback(q, `reviews/sellerId-${sellerId}`);
      const reviewsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      reviewsData.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setReviews(reviewsData);
    } catch (err) {
      console.error('Error fetching user reviews:', err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const fetchUserAds = async () => {
    if (!user) return;
    setAdsLoading(true);
    try {
      const q = query(collection(db, 'ads'), where('sellerId', '==', user.uid), limit(100));
      const querySnapshot = await getDocsWithCacheFallback(q, `ads/sellerId-${user.uid}`);
      const adsData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Ad));
      setAds(adsData.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));

      // Clear notifications for these ads
      const unnotifiedAds = adsData.filter(ad => ad.userNotified === false && ad.status !== 'pending');
      if (unnotifiedAds.length > 0) {
        const batch = writeBatch(db);
        unnotifiedAds.forEach(ad => {
          batch.update(doc(db, 'ads', ad.id), { userNotified: true });
        });
        await batch.commit();
      }
    } catch (err) {
      console.error('Error in fetchUserAds:', err);
      handleFirestoreError(err, OperationType.LIST, 'ads');
    } finally {
      setAdsLoading(false);
    }
  };

  const uploadShowcaseFile = async (file: File, type: 'logo' | 'cover'): Promise<string> => {
    const isLogo = type === 'logo';
    if (isLogo) setUploadingLogo(true);
    else setUploadingCover(true);

    try {
      const uniqueName = `showcases/${type}_${user?.uid}_${Date.now()}__${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const fileRef = ref(storage, uniqueName);
      const uploadSnapshot = await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(uploadSnapshot.ref);
      return downloadUrl;
    } catch (err) {
      console.error('Erro no upload de showcase file:', err);
      alert('Ocorreu um erro ao fazer upload do ficheiro para o Firebase Storage.');
      throw err;
    } finally {
      if (isLogo) setUploadingLogo(false);
      else setUploadingCover(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!country) {
      alert('Por favor, selecione primeiro o país.');
      return;
    }
    setLoading(true);
    try {
      const docRef = doc(db, 'users', user.uid);
      const digitsOnly = phone.replace(/\D/g, '').trim();
      if (digitsOnly.length < 7) {
        alert('Por favor, insira um número de telemóvel válido.');
        setLoading(false);
        return;
      }
      const fullPhone = `${countryCode}${digitsOnly}`.trim();

      // Verificar se o telemóvel já se encontra registado por outro utilizador
      const usersQuery = query(
        collection(db, 'users'),
        where('phone', '==', fullPhone)
      );
      const querySnap = await getDocs(usersQuery);
      const duplicateUser = querySnap.docs.find(doc => doc.id !== user.uid);
      if (duplicateUser) {
        alert('Este número de telemóvel já está associado a outro utilizador. Por favor, utilize outro número.');
        setLoading(false);
        return;
      }

      let generatedSlug = '';
      if (showcaseActive) {
        if (!showcaseName.trim()) {
          alert('Nome do negócio da Vitrine Digital é obrigatório.');
          setLoading(false);
          return;
        }
        if (!showcaseCategory.trim()) {
          alert('Categoria principal do negócio é obrigatória.');
          setLoading(false);
          return;
        }
        if (!showcaseLogo) {
          alert('Logotipo do negócio é obrigatório.');
          setLoading(false);
          return;
        }
        if (!showcaseDescription.trim()) {
          alert('Descrição do negócio é obrigatória.');
          setLoading(false);
          return;
        }
        if (!showcaseWhatsapp.trim()) {
          alert('Telemóvel (WhatsApp) do negócio é obrigatório.');
          setLoading(false);
          return;
        }
        const cleanedSlug = showcaseName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()
          .replace(/(^-|-$)+/g, '');
        generatedSlug = `${cleanedSlug}-${user.uid.substring(0, 5)}`;
      }

      const showcasePayload = {
        showcaseActive,
        showcaseApproved: profile && profile.showcaseApproved !== undefined ? profile.showcaseApproved : false,
        showcaseName: showcaseActive ? showcaseName : '',
        showcaseSlug: showcaseActive ? generatedSlug : '',
        showcaseCategory: showcaseActive ? showcaseCategory : '',
        showcaseLogo: showcaseActive ? showcaseLogo : '',
        showcaseCover: showcaseActive ? showcaseCover : '',
        showcaseDescription: showcaseActive ? showcaseDescription : '',
        showcaseWhatsapp: showcaseActive ? showcaseWhatsapp : '',
        showcaseFacebook: showcaseActive ? (showcaseFacebook || '') : '',
        showcaseInstagram: showcaseActive ? (showcaseInstagram || '') : '',
        showcasePlan: showcaseActive ? showcasePlan : 'basic',
      };

      // Use setDoc with merge: true to avoid "No document to update" if creation failed
      await setDoc(docRef, { 
        name, 
        phone: fullPhone, 
        city, 
        country,
        ...showcasePayload
      }, { merge: true });
      
      // Sincronizar para o perfil público (sellerPublicProfiles)
      try {
        const publicRef = doc(db, 'sellerPublicProfiles', user.uid);
        const publicSnap = await getDoc(publicRef);
        const now = new Date();
        
        const publicPayload: any = {
          displayName: name,
          city: city,
          country: country,
          updatedAt: now,
          ...showcasePayload
        };
        
        if (!publicSnap.exists()) {
          const fallbackCreated = profile?.acceptedTermsAt 
            ? (typeof profile.acceptedTermsAt.toDate === 'function' 
                ? profile.acceptedTermsAt.toDate() 
                : (profile.acceptedTermsAt instanceof Date ? profile.acceptedTermsAt : new Date(profile.acceptedTermsAt))) 
            : now;
          publicPayload.createdAt = fallbackCreated instanceof Date && !isNaN(fallbackCreated.getTime()) ? fallbackCreated : now;
        }
        
        await setDoc(publicRef, publicPayload, { merge: true });
      } catch (syncErr) {
        console.error('[Sync] Erro ao sincronizar para sellerPublicProfiles:', syncErr);
      }

      localStorage.setItem('selectedCountry', country);
      await refreshProfile();
      setProfileSaved(true);
      setTimeout(() => {
        setProfileSaved(false);
        navigate('/');
      }, 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAd = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este anúncio?')) return;
    try {
      await deleteDoc(doc(db, 'ads', id));
      clearHomeCache();
      setAds(prev => prev.filter(ad => ad.id !== id));
      alert('Anúncio eliminado com sucesso!');
    } catch (err) {
      console.error('Erro ao excluir anúncio:', err);
      handleFirestoreError(err, OperationType.DELETE, `ads/${id}`);
    }
  };

  const handleRelistAd = async (ad: Ad) => {
    if (!window.confirm('Deseja relistar este anúncio? Ele voltará para a fila de aprovação.')) return;
    try {
      const adRef = doc(db, 'ads', ad.id);
      
      // Calculate new expiration date (default 30 days for relisting)
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);

      // Track renewal after warning metric
      if (ad.adStatus === 'near_expiration' || ad.adStatus === 'expired') {
        const todayStr = new Date().toISOString().split('T')[0];
        const metricsRef = doc(db, 'metrics', todayStr);
        try {
          await setDoc(metricsRef, {
            notifications: {
              renewalsAfterWarning: increment(1)
            }
          }, { merge: true });
        } catch (err) {
          console.error('Error updating renewal metrics:', err);
        }
      }

      await setDoc(adRef, {
        status: 'pending',
        adStatus: 'active',
        expirationDate: expirationDate,
        userNotified: false,
        createdAt: new Date()
      }, { merge: true });
      clearHomeCache();
      
      alert('Anúncio enviado para aprovação!');
      fetchUserAds();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `ads/${ad.id}`);
    }
  };

  const handleMarkAsAvailable = async (adId: string) => {
    if (!window.confirm('Deseja marcar este anúncio como disponível de novo?')) return;
    try {
      const adRef = doc(db, 'ads', adId);
      await updateDoc(adRef, {
        adStatus: 'active',
        status: 'approved',
        updatedAt: serverTimestamp()
      });
      clearHomeCache();
      alert('Anúncio marcado como disponível de novo!');
      fetchUserAds();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `ads/${adId}`);
    }
  };

  const handleMarkAsSoldOutside = async (adId: string) => {
    if (!window.confirm('Deseja marcar este anúncio como vendido fora da plataforma? O anúncio ficará com status de vendido e não exigirá avaliações.')) return;
    try {
      const adRef = doc(db, 'ads', adId);
      await updateDoc(adRef, {
        adStatus: 'sold',
        status: 'approved',
        soldOutsidePlatform: true,
        soldAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      clearHomeCache();
      alert('Anúncio marcado como vendido fora da plataforma!');
      fetchUserAds();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `ads/${adId}`);
    }
  };

  if (!user) return <div className="text-center py-20">Por favor, faça login para ver seu perfil.</div>;

  const pointsFromAds = (profile as any)?.pointsFromAds || 0;
  const pointsFromReferrals = (referralsLoading ? 0 : referralsCount) * POINTS_PER_REFERRAL;
  const totalPoints = calculateTotalPoints(referralsLoading ? 0 : referralsCount, pointsFromAds);
  const progressPoints = calculateProgressPoints(totalPoints);
  const progressPercent = Math.min(100, Math.round((progressPoints / POINTS_THRESHOLD) * 100));
  const pointsNeeded = POINTS_THRESHOLD - progressPoints;

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Tabs Selector Navigation */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-fit flex-row overflow-x-auto max-w-full" id="profile-tabs-selectors">
        <button
          onClick={() => navigate('/profile?tab=perfil')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            currentTab === 'perfil' || !['perfil', 'anuncios', 'favorites', 'compras', 'reviews', 'reivindicacoes'].includes(currentTab)
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          id="btn-tab-perfil"
        >
          👤 Meu Perfil
        </button>
        <button
          onClick={() => navigate('/negocio')}
          className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap text-slate-500 hover:text-slate-800"
          id="btn-tab-negocio-page"
        >
          🏪 Meu Negócio
        </button>
        <button
          onClick={() => navigate('/campanhas')}
          className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap text-slate-500 hover:text-slate-800"
          id="btn-tab-campanhas-page"
        >
          🎁 Campanhas
        </button>
        <button
          onClick={() => navigate('/profile?tab=anuncios')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            currentTab === 'anuncios'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          id="btn-tab-anuncios"
        >
          Meus Anúncios <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ml-1 scale-90 ${currentTab === 'anuncios' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>{ads.length}</span>
        </button>
        <button
          onClick={() => navigate('/profile?tab=reviews')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            currentTab === 'reviews'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          id="btn-tab-reviews"
        >
          Avaliações <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ml-1 scale-90 ${currentTab === 'reviews' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>{reviews.length}</span>
        </button>
        <button
          onClick={() => navigate('/profile?tab=compras')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            currentTab === 'compras'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          id="btn-tab-compras"
        >
          Compras <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ml-1 scale-90 ${currentTab === 'compras' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>{purchasedAds.length}</span>
        </button>
        <button
          onClick={() => navigate('/profile?tab=favorites')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            currentTab === 'favorites'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          id="btn-tab-favorites"
        >
          Favoritos <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ml-1 scale-90 ${currentTab === 'favorites' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>{favorites?.length || 0}</span>
        </button>
        <button
          onClick={() => navigate('/profile?tab=reivindicacoes')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            currentTab === 'reivindicacoes'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          id="btn-tab-reivindicacoes"
        >
          🛡️ Reivindicações <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ml-1 scale-90 ${currentTab === 'reivindicacoes' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>{userClaims.length}</span>
        </button>
      </div>

      {(currentTab === 'perfil' || currentTab === 'vitrine' || !['perfil', 'vitrine', 'anuncios', 'favorites', 'compras', 'reviews', 'reivindicacoes'].includes(currentTab)) && (
        <div className="space-y-12" id="profile-perfil-tab-content">
          <InstallButton variant="button" />
          <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
            <User size={32} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-900">Meu Perfil</h1>
              {profile?.ratingCount ? (
                <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full text-xs font-black border border-amber-100">
                  <Star size={12} className="fill-amber-400 text-amber-400" />
                  <span>{profile.ratingAverage}</span>
                  <span className="text-[10px] font-medium text-slate-400 ml-0.5">({profile.ratingCount})</span>
                </div>
              ) : null}
            </div>
            <p className="text-slate-500">{user.email}</p>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Nome Completo</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all"
                placeholder="Seu nome"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Telemóvel (WhatsApp)</label>
            <div className="flex gap-2">
              <div className="relative w-32 shrink-0">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full pl-9 pr-2 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all appearance-none text-sm font-bold"
                >
                  {COUNTRY_CODES.map((c, index) => (
                    <option key={`country-${c.code}-${index}`} value={c.code}>{c.flag} {c.code}</option>
                  ))}
                </select>
              </div>
              <div className="relative flex-1">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all"
                  placeholder="Ex: 912345678"
                />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">Necessário para que os compradores entrem em contacto.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">País / Comunidade</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base leading-none select-none pointer-events-none z-10">
                {country === 'Portugal' ? '🇵🇹' : country === 'Reino Unido' ? '🇬🇧' : '🌍'}
              </span>
              <select
                value={country}
                onChange={(e) => {
                  const newVal = e.target.value as 'Portugal' | 'Reino Unido' | '';
                  setCountry(newVal);
                  setCity('');
                  if (newVal === 'Reino Unido') {
                    setCountryCode('+44');
                  } else if (newVal === 'Portugal') {
                    setCountryCode('+351');
                  }
                }}
                required
                className="w-full pl-12 pr-10 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all appearance-none font-bold text-slate-800 cursor-pointer"
              >
                <option value="" disabled className="text-slate-400">Selecione o seu país</option>
                <option value="Portugal">🇵🇹 Portugal</option>
                <option value="Reino Unido">🇬🇧 Reino Unido</option>
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Cidade</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={20} />
              <SearchableCitySelect
                value={city}
                onChange={(val) => setCity(val)}
                placeholder="Escreva ou escolha a sua cidade"
                country={country}
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading || uploadingLogo || uploadingCover || profileSaved}
              className={`w-full py-4 rounded-2xl font-bold transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 ${
                profileSaved 
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
              }`}
            >
              {profileSaved ? (
                <>
                  <CheckCircle size={20} />
                  <span>✓ Alterações Guardadas!</span>
                </>
              ) : (
                <span>{loading ? 'A guardar...' : 'Guardar Alterações'}</span>
              )}
            </button>
          </div>
        </form>
      </motion.div>

        </div>
      )}

      {currentTab === 'anuncios' && (
        <div className="space-y-12" id="profile-anuncios-tab-content">
          <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Meus Anúncios
            <span className="bg-slate-200 text-slate-600 text-sm px-3 py-1 rounded-full">{ads.length}</span>
          </h2>

          {/* Sub-abas de divisão por país */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit gap-1" id="ads-country-sub-tabs">
            <button
              onClick={() => setAdsCountryTab('Portugal')}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                adsCountryTab === 'Portugal'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              id="btn-sub-tab-portugal"
            >
              <span>🇵🇹</span> Portugal
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                adsCountryTab === 'Portugal' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/80 text-slate-600'
              }`}>
                {ptAds.length}
              </span>
            </button>
            <button
              onClick={() => setAdsCountryTab('Reino Unido')}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                adsCountryTab === 'Reino Unido'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              id="btn-sub-tab-uk"
            >
              <span>🇬🇧</span> Reino Unido
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                adsCountryTab === 'Reino Unido' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/80 text-slate-600'
              }`}>
                {ukAds.length}
              </span>
            </button>
          </div>
        </div>

        {adsLoading ? (
          <div className="text-center py-12 text-slate-400">A carregar anúncios...</div>
        ) : (adsCountryTab === 'Portugal' ? ptAds : ukAds).length === 0 ? (
          <div className="bg-white p-12 rounded-3xl text-center border-2 border-dashed border-slate-200">
            <p className="text-slate-500 mb-4">
              {ads.length === 0 
                ? 'Ainda não publicou nenhum anúncio.' 
                : `Ainda não publicou nenhum anúncio em ${adsCountryTab}.`}
            </p>
            <button
              onClick={() => navigate('/create-ad')}
              className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
            >
              Criar Primeiro Anúncio
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(adsCountryTab === 'Portugal' ? ptAds : ukAds).map((ad, idx) => {
              const isAdFeatured = ad.isFeatured && ad.featuredUntil && (
                ad.featuredUntil.seconds 
                  ? ad.featuredUntil.toDate() > new Date() 
                  : new Date(ad.featuredUntil) > new Date()
              );

              return (
                <motion.div
                  key={`profile-ad-${ad.id}-${idx}`}
                  id={`ad-profile-${ad.id}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`bg-white p-4 rounded-3xl shadow-md border flex gap-4 transition-all duration-500 relative ${
                    isAdFeatured
                      ? 'border-amber-400 ring-4 ring-amber-300 bg-amber-50/5'
                      : highlightAdId === ad.id 
                      ? 'border-amber-400 ring-4 ring-amber-100 bg-amber-50/10 scale-[1.02]' 
                      : 'border-slate-100'
                  }`}
                >
                  <OptimizedImage 
                    src={ad.imageUrl} 
                    alt={ad.title} 
                    className="w-full h-full object-cover" 
                    containerClassName="w-24 h-24 rounded-2xl bg-slate-50 overflow-hidden"
                    style={{
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
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-slate-900 truncate">{ad.title}</h3>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            if (ad.status === 'approved') {
                              alert('Atenção: Qualquer alteração fará com que o anúncio volte para a fila de aprovação do administrador.');
                            }
                            navigate(`/edit-ad/${ad.id}`);
                          }} 
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDeleteAd(ad.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    {ad.category === '💚 Doações & Solidariedade' ? (
                      <p className="text-emerald-600 font-extrabold mt-1">Grátis 💚</p>
                    ) : (
                      <p className="text-indigo-600 font-bold mt-1">{formatPrice(ad.price, ad.country)}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {isAdFeatured && (
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 shadow-sm animate-pulse">
                          ✨ Destacado 24h
                        </span>
                      )}
                      {ad.status === 'pending' && (
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                          <Clock size={14} /> Pendente
                        </span>
                      )}
                      {ad.status === 'approved' && ad.adStatus === 'active' && (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                          <CheckCircle size={14} /> Aprovado
                        </span>
                      )}
                      {ad.adStatus === 'near_expiration' && ad.status === 'approved' && (
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                          <AlertTriangle size={14} /> Expira em breve
                        </span>
                      )}
                      {(ad.status === 'expired' || ad.adStatus === 'expired') && (
                        <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                          <XCircle size={14} /> Expirado
                        </span>
                      )}
                      {ad.status === 'archived' && (
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded-lg">
                          <Archive size={14} /> Arquivado
                        </span>
                      )}
                      {ad.status === 'rejected' && (
                        <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                          <XCircle size={14} /> Rejeitado
                        </span>
                      )}
                      {(ad.status === 'sold' || ad.adStatus === 'sold') && ad.category !== 'Imigração' && ad.price !== undefined && Number(ad.price) > 0 && (
                        <span className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                          <ShoppingBag size={14} /> Vendido
                        </span>
                      )}
                    </div>
                    
                    {ad.expirationDate && (
                      <p className="text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-wider">
                        Expira em: {format(ad.expirationDate.toDate(), "dd 'de' MMMM", { locale: pt })}
                      </p>
                    )}

                    <div className="mt-3 flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1"><Eye size={12} /> {ad.views || 0}</span>
                      <span className="flex items-center gap-1"><MessageSquare size={12} /> {ad.whatsappClicks || 0}</span>
                    </div>

                    {(ad.status === 'approved' || ad.adStatus === 'active' || ad.adStatus === 'near_expiration') && ad.adStatus !== 'sold' && ad.category !== 'Imigração' && ad.price !== undefined && Number(ad.price) > 0 && (
                      <div className="flex flex-col gap-2 mt-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedAdForReview(ad);
                            setIsBuyerRating(false);
                            setShowReviewModal(true);
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all border border-emerald-100 cursor-pointer"
                        >
                          <ShoppingBag size={14} /> Marcar como Vendido (com avaliação)
                        </button>
                        <button
                          onClick={() => handleMarkAsSoldOutside(ad.id)}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all border border-slate-200 cursor-pointer"
                        >
                          <Globe size={14} /> Vendido fora da plataforma
                        </button>
                      </div>
                    )}

                    {ad.status === 'approved' && ad.adStatus === 'active' && !isAdFeatured && (
                      <button
                        onClick={() => handleFeatureAd(ad)}
                        className={`mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          (profile?.referralCredits || 0) > 0
                            ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-sm'
                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>✨</span>
                        <span>Destacar Anúncio (1 crédito)</span>
                      </button>
                    )}

                    {ad.adStatus === 'sold' && ad.category !== 'Imigração' && ad.price !== undefined && Number(ad.price) > 0 && (
                      <button
                      onClick={() => handleMarkAsAvailable(ad.id)}
                      className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all border border-indigo-100"
                    >
                      <RefreshCcw size={14} /> Reverter para Disponível
                    </button>
                  )}

                  {(ad.status === 'expired' || ad.adStatus === 'expired' || ad.status === 'archived' || ad.adStatus === 'near_expiration') && (
                    <button
                      onClick={() => handleRelistAd(ad)}
                      className={`mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
                        ad.adStatus === 'near_expiration' 
                          ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' 
                          : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                      }`}
                    >
                      <RefreshCcw size={14} /> 
                      {ad.adStatus === 'near_expiration' ? 'Renovar Anúncio' : 'Relistar Anúncio'}
                    </button>
                  )}

                  {/* Interessados Section */}
                  <button
                    onClick={() => handleToggleInterests(ad.id)}
                    className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-indigo-50/50 text-indigo-700 hover:bg-indigo-50 border border-slate-200 transition-all cursor-pointer"
                  >
                    <span>👥</span>
                    <span>
                      {expandedInterestsAdId === ad.id ? 'Ocultar Interessados' : 'Ver Interessados'}
                    </span>
                  </button>

                  {/* Expanded Interests List */}
                  {expandedInterestsAdId === ad.id && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                      <div className="flex justify-between items-center mb-2 font-bold text-slate-700">
                        <span>Interessados ({adInterests[ad.id]?.data?.length || 0})</span>
                      </div>
                      {adInterests[ad.id]?.loading ? (
                        <div className="py-3 text-center text-slate-400">Aprimorando consulta...</div>
                      ) : !adInterests[ad.id]?.data || adInterests[ad.id]?.data.length === 0 ? (
                        <div className="py-3 text-center text-slate-400">Ainda sem interessados registados neste anúncio.</div>
                      ) : (
                        <div className="max-h-40 overflow-y-auto space-y-2">
                          {adInterests[ad.id].data.map((interest: any, subIdx: number) => {
                            const contactDate = interest.createdAt?.toDate 
                              ? format(interest.createdAt.toDate(), "dd/MM/yyyy HH:mm")
                              : 'Recentemente';
                            return (
                              <div key={interest.id || subIdx} className="bg-white p-2 rounded-xl border border-slate-100 flex justify-between items-center gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">{interest.interestedUserName}</p>
                                  <p className="text-[10px] text-slate-400">Contacto: {contactDate}</p>
                                </div>
                                <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide shrink-0">
                                  WhatsApp
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
          </div>
        )}
      </div>
        </div>
      )}

      {currentTab === 'reviews' && (
        <div className="space-y-6" id="reviews-tab-content">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Avaliações Recebidas
            <span className="bg-amber-100 text-amber-800 text-sm px-3 py-1 rounded-full">{reviews.length}</span>
          </h2>

          {reviewsLoading ? (
            <div className="text-center py-12 text-slate-400">A carregar avaliações...</div>
          ) : reviews.length === 0 ? (
            <div className="bg-white p-16 rounded-3xl text-center border-2 border-dashed border-slate-200" id="no-reviews-box">
              <span className="text-4xl text-amber-400">★</span>
              <p className="text-slate-500 mt-4 font-semibold">Ainda não recebeu nenhuma avaliação.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviews.map((rev) => (
                <div key={rev.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-800">{rev.buyerName}</h4>
                        <div className="flex flex-wrap gap-1.5 items-center mt-1">
                          {rev.adCategory && (
                            <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md font-semibold font-sans">
                              {rev.adCategory}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]" title={rev.adTitle}>
                            {rev.adTitle}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={12} className={`${s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-100'}`} />
                        ))}
                      </div>
                    </div>
                    {rev.comment ? (
                      <p className="text-slate-600 text-xs leading-relaxed italic">"{rev.comment}"</p>
                    ) : (
                      <p className="text-slate-400 text-xs italic">Sem comentário escrito.</p>
                    )}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-50 text-[10px]">
                    <span className={`px-2 py-0.5 rounded-full font-bold ${rev.success ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {rev.success ? 'Negócio Fechado ✓' : 'Negócio Incompleto'}
                    </span>
                    <span className="text-slate-400 font-medium">
                      {rev.createdAt?.toDate ? formatDistanceToNow(rev.createdAt.toDate(), { addSuffix: true, locale: pt }) : 'Recentemente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {currentTab === 'favorites' && (
        <div className="space-y-6" id="favorites-tab-content">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Anúncios Favoritos
            <span className="bg-[#bfead0] text-emerald-800 text-sm px-3 py-1 rounded-full font-bold">{favoriteAds.length}</span>
          </h2>

          {favoritesLoading ? (
            <div className="text-center py-12 text-slate-400">A carregar anúncios favoritos...</div>
          ) : favoriteAds.length === 0 ? (
            <div className="bg-white p-16 rounded-3xl text-center border-2 border-dashed border-slate-200" id="no-favorites-box">
              <span className="text-4xl">❤️</span>
              <p className="text-slate-500 mt-4 mb-4 font-semibold">Ainda não marcou nenhum anúncio como favorito.</p>
              <button
                onClick={() => navigate('/')}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all cursor-pointer shadow-md shadow-indigo-100"
              >
                Ver Anúncios
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in" id="favorites-ads-grid">
              {favoriteAds.map((ad, idx) => (
                <AdCard key={`fav-ad-card-${ad.id || idx}`} ad={ad} />
              ))}
            </div>
          )}
        </div>
      )}

      {currentTab === 'compras' && (
        <div className="space-y-6" id="compras-tab-content">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Minhas Compras
            <span className="bg-indigo-100 text-indigo-800 text-sm px-3 py-1 rounded-full font-bold">{purchasedAds.length}</span>
          </h2>

          {purchasedAdsLoading ? (
            <div className="text-center py-12 text-slate-400">A carregar o seu histórico de compras...</div>
          ) : purchasedAds.length === 0 ? (
            <div className="bg-white p-16 rounded-3xl text-center border-2 border-dashed border-slate-200" id="no-compras-box">
              <span className="text-4xl">🛍️</span>
              <p className="text-slate-500 mt-4 mb-4 font-semibold">Ainda não efetuou nenhuma compra na plataforma.</p>
              <button
                onClick={() => navigate('/')}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all cursor-pointer shadow-md shadow-indigo-100"
              >
                Ver Anúncios
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in" id="purchased-ads-grid">
              {purchasedAds.map((ad, idx) => {
                const soldDate = ad.soldAt?.toDate ? ad.soldAt.toDate() : (ad.soldAt ? new Date(ad.soldAt) : null);
                const dateLabel = soldDate 
                  ? format(soldDate, "dd 'de' MMMM 'de' yyyy", { locale: pt }) 
                  : 'Recém-adquirido';

                return (
                  <div key={`purchased-ad-${ad.id || idx}`} className="bg-white rounded-3xl border border-slate-100 shadow-lg hover:shadow-xl transition-all overflow-hidden flex flex-col h-full">
                    <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                      {ad.imageUrl ? (
                        <OptimizedImage 
                          src={ad.imageUrl} 
                          alt={ad.title} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-400">
                          Sem Imagem
                        </div>
                      )}
                      <span className="absolute top-4 right-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg">
                        Adquirido
                      </span>
                    </div>

                    <div className="p-6 flex flex-col flex-1 gap-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between">
                        <span>{ad.category}</span>
                        <span>{ad.city}</span>
                      </div>
                      
                      <h3 className="font-bold text-slate-900 text-lg line-clamp-1">{ad.title}</h3>
                      
                      {ad.price !== undefined && (
                        <p className="font-extrabold text-[#006600] text-xl">
                          {ad.category === '💚 Doações & Solidariedade' ? 'Grátis 💚' : formatPrice(ad.price, ad.country || 'Portugal')}
                        </p>
                      )}

                      <div className="border-t border-slate-100 my-2 pt-3 flex flex-col gap-1 text-xs text-slate-500">
                        <div className="flex justify-between">
                          <span>Vendedor:</span>
                          <span className="font-bold text-slate-800">{ad.sellerName || 'Vendedor'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Data da compra:</span>
                          <span className="font-medium text-slate-400">{dateLabel}</span>
                        </div>
                      </div>

                      {reviewedAdIds.has(ad.id) ? (
                        <button
                          disabled
                          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                        >
                          <CheckCircle size={14} className="text-slate-400" /> 
                          Já avaliado
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedAdForReview(ad);
                            setIsBuyerRating(true);
                            setShowReviewModal(true);
                          }}
                          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all border border-indigo-100 group"
                        >
                          <Star size={14} className="fill-indigo-100 group-hover:fill-indigo-200 group-hover:scale-110 transition-all text-indigo-600" /> 
                          Avaliar vendedor
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {currentTab === 'reivindicacoes' && (
        <div className="space-y-6" id="reivindicacoes-tab-content">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Meus Pedidos de Reivindicação
            <span className="bg-indigo-100 text-indigo-800 text-sm px-3 py-1 rounded-full font-bold">{userClaims.length}</span>
          </h2>

          {userClaimsLoading ? (
            <div className="text-center py-12 text-slate-400">A carregar os seus pedidos de reivindicação...</div>
          ) : userClaims.length === 0 ? (
            <div className="bg-white p-16 rounded-3xl text-center border-2 border-dashed border-slate-200" id="no-reivindicacoes-box">
              <span className="text-4xl">🛡️</span>
              <p className="text-slate-500 mt-4 font-semibold">Ainda não solicitou a reivindicação de nenhum negócio.</p>
            </div>
          ) : (
            <div className="space-y-4" id="user-claims-list">
              {userClaims.map((claim) => {
                const claimDate = claim.createdAt?.toDate ? format(claim.createdAt.toDate(), "dd 'de' MMMM 'de' yyyy", { locale: pt }) : 'Recentemente';
                
                return (
                  <div key={claim.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-50 pb-3">
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{claim.adTitle}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Solicitado em: {claimDate}</p>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Overall Claim status */}
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          claim.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : claim.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {claim.status === 'approved' && '✓ Aprovado'}
                          {claim.status === 'rejected' && '✗ Recusado'}
                          {claim.status === 'pending' && '⏳ Em Análise'}
                        </span>

                        {/* Verification Status Badge */}
                        {claim.verificationStatus && (
                          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                            claim.verificationStatus === 'confirmed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : claim.verificationStatus === 'sent'
                              ? 'bg-blue-50 text-blue-700 border border-blue-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}>
                            {claim.verificationStatus === 'confirmed' && '🟢 Código Confirmado'}
                            {claim.verificationStatus === 'sent' && '🟡 Código Enviado'}
                            {claim.verificationStatus === 'invalid' && '🔴 Código Inválido'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="block text-slate-400 font-bold uppercase text-[9px] tracking-wide">Nome Completo</span>
                        <span className="text-slate-800 font-extrabold">{claim.name}</span>
                      </div>
                      <div>
                        <span className="block text-slate-400 font-bold uppercase text-[9px] tracking-wide">Email fornecido</span>
                        <span className="text-slate-800 font-extrabold">{claim.email || 'Não fornecido'}</span>
                      </div>
                      <div>
                        <span className="block text-slate-400 font-bold uppercase text-[9px] tracking-wide">Telefone / WhatsApp</span>
                        <span className="text-slate-800 font-extrabold">{claim.phone || 'Não fornecido'}</span>
                      </div>
                    </div>

                    {/* Area do Utilizador - Confirmar Código Section */}
                    {claim.status === 'pending' && claim.verificationCode && claim.verificationStatus === 'sent' && (
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3 mt-2">
                        <h4 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                          🔑 Confirmar Código de Verificação
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Foi-lhe atribuído um código de verificação para confirmar a propriedade deste negócio por 
                          <span className="font-bold text-slate-700"> {claim.verificationMethod === 'email' ? 'Email' : 'WhatsApp'}</span>. 
                          Insira o código abaixo para prosseguir com a análise do pedido.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-2 max-w-md">
                          <input
                            type="text"
                            placeholder="Digite o código recebido (ex: ML-123456)"
                            value={claimVerificationCode[claim.id] || ''}
                            onChange={(e) => setClaimVerificationCode(prev => ({ ...prev, [claim.id]: e.target.value }))}
                            disabled={verifyingClaimId === claim.id || claimVerificationSuccess[claim.id] || claim.verificationStatus === 'confirmed'}
                            className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl font-mono text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1"
                          />
                          <button
                            type="button"
                            disabled={verifyingClaimId === claim.id || claimVerificationSuccess[claim.id] || claim.verificationStatus === 'confirmed'}
                            onClick={() => handleVerifyClaimCode(claim.id, claimVerificationCode[claim.id], claim.verificationCode)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider disabled:bg-indigo-300 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow"
                          >
                            {verifyingClaimId === claim.id ? 'A verificar...' : 'Confirmar Código'}
                          </button>
                        </div>

                        {claimVerificationError[claim.id] && (
                          <p className="text-xs font-black text-rose-600">
                            ❌ {claimVerificationError[claim.id]}
                          </p>
                        )}
                        {claimVerificationSuccess[claim.id] && (
                          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1">
                            <p className="text-xs font-black text-emerald-800">
                              ✅ Código confirmado com sucesso.
                            </p>
                            <p className="text-[11px] text-emerald-600 font-semibold leading-snug">
                              Your business claim is ready for review by the ConnectBoat team.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* If verified (already confirmed) */}
                    {claim.verificationStatus === 'confirmed' && (
                      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-2 text-emerald-800 text-xs">
                        <span>✅</span>
                        <div>
                          <p className="font-black">Código confirmado com sucesso.</p>
                          <p className="font-semibold text-emerald-600">Your business claim is ready for review by the ConnectBoat team.</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedAdForReview && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedAdForReview(null);
          }}
          adId={selectedAdForReview.id}
          adTitle={selectedAdForReview.title}
          adCategory={selectedAdForReview.category}
          sellerId={selectedAdForReview.sellerId || ''}
          sellerName={selectedAdForReview.sellerName || ''}
          isBuyerRating={isBuyerRating}
          onSuccess={() => {
            if (isBuyerRating) {
              fetchPurchasedAds();
              alert('Obrigado! Avaliação enviada com sucesso.');
            } else {
              fetchUserAds();
              alert('Parabéns pela venda! O seu anúncio foi finalizado com sucesso.');
            }
          }}
        />
      )}

      {/* MODAL CADASTRAR/EDITAR ITEM DA VITRINE */}
      {showProductModal && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-slate-900">
                {productName ? `Editar: ${productName}` : 'Adicionar Item à Vitrine'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowProductModal(false);
                  setEditingProduct(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto space-y-4">
              {/* Nome */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Nome do Produto/Serviço *</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-semibold"
                  placeholder="Ex: Bolo de Chocolate Personalizado"
                />
              </div>

              {/* Descrição */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Descrição *</label>
                <textarea
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  required
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white outline-none transition-all text-sm resize-none"
                  placeholder="Descreva detalhes como ingredientes, prazos ou especificações..."
                />
              </div>

              {/* Preço & Ordem & Ativo em uma fila */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Preço Opcional (€ / £)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-semibold"
                    placeholder="Ex: 25.00 (sob consulta se vazio)"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Ordem de Exibição (0, 1...)</label>
                  <input
                    type="number"
                    min="0"
                    value={productOrder}
                    onChange={(e) => setProductOrder(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Status Ativo/Inativo */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-sm font-bold text-slate-700 block">Item Ativo</span>
                  <span className="text-[10px] text-slate-400">Itens inativos não serão exibidos aos clientes.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setProductActive(!productActive)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    productActive ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      productActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Fotos (Até 2) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Fotos do Item (Até 2)</label>
                <div className="grid grid-cols-2 gap-4">
                  {[0, 1].map((idx) => {
                    const currentImg = productImages[idx];
                    const isUploading = isUploadingProductImg[idx];
                    return (
                      <div key={`product-img-upload-${idx}`} className="border-2 border-dashed border-slate-200 rounded-2xl aspect-[4/3] flex flex-col items-center justify-center relative overflow-hidden bg-slate-50">
                        {currentImg ? (
                          <>
                            <img src={currentImg} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute top-2 right-2 flex gap-1">
                              <button
                                type="button"
                                onClick={() => removeProductImage(idx)}
                                className="p-1 px-2 text-[10px] font-black uppercase text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow"
                              >
                                Remover
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="p-3 text-center space-y-2 flex flex-col items-center">
                            <span className="text-2xl">📸</span>
                            <span className="text-[9px] font-bold text-slate-400 block line-clamp-2">Foto {idx + 1}</span>
                            <input
                              type="file"
                              accept="image/*"
                              id={`product-image-picker-${idx}`}
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  uploadProductImage(e.target.files[0], idx, editingProduct.id);
                                }
                              }}
                            />
                            <button
                              type="button"
                              disabled={isUploading}
                              onClick={() => document.getElementById(`product-image-picker-${idx}`)?.click()}
                              className="px-2 py-1 text-[9px] font-black rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-600 disabled:opacity-50"
                            >
                              {isUploading ? 'A carregar...' : 'Fazer Upload'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-slate-100 flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowProductModal(false);
                    setEditingProduct(null);
                  }}
                  className="w-1/2 py-3 bg-slate-150 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct || isUploadingProductImg.some(Boolean) || productSavedSuccess}
                  className={`w-1/2 py-3 font-bold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                    productSavedSuccess 
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {productSavedSuccess ? (
                    <>
                      <CheckCircle size={16} />
                      <span>✓ Item Guardado!</span>
                    </>
                  ) : (
                    <span>{isSavingProduct ? 'A guardar...' : 'Guardar Item'}</span>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Stripe Showcase Checkout Modal */}
      <AnimatePresence>
        {showShowcasePaymentModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100"
            >
              {/* Header */}
              <div className="relative p-6 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white">
                <button
                  onClick={() => setShowShowcasePaymentModal(false)}
                  className="absolute top-4 right-4 text-white/75 hover:text-white bg-white/10 p-2 rounded-full transition-all"
                >
                  <X size={16} />
                </button>
                <div className="flex items-center gap-2 text-indigo-400 font-black tracking-widest text-[10px] uppercase">
                  <span>Stripe Secure Subscription</span>
                </div>
                <h3 className="text-xl font-bold mt-2">Ativar Minha Vitrine Digital</h3>
                <p className="text-xs text-slate-300 mt-1">Coloque o seu negócio num nível profissional por apenas {country === 'Reino Unido' ? '£8.99' : '€8.99'} por mês.</p>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                {/* Summary */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Subscrição Vitrine Digital (Mensal)</span>
                    <span className="font-bold text-slate-900">
                      {country === 'Reino Unido' ? '£8.99/mês' : '€8.99/mês'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Configuração e ativação única</span>
                    <span className="font-semibold text-emerald-600">Grátis</span>
                  </div>
                  <div className="border-t border-slate-200/50 pt-2 flex justify-between text-sm font-bold text-slate-900">
                    <span>Total Debitável Hoje</span>
                    <span className="text-indigo-600">
                      {country === 'Reino Unido' ? '£8.99' : '€8.99'}
                    </span>
                  </div>
                </div>

                {/* Card Fields */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">Dados do Cartão</span>
                  
                  <div className="border-2 border-slate-200 focus-within:border-indigo-600 rounded-2xl px-4 py-3 bg-white space-y-3 transition-all shadow-sm">
                    {/* Card Number */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Número do Cartão</label>
                      <input
                        type="text"
                        value={showcaseCardNumber}
                        onChange={(e) => setShowcaseCardNumber(e.target.value)}
                        className="w-full bg-transparent border-none p-0 outline-none text-sm text-slate-900 font-medium placeholder-slate-300"
                        placeholder="4242 4242 4242 4242"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-2">
                      {/* Exp */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Validade</label>
                        <input
                          type="text"
                          value={showcaseCardExpiry}
                          onChange={(e) => setShowcaseCardExpiry(e.target.value)}
                          className="w-full bg-transparent border-none p-0 outline-none text-sm text-slate-900 font-medium placeholder-slate-300"
                          placeholder="MM/AA"
                        />
                      </div>
                      {/* CVC */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CVC</label>
                        <input
                          type="password"
                          value={showcaseCardCVC}
                          onChange={(e) => setShowcaseCardCVC(e.target.value)}
                          className="w-full bg-transparent border-none p-0 outline-none text-sm text-slate-900 font-medium placeholder-slate-300"
                          placeholder="CVC"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Name on Card */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nome do Titular</label>
                    <input
                      type="text"
                      value={showcaseCardName}
                      onChange={(e) => setShowcaseCardName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 text-sm"
                      placeholder="Ex: Manuel Silva"
                    />
                  </div>
                </div>

                {/* Security trust badges */}
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">🔒 Processamento 256-bit SSL</span>
                  <div className="flex gap-1.5 opacity-60">
                    <span className="px-1 py-0.5 border border-slate-200 rounded bg-slate-50 font-black text-[8px]">VISA</span>
                    <span className="px-1 py-0.5 border border-slate-200 rounded bg-slate-50 font-black text-[8px]">MC</span>
                    <span className="px-1 py-0.5 border border-slate-200 rounded bg-slate-50 font-black text-[8px]">STRIPE</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleMockShowcasePaymentSuccess}
                    disabled={showcasePaymentLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    {showcasePaymentLoading ? (
                      <span className="flex items-center gap-2">
                        <RefreshCcw className="animate-spin" size={16} /> A processar subscrição...
                      </span>
                    ) : (
                      <span>Subscrever por {country === 'Reino Unido' ? '£8.99/mês' : '€8.99/mês'}</span>
                    )}
                  </button>
                  
                  <button
                    onClick={() => setShowShowcasePaymentModal(false)}
                    className="w-full text-center py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-all"
                  >
                    Mudar de ideias
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;
