import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { collection, query, orderBy, limit, updateDoc, doc, serverTimestamp, setDoc, deleteDoc, getDoc, getDocs, where } from 'firebase/firestore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db, handleFirestoreError, OperationType, getDocsWithCacheFallback } from '../firebase';
import { Ad, UserProfile } from '../types';
import { clearHomeCache } from '../utils/cache';
import { motion, AnimatePresence } from 'motion/react';
import OptimizedImage from '../components/OptimizedImage';
import { awardAdApprovalPoints } from '../utils/rewards';
import { 
  Clock, 
  Archive, 
  Trash2, 
  Edit,
  RefreshCcw,
  CheckCircle, 
  XCircle, 
  Eye, 
  EyeOff,
  MessageSquare,
  Search,
  Filter,
  AlertCircle,
  X,
  MapPin,
  Tag,
  Image as ImageIcon,
  LayoutGrid,
  List,
  ShieldAlert,
  ShieldCheck,
  CreditCard,
  Mail,
  Phone,
  UserRound,
  ExternalLink,
  Copy,
  MessageCircle
} from 'lucide-react';
import { format, formatDistanceToNow, addDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { formatPrice } from '../utils';
import { sendEmailGeneric, getSellerEmail } from '../utils/emailService';
import { useAuth } from '../context/AuthContext';
import { 
  isPaidAd, 
  getAdPlanLabel, 
  formatUKDate, 
  formatUKDateTime, 
  getAdPaymentClassification 
} from '../utils/paymentUtils';

export { 
  isPaidAd, 
  getAdPlanLabel, 
  formatUKDate, 
  formatUKDateTime, 
  getAdPaymentClassification 
};

interface ColumnOption {
  id: string;
  label: string;
  mandatory?: boolean;
}

const ALL_COLUMNS: ColumnOption[] = [
  { id: 'foto', label: 'Photo' },
  { id: 'titulo', label: 'Title', mandatory: true },
  { id: 'preco', label: 'Price' },
  { id: 'status', label: 'Status' },
  { id: 'pagamento', label: 'Payment' },
  { id: 'vendedor', label: 'Seller' },
  { id: 'pais', label: 'Country' },
  { id: 'cidade', label: 'City' },
  { id: 'criacao', label: 'Created' },
  { id: 'expiracao', label: 'Expiry' },
  { id: 'vistas', label: 'Views' },
  { id: 'cliques', label: 'Clicks' },
  { id: 'acoes', label: 'Quick actions', mandatory: true },
];

const AdminAds = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [adFilter, setAdFilter] = useState<string>(searchParams.get('status') || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [sellerProfile, setSellerProfile] = useState<UserProfile | null>(null);
  const [sellerProfileLoading, setSellerProfileLoading] = useState(false);
  const [sellerProfileError, setSellerProfileError] = useState<string | null>(null);
  const [sellerAdsCount, setSellerAdsCount] = useState<number | null>(null);

  const [selectedAdIds, setSelectedAdIds] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status) {
      setAdFilter(status);
    }
    const selectAllParam = searchParams.get('selectAll') === 'true';
    if (selectAllParam && ads.length > 0) {
      const targetFilter = status || 'all';
      const targetFiltered = ads.filter(ad => {
        const matchesFilter = targetFilter === 'all' 
          ? true 
          : targetFilter === 'duplicates' 
            ? ad.isDuplicate === true 
            : targetFilter === 'paid'
              ? isPaidAd(ad)
              : (ad.status === targetFilter || ad.adStatus === targetFilter);
        return matchesFilter;
      });
      if (targetFiltered.length > 0) {
        setSelectedAdIds(targetFiltered.map(a => a.id));
      }
    }
  }, [searchParams, ads]);

  // New States for ERP / Scalability TabelaMode
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    return (localStorage.getItem('admin_ads_view_mode') as 'cards' | 'table') || 'cards';
  });
  const [countryFilter, setCountryFilter] = useState<'all' | 'Portugal' | 'Reino Unido'>('all');
  const [listingTypeFilter, setListingTypeFilter] = useState<'all' | 'sale' | 'hire'>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [fetchLimit, setFetchLimit] = useState(100);
  const pageSize = 50;

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('admin_ads_visible_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Garante que os campos obrigatorios estão sempre presentes
          return Array.from(new Set([...parsed, 'titulo', 'acoes']));
        }
      } catch (e) {
        console.error('Erro ao processar as colunas visíveis salvas:', e);
      }
    }
    // Por padrão exibe todas as colunas
    return ALL_COLUMNS.map(col => col.id);
  });

  useEffect(() => {
    localStorage.setItem('admin_ads_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const isColVisible = (id: string) => visibleColumns.includes(id);

  const [adminImagePositionX, setAdminImagePositionX] = useState<number>(50);
  const [adminImagePositionY, setAdminImagePositionY] = useState<number>(50);
  const [adminImageZoom, setAdminImageZoom] = useState<number>(1);
  const [savingPosition, setSavingPosition] = useState(false);
  const [savedPositionSuccess, setSavedPositionSuccess] = useState(false);
  const [claimActionLoading, setClaimActionLoading] = useState(false);
  const [resendingEmailId, setResendingEmailId] = useState<string | null>(null);
  const [assistedPaymentAd, setAssistedPaymentAd] = useState<Ad | null>(null);
  const [assistedPaymentPlan, setAssistedPaymentPlan] = useState<'standard' | 'featured' | 'premium'>('standard');
  const [assistedPaymentLoading, setAssistedPaymentLoading] = useState(false);
  const [assistedPaymentUrl, setAssistedPaymentUrl] = useState('');
  const [assistedPaymentError, setAssistedPaymentError] = useState<string | null>(null);

  const openAssistedPayment = (ad: Ad) => {
    setAssistedPaymentAd(ad);
    setAssistedPaymentPlan('standard');
    setAssistedPaymentUrl('');
    setAssistedPaymentError(null);
  };

  const closeAssistedPayment = () => {
    setAssistedPaymentAd(null);
    setAssistedPaymentUrl('');
    setAssistedPaymentError(null);
    setAssistedPaymentLoading(false);
  };

  const handleGenerateAssistedPayment = async () => {
    if (!assistedPaymentAd || !user) return;

    setAssistedPaymentLoading(true);
    setAssistedPaymentError(null);
    setAssistedPaymentUrl('');

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/create-assisted-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          adId: assistedPaymentAd.id,
          plan: assistedPaymentPlan,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.url) {
        throw new Error(data?.errorMessage || data?.error || 'Could not create the assisted payment link.');
      }

      setAssistedPaymentUrl(data.url);
    } catch (err: any) {
      console.error('[AdminAds] Assisted payment error:', err);
      setAssistedPaymentError(err?.message || 'Could not create the assisted payment link.');
    } finally {
      setAssistedPaymentLoading(false);
    }
  };

  const copyAssistedPaymentLink = async () => {
    if (!assistedPaymentUrl) return;
    try {
      await navigator.clipboard.writeText(assistedPaymentUrl);
      alert('Payment link copied!');
    } catch (err) {
      console.error('[AdminAds] Failed to copy payment link:', err);
      alert('Could not copy the payment link.');
    }
  };

  const shareAssistedPaymentWhatsApp = () => {
    if (!assistedPaymentUrl || !assistedPaymentAd) return;
    const planLabels = {
      standard: 'Standard Listing (£2.99)',
      featured: 'Featured Listing (£4.99)',
      premium: 'Premium Featured (£9.99)',
    };
    const message = `ConnectBoat payment for "${assistedPaymentAd.title}" - ${planLabels[assistedPaymentPlan]}: ${assistedPaymentUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const formatSellerDate = (value: any): string => {
    if (!value) return 'Not available';
    try {
      const dateValue = typeof value?.toDate === 'function'
        ? value.toDate()
        : value instanceof Date
          ? value
          : value?.seconds
            ? new Date(value.seconds * 1000)
            : new Date(value);

      if (Number.isNaN(dateValue.getTime())) return 'Not available';
      return format(dateValue, 'dd MMM yyyy HH:mm');
    } catch {
      return 'Not available';
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadSellerProfile = async () => {
      const sellerId = selectedAd?.sellerId?.trim();

      setSellerProfile(null);
      setSellerAdsCount(null);
      setSellerProfileError(null);

      if (!sellerId) return;

      setSellerProfileLoading(true);
      try {
        const [profileSnap, sellerAdsSnap] = await Promise.all([
          getDoc(doc(db, 'users', sellerId)),
          getDocs(query(collection(db, 'ads'), where('sellerId', '==', sellerId)))
        ]);

        if (cancelled) return;

        if (profileSnap.exists()) {
          setSellerProfile({
            id: profileSnap.id,
            ...(profileSnap.data() as UserProfile)
          });
        } else {
          setSellerProfileError('The user profile was not found in users/{uid}.');
        }

        setSellerAdsCount(sellerAdsSnap.size);
      } catch (err) {
        console.error('[AdminAds] Failed to load seller profile:', err);
        if (!cancelled) {
          setSellerProfileError('Could not load the seller account details.');
        }
      } finally {
        if (!cancelled) setSellerProfileLoading(false);
      }
    };

    loadSellerProfile();

    return () => {
      cancelled = true;
    };
  }, [selectedAd?.id, selectedAd?.sellerId]);

  useEffect(() => {
    if (selectedAd) {
      setAdminImagePositionX(selectedAd.imagePositionX !== undefined ? selectedAd.imagePositionX : 50);
      setAdminImagePositionY(selectedAd.imagePositionY !== undefined ? selectedAd.imagePositionY : 50);
      setAdminImageZoom(selectedAd.imageZoom !== undefined ? selectedAd.imageZoom : 1);
    }
  }, [selectedAd]);

  const handleSaveEnquadramento = async () => {
    if (!selectedAd) return;
    setSavingPosition(true);
    try {
      const coverUrl = selectedAd.imageUrl || (selectedAd.images && selectedAd.images[0]) || '';
      await updateDoc(doc(db, 'ads', selectedAd.id), {
        imagePositionX: adminImagePositionX,
        imagePositionY: adminImagePositionY,
        imageZoom: adminImageZoom,
        coverImageSettings: {
          imageUrl: coverUrl,
          x: adminImagePositionX,
          y: adminImagePositionY,
          zoom: adminImageZoom,
        },
        updatedAt: serverTimestamp()
      });
      clearHomeCache();
      setAds(prevAds => prevAds.map(ad => ad.id === selectedAd.id ? { 
        ...ad, 
        imagePositionX: adminImagePositionX, 
        imagePositionY: adminImagePositionY,
        imageZoom: adminImageZoom,
        coverImageSettings: {
          imageUrl: coverUrl,
          x: adminImagePositionX,
          y: adminImagePositionY,
          zoom: adminImageZoom,
        }
      } as Ad : ad));
      setSelectedAd(prev => prev ? {
        ...prev,
        imagePositionX: adminImagePositionX,
        imagePositionY: adminImagePositionY,
        imageZoom: adminImageZoom,
        coverImageSettings: {
          imageUrl: coverUrl,
          x: adminImagePositionX,
          y: adminImagePositionY,
          zoom: adminImageZoom,
        }
      } : null);
      setSavedPositionSuccess(true);
      setTimeout(() => {
        setSavedPositionSuccess(false);
      }, 2000);
    } catch (err) {
      console.error(err);
      alert('Erro ao guardar enquadramento.');
    } finally {
      setSavingPosition(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, []);

  const [renewingId, setRenewingId] = useState<string | null>(null);

  const fetchAds = async (customLimit?: number | null) => {
    try {
      setLoading(true);
      const currentLimit = customLimit !== undefined && customLimit !== null ? customLimit : fetchLimit;
      const q = query(collection(db, 'ads'), orderBy('createdAt', 'desc'), limit(currentLimit));
      const querySnapshot = await getDocsWithCacheFallback(q, 'admin/ads');
      const adsData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Ad));
      setAds(adsData);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'ads');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    const newLimit = fetchLimit + 100;
    setFetchLimit(newLimit);
    fetchAds(newLimit);
  };

  const handleAdAction = async (adId: string, status: string) => {
    try {
      const adToUpdate = ads.find(a => a.id === adId) || (selectedAd?.id === adId ? selectedAd : null);

      const updatePayload: Record<string, any> = {
        status,
        updatedAt: serverTimestamp()
      };

      const isPaidPendingApproval = Boolean(
        status === 'approved' &&
        adToUpdate &&
        isPaidAd(adToUpdate) &&
        adToUpdate.status === 'pending'
      );

      if (isPaidPendingApproval && adToUpdate) {
        const plan = (adToUpdate.plan || 'standard').toLowerCase();
        const isFeatured = plan === 'featured' || plan === 'premium';
        const featuredLevel = plan === 'premium' ? 'premium' : plan === 'featured' ? 'featured' : 'standard';
        const expiresAt = addDays(new Date(), 30);

        // Both normal customer payments and admin-assisted payments start
        // their 30-day listing period only after moderation approval.
        updatePayload.awaitingAdminActivation = false;
        updatePayload.awaitingAdminApproval = false;
        updatePayload.adStatus = 'active';
        updatePayload.activatedAt = serverTimestamp();
        updatePayload.expirationDate = expiresAt;
        updatePayload.featuredUntil = expiresAt;
        updatePayload.featuredActivatedAt = serverTimestamp();
        updatePayload.isFeatured = isFeatured;
        updatePayload.featuredLevel = featuredLevel;
      }

      await updateDoc(doc(db, 'ads', adId), updatePayload);
      clearHomeCache();

      if (adToUpdate && adToUpdate.sellerId) {
        const isSelfOwned = user?.uid && (adToUpdate.sellerId.trim() === user.uid);

        if (status === 'approved') {
          try {
            await awardAdApprovalPoints(adToUpdate.sellerId, adId);
          } catch (pointsErr) {
            console.error("Error awarding ad approved points:", pointsErr);
          }

          if (!isSelfOwned) {
            try {
              const notifId = `approval_${adId}_${Date.now()}`;
              const notifData = {
                userId: adToUpdate.sellerId.trim(),
                title: 'Listing approved',
                message: `Your listing "${adToUpdate.title}" has been approved and is now live.`,
                createdAt: serverTimestamp(),
                read: false,
                adId: adId,
                type: 'ad_approved'
              };
              await setDoc(doc(db, 'notifications', notifId), notifData);
              console.log('[AdminAds] Approval notification saved!');
            } catch (notifErr) {
              console.warn('[AdminAds] Failed to create approval notification:', notifErr);
            }

            // Normal flow: resolve the seller account e-mail from sellerId.
            getSellerEmail(adToUpdate.sellerId.trim()).then((email) => {
              if (email) {
                sendEmailGeneric('anuncio_aprovado', email, {
                  sellerName: adToUpdate.sellerName || 'Advertiser',
                  adTitle: adToUpdate.title,
                  adId: adId
                }).catch(err => console.warn('[AdminAds] Failed to send approval email:', err));
              }
            }).catch(err => console.warn('[AdminAds] Failed to get seller email:', err));
          } else {
            const isAdminAssisted = (adToUpdate as any).paymentFlow === 'admin_assisted';
            const adminEmail = String(user?.email || (profile as any)?.email || '').trim().toLowerCase();
            const customerEmailCandidates = [
              (adToUpdate as any).contactEmail,
              (adToUpdate as any).sellerEmail,
              (adToUpdate as any).userEmail,
            ]
              .map(value => String(value || '').trim())
              .filter(value => value.includes('@'));

            const assistedCustomerEmail = customerEmailCandidates.find(
              email => email.toLowerCase() !== adminEmail
            );

            if (isAdminAssisted && assistedCustomerEmail) {
              sendEmailGeneric('anuncio_aprovado', assistedCustomerEmail, {
                sellerName: adToUpdate.sellerName || 'Advertiser',
                adTitle: adToUpdate.title,
                adId: adId
              })
                .then(() => console.log(`[AdminAds] Assisted approval email sent to customer ${assistedCustomerEmail}`))
                .catch(err => console.warn('[AdminAds] Failed to send assisted customer approval email:', err));
            } else {
              console.log('[AdminAds] Skipping approval email & notification for self-owned ad without a different customer email');
            }
          }

        } else if (status === 'rejected') {
          if (!isSelfOwned) {
            try {
              const notifId = `rejection_${adId}_${Date.now()}`;
              const notifData = {
                userId: adToUpdate.sellerId.trim(),
                title: 'Listing rejected',
                message: `Your listing "${adToUpdate.title}" could not be approved by the moderation team.`,
                createdAt: serverTimestamp(),
                read: false,
                adId: adId,
                type: 'ad_rejected'
              };
              await setDoc(doc(db, 'notifications', notifId), notifData);
            } catch (notifErr) {
              console.warn('[AdminAds] Failed to create rejection notification:', notifErr);
            }

            // Send rejection email (async)
            getSellerEmail(adToUpdate.sellerId.trim()).then((email) => {
              if (email) {
                sendEmailGeneric('anuncio_rejeitado', email, {
                  sellerName: adToUpdate.sellerName || 'Advertiser',
                  adTitle: adToUpdate.title,
                  reason: 'Description inadequacy, invalid price or content contrary to terms.'
                }).catch(err => console.warn('[AdminAds] Failed to send rejection email:', err));
              }
            }).catch(err => console.warn('[AdminAds] Failed to get seller email:', err));
          } else {
            console.log('[AdminAds] Skipping rejection email & notification for self-owned ad');
          }
        }
      }

      setAds(prevAds => prevAds.map(ad => ad.id === adId ? {
        ...ad,
        status,
        ...(isPaidAssistedAwaitingActivation ? {
          awaitingAdminActivation: false,
          activatedAt: new Date(),
          expirationDate: addDays(new Date(), 30),
          featuredUntil: addDays(new Date(), 30),
          isFeatured: (ad.plan || '').toLowerCase() === 'featured' || (ad.plan || '').toLowerCase() === 'premium',
          featuredLevel: (ad.plan || '').toLowerCase() === 'premium' ? 'premium' : (ad.plan || '').toLowerCase() === 'featured' ? 'featured' : 'standard'
        } : {})
      } as Ad : ad));
      setSelectedAd(prev => prev && prev.id === adId ? {
        ...prev,
        status: status as any,
        ...(isPaidAssistedAwaitingActivation ? {
          awaitingAdminActivation: false,
          activatedAt: new Date(),
          expirationDate: addDays(new Date(), 30),
          featuredUntil: addDays(new Date(), 30)
        } : {})
      } as Ad : prev);
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `ads/${adId}`);
      return false;
    }
  };

  const handleDeleteAd = async (adId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this listing? This action is irreversible.')) return;
    try {
      await deleteDoc(doc(db, 'ads', adId));
      clearHomeCache();
      setAds(prevAds => prevAds.filter(ad => ad.id !== adId));
      setSelectedAdIds(prev => prev.filter(id => id !== adId));
      if (selectedAd?.id === adId) setSelectedAd(null);
      alert('Listing permanently deleted successfully!');
    } catch (err) {
      console.error('Error deleting listing:', err);
      handleFirestoreError(err, OperationType.DELETE, `ads/${adId}`);
    }
  };

  const handleToggleHideAd = async (adId: string, currentIsHidden?: boolean) => {
    const newIsHidden = !currentIsHidden;
    try {
      await updateDoc(doc(db, 'ads', adId), { 
        isHidden: newIsHidden,
        updatedAt: serverTimestamp()
      });
      clearHomeCache();
      setAds(prevAds => prevAds.map(ad => ad.id === adId ? { ...ad, isHidden: newIsHidden } as Ad : ad));
      if (selectedAd?.id === adId) {
        setSelectedAd(prev => prev ? { ...prev, isHidden: newIsHidden } : null);
      }
    } catch (err) {
      console.error('Error toggling hide status:', err);
      handleFirestoreError(err, OperationType.UPDATE, `ads/${adId}`);
    }
  };

  const handleBatchToggleHide = async (hideState: boolean) => {
    if (selectedAdIds.length === 0) return;
    const actionText = hideState ? 'colocar em Standby (ocultar)' : 'tornar visíveis';
    if (!window.confirm(`Tem a certeza que deseja ${actionText} ${selectedAdIds.length} anúncio(s)?`)) return;

    setBatchLoading(true);
    try {
      await Promise.all(selectedAdIds.map(id => 
        updateDoc(doc(db, 'ads', id), { 
          isHidden: hideState,
          updatedAt: serverTimestamp() 
        })
      ));
      clearHomeCache();
      setAds(prev => prev.map(a => selectedAdIds.includes(a.id) ? { ...a, isHidden: hideState } : a));
      setSelectedAdIds([]);
      alert(`Operação concluída: ${selectedAdIds.length} anúncio(s) atualizado(s).`);
    } catch (err) {
      console.error('Error batch hiding ads:', err);
      alert('Erro ao atualizar os anúncios selecionados.');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedAdIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete the ${selectedAdIds.length} selected listings? This action is irreversible.`)) return;

    setBatchLoading(true);
    let successCount = 0;
    let failCount = 0;

    const promises = selectedAdIds.map(async (id) => {
      try {
        await deleteDoc(doc(db, 'ads', id));
        successCount++;
      } catch (err) {
        console.error(`Error deleting listing ${id}:`, err);
        failCount++;
      }
    });

    await Promise.all(promises);
    clearHomeCache();
    setAds(prev => prev.filter(ad => !selectedAdIds.includes(ad.id)));
    if (selectedAd && selectedAdIds.includes(selectedAd.id)) setSelectedAd(null);
    setSelectedAdIds([]);
    setBatchLoading(false);
    alert(`Batch deletion completed: ${successCount} successfully deleted.${failCount > 0 ? ` Failures: ${failCount}` : ''}`);
  };

  const handleBatchAction = async (status: 'approved' | 'rejected') => {
    if (selectedAdIds.length === 0) return;
    const actionLabel = status === 'approved' ? 'approve' : 'reject';
    const confirmMsg = `Are you sure you want to ${actionLabel} the ${selectedAdIds.length} selected listings in batch?`;
    if (!window.confirm(confirmMsg)) return;

    setBatchLoading(true);
    let successCount = 0;
    let failCount = 0;

    const promises = selectedAdIds.map(async (id) => {
      const res = await handleAdAction(id, status);
      if (res) {
        successCount++;
      } else {
        failCount++;
      }
    });

    await Promise.all(promises);
    setBatchLoading(false);
    setSelectedAdIds([]);
    alert(`Batch operation completed: ${successCount} listings updated.${failCount > 0 ? ` Failures: ${failCount}` : ''}`);
  };

  const handleRenewAd = async (adId: string) => {
    setRenewingId(adId);
    try {
      const newExpirationDate = addDays(new Date(), 30);
      await updateDoc(doc(db, 'ads', adId), {
        status: 'approved',
        adStatus: 'active',
        expirationDate: newExpirationDate,
        updatedAt: serverTimestamp(),
        userNotified: true
      });
      clearHomeCache();
      
      const mockTimestamp = { toDate: () => newExpirationDate };
      
      setAds(prevAds => prevAds.map(ad => ad.id === adId ? { 
        ...ad, 
        status: 'approved', 
        adStatus: 'active',
        expirationDate: mockTimestamp 
      } as Ad : ad));
      
      alert('Listing successfully renewed for a further 30 days!');
    } catch (err) {
      console.error('Renew error:', err);
      handleFirestoreError(err, OperationType.UPDATE, `ads/${adId}`);
    } finally {
      setRenewingId(null);
    }
  };

  const handleMakeClaimable = async (adId: string) => {
    if (!adId) return;
    setClaimActionLoading(true);
    try {
      const adToUpdate = ads.find(a => a.id === adId) || (selectedAd?.id === adId ? selectedAd : null);
      if (!adToUpdate) return;

      const businessViews = adToUpdate.businessViews !== undefined ? adToUpdate.businessViews : 0;
      const invitationStatus = adToUpdate.invitationStatus !== undefined ? adToUpdate.invitationStatus : "not_sent";
      const invitationCount = adToUpdate.invitationCount !== undefined ? adToUpdate.invitationCount : 0;

      const updates = {
        isClaimableBusiness: true,
        claimStatus: 'unclaimed',
        businessViews,
        invitationStatus,
        invitationCount,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'ads', adId), updates);
      clearHomeCache();

      setAds(prevAds => prevAds.map(ad => ad.id === adId ? { ...ad, ...updates } as Ad : ad));
      setSelectedAd(prev => prev && prev.id === adId ? { ...prev, ...updates } as any : prev);

      alert('Listing successfully set as Claimable Business!');
    } catch (err) {
      console.error('Error making claimable:', err);
      alert('Error updating listing: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setClaimActionLoading(false);
    }
  };

  const handleRemoveClaimable = async (adId: string) => {
    if (!adId) return;
    setClaimActionLoading(true);
    try {
      const adToUpdate = ads.find(a => a.id === adId) || (selectedAd?.id === adId ? selectedAd : null);
      if (!adToUpdate) return;

      if (adToUpdate.claimStatus === 'claimed') {
        alert('Cannot remove claim status from an already approved and claimed business listing.');
        return;
      }

      const updates = {
        isClaimableBusiness: false,
        claimStatus: null,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'ads', adId), updates);
      clearHomeCache();

      setAds(prevAds => prevAds.map(ad => ad.id === adId ? { ...ad, ...updates } as Ad : ad));
      setSelectedAd(prev => prev && prev.id === adId ? { ...prev, ...updates } as any : prev);

      alert('Claim status removed successfully!');
    } catch (err) {
      console.error('Error removing claimable:', err);
      alert('Error updating listing: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setClaimActionLoading(false);
    }
  };

  const handleResendPaymentEmail = async (adId: string) => {
    setResendingEmailId(adId);
    try {
      if (!user) {
        throw new Error('Authentication required.');
      }

      const idToken = await user.getIdToken();

      const res = await fetch('/api/admin/resend-payment-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ adId })
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        alert(`Erro na resposta do servidor (HTTP ${res.status} ${res.statusText}). O servidor não retornou JSON válido.`);
        return;
      }

      if (res.ok && data.success) {
        alert(data.message || 'E-mail de confirmação de pagamento enviado com sucesso!');
        setAds(prev => prev.map(a => a.id === adId ? {
          ...a,
          paymentConfirmationEmailSent: true,
          paymentConfirmationEmailStatus: 'sent',
          paymentConfirmationEmailError: null
        } as any : a));
        if (selectedAd?.id === adId) {
          setSelectedAd(prev => prev ? {
            ...prev,
            paymentConfirmationEmailSent: true,
            paymentConfirmationEmailStatus: 'sent',
            paymentConfirmationEmailError: null
          } as any : null);
        }
      } else {
        const errorMsg = data.errorMessage || data.error || `HTTP ${res.status} - ${res.statusText}`;
        alert(`Falha no envio do e-mail (HTTP ${res.status}): ${errorMsg}`);
      }
    } catch (err: any) {
      console.error('Error resending payment email:', err);
      alert(`Erro de ligação ao servidor: ${err?.message || 'Indisponibilidade de rede ou servidor'}`);
    } finally {
      setResendingEmailId(null);
    }
  };

  const filteredAds = ads.filter(ad => {
    // 1. Status Filter
    const matchesFilter = adFilter === 'all' 
      ? true 
      : adFilter === 'hidden'
        ? ad.isHidden === true
        : adFilter === 'duplicates' 
          ? ad.isDuplicate === true 
          : adFilter === 'paid'
            ? isPaidAd(ad)
            : adFilter === 'awaiting_activation'
              ? (
                  isPaidAd(ad) &&
                  (ad as any).paymentFlow === 'admin_assisted' &&
                  (ad as any).awaitingAdminActivation === true
                )
              : (ad.status === adFilter || ad.adStatus === adFilter);

    // 2. Country Filter
    const adCountry = ad.country || 'Portugal';
    const matchesCountry = countryFilter === 'all'
      ? true
      : adCountry.toLowerCase() === countryFilter.toLowerCase();

    // 3. Listing Type Filter
    const isHireListing =
      (ad as any).listingIntent === 'hire' ||
      ad.category === 'Boats for Hire' ||
      ad.category === 'Aluguer de Barcos' ||
      ad.category === 'Boat Hire & Charters' ||
      (ad as any).listingType === 'hire' ||
      (ad as any).listingType === 'rent';

    const matchesListingType =
      listingTypeFilter === 'all'
        ? true
        : listingTypeFilter === 'hire'
          ? isHireListing
          : !isHireListing;

    // 4. Period Filter
    let matchesPeriod = true;
    if (periodFilter !== 'all') {
      const createDate = ad.createdAt?.toDate ? ad.createdAt.toDate() : (ad.createdAt ? new Date(ad.createdAt) : null);
      if (!createDate) {
        matchesPeriod = false;
      } else {
        const createTime = createDate.getTime();
        const nowTime = new Date().getTime();
        const diffDays = (nowTime - createTime) / (1000 * 60 * 60 * 24);
        if (periodFilter === 'today' && diffDays > 1) matchesPeriod = false;
        else if (periodFilter === '7days' && diffDays > 7) matchesPeriod = false;
        else if (periodFilter === '30days' && diffDays > 30) matchesPeriod = false;
      }
    }

    // 5. Global Search Term matching: title, description, seller, city, country, or ad ID
    let matchesSearch = true;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const title = (ad.title || '').toLowerCase();
      const description = (ad.description || '').toLowerCase();
      const seller = (ad.sellerName || '').toLowerCase();
      const city = (ad.city || '').toLowerCase();
      const country = (ad.country || '').toLowerCase();
      const id = (ad.id || '').toLowerCase();

      matchesSearch = title.includes(term) ||
                      description.includes(term) ||
                      seller.includes(term) ||
                      city.includes(term) ||
                      country.includes(term) ||
                      id.includes(term);
    }

    return matchesFilter && matchesCountry && matchesListingType && matchesPeriod && matchesSearch;
  });

  const totalPages = Math.ceil(filteredAds.length / pageSize) || 1;
  const pagedAds = filteredAds.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const stats = {
    total: ads.length,
    pending: ads.filter(a => a.status === 'pending').length,
    approved: ads.filter(a => a.status === 'approved' || a.adStatus === 'active').length,
    paid: ads.filter(a => isPaidAd(a)).length,
    awaitingActivation: ads.filter(
      a =>
        isPaidAd(a) &&
        (a as any).paymentFlow === 'admin_assisted' &&
        (a as any).awaitingAdminActivation === true
    ).length,
    expired: ads.filter(a => a.status === 'expired' || a.adStatus === 'expired').length,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Manage Listings</h1>
        <p className="text-slate-500 font-medium">Approve, reject or moderate platform listings.</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'bg-slate-100 text-slate-600' },
          { label: 'Pending', value: stats.pending, color: stats.pending > 0 ? 'animate-pending-highlight text-amber-950 border-amber-300' : 'bg-amber-50 text-amber-600' },
          { label: 'Approved', value: stats.approved, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Paid', value: stats.paid, color: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
          {
            label: 'Awaiting Activation',
            value: stats.awaitingActivation,
            color: stats.awaitingActivation > 0
              ? 'bg-cyan-100 text-cyan-900 border border-cyan-300'
              : 'bg-cyan-50 text-cyan-600'
          },
          { label: 'Expired', value: stats.expired, color: 'bg-red-50 text-red-600' },
        ].map((stat, idx) => (
          <div key={idx} className={`p-4 rounded-2xl border border-slate-100 shadow-sm transition-all ${stat.color}`}>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{stat.label}</p>
            <p className="text-2xl font-black mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Advanced Filters & Search Toolbar */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-4">
        {/* Top Controls: Search Bar & View Mode Toggle */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          {/* Expanded Global Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search by listing title, description, seller, city or ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // reset to page 1 on active search
              }}
              className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* View Mode Toggle Pill */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl self-start lg:self-auto gap-1">
            <button
              onClick={() => {
                setViewMode('cards');
                localStorage.setItem('admin_ads_view_mode', 'cards');
              }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid size={15} />
              <span>Cards</span>
            </button>
            <button
              onClick={() => {
                setViewMode('table');
                localStorage.setItem('admin_ads_view_mode', 'table');
              }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List size={15} />
              <span>Table</span>
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2 border-t border-slate-100">
          {/* Status Segmented Filter - 5 columns */}
          <div className="md:col-span-5 flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Filter by Status</label>
            <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {[
                { id: 'all', label: 'All' },
                { id: 'pending', label: 'Pending' },
                { id: 'duplicates', label: 'Duplicates⚠️' },
                { id: 'approved', label: 'Active' },
                { id: 'hidden', label: 'Standby / Ocultos 👁️‍🗨️' },
                { id: 'paid', label: 'Paid listings' },
                { id: 'awaiting_activation', label: `Awaiting Activation (${stats.awaitingActivation})` },
                { id: 'expired', label: 'Expired' },
                { id: 'rejected', label: 'Rejected' },
                { id: 'archived', label: 'Archived' }
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => {
                    setAdFilter(filter.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-all ${
                    adFilter === filter.id 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-100'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Country Select Filter - 2 columns */}
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Country</label>
            <select
              value={countryFilter}
              onChange={(e) => {
                setCountryFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-150 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-705 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="all">🌍 All Countries</option>
              <option value="Portugal">🇵🇹 Portugal</option>
              <option value="Reino Unido">🇬🇧 United Kingdom</option>
            </select>
          </div>

          {/* Listing Type Select Filter - 3 columns */}
          <div className="md:col-span-3 flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Listing Type</label>
            <select
              value={listingTypeFilter}
              onChange={(e) => {
                setListingTypeFilter(e.target.value as 'all' | 'sale' | 'hire');
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-150 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-705 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="all">⛵ All Listings</option>
              <option value="sale">🏷️ Boats for Sale</option>
              <option value="hire">🛥️ Boats for Hire</option>
            </select>
          </div>

          {/* Period Select Filter - 2 columns */}
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Creation Date</label>
            <select
              value={periodFilter}
              onChange={(e) => {
                setPeriodFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-150 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-705 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="all">📅 All Time</option>
              <option value="today">Today (last 24h)</option>
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
            </select>
          </div>
         </div>
        
        {/* Visible Columns Selector */}
        {viewMode === 'table' && (
          <div className="pt-3.5 border-t border-slate-100 space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Visible columns</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-2 bg-slate-50 p-3 rounded-xl border border-slate-150">
              {ALL_COLUMNS.map((col) => {
                const isMandatory = col.mandatory;
                const isChecked = isColVisible(col.id);
                return (
                  <label 
                    key={col.id} 
                    className={`flex items-center gap-2 text-xs font-semibold select-none transition-all ${
                      isMandatory 
                        ? 'text-indigo-600/70 cursor-not-allowed opacity-80' 
                        : isChecked 
                          ? 'text-slate-800 hover:text-indigo-600 cursor-pointer' 
                          : 'text-slate-400 hover:text-slate-600 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isMandatory}
                      onChange={() => {
                        if (isMandatory) return;
                        if (isChecked) {
                          setVisibleColumns(prev => prev.filter(id => id !== col.id));
                        } else {
                          setVisibleColumns(prev => [...prev, col.id]);
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 w-3.5 h-3.5 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span>
                      {col.label} 
                      {isMandatory && <span className="text-[8px] text-indigo-500 font-black tracking-wider uppercase ml-1">(Required)</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Info label about scope */}
        <div className="flex flex-wrap justify-between items-center gap-2 text-[10px] text-slate-400 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span>Searching locally in {ads.length} loaded listings.</span>
          <button 
            onClick={handleLoadMore}
            disabled={loading}
            className="text-indigo-600 hover:text-indigo-800 font-black uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>Fetch more listings from server (+100)</span>
          </button>
        </div>
      </div>

      {/* Batch Actions Bar */}
      <AnimatePresence>
        {selectedAdIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="overflow-hidden mb-4"
          >
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                  {selectedAdIds.length} {selectedAdIds.length === 1 ? 'listing selected' : 'listings selected'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleBatchToggleHide(true)}
                  disabled={batchLoading}
                  className="flex-1 sm:flex-initial h-9 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Colocar anúncios selecionados em Standby (Ocultar)"
                >
                  <EyeOff size={14} />
                  <span>Ocultar (Standby)</span>
                </button>
                <button
                  onClick={() => handleBatchToggleHide(false)}
                  disabled={batchLoading}
                  className="flex-1 sm:flex-initial h-9 px-4 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
                  title="Tornar anúncios selecionados visíveis no site"
                >
                  <Eye size={14} />
                  <span>Tornar Visíveis</span>
                </button>
                <button
                  onClick={() => handleBatchAction('approved')}
                  disabled={batchLoading}
                  className="flex-1 sm:flex-initial h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-100 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle size={14} />
                  <span>Approve Selected</span>
                </button>
                <button
                  onClick={() => handleBatchAction('rejected')}
                  disabled={batchLoading}
                  className="flex-1 sm:flex-initial h-9 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-red-100"
                >
                  <XCircle size={14} />
                  <span>Reject Selected</span>
                </button>
                <button
                  onClick={handleBatchDelete}
                  disabled={batchLoading}
                  className="flex-1 sm:flex-initial h-9 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-red-100"
                >
                  <Trash2 size={14} />
                  <span>Delete Selected</span>
                </button>
                <button
                  onClick={() => setSelectedAdIds([])}
                  disabled={batchLoading}
                  className="h-9 px-3.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="text-center py-20 text-slate-400 font-bold animate-pulse">Loading listings...</div>
      ) : filteredAds.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
          <AlertCircle className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500 font-bold">No listings found matching the selected filters.</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* --- VIEW MODE: CARDS --- */
        <div className="grid grid-cols-1 gap-4">
          {pagedAds.map((ad, idx) => (
            <motion.div
              key={`${ad.id}-${idx}`}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:border-indigo-200 transition-all flex flex-col"
            >
              {/* Card Header Info */}
              <div className="p-4 sm:p-5 flex gap-4 items-start relative">
                {/* Seleção Multipla Checkbox */}
                <div className="pt-2 sm:pt-4 self-center shrink-0">
                  <input 
                    type="checkbox"
                    checked={selectedAdIds.includes(ad.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAdIds(prev => [...prev, ad.id]);
                      } else {
                        setSelectedAdIds(prev => prev.filter(id => id !== ad.id));
                      }
                    }}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 w-4.5 h-4.5 cursor-pointer"
                  />
                </div>
                {/* Image Container */}
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center">
                  <OptimizedImage 
                    src={ad.imageUrl} 
                    alt={ad.title} 
                    className="w-full h-full object-cover" 
                    containerClassName="w-full h-full"
                  />
                  {ad.status === 'pending' && (
                    <div className="absolute top-1 left-1 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center border border-white animate-pulse z-10">
                      <Clock size={10} />
                    </div>
                  )}
                </div>

                {/* Primary Metadata */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1 bg-white">
                    <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded uppercase whitespace-nowrap tracking-wider ${
                      ad.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                      ad.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 
                      'bg-red-50 text-red-600 border border-red-100'
                    }`}>
                      {ad.status}
                    </span>
                    {ad.adStatus && ad.adStatus !== ad.status && !(ad.status === 'pending' && ad.adStatus === 'active') && (
                      <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded uppercase whitespace-nowrap tracking-wider ${
                        ad.adStatus === 'active' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 
                        ad.adStatus === 'expired' ? 'bg-red-50 text-red-600 border border-red-100' : 
                        'bg-amber-50 text-amber-600 border border-amber-100'
                      }`}>
                        {ad.adStatus}
                      </span>
                    )}
                    {ad.isHidden && (
                      <span className="inline-block text-[9px] font-black px-1.5 py-0.5 rounded uppercase whitespace-nowrap tracking-wider bg-amber-500 text-white shadow-xs">
                        🙈 Standby (Oculto)
                      </span>
                    )}
                    {/* Paid Status & Plan Badges */}
                    {(() => {
                      const pInfo = getAdPaymentClassification(ad);
                      if (pInfo.isPaid) {
                        return (
                          <span className="inline-block text-[9px] font-black px-1.5 py-0.5 rounded uppercase whitespace-nowrap tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200" title={`Paid on ${pInfo.formattedDate || 'N/A'}`}>
                            💳 Paid
                          </span>
                        );
                      }
                      if (pInfo.type === 'legacy_free') {
                        return (
                          <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded uppercase whitespace-nowrap tracking-wider bg-slate-100 text-slate-600 border border-slate-200" title="Legacy / Free Listing">
                            Legacy / Free Listing
                          </span>
                        );
                      }
                      return (
                        <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded uppercase whitespace-nowrap tracking-wider bg-slate-100 text-slate-500 border border-slate-200" title="Payment data unavailable">
                          Payment data unavailable
                        </span>
                      );
                    })()}

                    {(ad as any).paymentFlow === 'admin_assisted' && (ad as any).awaitingAdminActivation === true && isPaidAd(ad) && (
                      <span className="inline-block text-[9px] font-black px-1.5 py-0.5 rounded uppercase whitespace-nowrap tracking-wider bg-cyan-50 text-cyan-700 border border-cyan-200">
                        Paid / Awaiting Admin Activation
                      </span>
                    )}

                    <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded uppercase whitespace-nowrap tracking-wider border ${getAdPlanLabel(ad).color}`}>
                      Plan: {getAdPlanLabel(ad).label}
                    </span>

                    {ad.mediaBoostEnabled && (
                      <span className="inline-block text-[9px] font-black px-1.5 py-0.5 rounded uppercase whitespace-nowrap tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                        ⚡ Media Boost
                      </span>
                    )}

                    {ad.paymentConfirmationEmailStatus === 'sent' || ad.paymentConfirmationEmailSent ? (
                      <span className="inline-block text-[9px] font-black px-1.5 py-0.5 rounded uppercase whitespace-nowrap tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200" title="E-mail de recibo enviado ao anunciante">
                        ✉️ Email: Sent
                      </span>
                    ) : ad.paymentConfirmationEmailStatus === 'failed' ? (
                      <span className="inline-block text-[9px] font-black px-1.5 py-0.5 rounded uppercase whitespace-nowrap tracking-wider bg-red-50 text-red-700 border border-red-200" title={ad.paymentConfirmationEmailError || 'Falha ao enviar e-mail'}>
                        ✉️ Email: Failed
                      </span>
                    ) : (
                      <span className="inline-block text-[9px] font-black px-1.5 py-0.5 rounded uppercase whitespace-nowrap tracking-wider bg-slate-100 text-slate-600 border border-slate-200" title="E-mail de confirmação não enviado">
                        ✉️ Email: Not sent
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2 break-all mb-1.5" title={ad.title}>
                    {ad.title}
                  </h3>

                  {ad.isDuplicate && (
                    <div className="mb-2 bg-amber-50 text-amber-800 border border-amber-100 rounded-lg p-2 text-[10px] font-semibold flex items-start gap-1">
                      <AlertCircle size={12} className="shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <span>Suspected Duplicate: {ad.duplicateReason}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm sm:text-base font-black text-indigo-600">
                      {ad.category === '💚 Doações & Solidariedade' ? 'Free 💚' : formatPrice(ad.price, ad.country)}
                    </span>
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                      • Seller: <span className="text-slate-600 font-semibold">{ad.sellerName || 'ValtailAdmin'}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Meta Row (Dates & Clicks) */}
              <div className="px-4 pb-3 sm:px-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-medium text-slate-400 border-b border-dashed border-slate-100 bg-white">
                <div className="flex items-center gap-1" title="Creation Date">
                  <Clock size={13} className="text-indigo-400" />
                  <span>Created: {ad.createdAt?.toDate ? format(ad.createdAt.toDate(), 'dd MMM yyyy') : 'Recently'}</span>
                </div>
                <div className="flex items-center gap-1" title="Payment Date">
                  <CreditCard size={13} className="text-emerald-500" />
                  <span>Payment Date: {isPaidAd(ad) && (formatUKDate(ad.paidAt) || formatUKDate((ad as any).paymentCompletedAt)) ? <strong className="text-emerald-700">{formatUKDate(ad.paidAt) || formatUKDate((ad as any).paymentCompletedAt)}</strong> : <span className="text-slate-400 italic">Payment data unavailable</span>}</span>
                </div>
                {ad.expirationDate && (
                  <div className="flex items-center gap-1" title="Expiration Date">
                    <AlertCircle size={13} className="text-amber-400" />
                    <span>EXP: {ad.expirationDate.toDate ? format(ad.expirationDate.toDate(), 'dd MMM yyyy') : 'N/A'}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Eye size={13} className="text-slate-400" />
                  <span>{ad.views || 0} views</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare size={13} className="text-slate-400" />
                  <span>{ad.whatsappClicks || 0} clicks</span>
                </div>
              </div>

              {/* Card Actions Footer */}
              <div className="bg-slate-50/50 p-3 sm:px-5 sm:py-3.5 flex flex-wrap gap-2 items-center justify-between">
                {/* Secondary Navigation Tools */}
                <div className="flex flex-wrap gap-1.5 items-center">
                  <button
                    onClick={() => setSelectedAd(ad)}
                    className="h-9 px-3 flex items-center gap-1.5 text-indigo-600 bg-white hover:bg-indigo-50 border border-indigo-100 rounded-xl transition-all font-bold text-[11px]"
                    title="View Full Listing"
                  >
                    <Eye size={14} />
                    <span>View</span>
                  </button>

                  <button
                    onClick={() => navigate(`/edit-ad/${ad.id}`)}
                    className="h-9 px-3 flex items-center gap-1.5 text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all font-bold text-[11px]"
                    title="Edit Listing"
                  >
                    <Edit size={14} />
                    <span>Edit</span>
                  </button>

                  {/* Standby / Ocultar Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => handleToggleHideAd(ad.id, ad.isHidden)}
                    className={`h-9 px-3 flex items-center gap-2 rounded-xl border font-bold text-[11px] transition-all cursor-pointer ${
                      ad.isHidden
                        ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    title={ad.isHidden ? 'Anúncio em Standby (Oculto). Clique para Tornar Visível' : 'Anúncio Visível. Clique para Ocultar (Colocar em Standby)'}
                  >
                    <div className={`w-6 h-3.5 flex items-center rounded-full p-0.5 transition-colors ${
                      ad.isHidden ? 'bg-amber-600' : 'bg-slate-300'
                    }`}>
                      <div className={`w-2.5 h-2.5 bg-white rounded-full shadow-md transform transition-transform ${
                        ad.isHidden ? 'translate-x-2.5' : 'translate-x-0'
                      }`} />
                    </div>
                    <span>{ad.isHidden ? 'Standby' : 'Ocultar'}</span>
                  </button>

                  {ad.isClaimableBusiness ? (
                    ad.claimStatus === 'claimed' ? (
                      <span className="h-9 px-3 flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl font-bold text-[11px]" title="Verified Owner">
                        <ShieldCheck size={14} className="text-emerald-600" />
                        <span>Verified Owner</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleRemoveClaimable(ad.id)}
                        disabled={claimActionLoading}
                        className="h-9 px-3 flex items-center gap-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all font-bold text-[11px] disabled:opacity-50"
                        title="Remove Claim Status"
                      >
                        <ShieldAlert size={14} />
                        <span>Remove Claim</span>
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => handleMakeClaimable(ad.id)}
                      disabled={claimActionLoading}
                      className="h-9 px-3 flex items-center gap-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition-all font-bold text-[11px] disabled:opacity-50"
                      title="Make Claimable Business"
                    >
                      <ShieldCheck size={14} />
                      <span>Make Claimable</span>
                    </button>
                  )}
                </div>

                {!isPaidAd(ad) && ad.status === 'pending' && (
                  <button
                    onClick={() => openAssistedPayment(ad)}
                    className="h-9 px-3.5 flex items-center gap-1.5 text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-xl transition-all font-bold text-[11px]"
                    title="Generate assisted Stripe payment link and QR code"
                  >
                    <CreditCard size={14} />
                    <span>Payment QR</span>
                  </button>
                )}

                {/* Moderation / State Controls */}
                <div className="flex gap-1.5 items-center ml-auto">
                  {(ad.status === 'expired' || ad.adStatus === 'expired') && (
                    <button
                      onClick={() => {
                        if (window.confirm('Reactivate this listing for a further 30 days?')) {
                          handleRenewAd(ad.id);
                        }
                      }}
                      disabled={renewingId === ad.id}
                      className={`h-9 px-3.5 flex items-center gap-1.5 rounded-xl transition-all font-bold text-[11px] ${
                        renewingId === ad.id 
                          ? 'bg-slate-100 text-slate-400' 
                          : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-100'
                      }`}
                    >
                      {renewingId === ad.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-white rounded-full animate-spin" />
                      ) : (
                        <RefreshCcw size={13} />
                      )}
                      <span>Reactivate</span>
                    </button>
                  )}

                  {ad.status === 'approved' && !ad.adStatus?.includes('expired') && (
                    <div className="flex gap-1.5 items-center">
                      <button
                        onClick={() => {
                          if (window.confirm('Renew this listing for a further 30 days?')) {
                            handleRenewAd(ad.id);
                          }
                        }}
                        disabled={renewingId === ad.id}
                        className={`h-9 px-3.5 flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl transition-all font-bold text-[11px] ${
                          renewingId === ad.id ? 'opacity-50' : ''
                        }`}
                        title="Renew listing for 30 days"
                      >
                        {renewingId === ad.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin" />
                        ) : (
                          <RefreshCcw size={13} />
                        )}
                        <span>Renew</span>
                      </button>

                      <button
                        onClick={() => handleAdAction(ad.id, 'archived')}
                        className="h-9 px-3 flex items-center gap-1.5 text-slate-500 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all font-bold text-[11px]"
                      >
                        <Archive size={14} />
                        <span>Archive</span>
                      </button>
                    </div>
                  )}

                  {ad.status === 'pending' && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleAdAction(ad.id, 'approved')}
                        className="h-9 px-3.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl transition-all font-bold flex items-center gap-1.5 text-[11px] shadow-sm shadow-emerald-100"
                      >
                        <CheckCircle size={14} />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleAdAction(ad.id, 'rejected')}
                        className="h-9 px-3.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-all font-bold flex items-center gap-1.5 text-[11px]"
                      >
                        <XCircle size={14} />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => handleDeleteAd(ad.id)}
                    className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-100 rounded-xl transition-all shrink-0 animate-none"
                    title="Permanently delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* --- VIEW MODE: TABLE --- */
        <div className="space-y-4">
          {/* Desktop/Tablet Table layout */}
          <div className="hidden md:block overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-left border-collapse transition-all" style={{ minWidth: `${Math.max(600, visibleColumns.length * 90)}px` }}>
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                  <th className="py-3 px-4 w-10 text-center">
                    <input 
                      type="checkbox"
                      checked={pagedAds.length > 0 && pagedAds.every(ad => selectedAdIds.includes(ad.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newSelected = Array.from(new Set([...selectedAdIds, ...pagedAds.map(ad => ad.id)]));
                          setSelectedAdIds(newSelected);
                        } else {
                          setSelectedAdIds(selectedAdIds.filter(id => !pagedAds.map(a => a.id).includes(id)));
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-650 focus:ring-indigo-500/20 w-4 h-4 cursor-pointer"
                    />
                  </th>
                  {isColVisible('foto') && <th className="py-3 px-4 w-16 text-center">Photo</th>}
                  {isColVisible('titulo') && <th className="py-3 px-4">Listing</th>}
                  {isColVisible('pais') && <th className="py-3 px-4 text-center">Country</th>}
                  {isColVisible('cidade') && <th className="py-3 px-4">City / Location</th>}
                  {isColVisible('preco') && <th className="py-3 px-4">Price</th>}
                  {isColVisible('status') && <th className="py-3 px-4 text-center">Status</th>}
                  {isColVisible('pagamento') && <th className="py-3 px-4 text-center">Payment</th>}
                  {isColVisible('vendedor') && <th className="py-3 px-4">Seller</th>}
                  {isColVisible('criacao') && <th className="py-3 px-4">Created</th>}
                  {isColVisible('expiracao') && <th className="py-3 px-4">Expiry</th>}
                  {isColVisible('vistas') && <th className="py-3 px-4 text-center">Views</th>}
                  {isColVisible('cliques') && <th className="py-3 px-4 text-center">Clicks</th>}
                  {isColVisible('acoes') && <th className="py-3 px-4 text-right pr-6">Quick Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedAds.map((ad, idx) => {
                  const adCountryIcon = ad.country === 'Reino Unido' ? '🇬🇧' : '🇵🇹';
                  return (
                    <tr key={`${ad.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors text-xs">
                      <td className="py-3 px-4 border-none text-center">
                        <input 
                          type="checkbox"
                          checked={selectedAdIds.includes(ad.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAdIds(prev => [...prev, ad.id]);
                            } else {
                              setSelectedAdIds(prev => prev.filter(id => id !== ad.id));
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 w-4 h-4 cursor-pointer"
                        />
                      </td>
                      {/* Photo column */}
                      {isColVisible('foto') && (
                        <td className="py-3 px-4 border-none text-center">
                          <div 
                            className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center cursor-pointer mx-auto relative group shadow-inner"
                            onClick={() => setSelectedAd(ad)}
                          >
                            <img 
                              src={ad.imageUrl} 
                              alt={ad.title} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-all" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        </td>
                      )}

                      {/* Title column */}
                      {isColVisible('titulo') && (
                        <td className="py-3 px-4 border-none font-medium">
                          <div className="max-w-[200px]">
                            <div className="flex items-center gap-1.5 flex-wrap max-w-full">
                              <div 
                                className="font-bold text-slate-900 truncate hover:text-indigo-600 transition-colors cursor-pointer"
                                onClick={() => setSelectedAd(ad)}
                                title={ad.title}
                              >
                                {ad.title}
                              </div>
                              {ad.isDuplicate && (
                                <span className="bg-amber-100 text-amber-800 text-[8px] font-black uppercase tracking-wider px-1 rounded inline-block whitespace-nowrap shrink-0" title={ad.duplicateReason}>
                                  Duplicate⚠️
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] text-slate-400 font-semibold uppercase mt-0.5 tracking-wider">{ad.category}</div>
                            <div className="text-[8px] text-slate-300 font-mono mt-0.5">ID: {ad.id}</div>
                          </div>
                        </td>
                      )}

                      {/* Country Column */}
                      {isColVisible('pais') && (
                        <td className="py-3 px-4 border-none text-center font-bold">
                          <span className="text-base" title={ad.country || 'Portugal'}>{adCountryIcon}</span>
                        </td>
                      )}

                      {/* City Column */}
                      {isColVisible('cidade') && (
                        <td className="py-3 px-4 border-none text-slate-700 font-semibold">
                          {ad.city || 'N/A'}
                        </td>
                      )}

                      {/* Price Column */}
                      {isColVisible('preco') && (
                        <td className="py-3 px-4 border-none text-indigo-650 font-black whitespace-nowrap">
                          {ad.category === '💚 Doações & Solidariedade' ? 'Free 💚' : formatPrice(ad.price, ad.country)}
                        </td>
                      )}

                      {/* Status Column */}
                      {isColVisible('status') && (
                        <td className="py-3 px-4 border-none text-center">
                          <div className="flex flex-col gap-0.5 items-center">
                            <span className={`inline-block text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider min-w-[70px] text-center ${
                              ad.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                              ad.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse' : 
                              'bg-red-50 text-red-650 border border-red-100'
                            }`}>
                              {ad.status}
                            </span>
                            {ad.adStatus && ad.adStatus !== ad.status && !(ad.status === 'pending' && ad.adStatus === 'active') && (
                              <span className={`inline-block text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider min-w-[70px] text-center ${
                                ad.adStatus === 'active' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 
                                ad.adStatus === 'expired' ? 'bg-red-50 text-red-650 border border-red-150' : 
                                'bg-amber-50 text-amber-600 border border-amber-100'
                              }`}>
                                {ad.adStatus}
                              </span>
                            )}
                            {ad.isHidden && (
                              <span className="inline-block text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider min-w-[70px] text-center bg-amber-500 text-white border border-amber-600 mt-0.5" title="Anúncio em Standby (Oculto)">
                                🙈 Standby
                              </span>
                            )}
                            {isPaidAd(ad) && !isColVisible('pagamento') && (
                              <span className="inline-block text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider min-w-[70px] text-center bg-emerald-100 text-emerald-800 border border-emerald-200 mt-0.5">
                                💳 Paid ({getAdPlanLabel(ad).label})
                              </span>
                            )}
                            {ad.paymentConfirmationEmailStatus === 'sent' || ad.paymentConfirmationEmailSent ? (
                              <span className="inline-block text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider min-w-[70px] text-center bg-emerald-50 text-emerald-700 border border-emerald-200 mt-0.5" title="E-mail de recibo enviado">
                                ✉️ Sent
                              </span>
                            ) : ad.paymentConfirmationEmailStatus === 'failed' ? (
                              <span className="inline-block text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider min-w-[70px] text-center bg-red-50 text-red-700 border border-red-200 mt-0.5" title={ad.paymentConfirmationEmailError || 'Falha no e-mail'}>
                                ✉️ Failed
                              </span>
                            ) : (
                              <span className="inline-block text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider min-w-[70px] text-center bg-slate-100 text-slate-600 border border-slate-200 mt-0.5" title="E-mail não enviado">
                                ✉️ Not sent
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Payment Column */}
                      {isColVisible('pagamento') && (
                        <td className="py-3 px-4 border-none text-center">
                          <div className="flex flex-col gap-1 items-center">
                            {(() => {
                              const pInfo = getAdPaymentClassification(ad);
                              if (pInfo.isPaid) {
                                return (
                                  <span className="inline-block text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    💳 Paid
                                  </span>
                                );
                              }
                              if (pInfo.type === 'legacy_free') {
                                return (
                                  <span className="inline-block text-[8px] font-semibold px-1 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                    Legacy / Free
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-block text-[8px] font-semibold px-1 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200" title="Payment data unavailable">
                                  Data N/A
                                </span>
                              );
                            })()}
                            <span className={`inline-block text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border ${getAdPlanLabel(ad).color}`}>
                              {getAdPlanLabel(ad).label}
                            </span>
                            <span className="text-[9px] text-slate-500 font-bold whitespace-nowrap">
                              {isPaidAd(ad) && formatUKDate(ad.paidAt) ? formatUKDate(ad.paidAt) : <span className="text-slate-300 italic font-normal">N/A</span>}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* Seller Column */}
                      {isColVisible('vendedor') && (
                        <td className="py-3 px-4 border-none">
                          <div>
                            <div className="font-bold text-slate-800">{ad.sellerName || 'ValtailAdmin'}</div>
                            <div className="text-[9px] text-slate-400 font-mono" title={ad.sellerId}>ID: {ad.sellerId ? `${ad.sellerId.substring(0, 6)}...` : 'N/A'}</div>
                          </div>
                        </td>
                      )}

                      {/* Creation Date */}
                      {isColVisible('criacao') && (
                        <td className="py-3 px-4 border-none text-slate-500 whitespace-nowrap">
                          {ad.createdAt?.toDate ? format(ad.createdAt.toDate(), 'dd MMM yyyy') : 'Recently'}
                        </td>
                      )}

                      {/* Expiration Date */}
                      {isColVisible('expiracao') && (
                        <td className="py-3 px-4 border-none text-slate-500 whitespace-nowrap">
                          {ad.expirationDate?.toDate ? format(ad.expirationDate.toDate(), 'dd MMM yyyy') : 'N/A'}
                        </td>
                      )}

                      {/* Views Column */}
                      {isColVisible('vistas') && (
                        <td className="py-3 px-4 border-none text-center font-bold text-slate-700">
                          {ad.views || 0}
                        </td>
                      )}

                      {/* Clicks Column */}
                      {isColVisible('cliques') && (
                        <td className="py-3 px-4 border-none text-center font-bold text-slate-705">
                          {ad.whatsappClicks || 0}
                        </td>
                      )}

                      {/* Actions Column */}
                      {isColVisible('acoes') && (
                        <td className="py-3 px-4 border-none text-right pr-6">
                          <div className="flex gap-1 items-center justify-end">
                            {/* View */}
                            <button
                              onClick={() => setSelectedAd(ad)}
                              className="p-1 px-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-150 border border-indigo-100 rounded-lg transition-all text-[10px] font-bold"
                              title="View Details"
                            >
                              View
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => navigate(`/edit-ad/${ad.id}`)}
                              className="p-1 px-2 text-slate-600 bg-slate-50 hover:bg-slate-150 border border-slate-200 rounded-lg transition-all text-[10px] font-bold"
                              title="Edit"
                            >
                              Edit
                            </button>

                            {/* Standby / Ocultar Toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleHideAd(ad.id, ad.isHidden)}
                              className={`p-1 px-2 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                                ad.isHidden
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                              title={ad.isHidden ? 'Standby (Oculto) - Clique para tornar visível' : 'Visível - Clique para ocultar (Standby)'}
                            >
                              <div className={`w-5 h-3 flex items-center rounded-full p-0.5 transition-colors ${ad.isHidden ? 'bg-amber-600' : 'bg-slate-300'}`}>
                                <div className={`w-2 h-2 bg-white rounded-full shadow-md transform transition-transform ${ad.isHidden ? 'translate-x-2' : 'translate-x-0'}`} />
                              </div>
                              <span>{ad.isHidden ? 'Standby' : 'Ocultar'}</span>
                            </button>

                            {/* Claim Controls */}
                            {ad.isClaimableBusiness ? (
                              ad.claimStatus === 'claimed' ? (
                                <span className="p-1 px-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] font-bold flex items-center gap-1" title="Verified Owner">
                                  <ShieldCheck size={12} className="text-emerald-600" />
                                  <span>Verified Owner</span>
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleRemoveClaimable(ad.id)}
                                  disabled={claimActionLoading}
                                  className="p-1 px-2 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"
                                  title="Remove Claim Status"
                                >
                                  <ShieldAlert size={12} />
                                  <span>Remove Claim</span>
                                </button>
                              )
                            ) : (
                              <button
                                onClick={() => handleMakeClaimable(ad.id)}
                                disabled={claimActionLoading}
                                className="p-1 px-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg transition-all text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"
                                title="Make Claimable Business"
                              >
                                <ShieldCheck size={12} />
                                <span>Make Claimable</span>
                              </button>
                            )}

                            {!isPaidAd(ad) && ad.status === 'pending' && (
                              <button
                                onClick={() => openAssistedPayment(ad)}
                                className="p-1 px-2 text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg transition-all text-[10px] font-bold flex items-center gap-1"
                                title="Generate Payment QR"
                              >
                                <CreditCard size={12} />
                                <span>Payment QR</span>
                              </button>
                            )}

                            {/* Approve/Reject */}
                            {ad.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleAdAction(ad.id, 'approved')}
                                  className="p-1 text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-all"
                                  title="Approve"
                                >
                                  <CheckCircle size={14} />
                                </button>
                                <button
                                  onClick={() => handleAdAction(ad.id, 'rejected')}
                                  className="p-1 text-red-650 bg-red-50 hover:bg-red-200 rounded-lg transition-all"
                                  title="Reject"
                                >
                                  <XCircle size={14} />
                                </button>
                              </>
                            )}

                            {/* Reactivate / Renew */}
                            {(ad.status === 'expired' || ad.adStatus === 'expired') && (
                              <button
                                onClick={() => {
                                  if (window.confirm('Reactivate this listing for a further 30 days?')) {
                                    handleRenewAd(ad.id);
                                  }
                                }}
                                disabled={renewingId === ad.id}
                                className="p-1 px-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg transition-all text-[10px] font-extrabold"
                              >
                                Reactivate
                              </button>
                            )}

                            {/* Renew (Active approved ads) */}
                            {ad.status === 'approved' && !ad.adStatus?.includes('expired') && (
                              <button
                                onClick={() => {
                                  if (window.confirm('Renew this listing for a further 30 days?')) {
                                    handleRenewAd(ad.id);
                                  }
                                }}
                                disabled={renewingId === ad.id}
                                className="p-1 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all"
                                title="Renew (+30 days)"
                              >
                                <RefreshCcw size={13} className={renewingId === ad.id ? 'animate-spin' : ''} />
                              </button>
                            )}

                            {/* Archive */}
                            {ad.status === 'approved' && !ad.adStatus?.includes('expired') && (
                              <button
                                onClick={() => handleAdAction(ad.id, 'archived')}
                                className="p-1 text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all"
                                title="Archive"
                              >
                                <Archive size={13} />
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteAd(ad.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-100 rounded-lg transition-all"
                              title="Permanently delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile representation under TabelaMode */}
          <div className="block md:hidden bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {pagedAds.map((ad, idx) => {
              const countryIcon = ad.country === 'Reino Unido' ? '🇬🇧' : '🇵🇹';
              return (
                <div key={`${ad.id}-${idx}`} className="py-3 flex gap-3.5 items-center">
                  <input 
                    type="checkbox"
                    checked={selectedAdIds.includes(ad.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAdIds(prev => [...prev, ad.id]);
                      } else {
                        setSelectedAdIds(prev => prev.filter(id => id !== ad.id));
                      }
                    }}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 w-4 h-4 cursor-pointer shrink-0"
                  />
                  <img 
                    src={ad.imageUrl} 
                    alt={ad.title} 
                    className="w-12 h-12 object-cover rounded-lg bg-slate-50 border border-slate-200 shrink-0 cursor-pointer" 
                    onClick={() => setSelectedAd(ad)}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 
                      className="font-bold text-slate-900 text-xs truncate hover:text-indigo-600 cursor-pointer"
                      onClick={() => setSelectedAd(ad)}
                    >
                      {ad.title}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {countryIcon} {ad.city} • <span className="font-extrabold text-indigo-600">{ad.category === '💚 Doações & Solidariedade' ? 'Free 💚' : formatPrice(ad.price, ad.country)}</span>
                    </p>
                    <div className="flex gap-1 mt-1">
                      <span className={`inline-block text-[8px] font-black px-1.5 py-0.2 rounded uppercase ${
                        ad.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 
                        ad.status === 'pending' ? 'bg-amber-50 text-amber-600 animate-pulse' : 
                        'bg-red-50 text-red-650'
                      }`}>
                        {ad.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 items-center shrink-0">
                    <button
                      onClick={() => setSelectedAd(ad)}
                      className="p-1 px-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 transition-colors text-[9px] font-extrabold rounded-md"
                    >
                      View
                    </button>
                    <button
                      onClick={() => navigate(`/edit-ad/${ad.id}`)}
                      className="p-1 px-1.5 bg-slate-50 text-slate-600 border border-slate-200 transition-colors text-[9px] font-bold rounded-md"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination & Load More Controls Row */}
      {filteredAds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 bg-none">
          {/* Page Info */}
          <p className="text-xs text-slate-500 font-bold">
            Showing <span className="text-slate-800">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="text-slate-800">
              {Math.min(currentPage * pageSize, filteredAds.length)}
            </span>{' '}
            of <span className="text-slate-800">{filteredAds.length}</span> filtered results ({ads.length} loaded)
          </p>

          {/* Pagination Controls */}
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3.5 py-1.5 bg-white border border-slate-200 text-xs font-bold rounded-xl text-slate-600 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 transition-all cursor-pointer"
            >
              Previous
            </button>
            <span className="px-3.5 py-1.5 bg-slate-50 text-xs font-bold rounded-xl text-slate-700 border border-slate-150">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3.5 py-1.5 bg-white border border-slate-200 text-xs font-bold rounded-xl text-slate-600 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 transition-all cursor-pointer"
            >
              Next
            </button>
          </div>

          {/* Database Load More Button */}
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="flex items-center gap-2 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:text-indigo-700 text-slate-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-indigo-700 border-t-transparent rounded-full animate-spin" />
            ) : (
              <RefreshCcw size={14} className="text-indigo-650" />
            )}
            <span>Load More from Database</span>
          </button>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedAd && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div>
                  <h2 className="text-xl font-black text-slate-900 truncate max-w-[280px] sm:max-w-[450px]" title={selectedAd.title}>
                    {selectedAd.title}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Listing ID: <span className="font-mono">{selectedAd.id}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedAd(null)}
                  className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                {/* Image Gallery */}
                <div className="space-y-3">
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center">
                    <OptimizedImage
                      src={selectedAd.imageUrl}
                      alt={selectedAd.title}
                      className="max-h-[300px] w-full object-contain"
                    />
                  </div>
                  {selectedAd.images && selectedAd.images.length > 1 && (
                    <div className="grid grid-cols-4 gap-2">
                      {selectedAd.images.map((img, i) => (
                        <div key={i} className="aspect-video bg-slate-50 rounded-xl overflow-hidden border border-slate-100 flex items-center justify-center">
                          <img
                            src={img}
                            alt={`Image ${i + 1}`}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Image Framing Adjustment */}
                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-4">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 pb-2 border-b border-slate-200">
                    <ImageIcon size={14} className="text-indigo-500" />
                    Image Framing (Admin Adjustment)
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    {/* Live Preview Box */}
                    <div className="flex flex-col items-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Live Preview (Card/Cover)</p>
                      <div className="w-28 h-28 bg-slate-200 rounded-xl overflow-hidden border border-slate-300 relative shadow-inner">
                        <img 
                          src={selectedAd.imageUrl} 
                          alt="Framing preview" 
                          className="w-full h-full object-cover transition-all duration-75"
                          style={{
                            objectPosition: `${adminImagePositionX}% ${adminImagePositionY}%`,
                            transform: `scale(${adminImageZoom}) translate(${
                              adminImageZoom > 1
                                ? (adminImagePositionX - 50) * (adminImageZoom - 1) / adminImageZoom
                                : 0
                            }%, ${
                              adminImageZoom > 1
                                ? (adminImagePositionY - 50) * (adminImageZoom - 1) / adminImageZoom
                                : 0
                            }%)`
                          }}
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>

                    {/* Sliders and Action Buttons */}
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-0.5">
                          <span>Horizontal</span>
                          <span className="font-mono text-indigo-600">{adminImagePositionX}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={adminImagePositionX}
                          onChange={(e) => setAdminImagePositionX(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-ew-resize accent-indigo-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-0.5">
                          <span>Vertical</span>
                          <span className="font-mono text-indigo-600">{adminImagePositionY}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={adminImagePositionY}
                          onChange={(e) => setAdminImagePositionY(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-ns-resize accent-indigo-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-0.5">
                          <span>Zoom</span>
                          <span className="font-mono text-indigo-600">{adminImageZoom.toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="1.8"
                          step="0.05"
                          value={adminImageZoom}
                          onChange={(e) => setAdminImageZoom(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-zoom-in accent-indigo-600 focus:outline-none"
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setAdminImagePositionX(50);
                            setAdminImagePositionY(50);
                          }}
                          className="flex-1 py-1.5 px-2 bg-indigo-50 border border-indigo-100/70 hover:bg-indigo-100/60 text-[10px] font-bold text-indigo-600 rounded-lg transition-colors cursor-pointer text-center"
                        >
                          Center
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAdminImagePositionX(50);
                            setAdminImagePositionY(50);
                            setAdminImageZoom(1);
                          }}
                          className="flex-1 py-1.5 px-2 bg-slate-100 border border-slate-200 hover:bg-slate-200/60 text-[10px] font-bold text-slate-600 rounded-lg transition-colors cursor-pointer text-center"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1 bg-none">
                    <button
                      type="button"
                      disabled={savingPosition || savedPositionSuccess}
                      onClick={handleSaveEnquadramento}
                      className={`w-full font-black text-xs py-2 px-3 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 ${
                        savedPositionSuccess 
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100' 
                          : 'bg-slate-900 hover:bg-indigo-600 text-white'
                      }`}
                    >
                      {savingPosition ? 'Saving...' : savedPositionSuccess ? '✓ Saved Successfully!' : 'Save Framing'}
                    </button>
                  </div>
                </div>

                {/* Badges Info */}
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-block text-xs font-black px-3 py-1.5 rounded-lg uppercase whitespace-nowrap ${
                    selectedAd.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 
                    selectedAd.status === 'pending' ? 'bg-amber-50 text-amber-600' : 
                    'bg-red-50 text-red-600'
                  }`}>
                    Status: {selectedAd.status}
                  </span>
                  {selectedAd.adStatus && selectedAd.adStatus !== selectedAd.status && !(selectedAd.status === 'pending' && selectedAd.adStatus === 'active') && (
                    <span className="inline-block text-xs font-black px-3 py-1.5 rounded-lg uppercase whitespace-nowrap bg-indigo-50 text-indigo-600 font-sans">
                      Cycle: {selectedAd.adStatus}
                    </span>
                  )}
                  {selectedAd.isHidden && (
                    <span className="inline-block text-xs font-black px-3 py-1.5 rounded-lg uppercase whitespace-nowrap bg-amber-500 text-white font-sans shadow-xs">
                      🙈 Standby (Oculto)
                    </span>
                  )}
                  {selectedAd.plan && (
                    <span className="inline-block text-xs font-black px-3 py-1.5 rounded-lg uppercase whitespace-nowrap bg-purple-50 text-purple-600 font-sans">
                      Plan: {selectedAd.plan}
                    </span>
                  )}
                  {/* Payment Email Status Badge */}
                  {selectedAd.paymentConfirmationEmailStatus === 'sent' || selectedAd.paymentConfirmationEmailSent ? (
                    <span className="inline-block text-xs font-black px-3 py-1.5 rounded-lg uppercase whitespace-nowrap bg-emerald-50 text-emerald-700 border border-emerald-200" title="E-mail de recibo enviado ao anunciante">
                      ✉️ Email: Sent
                    </span>
                  ) : selectedAd.paymentConfirmationEmailStatus === 'failed' ? (
                    <span className="inline-block text-xs font-black px-3 py-1.5 rounded-lg uppercase whitespace-nowrap bg-red-50 text-red-700 border border-red-200" title={selectedAd.paymentConfirmationEmailError || 'Falha ao enviar e-mail'}>
                      ✉️ Email: Failed
                    </span>
                  ) : (
                    <span className="inline-block text-xs font-black px-3 py-1.5 rounded-lg uppercase whitespace-nowrap bg-slate-100 text-slate-600 border border-slate-200">
                      ✉️ Email: Not sent
                    </span>
                  )}
                </div>

                {/* Primary Details Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
                    <p className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">Price</p>
                    <p className="text-2xl font-black text-slate-950 mt-1">
                      {selectedAd.category === '💚 Doações & Solidariedade' ? 'Free 💚' : formatPrice(selectedAd.price, selectedAd.country)}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Location & Category</p>
                    <div className="space-y-1.5 mt-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <MapPin size={14} className="text-red-500 shrink-0" />
                        <span>{selectedAd.country === 'Reino Unido' ? '🇬🇧' : '🇵🇹'} {selectedAd.city}, {selectedAd.country || 'Portugal'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <Tag size={14} className="text-indigo-500 shrink-0" />
                        <span>{selectedAd.category}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Information Card */}
                <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard size={15} className="text-emerald-600" />
                      <span>Payment & Plan Information</span>
                    </h4>
                    {(() => {
                      const pInfo = getAdPaymentClassification(selectedAd);
                      if (pInfo.isPaid) {
                        return (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-md border border-emerald-200">
                            💳 Paid
                          </span>
                        );
                      }
                      if (pInfo.type === 'legacy_free') {
                        return (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase rounded-md border border-slate-200">
                            Legacy / Free Listing
                          </span>
                        );
                      }
                      return (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-semibold uppercase rounded-md border border-slate-200">
                          Payment data unavailable
                        </span>
                      );
                    })()}
                    {(selectedAd as any).paymentFlow === 'admin_assisted' && (selectedAd as any).awaitingAdminActivation === true && isPaidAd(selectedAd) && (
                      <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 text-[10px] font-black uppercase rounded-md border border-cyan-200">
                        Awaiting Admin Activation
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-slate-500 font-medium">Acquired Plan:</span>{' '}
                      <span className="font-bold text-slate-900">{getAdPlanLabel(selectedAd).label}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Payment Date (UK):</span>{' '}
                      <span className="font-bold text-slate-900">
                        {isPaidAd(selectedAd) && (formatUKDateTime(selectedAd.paidAt) || formatUKDate(selectedAd.paidAt)) ? (
                          formatUKDateTime(selectedAd.paidAt) || formatUKDate(selectedAd.paidAt)
                        ) : (
                          <span className="text-slate-400 italic font-normal">Payment data unavailable</span>
                        )}
                      </span>
                    </div>
                    {selectedAd.stripeCheckoutSessionId && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-500 font-medium">Stripe Session ID:</span>{' '}
                        <span className="font-mono text-[11px] text-slate-800 bg-emerald-100/50 px-1.5 py-0.5 rounded select-all break-all">
                          {selectedAd.stripeCheckoutSessionId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedAd.isDuplicate && (
                  <div className="bg-amber-50 text-amber-900 border-2 border-amber-200 rounded-2xl p-4 text-xs font-semibold space-y-2">
                    <div className="flex items-center justify-between font-bold text-amber-800">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle size={16} className="text-amber-600 shrink-0" />
                        <span>
                          {selectedAd.duplicateLevel === 'confirmed' ? 'EXACT DUPLICATE LISTING ALERT' : 'POSSIBLE DUPLICATE ALERT'}
                        </span>
                      </div>
                      {selectedAd.duplicateScore !== undefined && (
                        <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full text-[10px] font-black">
                          {selectedAd.duplicateScore}% Confidence
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 leading-relaxed font-medium">
                      The system identified similarity with an existing listing from the seller.
                    </p>
                    <p className="text-slate-900 font-black bg-amber-100/50 p-2.5 rounded-xl select-text">
                      Reason: {selectedAd.duplicateReason}
                    </p>
                    {selectedAd.duplicateMatchedFields && selectedAd.duplicateMatchedFields.length > 0 && (
                      <div className="flex flex-wrap gap-1 items-center pt-1">
                        <span className="text-[10px] text-slate-500 font-bold uppercase mr-1">Matched Fields:</span>
                        {selectedAd.duplicateMatchedFields.map(f => (
                          <span key={f} className="px-2 py-0.5 bg-amber-200/60 text-amber-900 text-[10px] font-extrabold rounded-md uppercase">
                            {f.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                    {selectedAd.duplicateUserChoice && (
                      <div className="text-[11px] font-bold text-indigo-700 bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                        User Decision: {selectedAd.duplicateUserChoice === 'continued_different_boat' ? 'User confirmed this is a different boat and proceeded' : selectedAd.duplicateUserChoice}
                      </div>
                    )}
                  </div>
                )}

                {/* Description */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Full Description</h4>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm text-slate-700 font-medium whitespace-pre-wrap break-words overflow-hidden leading-relaxed">
                    {selectedAd.description || 'No description provided.'}
                  </div>
                </div>

                {/* Seller / Account Info */}
                <div className="p-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                        <UserRound size={15} />
                        Seller / Account Information
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium mt-1">Private support information visible in the Admin panel only.</p>
                    </div>
                    {selectedAd.sellerId && (
                      <button
                        type="button"
                        onClick={() => {
                          const sellerId = selectedAd.sellerId.trim();
                          setSelectedAd(null);
                          navigate(`/admin/users?seller=${encodeURIComponent(sellerId)}`);
                        }}
                        className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <ExternalLink size={14} />
                        Open User Profile
                      </button>
                    )}
                  </div>

                  {sellerProfileLoading ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 py-2">
                      <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-700 rounded-full animate-spin" />
                      Loading account details...
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="bg-white rounded-xl border border-indigo-100 p-3">
                          <span className="text-[10px] font-black uppercase text-slate-400">Name</span>
                          <p className="text-slate-900 font-bold mt-1">{sellerProfile?.name || selectedAd.sellerName || 'Not available'}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-indigo-100 p-3">
                          <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Mail size={11} /> Email</span>
                          <p className="text-slate-900 font-bold mt-1 break-all select-all">{sellerProfile?.email || selectedAd.contactEmail || 'Not available'}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-indigo-100 p-3">
                          <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Phone size={11} /> Phone / WhatsApp</span>
                          <p className="text-slate-900 font-bold mt-1 select-all">{sellerProfile?.phone || selectedAd.sellerPhone || 'Not available'}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-indigo-100 p-3">
                          <span className="text-[10px] font-black uppercase text-slate-400">Location</span>
                          <p className="text-slate-900 font-bold mt-1">
                            {[sellerProfile?.city, sellerProfile?.country].filter(Boolean).join(', ') || selectedAd.city || 'Not available'}
                          </p>
                        </div>
                        <div className="bg-white rounded-xl border border-indigo-100 p-3">
                          <span className="text-[10px] font-black uppercase text-slate-400">Account role</span>
                          <p className="text-slate-900 font-bold mt-1 capitalize">{sellerProfile?.role || 'user'}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-indigo-100 p-3">
                          <span className="text-[10px] font-black uppercase text-slate-400">Listings by this user</span>
                          <p className="text-slate-900 font-bold mt-1">{sellerAdsCount ?? 'Not available'}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-indigo-100 p-3">
                          <span className="text-[10px] font-black uppercase text-slate-400">Account created / terms accepted</span>
                          <p className="text-slate-900 font-bold mt-1">{formatSellerDate(sellerProfile?.acceptedTermsAt)}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-indigo-100 p-3">
                          <span className="text-[10px] font-black uppercase text-slate-400">Last login</span>
                          <p className="text-slate-900 font-bold mt-1">{formatSellerDate(sellerProfile?.lastLoginAt)}</p>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-indigo-100 p-3">
                        <span className="text-[10px] font-black uppercase text-slate-400">User UID</span>
                        <p className="text-slate-950 font-mono text-[11px] mt-1 select-all break-all">{selectedAd.sellerId || 'Not available'}</p>
                      </div>

                      {sellerProfileError && (
                        <div className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                          {sellerProfileError} The listing-level seller information above remains available.
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/80 flex flex-wrap gap-3 items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">Created on</p>
                  <p className="text-xs font-bold text-slate-700 mt-1 flex items-center gap-1">
                    <Clock size={12} />
                    {selectedAd.createdAt?.toDate ? format(selectedAd.createdAt.toDate(), 'dd MMM yyyy HH:mm') : 'Recently'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleResendPaymentEmail(selectedAd.id)}
                    disabled={resendingEmailId === selectedAd.id}
                    className="h-10 px-4 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-sm shadow-sky-100 disabled:opacity-50"
                    title="Reenviar E-mail de Recibo/Pagamento ao Anunciante"
                  >
                    {resendingEmailId === selectedAd.id ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <MessageSquare size={16} />
                    )}
                    <span>Reenviar E-mail Pagamento</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAd(null);
                      navigate(`/edit-ad/${selectedAd.id}`);
                    }}
                    className="h-10 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs rounded-xl transition-all flex items-center gap-2"
                    title="Edit Listing"
                  >
                    <Edit size={16} />
                    <span>Edit</span>
                  </button>
                  {!isPaidAd(selectedAd) && selectedAd.status === 'pending' && (
                    <button
                      onClick={() => openAssistedPayment(selectedAd)}
                      className="h-10 px-4 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 font-bold text-xs rounded-xl transition-all flex items-center gap-2"
                      title="Generate assisted Stripe payment link and QR code"
                    >
                      <CreditCard size={16} />
                      <span>Payment QR</span>
                    </button>
                  )}
                  {selectedAd.status === 'pending' && (
                    <>
                      <button
                        onClick={async () => {
                          const success = await handleAdAction(selectedAd.id, 'approved');
                          if (success) {
                            setSelectedAd(null);
                            alert('Listing approved successfully!');
                          }
                        }}
                        className="h-10 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-sm shadow-emerald-100"
                      >
                        <CheckCircle size={16} />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={async () => {
                          const success = await handleAdAction(selectedAd.id, 'rejected');
                          if (success) {
                            setSelectedAd(null);
                            alert('Listing rejected successfully!');
                          }
                        }}
                        className="h-10 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <XCircle size={16} />
                        <span>Reject</span>
                      </button>
                    </>
                  )}
                  {selectedAd.isClaimableBusiness ? (
                    selectedAd.claimStatus === 'claimed' ? (
                      <span className="h-10 px-4 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-xl flex items-center gap-2" title="Verified Owner">
                        <ShieldCheck size={16} className="text-emerald-600" />
                        <span>Verified Owner</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleRemoveClaimable(selectedAd.id)}
                        disabled={claimActionLoading}
                        className="h-10 px-4 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
                        title="Remove Claim Status"
                      >
                        <ShieldAlert size={16} />
                        <span>Remove Claim</span>
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => handleMakeClaimable(selectedAd.id)}
                      disabled={claimActionLoading}
                      className="h-10 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
                      title="Make Claimable Business"
                    >
                      <ShieldCheck size={16} />
                      <span>Make Claimable</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleToggleHideAd(selectedAd.id, selectedAd.isHidden)}
                    className={`h-10 px-4 font-bold text-xs rounded-xl transition-all flex items-center gap-2 border cursor-pointer ${
                      selectedAd.isHidden
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                    title={selectedAd.isHidden ? 'Anúncio em Standby (Oculto). Clique para tornar visível' : 'Anúncio Visível. Clique para colocar em Standby'}
                  >
                    <div className={`w-7 h-4 flex items-center rounded-full p-0.5 transition-colors ${selectedAd.isHidden ? 'bg-amber-600' : 'bg-slate-300'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${selectedAd.isHidden ? 'translate-x-3' : 'translate-x-0'}`} />
                    </div>
                    <span>{selectedAd.isHidden ? 'Standby (Oculto)' : 'Ocultar (Standby)'}</span>
                  </button>

                  <button
                    onClick={() => handleDeleteAd(selectedAd.id)}
                    className="h-10 px-4 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                    title="Permanently delete"
                  >
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </button>
                  <button
                    onClick={() => setSelectedAd(null)}
                    className="h-10 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {assistedPaymentAd && (
          <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Generate Payment QR</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{assistedPaymentAd.title}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">{assistedPaymentAd.id}</p>
                </div>
                <button
                  onClick={closeAssistedPayment}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {!assistedPaymentUrl ? (
                  <>
                    <div>
                      <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Choose plan</label>
                      <div className="grid grid-cols-1 gap-2">
                        {([
                          ['standard', 'Standard Listing', '£2.99'],
                          ['featured', 'Featured Listing', '£4.99'],
                          ['premium', 'Premium Featured', '£9.99'],
                        ] as const).map(([value, label, price]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setAssistedPaymentPlan(value)}
                            className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                              assistedPaymentPlan === value
                                ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-100'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <span className="font-bold text-sm text-slate-800">{label}</span>
                            <span className="font-black text-sm text-slate-900">{price}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {assistedPaymentError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                        {assistedPaymentError}
                      </div>
                    )}

                    <button
                      onClick={handleGenerateAssistedPayment}
                      disabled={assistedPaymentLoading}
                      className="w-full h-11 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2"
                    >
                      {assistedPaymentLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <CreditCard size={17} />
                      )}
                      <span>{assistedPaymentLoading ? 'Generating...' : 'Generate Stripe Payment'}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex justify-center py-2">
                      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <QRCodeSVG value={assistedPaymentUrl} size={210} level="M" includeMargin />
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl break-all text-[11px] text-slate-600 font-mono select-all">
                      {assistedPaymentUrl}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        onClick={copyAssistedPaymentLink}
                        className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2"
                      >
                        <Copy size={15} />
                        Copy Payment Link
                      </button>
                      <button
                        onClick={() => window.open(assistedPaymentUrl, '_blank', 'noopener,noreferrer')}
                        className="h-10 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center gap-2"
                      >
                        <ExternalLink size={15} />
                        Open Checkout
                      </button>
                    </div>

                    <button
                      onClick={shareAssistedPaymentWhatsApp}
                      className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm flex items-center justify-center gap-2"
                    >
                      <MessageCircle size={17} />
                      Share via WhatsApp
                    </button>

                    <button
                      onClick={() => {
                        setAssistedPaymentUrl('');
                        setAssistedPaymentError(null);
                      }}
                      className="w-full h-9 rounded-xl text-slate-500 hover:bg-slate-50 font-bold text-xs"
                    >
                      Generate another link
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminAds;
