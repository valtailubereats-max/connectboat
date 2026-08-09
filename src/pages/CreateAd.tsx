import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType, getDocWithCacheFallback } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { clearHomeCache } from '../utils/cache';
import { sendEmailGeneric } from '../utils/emailService';
import { CITIES, Ad, MarketplaceSettings, PORTUGAL_CITIES, UK_CITIES, UK_REGIONS, CITIES_BY_REGION, getRegionForCity, BOAT_TYPES, BOAT_CONDITIONS, BOAT_FUEL_TYPES, BOAT_HULL_MATERIALS, PRICING_UNITS } from '../types';
import { SearchableCitySelect } from '../components/SearchableCitySelect';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Tag, MapPin, Euro, FileText, ChevronLeft, ChevronRight, Upload, X, Plus, RefreshCcw, Link, AlertCircle, Check, Camera, Anchor, Compass, Gauge, ShieldCheck, Ruler, Fuel, Sparkles, CreditCard } from 'lucide-react';
import { compressImage } from '../lib/imageUtils';
import { normalizeDescription } from '../utils/textFormatter';
import { parsePrice, formatPrice } from '../utils';
import { getSourceSiteFromUrl, getSupportedMarketplace, getSupportedMarketplacesMessage } from '../utils/marketplaces';
import { isImportedOrExternalAd, normalizeAndLimitImages, sanitizeFirestorePayload } from '../utils/adSanitizer';
import { getCardFramingStyle, getAdFraming, logFramingDiagnostic } from '../utils/imageFraming';
import { evaluateListingDuplicates, DuplicateCheckResult } from '../utils/duplicateDetector';
import { saveCustomCity } from '../utils/locationService';

const CreateAd = () => {
  const { categories, settings: globalSettings } = useSettings();
  const { id } = useParams();
  const { user, profile, isAdmin, isModerator, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [originalAd, setOriginalAd] = useState<Ad | null>(null);

  const isEditLocked = useMemo(() => {
    if (!id || !originalAd || !originalAd.isFeatured) return false;
    
    let activatedAt: Date;
    if (originalAd.featuredActivatedAt) {
      activatedAt = originalAd.featuredActivatedAt.seconds
        ? originalAd.featuredActivatedAt.toDate()
        : new Date(originalAd.featuredActivatedAt);
    } else {
      const timeRef = originalAd.createdAt || originalAd.updatedAt || Date.now();
      activatedAt = timeRef.seconds ? timeRef.toDate() : new Date(timeRef);
    }

    const hoursPassed = (Date.now() - activatedAt.getTime()) / (1000 * 60 * 60);
    return hoursPassed > 24;
  }, [originalAd, id]);

  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    show: boolean;
    level: 'confirmed' | 'possible';
    reason: string;
    explanationDetails?: string;
    matchedFields: string[];
    matchedAdId?: string;
    matchedAdTitle?: string;
    adData: any;
    adId: string;
    score: number;
  } | null>(null);

  const showValidationError = (message: string, fieldId?: string) => {
    console.error('[CreateAd Validation Error]', message, fieldId ? `(Field ID: ${fieldId})` : '');
    setFormError(message);
    setLoading(false);

    if (fieldId) {
      setTimeout(() => {
        const el = document.getElementById(fieldId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if ('focus' in el && typeof (el as any).focus === 'function') {
            (el as HTMLElement).focus();
          }
        }
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prefill = location.state?.prefill;
  const urlCategory = new URLSearchParams(location.search).get('category');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading]);

  const [formData, setFormData] = useState({
    title: prefill?.title || '',
    description: prefill?.description || '',
    price: prefill?.price !== undefined && prefill?.price !== null ? (typeof prefill.price === 'number' ? formatPrice(prefill.price) : prefill.price.toString()) : '',
    currency: 'GBP',
    priceOnApplication: false,
    priceRequiresReview: false,
    locationRequiresReview: false,
    images: [] as string[],
    city: prefill?.city || 'Southampton',
    region: prefill?.region || (prefill?.city ? getRegionForCity(prefill.city) : 'England'),
    country: 'United Kingdom',
    category: urlCategory || prefill?.category || categories[0] || 'Outros',
    plan: 'standard' as 'standard' | 'free' | 'local' | 'national' | 'highlight' | 'featured' | 'premium',
    duration: 30, // Default for standard
    contactEmail: '',
    externalUrl: '',
    sellerPhone: prefill?.sellerPhone || '',
    sourceUrl: prefill?.sourceUrl || '',
    listingMode: 'external' as 'external' | 'claimable',
    salary: '',
    contractType: '',
    workSchedule: '',
    companyName: '',
    experienceRequired: '',
    useProfilePhone: true,
    contactPhone: '',
    isPermanentFeatured: false,
    listingType: 'normal' as 'normal' | 'informativo',
    targetUrl: '',
    serviceCoverage: prefill?.serviceCoverage || 'city',
    // Rental fields
    listingIntent: (prefill?.listingIntent || (urlCategory === 'Boats for Hire' ? 'hire' : 'sale')) as 'sale' | 'hire',
    pricingUnit: prefill?.pricingUnit || 'Per Day',
    rentalPrice: prefill?.rentalPrice ? prefill.rentalPrice.toString() : '',
    departureLocation: prefill?.departureLocation || '',
    passengerCapacity: prefill?.passengerCapacity || '',
    skipperIncluded: prefill?.skipperIncluded || 'No',
    fuelIncluded: prefill?.fuelIncluded || 'No',
    minimumHireDuration: prefill?.minimumHireDuration || '',
    securityDeposit: prefill?.securityDeposit ? prefill.securityDeposit.toString() : '',
    availableEquipment: prefill?.availableEquipment || '',
    rentalRules: prefill?.rentalRules || '',
    availabilityNotes: prefill?.availabilityNotes || '',
    // Boating fields (Phase 4)
    boatType: prefill?.boatType || '',
    manufacturer: prefill?.manufacturer || '',
    model: prefill?.model || '',
    year: prefill?.year ? prefill.year.toString() : '',
    condition: prefill?.condition || '',
    length: prefill?.length || '',
    beam: prefill?.beam || '',
    draft: prefill?.draft || '',
    fuelType: prefill?.fuelType || '',
    engineBrand: prefill?.engineBrand || '',
    horsepower: prefill?.horsepower || '',
    engineHours: prefill?.engineHours || '',
    cabins: prefill?.cabins || '',
    berths: prefill?.berths || '',
    bathrooms: prefill?.bathrooms || '',
    hullMaterial: prefill?.hullMaterial || '',
    trailerIncluded: prefill?.trailerIncluded || '',
    vatPaid: prefill?.vatPaid || '',
    ceCertified: prefill?.ceCertified || '',
    // Media Boost fields
    mediaBoostEnabled: false,
    videoUrl: null as string | null,
    videoStoragePath: null as string | null,
    tempVideoPath: null as string | null,
    tempVideoUrl: null as string | null,
    videoDurationSeconds: null as number | null,
    videoFileSize: null as number | null,
    videoMimeType: null as string | null,
    videoPaid: false
  });

  // Media Boost Upload States & Handlers
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const uploadTaskRef = useRef<any>(null);

  const handleVideoFileSelect = (file: File) => {
    setVideoError(null);

    const validMimes = ['video/mp4', 'video/quicktime', 'video/webm'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const validExts = ['mp4', 'mov', 'webm'];

    if (!validMimes.includes(file.type) && !validExts.includes(ext)) {
      setVideoError("Please upload an MP4, MOV or WebM video.");
      return;
    }

    if (file.size > 150 * 1024 * 1024) {
      setVideoError("Video file size must not exceed 150 MB.");
      return;
    }

    const videoEl = document.createElement('video');
    videoEl.preload = 'metadata';
    const objectUrl = URL.createObjectURL(file);
    videoEl.src = objectUrl;

    videoEl.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      const durationSeconds = Math.round(videoEl.duration);
      if (videoEl.duration > 60) {
        setVideoError("Video must be 60 seconds or shorter.");
        return;
      }
      startVideoUpload(file, durationSeconds);
    };

    videoEl.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setVideoError("Please upload an MP4, MOV or WebM video.");
    };
  };

  const startVideoUpload = (file: File, durationSeconds: number) => {
    if (!user) return;
    setVideoUploading(true);
    setVideoUploadProgress(0);
    setVideoError(null);

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const isAlreadyPaidOrStaff = isStaff || Boolean(originalAd?.videoPaid);
    const path = isAlreadyPaidOrStaff
      ? `listing-videos/${user.uid}/${id || Date.now()}/${cleanFileName}`
      : `temporary-listing-videos/${user.uid}/${id || Date.now()}/${cleanFileName}`;
    const storageRef = ref(storage, path);

    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTaskRef.current = uploadTask;

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setVideoUploadProgress(Math.round(progress));
      },
      (err: any) => {
        console.error('Video upload error:', err);
        if (err.code !== 'storage/canceled') {
          setVideoError('Error uploading video to server. Please try again.');
        }
        setVideoUploading(false);
        uploadTaskRef.current = null;
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          const isTemp = path.startsWith('temporary-listing-videos/');
          setFormData((prev) => ({
            ...prev,
            videoUrl: downloadUrl,
            videoStoragePath: path,
            tempVideoPath: isTemp ? path : null,
            tempVideoUrl: isTemp ? downloadUrl : null,
            videoDurationSeconds: durationSeconds,
            videoFileSize: file.size,
            videoMimeType: file.type || 'video/mp4',
          }));
          setVideoUploading(false);
          setVideoUploadProgress(100);
        } catch (e) {
          setVideoError('Error getting video download URL.');
          setVideoUploading(false);
        } finally {
          uploadTaskRef.current = null;
        }
      }
    );
  };

  const handleCancelVideoUpload = () => {
    if (uploadTaskRef.current) {
      uploadTaskRef.current.cancel();
      uploadTaskRef.current = null;
    }
    setVideoUploading(false);
    setVideoUploadProgress(0);
  };

  const handleRemoveVideo = async () => {
    handleCancelVideoUpload();
    const pathToDelete = formData.tempVideoPath || formData.videoStoragePath;
    if (pathToDelete) {
      try {
        const videoRef = ref(storage, pathToDelete);
        await deleteObject(videoRef);
      } catch (e) {
        console.warn('Could not delete video object:', e);
      }
    }
    setFormData((prev) => ({
      ...prev,
      videoUrl: null,
      videoStoragePath: null,
      tempVideoPath: null,
      tempVideoUrl: null,
      videoDurationSeconds: null,
      videoFileSize: null,
      videoMimeType: null,
    }));
    setVideoError(null);
  };

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const validateStep1 = () => {
    if (!formData.title || !formData.title.trim()) {
      showValidationError('Please enter a title for your listing.', 'txt-ad-title');
      return false;
    }
    if (!formData.category) {
      showValidationError('Please select a category.');
      return false;
    }
    if (!formData.description || !formData.description.trim()) {
      showValidationError('Please enter a detailed description.', 'txt-description');
      return false;
    }
    if (!formData.city) {
      showValidationError('Please select a city/region.');
      return false;
    }
    if (formData.mediaBoostEnabled) {
      if (videoUploading) {
        showValidationError('Please wait for the video upload to finish before proceeding.');
        return false;
      }
      if (!formData.videoUrl || videoError) {
        showValidationError('Please upload a valid video to enable Media Boost, or untick the option to proceed.');
        return false;
      }
    }
    setFormError(null);
    return true;
  };

  const getPlanTier = (planName?: string): number => {
    if (!planName) return 0;
    const p = planName.toLowerCase();
    if (['national', 'premium', 'showcase'].includes(p)) return 2;
    if (['local', 'highlight', 'featured', 'intermediate'].includes(p)) return 1;
    return 0;
  };

  const checkRequiresPayment = (): boolean => {
    const isStaff = isAdmin || isModerator || profile?.role === 'admin' || profile?.role === 'moderator';
    if (isStaff) return false;
    if (formData.isPermanentFeatured) return false;

    const isEditing = Boolean(id && originalAd);

    if (!isEditing) {
      const activePlan = (formData.plan || 'standard').toLowerCase();
      const isFree = activePlan === 'free';
      const mediaBoostNew = formData.mediaBoostEnabled;
      return !isFree || mediaBoostNew;
    }

    // When editing an existing ad:
    const isExpired = originalAd?.status === 'expired' || originalAd?.adStatus === 'expired';
    if (isExpired) return true;

    const oldTier = getPlanTier(originalAd?.plan);
    const newTier = getPlanTier(formData.plan);
    const isPlanUpgrade = newTier > oldTier;

    const isNewMediaBoost = formData.mediaBoostEnabled && !originalAd?.videoPaid;

    return isPlanUpgrade || isNewMediaBoost;
  };

  const getMaxPhotosForPlan = (planKey: string): number => {
    if (settings?.maxImages) {
      const val = settings.maxImages[planKey as keyof typeof settings.maxImages];
      if (val) return val;
      if ((planKey === 'featured' || planKey === 'highlight' || planKey === 'local') && settings.maxImages.featured) {
        return settings.maxImages.featured;
      }
      if ((planKey === 'premium' || planKey === 'national') && settings.maxImages.premium) {
        return settings.maxImages.premium;
      }
      if ((planKey === 'standard' || planKey === 'free') && settings.maxImages.standard) {
        return settings.maxImages.standard;
      }
    }
    if (planKey === 'premium' || planKey === 'national') return 8;
    if (planKey === 'featured' || planKey === 'local' || planKey === 'highlight') return 6;
    return 4;
  };

  const getPlanPrice = (planKey: string): number => {
    const prices = globalSettings?.planPrices;
    const normalizedPlan = (planKey || 'standard').toLowerCase();

    if (normalizedPlan === 'premium') {
      return Number(prices?.premium ?? 9.99);
    }

    if (['featured', 'local', 'national', 'highlight'].includes(normalizedPlan)) {
      return Number(prices?.featured ?? 4.99);
    }

    return Number(prices?.standard ?? 2.99);
  };

  const getCheckoutTotalAmountFormatted = () => {
    if (!checkRequiresPayment()) return '0.00';
    const activePlan = (formData.plan || 'standard').toLowerCase();
    const planBase = getPlanPrice(activePlan);
    const mediaBoostExtra = (formData.mediaBoostEnabled && !originalAd?.videoPaid) ? 2.00 : 0;
    return (planBase + mediaBoostExtra).toFixed(2);
  };

  const validateStep1AndProceed = () => {
    if (validateStep1()) {
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPhotoSourceMenu, setShowPhotoSourceMenu] = useState(false);
  const [pendingAdData, setPendingAdData] = useState<any>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const pCategory = searchParams.get('category');
    if (pCategory) {
      setFormData(prev => ({
        ...prev,
        category: pCategory
      }));
    }

    const isStripeSuccess = searchParams.get('stripe_success') === 'true';
    const returnedAdId = searchParams.get('ad_id');
    const returnedPlan = searchParams.get('plan') || 'local';

    if (isStripeSuccess && returnedAdId) {
      clearHomeCache();
      setSaveSuccessMsg('Pagamento de destaque efetuado com sucesso via Stripe Checkout!');
      
      // Clear query params from browser URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      setTimeout(() => {
        setSaveSuccessMsg(null);
        navigate('/profile?tab=anuncios');
      }, 2500);
    }
  }, [location.search, navigate]);

  const [imagePositionX, setImagePositionX] = useState<number>(50);
  const [imagePositionY, setImagePositionY] = useState<number>(50);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);

  const canMoveX = (() => {
    if (imageAspectRatio === null) return true;
    if (imageAspectRatio > 1) return true;
    return imageZoom > 1.01;
  })();

  const canMoveY = (() => {
    if (imageAspectRatio === null) return true;
    if (imageAspectRatio < 1) return true;
    return imageZoom > 1.01;
  })();

  useEffect(() => {
    if (!canMoveX) {
      setImagePositionX(50);
    }
  }, [canMoveX]);

  useEffect(() => {
    if (!canMoveY) {
      setImagePositionY(50);
    }
  }, [canMoveY]);

  const perImageFramingRef = useRef<Record<string, { x: number; y: number; zoom: number }>>({});
  const prevCoverUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const currentCoverUrl = formData.images && formData.images[0] ? formData.images[0] : null;

    if (currentCoverUrl !== prevCoverUrlRef.current) {
      if (prevCoverUrlRef.current) {
        perImageFramingRef.current[prevCoverUrlRef.current] = {
          x: imagePositionX,
          y: imagePositionY,
          zoom: imageZoom,
        };
      }

      if (currentCoverUrl && perImageFramingRef.current[currentCoverUrl]) {
        const saved = perImageFramingRef.current[currentCoverUrl];
        setImagePositionX(saved.x);
        setImagePositionY(saved.y);
        setImageZoom(saved.zoom);
      } else {
        setImagePositionX(50);
        setImagePositionY(50);
        setImageZoom(1);
      }
      prevCoverUrlRef.current = currentCoverUrl;
    } else if (currentCoverUrl) {
      perImageFramingRef.current[currentCoverUrl] = {
        x: imagePositionX,
        y: imagePositionY,
        zoom: imageZoom,
      };
    }
  }, [formData.images?.[0], imagePositionX, imagePositionY, imageZoom]);

  useEffect(() => {
    if (formData.images && formData.images[0]) {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setImageAspectRatio(img.naturalWidth / img.naturalHeight);
        }
      };
      img.src = formData.images[0];
    } else {
      setImageAspectRatio(null);
    }
  }, [formData.images?.[0]]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 50, posY: 50 });

  // Referências para o gesto pinch-to-zoom (mobile) e swipe
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(1);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingImage(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: imagePositionX,
      posY: imagePositionY
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    if (!isDraggingImage || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    const scaleFactor = imageZoom > 1 ? 1 / imageZoom : 1.5;
    const shiftX = (deltaX / rect.width) * 100 * scaleFactor;
    const shiftY = (deltaY / rect.height) * 100 * scaleFactor;

    const nextX = Math.min(100, Math.max(0, dragStartRef.current.posX - shiftX));
    const nextY = Math.min(100, Math.max(0, dragStartRef.current.posY - shiftY));

    if (canMoveX) {
      setImagePositionX(Math.round(nextX));
    }
    if (canMoveY) {
      setImagePositionY(Math.round(nextY));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    if (isDraggingImage) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDraggingImage(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDraggingImage(true);
      const touch = e.touches[0];
      dragStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        posX: imagePositionX,
        posY: imagePositionY
      };
      touchStartDistRef.current = null;
    } else if (e.touches.length === 2) {
      setIsDraggingImage(false);
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.sqrt(
        Math.pow(touch1.clientX - touch2.clientX, 2) + 
        Math.pow(touch1.clientY - touch2.clientY, 2)
      );
      touchStartDistRef.current = dist;
      touchStartZoomRef.current = imageZoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && isDraggingImage && containerRef.current) {
      const touch = e.touches[0];
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = touch.clientX - dragStartRef.current.x;
      const deltaY = touch.clientY - dragStartRef.current.y;

      const scaleFactor = imageZoom > 1 ? 1 / imageZoom : 1.5;
      const shiftX = (deltaX / rect.width) * 100 * scaleFactor;
      const shiftY = (deltaY / rect.height) * 100 * scaleFactor;

      const nextX = Math.min(100, Math.max(0, dragStartRef.current.posX - shiftX));
      const nextY = Math.min(100, Math.max(0, dragStartRef.current.posY - shiftY));

      if (canMoveX) {
        setImagePositionX(Math.round(nextX));
      }
      if (canMoveY) {
        setImagePositionY(Math.round(nextY));
      }
    } else if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.sqrt(
        Math.pow(touch1.clientX - touch2.clientX, 2) + 
        Math.pow(touch1.clientY - touch2.clientY, 2)
      );
      
      const ratio = dist / touchStartDistRef.current;
      const nextZoom = touchStartZoomRef.current * ratio;
      setImageZoom(Math.min(3, Math.max(1, nextZoom)));
    }
  };

  const handleTouchEnd = () => {
    setIsDraggingImage(false);
    touchStartDistRef.current = null;
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventDefaultWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 0.08;
      const direction = e.deltaY < 0 ? 1 : -1;
      setImageZoom(prev => {
        const nextZoom = prev + direction * zoomFactor;
        return Math.min(3, Math.max(1, nextZoom));
      });
    };

    container.addEventListener('wheel', preventDefaultWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', preventDefaultWheel);
    };
  }, [containerRef.current]);

  const getAdImageStyle = (x: number, y: number, z: number) => {
    return getCardFramingStyle({ x, y, zoom: z }, { isHovered: false });
  };

  const handleCountryChange = (newCountry: 'Portugal' | 'Reino Unido' | 'Ambos') => {
    const defaultCity = newCountry === 'Reino Unido' ? UK_CITIES[0] : PORTUGAL_CITIES[0];
    
    setFormData(prev => {
      let nextCoverage = prev.serviceCoverage;
      if (prev.serviceCoverage === 'uk' && newCountry === 'Portugal') {
        nextCoverage = 'city';
      } else if (prev.serviceCoverage === 'portugal' && newCountry === 'Reino Unido') {
        nextCoverage = 'city';
      }

      const updated = {
        ...prev,
        country: newCountry,
        city: prev.city || defaultCity,
        serviceCoverage: nextCoverage
      };
      
      // If profile phone is unchecked, and custom contact phone is empty or only holds a prefix, auto suggest new prefix
      if (!prev.useProfilePhone) {
        const trimmedPhone = prev.contactPhone.trim();
        if (!trimmedPhone || trimmedPhone === '+351' || trimmedPhone === '+44') {
          updated.contactPhone = newCountry === 'Reino Unido' ? '+44 ' : '+351 ';
        }
      }
      
      return updated;
    });
  };

  const handleUseProfilePhoneChange = (checked: boolean) => {
    setFormData(prev => {
      const updated = {
        ...prev,
        useProfilePhone: checked
      };
      
      if (!checked) {
        const trimmedPhone = prev.contactPhone.trim();
        if (!trimmedPhone) {
          updated.contactPhone = prev.country === 'Reino Unido' ? '+44 ' : '+351 ';
        }
      }
      
      return updated;
    });
  };
  const [settings, setSettings] = useState<MarketplaceSettings | null>(null);
  const enablePortugal = (globalSettings?.enablePortugalMarket ?? settings?.enablePortugalMarket) === true;
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const uploadRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
    if (id) {
      fetchAd();
    }
  }, [id]);

  const fetchSettings = async () => {
    try {
      const settingsSnap = await getDocWithCacheFallback(doc(db, 'settings', 'global'), 'settings/global');
      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data());
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const prefilledFromProfileRef = useRef(false);

  useEffect(() => {
    if (!id && !prefill && !authLoading && !prefilledFromProfileRef.current) {
      prefilledFromProfileRef.current = true;
      const saved = localStorage.getItem('selectedCountry') as 'Portugal' | 'Reino Unido' | null;
      let targetCountry: 'Portugal' | 'Reino Unido' = 'Reino Unido';
      
      if (enablePortugal) {
        if (profile?.country === 'Reino Unido' || profile?.country === 'Portugal') {
          targetCountry = profile.country;
        } else if (saved === 'Reino Unido' || saved === 'Portugal') {
          targetCountry = saved;
        }
      }
      
      let targetCity = targetCountry === 'Reino Unido' ? UK_CITIES[0] : PORTUGAL_CITIES[0];
      if (profile?.city) {
        targetCity = profile.city;
      }
      
      setFormData(prev => ({
        ...prev,
        country: targetCountry,
        city: targetCity
      }));
    }
  }, [profile, authLoading, id, prefill]);

  const fetchAd = async () => {
    setFetching(true);
    try {
      const docRef = doc(db, 'ads', id!);
      const docSnap = await getDocWithCacheFallback(docRef, `ads/${id}`);
      if (docSnap.exists()) {
        const data = docSnap.data() as Ad;
        if (data.sellerId !== user?.uid && !isAdmin && !isModerator) {
          navigate('/');
          return;
        }
        setOriginalAd(data);
        const fetchedImages = normalizeAndLimitImages(data.images || (data.imageUrl ? [data.imageUrl] : []), 6);
        setFormData({
          title: data.title,
          description: data.description,
          price: data.price !== undefined && data.price !== null && data.price !== 0 ? formatPrice(data.price) : (data.price === 0 ? '0' : ''),
          images: fetchedImages.length > 0 ? fetchedImages : (data.images || []),
          city: data.city,
          country: data.country || 'Reino Unido',
          category: data.category,
          plan: data.plan || 'free',
          duration: 30, // Duration is only used for calculation on submit
          contactEmail: data.contactEmail || '',
          externalUrl: data.externalUrl || '',
          sellerPhone: data.sellerPhone || '',
          sourceUrl: data.sourceUrl || '',
          salary: data.salary || '',
          contractType: data.contractType || '',
          workSchedule: data.workSchedule || '',
          companyName: data.companyName || '',
          experienceRequired: data.experienceRequired || '',
          useProfilePhone: data.useProfilePhone !== undefined ? data.useProfilePhone : true,
          contactPhone: data.contactPhone || '',
          isPermanentFeatured: !!(data as any).isPermanentFeatured,
          listingType: data.listingType || 'normal',
          targetUrl: data.targetUrl || '',
          serviceCoverage: (data as any).serviceCoverage || 'city',
          listingIntent: data.listingIntent || (data.category === 'Boats for Hire' ? 'hire' : 'sale'),
          pricingUnit: data.pricingUnit || 'Per Day',
          rentalPrice: data.rentalPrice ? data.rentalPrice.toString() : '',
          departureLocation: data.departureLocation || '',
          passengerCapacity: data.passengerCapacity || '',
          skipperIncluded: data.skipperIncluded || 'No',
          fuelIncluded: data.fuelIncluded || 'No',
          minimumHireDuration: data.minimumHireDuration || '',
          securityDeposit: data.securityDeposit ? data.securityDeposit.toString() : '',
          availableEquipment: typeof data.availableEquipment === 'string' ? data.availableEquipment : (Array.isArray(data.availableEquipment) ? data.availableEquipment.join(', ') : ''),
          rentalRules: data.rentalRules || '',
          availabilityNotes: data.availabilityNotes || '',
          boatType: data.boatType || '',
          manufacturer: data.manufacturer || '',
          model: data.model || '',
          year: data.year ? data.year.toString() : '',
          condition: data.condition || '',
          length: data.length || '',
          beam: data.beam || '',
          draft: data.draft || '',
          fuelType: data.fuelType || '',
          engineBrand: data.engineBrand || '',
          horsepower: data.horsepower || '',
          engineHours: data.engineHours || '',
          cabins: data.cabins || '',
          berths: data.berths || '',
          bathrooms: data.bathrooms || '',
          hullMaterial: data.hullMaterial || '',
          trailerIncluded: data.trailerIncluded || '',
          vatPaid: data.vatPaid || '',
          ceCertified: data.ceCertified || '',
          // Media Boost fields
          mediaBoostEnabled: !!data.mediaBoostEnabled,
          videoUrl: data.videoUrl || null,
          videoStoragePath: data.videoStoragePath || null,
          tempVideoPath: data.tempVideoPath || null,
          tempVideoUrl: data.tempVideoUrl || null,
          videoDurationSeconds: data.videoDurationSeconds || null,
          videoFileSize: data.videoFileSize || null,
          videoMimeType: data.videoMimeType || null,
          videoPaid: !!data.videoPaid
        });
        const loadedFraming = getAdFraming(data);
        setImagePositionX(loadedFraming.x);
        setImagePositionY(loadedFraming.y);
        setImageZoom(loadedFraming.zoom);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `ads/${id}`);
    } finally {
      setFetching(false);
    }
  };

  const maxAllowed = React.useMemo(() => {
    return getMaxPhotosForPlan(formData.plan);
  }, [formData.plan, settings]);

  // Corta imagens para 2 se o utilizador trocar de Destaque para Grátis
  useEffect(() => {
    if (formData.plan === 'free' && formData.images.length > 2) {
      alert('The standard free listing allows up to 2 photos. Extra photos have been removed.');
      setFormData(prev => ({
        ...prev,
        images: prev.images.slice(0, 2)
      }));
    }
  }, [formData.plan]);

  const processFiles = async (files: File[]) => {
    if (uploadRef.current) return;

    const currentImagesCount = formData.images.length;
    const remainingSlots = maxAllowed - currentImagesCount;

    if (remainingSlots <= 0) {
      alert(`Limite de ${maxAllowed} imagens atingido para este plano.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      return;
    }

    const filesToUpload = files.slice(0, remainingSlots);

    // List any oversized files to warn the user
    const oversized = filesToUpload.filter(file => file.size > 5 * 1024 * 1024);
    if (oversized.length > 0) {
      alert(`As seguintes imagens excedem o limite de 5MB e foram puladas:\n${oversized.map(f => f.name).join('\n')}`);
    }

    const filesToProceed = filesToUpload.filter(file => file.size <= 5 * 1024 * 1024);
    if (filesToProceed.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      return;
    }

    uploadRef.current = true;
    setUploading(true);

    try {
      const uploadPromises = filesToProceed.map(async (file) => {
        const compressedBlob = await compressImage(file, 1200, 0.8);
        const fileName = `${Date.now()}_${file.name}`;
        const imageRef = ref(storage, `ads/${fileName}`);
        
        // Upload directly to Firebase Storage
        const uploadResult = await uploadBytes(imageRef, compressedBlob);
        const downloadUrl = await getDownloadURL(uploadResult.ref);
        return downloadUrl;
      });

      const urls = await Promise.all(uploadPromises);
      const validUrls = urls.filter((url): url is string => url !== null);

      if (validUrls.length > 0) {
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, ...validUrls].slice(0, maxAllowed)
        }));
      }

    } catch (err) {
      console.error('Erro no upload real:', err);
      alert(`Erro ao carregar imagens: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
      uploadRef.current = false;
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    processFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []) as File[];
    processFiles(files);
  };
  const removeImage = async (index: number) => {
    if (isEditLocked && !isAdmin) return;
    setFormData(prev => {
      const imageUrl = prev.images[index];
      const newImages = prev.images.filter((_, i) => i !== index);
      
      // Optional: Delete from storage if it's a firebase storage URL
      if (imageUrl && imageUrl.includes('firebasestorage.googleapis.com')) {
        const imageRef = ref(storage, imageUrl);
        deleteObject(imageRef).catch(err => {
          console.error('Error deleting image from storage:', err);
        });
      }
      
      return { ...prev, images: newImages };
    });
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    if (isEditLocked && !isAdmin) return;
    if (index <= 0) return; // Main photo cannot be moved via arrows
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    // Arrows only reorder among secondary photos (index >= 1)
    if (direction === 'left' && targetIndex < 1) return;
    if (direction === 'right' && targetIndex >= formData.images.length) return;

    const updated = [...formData.images];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);

    setFormData(prev => ({ ...prev, images: updated }));
  };

  const setAsMainImage = (index: number) => {
    if (isEditLocked && !isAdmin) return;
    if (index <= 0 || index >= formData.images.length) return;

    const updated = [...formData.images];
    const [moved] = updated.splice(index, 1);
    updated.splice(0, 0, moved);

    setFormData(prev => ({ ...prev, images: updated }));
  };

  const normalizeTextForDuplicates = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/[^a-z0-9]/g, "") // remove special chars/spaces
      .trim();
  };

  const areTitlesSimilarForDuplicates = (t1: string, t2: string) => {
    const n1 = normalizeTextForDuplicates(t1);
    const n2 = normalizeTextForDuplicates(t2);
    if (!n1 || !n2) return false;
    if (n1 === n2) return true;
    if (n1.includes(n2) || n2.includes(n1)) return true;
    
    const words1 = t1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const words2 = t2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words1.length === 0 || words2.length === 0) return false;
    const common = words1.filter(w => words2.includes(w));
    const ratio = common.length / Math.max(words1.length, words2.length);
    return ratio >= 0.7; // 70% of words in common
  };

  const executeSaveAd = async (finalAdData: any, targetAdId: string) => {
    setLoading(true);
    try {
      const cleanPayload = sanitizeFirestorePayload(finalAdData);

      // During an edit, do not create optional fields that did not exist
      // in the original Firestore document. Adding an empty/null field still
      // counts as a field change and can be rejected by the security rules.
      if (id && originalAd) {
        const preserveOptionalFieldShape = [
          'sellerEmail',
          'userEmail',
          'tempVideoPath',
          'tempVideoUrl'
        ];

        preserveOptionalFieldShape.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(originalAd, key)) {
            (cleanPayload as any)[key] = (originalAd as any)[key];
          } else {
            delete (cleanPayload as any)[key];
          }
        });
      }

      logFramingDiagnostic('CreateAd Save Payload', {
        targetAdId,
        imageUrl: cleanPayload.imageUrl,
        imagePositionX: cleanPayload.imagePositionX,
        imagePositionY: cleanPayload.imagePositionY,
        imageZoom: cleanPayload.imageZoom,
        coverImageSettings: cleanPayload.coverImageSettings,
      });
      try {
        await setDoc(doc(db, 'ads', targetAdId), cleanPayload, { merge: true });
        if (cleanPayload.city) {
          saveCustomCity(cleanPayload.city, cleanPayload.region, cleanPayload.country).catch((err) => {
            console.error('[CreateAd] Error auto-saving custom city:', err);
          });
        }
      } catch (saveErr: any) {
        console.error('[Ad Save Failure]', saveErr);
        showValidationError(`Erro ao guardar anúncio no Firestore: ${saveErr?.message || String(saveErr)}`);
        setLoading(false);
        return;
      }

      // Notificação interna automática para admins e moderadores quando um novo anúncio for criado como pendente
      if (!id && finalAdData.status === 'pending') {
        console.log('[PENDING EMAIL] start');
        try {
          const staffQuery = query(
            collection(db, 'users'),
            where('role', 'in', ['admin', 'moderator'])
          );
          const staffSnapshot = await getDocs(staffQuery);
          
          const staffUids: string[] = [];
          const staffEmails: string[] = [];
          const creatorUid = user?.uid;
          const creatorEmail = (user?.email || profile?.email || '').toLowerCase().trim();

          staffSnapshot.forEach(docSnap => {
            const uid = docSnap.id;
            const sData = docSnap.data();
            
            if (uid !== creatorUid) {
              staffUids.push(uid);
              if (sData && sData.email) {
                const sEmail = sData.email.toLowerCase().trim();
                if (sEmail && sEmail !== creatorEmail) {
                  staffEmails.push(sData.email);
                }
              }
            }
          });

          for (const staffUid of staffUids) {
            const notifId = `pending_${targetAdId}_${staffUid}_${Date.now()}`;
            const notifData = {
              userId: staffUid,
              title: 'Novo anúncio pendente',
              message: `Há um novo anúncio aguardando aprovação: "${finalAdData.title}"`,
              createdAt: serverTimestamp(),
              read: false,
              adId: targetAdId,
              type: 'ad_pending'
            };
            await setDoc(doc(db, 'notifications', notifId), notifData);
          }

          if (staffEmails.length > 0) {
            for (const email of staffEmails) {
              try {
                await sendEmailGeneric('anuncio_pendente_staff', email, {
                  staffEmails: [email],
                  adTitle: finalAdData.title,
                  adId: targetAdId,
                  sellerName: finalAdData.sellerName || 'Anunciante'
                });
              } catch (err: any) {
                console.warn('[PENDING EMAIL] error:', err.message || err);
              }
            }
          }

          // Send submission confirmation to seller if email is present
          if (user?.email) {
            try {
              await sendEmailGeneric('anuncio_submetido', user.email, {
                sellerName: profile?.name || user.displayName || 'Valued Member',
                adTitle: finalAdData.title,
                adId: targetAdId
              });
            } catch (err: any) {
              console.warn('[SELLER SUBMISSION EMAIL] error:', err.message || err);
            }
          }
        } catch (notifErr: any) {
          console.warn('[PENDING EMAIL] error:', notifErr.message || notifErr);
        }
      }

      clearHomeCache();
      if (id) {
        if ((isAdmin || isModerator) && originalAd?.sellerId !== user.uid) {
          setSaveSuccessMsg('Listing updated successfully (Staff Edit).');
          setTimeout(() => {
            setSaveSuccessMsg(null);
            navigate('/admin/ads');
          }, 2000);
        } else {
          setSaveSuccessMsg('Listing updated! Your listing has been returned to the admin queue for approval.');
          setTimeout(() => {
            setSaveSuccessMsg(null);
            navigate('/profile?tab=anuncios');
          }, 2000);
        }
      } else {
        setSaveSuccessMsg('Listing submitted! You will receive a notification when your listing is approved.');
        setTimeout(() => {
          setSaveSuccessMsg(null);
          navigate('/profile?tab=anuncios');
        }, 2000);
      }
    } catch (err: any) {
      console.error('[Ad Save Execution Error]', err);
      handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, `ads/${targetAdId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!user || !profile) {
      showValidationError('Error loading user profile. Please reload the page.');
      return;
    }

    const isJob = formData.category === 'Trabalho/Empregos' || formData.category === 'Boat Jobs';
    const isSpecialCategory = formData.category === 'Imigração' || isJob;
    const isImportedAd = isImportedOrExternalAd(formData) || isImportedOrExternalAd(originalAd) || isAdmin || isModerator;

    // Contact Phone Validation (Only required for normal non-imported listings)
    if (!isImportedAd) {
      if (isSpecialCategory) {
        if (!formData.sellerPhone?.trim()) {
          showValidationError('Please enter a contact phone/WhatsApp number.', 'txt-seller-phone');
          return;
        }
      } else {
        if (formData.useProfilePhone) {
          if (!profile?.phone?.trim()) {
            showValidationError(
              'Your profile does not have a configured phone number. Enter a contact phone or update your profile.',
              'contact-phone-section'
            );
            setFormData(prev => ({ ...prev, useProfilePhone: false }));
            setTimeout(() => {
              const phoneInput = document.getElementById('txt-contact-phone');
              phoneInput?.focus();
            }, 100);
            return;
          }
        } else {
          if (!formData.contactPhone?.trim() && !profile?.phone?.trim()) {
            showValidationError(
              'Please enter a contact phone number for your listing.',
              'txt-contact-phone'
            );
            return;
          }
        }
      }
    }

    if (!formData.title?.trim()) {
      showValidationError('Please enter a title for your listing.', 'txt-ad-title');
      return;
    }

    if (!formData.description?.trim()) {
      showValidationError('Please enter a detailed description for your listing.', 'txt-description');
      return;
    }

    const cleanFormImages = normalizeAndLimitImages(formData.images, 6);
    if (cleanFormImages.length === 0) {
      showValidationError('Please upload at least one valid image for your listing.', 'sec-images-upload');
      return;
    }

    setLoading(true);
    try {

      const adId = id || doc(collection(db, 'ads')).id;
      
      // Calculate expiration date
      let days = 30;
      if (settings?.planDurations) {
        if (formData.plan === 'free') {
          days = formData.duration;
        } else {
          days = settings.planDurations[formData.plan as keyof typeof settings.planDurations] || 30;
        }
      } else {
        // Fallback defaults
        if (formData.plan === 'free') days = formData.duration;
        // Fallback default duration for new designs
        else if (formData.plan === 'local' || formData.plan === 'national') days = 30;
        else if (formData.plan === 'intermediate') days = 180;
        else if (formData.plan === 'premium') days = 365;
      }

      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + days);

      const validSourceUrl = (formData.sourceUrl && /^https?:\/\//i.test(formData.sourceUrl)) ? formData.sourceUrl.trim() : null;

      const useProfilePhoneValue = isSpecialCategory ? false : formData.useProfilePhone;
      const contactPhoneValue = isSpecialCategory 
        ? formData.sellerPhone.replace(/\s+/g, ' ').trim()
        : (formData.useProfilePhone ? '' : formData.contactPhone.replace(/\s+/g, ' ').trim());
      const finalSellerPhoneValue = isSpecialCategory
        ? (formData.sellerPhone.replace(/\s+/g, ' ').trim() || profile.phone || '')
        : (formData.useProfilePhone ? (profile.phone || '') : (formData.contactPhone?.replace(/\s+/g, ' ').trim() || profile.phone || ''));

      const isStaff = isAdmin || isModerator;

      const adData: any = {
        id: adId,
        title: formData.title,
        description: formData.description,
        price: (formData.category === 'Imigração' || isJob || formData.category === '💚 Doações & Solidariedade') ? 0 : (formData.price ? parsePrice(formData.price) : 0),
        imageUrl: cleanFormImages[0] || '', // Primary image
        images: cleanFormImages,
        city: formData.city,
        country: formData.country,
        category: formData.category,
        sellerId: id && originalAd ? (originalAd.sellerId || user.uid) : user.uid,
        sellerEmail: id && originalAd
          ? (Object.prototype.hasOwnProperty.call(originalAd, 'sellerEmail') ? originalAd.sellerEmail : '')
          : (user?.email || profile?.email || ''),
        userEmail: id && originalAd
          ? (Object.prototype.hasOwnProperty.call(originalAd, 'userEmail') ? originalAd.userEmail : '')
          : (user?.email || profile?.email || ''),
        sellerPhone: finalSellerPhoneValue || (originalAd?.sellerPhone || ''),
        contactPhone: contactPhoneValue || (originalAd?.contactPhone || ''),
        useProfilePhone: useProfilePhoneValue,
        sellerName: id && originalAd ? (originalAd.sellerName || profile.name || 'ConnectBoat') : (profile.name || 'ConnectBoat'),
        status: isStaff && id ? (originalAd?.status || 'approved') : 'pending',
        adStatus: id && originalAd ? originalAd.adStatus : 'active',
        plan: formData.category === '💚 Doações & Solidariedade' ? 'local' : formData.plan,
        expirationDate: id && originalAd ? (originalAd.expirationDate || expirationDate) : expirationDate,
        userNotified: id && originalAd
          ? (Object.prototype.hasOwnProperty.call(originalAd, 'userNotified') ? originalAd.userNotified : false)
          : false,
        createdAt: id && originalAd ? originalAd.createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
        contactEmail: (formData.category === 'Imigração' || isJob) ? (formData.contactEmail || '') : (originalAd?.contactEmail || ''),
        externalUrl: (formData.category === 'Imigração' || isJob) ? (formData.externalUrl || '') : (originalAd?.externalUrl || ''),
        sourceUrl: validSourceUrl || (originalAd?.sourceUrl || null),
        imagePositionX: imagePositionX,
        imagePositionY: imagePositionY,
        imageZoom: imageZoom,
        coverImageSettings: {
          imageUrl: cleanFormImages[0] || '',
          x: imagePositionX,
          y: imagePositionY,
          zoom: imageZoom,
        },
        salary: isJob ? formData.salary.trim() : '',
        contractType: isJob ? formData.contractType : '',
        workSchedule: isJob ? formData.workSchedule : '',
        companyName: isJob ? formData.companyName.trim() : '',
        experienceRequired: isJob ? formData.experienceRequired : '',
        listingType: isStaff ? formData.listingType : (originalAd?.listingType || 'normal'),
        targetUrl: isStaff ? (formData.listingType === 'informativo' ? formData.targetUrl.trim() : '') : (originalAd?.targetUrl || ''),
        serviceCoverage: (formData.category === 'Serviços' || formData.category?.startsWith('Serviços') || formData.category?.includes('Serviços')) ? (formData.serviceCoverage || 'city') : 'city',
        // Rental / Hire Fields
        listingIntent: formData.listingIntent,
        pricingUnit: formData.listingIntent === 'hire' ? formData.pricingUnit : '',
        rentalPrice: formData.listingIntent === 'hire' ? (formData.rentalPrice ? parsePrice(formData.rentalPrice) : (formData.price ? parsePrice(formData.price) : 0)) : 0,
        departureLocation: formData.listingIntent === 'hire' ? formData.departureLocation.trim() : '',
        passengerCapacity: formData.listingIntent === 'hire' ? (formData.passengerCapacity ? parseInt(formData.passengerCapacity.toString()) || formData.passengerCapacity : '') : '',
        skipperIncluded: formData.listingIntent === 'hire' ? formData.skipperIncluded : 'No',
        fuelIncluded: formData.listingIntent === 'hire' ? formData.fuelIncluded : 'No',
        minimumHireDuration: formData.listingIntent === 'hire' ? formData.minimumHireDuration.trim() : '',
        securityDeposit: formData.listingIntent === 'hire' ? (formData.securityDeposit ? parsePrice(formData.securityDeposit) : '') : '',
        availableEquipment: formData.listingIntent === 'hire' ? formData.availableEquipment.trim() : '',
        rentalRules: formData.listingIntent === 'hire' ? formData.rentalRules.trim() : '',
        availabilityNotes: formData.listingIntent === 'hire' ? formData.availabilityNotes.trim() : '',
        // Boating fields (Phase 4)
        boatType: formData.boatType || '',
        manufacturer: formData.manufacturer.trim(),
        model: formData.model.trim(),
        year: formData.year ? parseInt(formData.year.toString()) || formData.year : '',
        condition: formData.condition || '',
        length: formData.length.trim(),
        beam: formData.beam.trim(),
        draft: formData.draft.trim(),
        fuelType: formData.fuelType || '',
        engineBrand: formData.engineBrand.trim(),
        horsepower: formData.horsepower.trim(),
        engineHours: formData.engineHours.trim(),
        cabins: formData.cabins.trim(),
        berths: formData.berths.trim(),
        bathrooms: formData.bathrooms.trim(),
        hullMaterial: formData.hullMaterial || '',
        trailerIncluded: formData.trailerIncluded || '',
        vatPaid: formData.vatPaid || '',
        ceCertified: formData.ceCertified || '',
        // Media Boost fields
        mediaBoostEnabled: !!formData.mediaBoostEnabled,
        videoUrl: formData.mediaBoostEnabled ? (formData.videoUrl || null) : null,
        videoStoragePath: formData.mediaBoostEnabled ? (formData.videoStoragePath || null) : null,
        tempVideoPath: formData.mediaBoostEnabled ? (formData.tempVideoPath || (formData.videoStoragePath?.startsWith('temporary-listing-videos/') ? formData.videoStoragePath : null)) : null,
        tempVideoUrl: formData.mediaBoostEnabled ? (formData.tempVideoUrl || (formData.videoStoragePath?.startsWith('temporary-listing-videos/') ? formData.videoUrl : null)) : null,
        videoDurationSeconds: formData.mediaBoostEnabled ? (formData.videoDurationSeconds || null) : null,
        videoFileSize: formData.mediaBoostEnabled ? (formData.videoFileSize || null) : null,
        videoMimeType: formData.mediaBoostEnabled ? (formData.videoMimeType || null) : null,
        videoPaid: isStaff ? true : (originalAd?.videoPaid ? true : false),
        mediaBoostPrice: 2.00
      };

      // Preservar metadados e dados de pagamento de anúncios existentes
      if (id && originalAd) {
        if (originalAd.sourceUrl) adData.sourceUrl = originalAd.sourceUrl;
        if (originalAd.sourceSite) adData.sourceSite = originalAd.sourceSite;
        if (originalAd.sourceCheckedAt) adData.sourceCheckedAt = originalAd.sourceCheckedAt;
        if (originalAd.importedBy) adData.importedBy = originalAd.importedBy;
        if (originalAd.importedAt) adData.importedAt = originalAd.importedAt;
        if (originalAd.listingMode) adData.listingMode = originalAd.listingMode;
        if (originalAd.isClaimableBusiness !== undefined) adData.isClaimableBusiness = originalAd.isClaimableBusiness;
        if (originalAd.claimStatus !== undefined) adData.claimStatus = originalAd.claimStatus;
        if (originalAd.claimedBy) adData.claimedBy = originalAd.claimedBy;
        if (originalAd.claimedAt) adData.claimedAt = originalAd.claimedAt;
        if (Object.prototype.hasOwnProperty.call(originalAd, 'sellerEmail')) {
          adData.sellerEmail = originalAd.sellerEmail;
        }
        if (Object.prototype.hasOwnProperty.call(originalAd, 'userEmail')) {
          adData.userEmail = originalAd.userEmail;
        }
        if (originalAd.externalListing !== undefined) adData.externalListing = originalAd.externalListing;
        if (originalAd.externalStatus) adData.externalStatus = originalAd.externalStatus;
        if (originalAd.demoListing !== undefined) adData.demoListing = originalAd.demoListing;
        // Preservar dados de pagamento confirmados
        if (originalAd.paidAt) adData.paidAt = originalAd.paidAt;
        if ((originalAd as any).paymentCompletedAt) adData.paymentCompletedAt = (originalAd as any).paymentCompletedAt;
        if ((originalAd as any).paymentStatus) adData.paymentStatus = (originalAd as any).paymentStatus;
        if (originalAd.stripeCheckoutSessionId) adData.stripeCheckoutSessionId = originalAd.stripeCheckoutSessionId;
        if ((originalAd as any).paymentConfirmationEmailSent !== undefined) adData.paymentConfirmationEmailSent = (originalAd as any).paymentConfirmationEmailSent;
        if (originalAd.videoPaid !== undefined) adData.videoPaid = originalAd.videoPaid;
      }

      if (formData.category === '💚 Doações & Solidariedade') {
        const thirtyDaysOut = new Date();
        thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
        adData.isFeatured = true;
        adData.featuredUntil = thirtyDaysOut;
        adData.featuredLevel = "local";
        adData.featuredReason = "donation";
        adData.donationBoost = true;
        adData.donationBadge = true;
        adData.featuredActivatedAt = new Date();
      }

      if (isStaff) {
        const isFeaturedPlan = ['featured', 'highlight', 'local', 'national', 'intermediate', 'premium'].includes(formData.plan);
        if (isFeaturedPlan || formData.isPermanentFeatured) {
          adData.isFeatured = true;
          adData.featuredLevel = formData.plan === 'national' ? 'national' : 'local';
          if (formData.isPermanentFeatured) {
            const farFuture = new Date();
            farFuture.setFullYear(farFuture.getFullYear() + 100);
            adData.isPermanentFeatured = true;
            adData.featuredUntil = farFuture;
          } else {
            adData.featuredUntil = expirationDate;
          }
          adData.featuredActivatedAt = adData.featuredActivatedAt || new Date();
        } else if (formData.plan === 'free' && !formData.isPermanentFeatured) {
          adData.isFeatured = false;
          adData.isPermanentFeatured = false;
        }
      }

      // Boats for Hire will be featured in the dedicated Boats for Hire section if plan is featured/premium
      if (formData.listingIntent === 'hire' || formData.category === 'Boats for Hire') {
        if (formData.plan === 'featured' || formData.plan === 'premium' || formData.plan === 'local' || formData.plan === 'national') {
          adData.isFeatured = true;
          adData.featuredLevel = formData.plan === 'premium' || formData.plan === 'national' ? 'premium' : 'featured';
          adData.featuredUntil = expirationDate;
          adData.featuredActivatedAt = adData.featuredActivatedAt || new Date();
        }
      }

      // Proteger contra edição não autorizada de campos estratégicos em anúncios destacados com mais de 24h
      if (!isAdmin && !isModerator && isEditLocked && originalAd) {
        if (
          formData.title !== originalAd.title ||
          JSON.stringify(formData.images) !== JSON.stringify(originalAd.images) ||
          formData.category !== originalAd.category ||
          formData.country !== originalAd.country ||
          formData.city !== originalAd.city ||
          formData.plan !== originalAd.plan
        ) {
          showValidationError('Não é permitido alterar título, imagens, categoria, comunidade ou plano em anúncios em destaque após 24h.');
          return;
        }
      }

      // --- VERIFICAÇÃO DE DUPLICIDADE ---
      setLoading(true);
      
      // 1. Verificar se sourceUrl igual já existe globalmente (Bloquear Direto!)
      if (validSourceUrl) {
        const qSource = query(collection(db, 'ads'), where('sourceUrl', '==', validSourceUrl));
        const snapSource = await getDocs(qSource);
        const dupSourceAd = snapSource.docs.find(docSnap => docSnap.id !== adId);
        if (dupSourceAd) {
          showValidationError("Erro: Este link de importação já foi publicado ou importado em outro anúncio no ConnectBoat. Não são permitidos anúncios duplicados.");
          return;
        }
      }

      // 2. Buscar outros anúncios do mesmo vendedor para verificação inteligente de duplicidade
      const qSeller = query(collection(db, 'ads'), where('sellerId', '==', user.uid));
      const snapSeller = await getDocs(qSeller);
      const sellerAds = snapSeller.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as any));

      const dupEval = evaluateListingDuplicates(adData, sellerAds, adId);

      adData.isDuplicate = dupEval.isDuplicate;
      adData.duplicateLevel = dupEval.level;
      adData.duplicateReason = dupEval.explanationDetails || dupEval.reason;
      adData.duplicateOf = dupEval.matchedAdId || '';
      adData.duplicateScore = dupEval.score;
      adData.duplicateMatchedFields = dupEval.matchedFields || [];

      // Se for detetado duplicado (confirmado ou possível), exibe o aviso com opções adequadas
      if (dupEval.isDuplicate && dupEval.level !== 'none') {
        setDuplicateWarning({
          show: true,
          level: dupEval.level,
          reason: dupEval.reason,
          explanationDetails: dupEval.explanationDetails,
          matchedFields: dupEval.matchedFields,
          matchedAdId: dupEval.matchedAdId,
          matchedAdTitle: dupEval.matchedAdTitle,
          adData: adData,
          adId: adId,
          score: dupEval.score
        });
        setLoading(false);
        return;
      }

      // Se requerer pagamento (anúncio novo, upgrade de plano ou renovação), encaminhar para Stripe Checkout
      if (checkRequiresPayment()) {
        setPendingAdData(adData);
        setShowPaymentModal(true);
        setLoading(false);
        return;
      }

      await executeSaveAd(adData, adId);
    } catch (err: any) {
      console.error('[Submit Ad Exception]', err);
      handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, `ads/${id || 'new'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStripeCheckout = async () => {
    if (!pendingAdData) return;
    setLoading(true);
    try {
      // 1. Guardar o anúncio base primeiro no Firestore para termos um ID válido
      const finalizedId = pendingAdData.id || `ad_${user?.uid?.substring(0, 5) || 'user'}_${Date.now()}`;
      const activePlan = (formData.plan || 'standard').toLowerCase();
      const payloadToSave = { ...pendingAdData, id: finalizedId, plan: activePlan, status: 'pending' };
      
      await executeSaveAd(payloadToSave, finalizedId);

      // 2. Criar sessão de Stripe Hosted Checkout
      if (!user) {
        throw new Error('You must be signed in to start Stripe Checkout.');
      }

      const idToken = await user.getIdToken();

      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          itemType: 'ad_listing',
          plan: activePlan,
          country: formData.country,
          adId: finalizedId,
          mediaBoostEnabled: !!formData.mediaBoostEnabled && (!originalAd || !originalAd.videoPaid),
          successUrl: `${window.location.origin}/create-ad?stripe_success=true&ad_id=${finalizedId}&plan=${activePlan}`,
          cancelUrl: `${window.location.origin}/create-ad?stripe_cancel=true`
        })
      });

      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.errorMessage || data.error || 'Erro ao iniciar sessão do Stripe Checkout.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('[Stripe Checkout Error]', err);
      alert('Ocorreu um erro ao ligar ao servidor de pagamentos Stripe.');
      setLoading(false);
    }
  };

  const handleImportAd = async () => {
    const isStaff = isAdmin || isModerator || profile?.role === 'admin' || profile?.role === 'moderator';
    if (!isStaff) {
      setImportError('You do not have permission to perform this action.');
      return;
    }

    if (!importUrl.trim()) {
      setImportError('Please paste a listing link.');
      return;
    }

    const regex = /^https?:\/\//i;
    if (!regex.test(importUrl)) {
      setImportError('Please enter a valid link starting with http:// or https://.');
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);

    console.log('[Import Pipeline Stage 1] Initiating import for URL:', importUrl);

    try {
      console.log('[Import Pipeline Stage 2] Sending request to /api/import-ad...');
      const userRole = isAdmin ? 'admin' : isModerator ? 'moderator' : (profile?.role || 'user');
      const response = await fetch('/api/import-ad', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: importUrl,
          userId: user?.uid,
          userRole
        })
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('[Import Pipeline Error] Non-JSON response received:', response.status, response.statusText, textResponse.slice(0, 300));
        throw new Error(`[HTTP ${response.status}] Invalid response from API (/api/import-ad). Please try again.`);
      }

      const result = await response.json();

      if (response.ok && result?.success && result?.data) {
        console.log('[Import Pipeline Stage 3] Response received successfully:', result.data);
        const { title, description, price, city, country, category, images } = result.data;
        
        const isOlxPortugal = importUrl.toLowerCase().includes('olx.pt');
        const isGumtreeUk = importUrl.toLowerCase().includes('gumtree.com') || importUrl.toLowerCase().includes('gumtree.co.uk');
        
        // Match category case-insensitively. If no correspondence, set to empty string for manual selection
        const matchedCategory = categories.find(
          (c: string) => c.toLowerCase() === (category || '').toString().toLowerCase()
        ) || '';

        setFormData(prev => {
          let matchedCity = prev.city;
          let matchedCountry = prev.country;
          
          if (isOlxPortugal) {
            matchedCountry = 'Portugal';
            if (city) {
              const matchedPortCity = PORTUGAL_CITIES.find(c => c.toLowerCase() === city.toString().toLowerCase());
              if (matchedPortCity) {
                matchedCity = matchedPortCity;
              } else {
                matchedCity = city.trim();
              }
            }
          } else if (isGumtreeUk) {
            matchedCountry = 'Reino Unido';
            if (city) {
              const matchedUkCity = UK_CITIES.find(c => c.toLowerCase() === city.toString().toLowerCase());
              if (matchedUkCity) {
                matchedCity = matchedUkCity;
              } else {
                matchedCity = city.trim();
              }
            } else {
              matchedCity = UK_CITIES[0];
            }
          } else {
            if (city) {
              const matchedPortCity = PORTUGAL_CITIES.find(c => c.toLowerCase() === city.toString().toLowerCase());
              const matchedUkCity = UK_CITIES.find(c => c.toLowerCase() === city.toString().toLowerCase());
              
              if (matchedPortCity) {
                matchedCity = matchedPortCity;
                matchedCountry = 'Portugal';
              } else if (matchedUkCity) {
                matchedCity = matchedUkCity;
                matchedCountry = 'Reino Unido';
              }
            } else if (country) {
              const normCountry = country.toString().toLowerCase();
              if (normCountry === 'portugal') {
                matchedCountry = 'Portugal';
                matchedCity = PORTUGAL_CITIES[0];
              } else if (normCountry === 'reino unido' || normCountry === 'uk' || normCountry === 'united kingdom') {
                matchedCountry = 'Reino Unido';
                matchedCity = UK_CITIES[0];
              }
            }
          }

          console.log('[Import Pipeline Stage 4] Pre-filling form with extracted nautical and listing data...');

          return {
            ...prev,
            title: title || prev.title,
            description: description ? normalizeDescription(description) : prev.description,
            price: price !== undefined && price !== null ? formatPrice(parsePrice(price)) : prev.price,
            city: matchedCity || prev.city,
            country: matchedCountry || prev.country,
            category: matchedCategory || prev.category, // fallback nicely but keep empty choice as principal
            images: images && Array.isArray(images) && images.length > 0 ? images : prev.images,
            sourceUrl: importUrl,
            boatType: result.data.boatType !== undefined && result.data.boatType !== null ? result.data.boatType : (prev.boatType || ''),
            manufacturer: result.data.manufacturer ?? '',
            model: result.data.model ?? '',
            year: result.data.year !== undefined && result.data.year !== null ? result.data.year.toString() : '',
            condition: result.data.condition !== undefined && result.data.condition !== null ? result.data.condition : (prev.condition || ''),
            length: result.data.length ?? '',
            beam: result.data.beam ?? '',
            draft: result.data.draft ?? '',
            fuelType: result.data.fuelType ?? '',
            engineBrand: result.data.engineBrand ?? '',
            horsepower: result.data.horsepower ?? '',
            engineHours: result.data.engineHours ?? '',
            cabins: result.data.cabins ?? '',
            berths: result.data.berths ?? '',
            bathrooms: result.data.bathrooms ?? '',
            hullMaterial: result.data.hullMaterial ?? '',
            trailerIncluded: result.data.trailerIncluded ?? '',
            vatPaid: result.data.vatPaid ?? '',
            ceCertified: result.data.ceCertified ?? '',
          };
        });

        const detectedMarketplace = getSupportedMarketplace(importUrl);
        const sourceSiteName = detectedMarketplace ? detectedMarketplace.name : getSourceSiteFromUrl(importUrl);

        setImportSuccess(`Listing details imported from ${sourceSiteName}. Please review the information before publishing.`);
      } else {
        const stageMsg = result?.stage ? `[Stage: ${result.stage}] ` : '';
        const errorMsg = result?.error || 'Unable to import listing details. Please fill in manually.';
        console.error('[Import Pipeline Stage Failure]', stageMsg, errorMsg);
        throw new Error(`${stageMsg}${errorMsg}`);
      }
    } catch (err: any) {
      console.error('[Import Pipeline Error]:', err.message || err);
      setImportError(err.message || 'Unable to import listing details. Please fill in manually.');
    } finally {
      setIsImporting(false);
    }
  };

  const isPromoActive = settings?.launchPromoActive === true;
  const isStaff = isAdmin || isModerator || profile?.role === 'admin' || profile?.role === 'moderator';

  const isBoatCategory = useMemo(() => {
    if (!formData.category) return true;
    const cat = formData.category.trim();
    const nonBoatCategories = [
      'Boat Parts',
      'Boat Engines',
      'Marine Electronics',
      'Trailers',
      'Marinas',
      'Boat Services',
      'Accessories',
      'Jobs & Crew',
      'Wanted',
      'Peças & Acessórios',
      'Motores',
      'Electrónica Marítima',
      'Serviços',
      'Trabalho/Empregos',
      'Imigração'
    ];
    return !nonBoatCategories.includes(cat);
  }, [formData.category]);

  const isEngineCategory = formData.category === 'Boat Engines' || formData.category === 'Motores';
  const isPartsCategory = formData.category === 'Boat Parts' || formData.category === 'Marine Electronics' || formData.category === 'Trailers' || formData.category === 'Accessories' || formData.category === 'Peças & Acessórios' || formData.category === 'Electrónica Marítima';
  const isJobCategory = formData.category === 'Jobs & Crew' || formData.category === 'Trabalho/Empregos' || formData.category === 'Boat Jobs';
  const isImmigrationCategory = formData.category === 'Imigração';
  const isServiceCategory = formData.category === 'Boat Services' || formData.category === 'Marinas' || formData.category === 'Serviços' || formData.category?.startsWith('Serviços') || formData.category?.includes('Serviços');
  const isDonationCategory = formData.category === '💚 Doações & Solidariedade';

  if (fetching) return <div className="text-center py-20">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-6 font-medium transition-colors cursor-pointer">
        <ChevronLeft size={20} /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Wizard Form */}
        <div className="lg:col-span-7 xl:col-span-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-100"
          >
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {id ? 'Edit Listing' : 'New Listing'}
              </h1>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
                Step {currentStep} of 3
              </span>
            </div>

            {/* Step Wizard Navigation Header */}
            <div className="mb-8 border-b border-slate-200/80 pb-6">
              <div className="flex items-center justify-between max-w-xl mx-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (currentStep > 1) setCurrentStep(1);
                  }}
                  className={`flex items-center gap-2 text-xs sm:text-sm font-extrabold transition-all ${
                    currentStep === 1
                      ? 'text-indigo-600'
                      : currentStep > 1
                      ? 'text-slate-800 cursor-pointer hover:text-indigo-600'
                      : 'text-slate-400'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    currentStep === 1 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : currentStep > 1 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {currentStep > 1 ? <Check size={16} strokeWidth={3} /> : '1'}
                  </div>
                  <span className="hidden sm:inline">1. Basic Info</span>
                  <span className="sm:hidden">Basic</span>
                </button>

                <div className={`flex-1 h-1 mx-2 sm:mx-3 rounded-full transition-all ${currentStep >= 2 ? 'bg-emerald-500' : 'bg-slate-100'}`} />

                <button
                  type="button"
                  onClick={() => {
                    if (currentStep > 2) setCurrentStep(2);
                    else if (currentStep < 2) validateStep1AndProceed();
                  }}
                  className={`flex items-center gap-2 text-xs sm:text-sm font-extrabold transition-all ${
                    currentStep === 2
                      ? 'text-indigo-600'
                      : currentStep > 2
                      ? 'text-slate-800 cursor-pointer hover:text-indigo-600'
                      : 'text-slate-400'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    currentStep === 2 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : currentStep > 2 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {currentStep > 2 ? <Check size={16} strokeWidth={3} /> : '2'}
                  </div>
                  <span className="hidden sm:inline">2. Details</span>
                  <span className="sm:hidden">Details</span>
                </button>

                <div className={`flex-1 h-1 mx-2 sm:mx-3 rounded-full transition-all ${currentStep >= 3 ? 'bg-emerald-500' : 'bg-slate-100'}`} />

                <button
                  type="button"
                  onClick={() => {
                    if (currentStep < 3) {
                      if (validateStep1()) setCurrentStep(3);
                    }
                  }}
                  className={`flex items-center gap-2 text-xs sm:text-sm font-extrabold transition-all ${
                    currentStep === 3
                      ? 'text-indigo-600'
                      : 'text-slate-400'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    currentStep === 3 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-400'
                  }`}>
                    3
                  </div>
                  <span className="hidden sm:inline">3. Plan & Publish</span>
                  <span className="sm:hidden">Plan</span>
                </button>
              </div>
            </div>

        {id && isEditLocked && !isAdmin && (
          <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-3xl" id="edit-locked-warning">
            <h3 className="text-md font-extrabold text-amber-800 flex items-center gap-2 mb-1">
              <span>⚠️</span> Partial Edit Active (Protected Feature Status)
            </h3>
            <p className="text-xs sm:text-sm text-amber-700 leading-relaxed">
              This listing has an <strong>active feature status for over 24 hours</strong>. To ensure community safety and integrity (preventing post-payment product swaps), key fields such as <strong>Title, Images, Category, Location, and Featured Plan</strong> are locked.
            </p>
            <p className="text-xs sm:text-sm text-amber-700 mt-2 leading-relaxed">
              You can still freely modify the <strong>Description, Phone/WhatsApp contact info, or mark as Sold/Closed</strong>. Thank you for your understanding.
            </p>
          </div>
        )}

        {!id && (isAdmin || isModerator || profile?.role === 'admin' || profile?.role === 'moderator') && (
          <div className="mb-8 p-6 bg-indigo-50/40 border border-indigo-100/80 rounded-2xl" id="import-ad-section">
            <h3 className="text-md font-bold text-slate-900 flex items-center gap-2 mb-1">
              <Link className="text-indigo-600" size={18} />
              Create listing from URL
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mb-4">
              Paste the link of an existing listing and we will try to fill in the details automatically.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Paste listing link (e.g. https://...)"
                value={importUrl}
                onChange={(e) => {
                  setImportUrl(e.target.value);
                  setImportError(null);
                  setImportSuccess(null);
                }}
                disabled={isImporting}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleImportAd}
                disabled={isImporting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:bg-indigo-400 disabled:cursor-not-allowed cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <RefreshCcw className="animate-spin text-white" size={16} />
                    Importing...
                  </>
                ) : (
                  'Import Data'
                )}
              </button>
            </div>
            
            {importError && (
              <div className="mt-3 text-xs text-rose-600 font-bold flex items-center gap-1">
                <AlertCircle size={14} className="shrink-0" />
                {importError}
              </div>
            )}
            
            {importSuccess && (
              <div className="mt-3 text-xs text-emerald-600 font-bold flex items-center gap-1">
                <Check size={14} className="shrink-0" />
                {importSuccess}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {formError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 bg-rose-50 border-2 border-rose-200 text-rose-800 rounded-2xl flex items-start justify-between gap-3 shadow-sm"
              id="form-error-banner"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="text-sm font-bold text-rose-900">Aviso de Validação</h4>
                  <p className="text-xs text-rose-700 mt-0.5 leading-relaxed font-medium">{formError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormError(null)}
                className="text-rose-500 hover:text-rose-700 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </motion.div>
          )}

          {formData.sourceUrl && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3">
              <Check className="text-emerald-600 shrink-0 mt-0.5" size={18} id="import-banner" />
              <div className="text-xs sm:text-sm text-slate-600">
                This listing was imported from {getSourceSiteFromUrl(formData.sourceUrl)}. The contact button will direct to the original listing.
              </div>
            </div>
          )}

          {/* STEP 1 OF 3: BASIC INFORMATION */}
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Listing Intent Toggle */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 sm:p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-700/80 space-y-3">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Listing Purpose <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      listingIntent: 'sale',
                      category: prev.category === 'Boats for Hire' ? 'Motorboats & Powerboats' : prev.category
                    }))}
                    className={`p-3.5 rounded-xl border-2 flex items-center justify-center gap-2.5 transition-all cursor-pointer font-bold text-sm ${
                      formData.listingIntent === 'sale'
                        ? 'bg-sky-600 text-white border-sky-600 shadow-md'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-400'
                    }`}
                  >
                    <Tag size={18} />
                    <span>Boat for Sale</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      listingIntent: 'hire',
                      category: 'Boats for Hire'
                    }))}
                    className={`p-3.5 rounded-xl border-2 flex items-center justify-center gap-2.5 transition-all cursor-pointer font-bold text-sm ${
                      formData.listingIntent === 'hire'
                        ? 'bg-sky-600 text-white border-sky-600 shadow-md'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-400'
                    }`}
                  >
                    <Anchor size={18} />
                    <span>Boat for Hire</span>
                  </button>
                </div>
              </div>
              {/* 1. Photos (FIRST item) */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Photos *
                  </label>
                  <span className="text-xs font-bold text-slate-400">
                    {formData.images.length} of {maxAllowed} photos
                  </span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                  <AnimatePresence mode="popLayout">
                    {formData.images.map((url, index) => (
                      url && (
                        <motion.div
                          key={url}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          layout
                          className="relative w-full aspect-square bg-slate-100 rounded-2xl overflow-hidden group border border-slate-200 select-none"
                        >
                          <img 
                            src={url} 
                            alt={`Preview ${index}`} 
                            className={formData.listingType === 'informativo' ? "w-full h-full object-contain p-2 bg-slate-50" : "w-full h-full object-cover"} 
                            style={index === 0 && formData.listingType !== 'informativo' ? getAdImageStyle(imagePositionX, imagePositionY, imageZoom) : undefined} 
                          />

                          {/* Delete Button */}
                          {!(isEditLocked && !isAdmin) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeImage(index);
                              }}
                              className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all active:scale-95 shadow-lg z-20 cursor-pointer"
                              title="Remove photo"
                              aria-label="Remove photo"
                            >
                              <X size={14} />
                            </button>
                          )}

                          {/* Main Photo Badge vs Secondary Controls */}
                          {index === 0 ? (
                            <div className="absolute bottom-0 left-0 right-0 bg-indigo-600 text-white text-[10px] font-bold py-1.5 text-center uppercase tracking-wider z-10 shadow-md">
                              ★ Main Photo
                            </div>
                          ) : (
                            !(isEditLocked && !isAdmin) && (
                              <div className="absolute bottom-2 left-1.5 right-1.5 flex items-center justify-between gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10 bg-slate-900/80 p-1 rounded-xl backdrop-blur-sm">
                                <div className="flex items-center gap-0.5">
                                  {index > 1 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveImage(index, 'left');
                                      }}
                                      className="p-1 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
                                      title="Move left"
                                      aria-label="Move photo left"
                                    >
                                      <ChevronLeft size={14} />
                                    </button>
                                  )}
                                  {index < formData.images.length - 1 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveImage(index, 'right');
                                      }}
                                      className="p-1 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
                                      title="Move right"
                                      aria-label="Move photo right"
                                    >
                                      <ChevronRight size={14} />
                                    </button>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAsMainImage(index);
                                  }}
                                  className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-extrabold uppercase tracking-tight transition-colors cursor-pointer ml-auto"
                                  title="Set as Main Photo"
                                  aria-label="Set as Main Photo"
                                >
                                  Set as Main
                                </button>
                              </div>
                            )
                          )}
                        </motion.div>
                      )
                    ))}
                  </AnimatePresence>

                  {formData.images.length < maxAllowed && !(isEditLocked && !isAdmin) && (
                    <button
                      type="button"
                      onClick={() => setShowPhotoSourceMenu(true)}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      disabled={uploading}
                      className={`aspect-square border-2 border-dashed rounded-2xl flex items-center justify-center relative transition-colors duration-200 group disabled:opacity-50 disabled:cursor-not-allowed ${
                        isDragging
                          ? 'border-indigo-500 bg-indigo-50/50 text-indigo-600 scale-[1.02]'
                          : 'bg-slate-50 border-slate-200 hover:border-indigo-400 hover:bg-slate-100/50'
                      }`}
                    >
                      <div className="text-center p-4">
                        {uploading ? (
                          <div className="flex flex-col items-center gap-2">
                            <RefreshCcw className="animate-spin text-indigo-600" size={32} />
                            <span className="text-xs font-bold text-indigo-600">Uploading...</span>
                          </div>
                        ) : (
                          <>
                            <Plus className={`mx-auto mb-1 transition-colors ${isDragging ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-400'}`} size={32} />
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                              {isDragging ? 'Drop here' : 'Drag or Click'}
                            </p>
                            <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-tighter font-semibold">
                              (Photos)
                            </p>
                          </>
                        )}
                      </div>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  * First photo is the cover photo. Use arrows or &quot;Set as Main&quot; to reorder photos. Max 5MB per file.
                </p>

                {formData.images.length > 0 && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/60 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">Main Photo Framing Adjustment</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setImagePositionX(50); setImagePositionY(50); }}
                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-100"
                      >
                        Center
                      </button>
                      <button
                        type="button"
                        onClick={() => { setImagePositionX(50); setImagePositionY(50); setImageZoom(1); }}
                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-100"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Media Boost Optional Add-on Block */}
              <div className="p-6 bg-gradient-to-br from-indigo-50/80 via-white to-sky-50/60 border-2 border-indigo-200/90 rounded-3xl space-y-4 shadow-sm relative overflow-hidden">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-indigo-600 text-white p-1.5 rounded-xl text-xs font-black shadow-sm flex items-center justify-center">
                        📹
                      </span>
                      <h3 className="text-base font-black text-slate-900">
                        Media Boost — +£2.00
                      </h3>
                      <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        Optional Extra
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium max-w-xl leading-relaxed">
                      “Add a video of up to 60 seconds to showcase your boat and increase buyer or renter confidence.”
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1 select-none">
                    <input
                      type="checkbox"
                      checked={formData.mediaBoostEnabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData(prev => ({ ...prev, mediaBoostEnabled: checked }));
                        if (!checked && videoUploading) {
                          handleCancelVideoUpload();
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {formData.mediaBoostEnabled && (
                  <div className="pt-4 border-t border-indigo-100/90 space-y-3">
                    {formData.videoUrl ? (
                      <div className="p-4 bg-white border border-indigo-200 rounded-2xl flex items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0 text-xl">
                            🎬
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">Video attached to listing</p>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium flex-wrap mt-0.5">
                              {formData.videoDurationSeconds && <span>⏱️ {formData.videoDurationSeconds}s</span>}
                              {formData.videoFileSize && <span>• 📁 {(formData.videoFileSize / (1024 * 1024)).toFixed(1)} MB</span>}
                              <span className="text-emerald-600 font-bold">✅ Video Ready</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={formData.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-all"
                          >
                            Preview
                          </a>
                          <button
                            type="button"
                            onClick={handleRemoveVideo}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl transition-all"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : videoUploading ? (
                      <div className="p-4 bg-white border border-indigo-200 rounded-2xl space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 flex items-center gap-2">
                            <RefreshCcw className="animate-spin text-indigo-600" size={14} />
                            Uploading video... {videoUploadProgress}%
                          </span>
                          <button
                            type="button"
                            onClick={handleCancelVideoUpload}
                            className="text-xs font-bold text-rose-600 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 transition-all duration-300"
                            style={{ width: `${videoUploadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="block border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/40 rounded-2xl p-6 text-center cursor-pointer transition-all">
                          <input
                            type="file"
                            accept="video/mp4,video/quicktime,video/webm"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleVideoFileSelect(file);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                              <Upload size={20} />
                            </div>
                            <p className="text-xs font-bold text-slate-800">
                              Click to upload video
                            </p>
                            <p className="text-[11px] text-slate-500 font-medium">
                              MP4, MOV or WebM • Max 60 seconds • Max 150 MB
                            </p>
                          </div>
                        </label>
                      </div>
                    )}

                    {videoError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>{videoError}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Listing Title */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Listing Title *</label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    id="txt-ad-title"
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    disabled={!isAdmin && isEditLocked}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="Ex: Princess V48 Yacht (2021)"
                  />
                </div>
              </div>

              {/* 3. Description */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Description *</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-6 text-slate-400" size={20} />
                  <textarea
                    id="txt-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    rows={5}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all resize-none"
                    placeholder="Describe item condition, history, included accessories, etc."
                  />
                </div>
              </div>

              {/* 4. Category */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Category *</label>
                <select
                  value={formData.category}
                  disabled={!isAdmin && isEditLocked}
                  onChange={(e) => {
                    const cat = e.target.value;
                    const updatedData = { ...formData, category: cat };
                    if (cat === '💚 Doações & Solidariedade') {
                      updatedData.plan = 'local';
                      updatedData.price = '0';
                    }
                    setFormData(updatedData);
                  }}
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-medium"
                >
                  <option value="">Select a category...</option>
                  {categories
                    .filter(c => {
                      const isStaffOnly = c === 'Imigração' || c === 'Trabalho/Empregos';
                      if (isStaffOnly) {
                        return isAdmin || isModerator || profile?.role === 'admin' || profile?.role === 'moderator';
                      }
                      return true;
                    })
                    .map((c, index) => <option key={`category-${c}-${index}`} value={c}>{c}</option>)}
                </select>
              </div>

              {/* 5. Price */}
              {formData.category === '💚 Doações & Solidariedade' ? (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Price</label>
                  <div className="w-full px-4 py-4 bg-emerald-50 border-2 border-emerald-150 text-emerald-800 rounded-2xl font-extrabold flex items-center gap-2 select-none">
                    <span>💚 Free (Community Donation)</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Price ({formData.country === 'Reino Unido' ? '£' : '€'})
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl select-none leading-none z-10">
                      {formData.country === 'Reino Unido' ? '£' : '€'}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-bold text-slate-800"
                      placeholder="Ex: 799,950"
                    />
                  </div>
                </div>
              )}

              {/* Region */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Region *</label>
                <div className="relative">
                  <select
                    value={formData.region}
                    disabled={!isAdmin && isEditLocked}
                    onChange={(e) => {
                      const newRegion = e.target.value;
                      const regionCities = CITIES_BY_REGION[newRegion] || UK_CITIES;
                      setFormData(prev => ({
                        ...prev,
                        region: newRegion,
                        city: regionCities.includes(prev.city) ? prev.city : (regionCities[0] || 'Southampton')
                      }));
                    }}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 outline-none cursor-pointer appearance-none shadow-sm hover:border-slate-200 transition-all font-sans disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {UK_REGIONS.map(reg => (
                      <option key={reg} value={reg} className="font-bold text-slate-900 bg-white">
                        {reg}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400 font-bold select-none">
                    ▼
                  </div>
                </div>
              </div>

              {/* City / Town */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">City / Town *</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={20} />
                  <SearchableCitySelect
                    value={formData.city}
                    disabled={!isAdmin && isEditLocked}
                    onChange={(val) => setFormData(prev => ({ ...prev, city: val, region: prev.region || getRegionForCity(val) }))}
                    placeholder="e.g. Southampton, Glasgow, Cardiff..."
                    region={formData.region}
                  />
                </div>
              </div>

              {/* 8. Contact Phone */}
              <div className="space-y-3 p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Contact Phone</h4>
                <label className="flex items-center gap-3 cursor-pointer select-none py-1">
                  <input
                    type="checkbox"
                    checked={formData.useProfilePhone}
                    onChange={(e) => handleUseProfilePhoneChange(e.target.checked)}
                    className="w-5 h-5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 transition-all cursor-pointer"
                  />
                  <span className="text-sm font-bold text-slate-700">
                    Use phone from my profile <span className="text-slate-500 font-normal">({profile?.phone || 'No phone configured'})</span>
                  </span>
                </label>

                {!formData.useProfilePhone && (
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-600 focus:outline-none text-sm"
                    placeholder={formData.country === 'Reino Unido' ? '+44 7123 456789' : '+351 912 345 678'}
                  />
                )}
              </div>

              {/* Step 1 Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-200 mt-8">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="px-6 py-3.5 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  ← Cancel
                </button>

                <button
                  type="button"
                  onClick={validateStep1AndProceed}
                  className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 cursor-pointer"
                >
                  Continue →
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2 OF 3: BOAT DETAILS */}
          {currentStep === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Hire / Charter Specifications Block */}
              {(formData.listingIntent === 'hire' || formData.category === 'Boats for Hire') && (
                <div className="p-6 bg-gradient-to-br from-sky-900 to-slate-900 text-white rounded-3xl space-y-5 shadow-xl border border-sky-800">
                  <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
                      <Anchor size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">Hire & Charter Specifications</h3>
                      <p className="text-xs text-sky-200/80">Configure rental pricing, capacity, location & conditions</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Rental Price & Unit */}
                    <div>
                      <label className="text-xs font-bold uppercase text-sky-200">Rental Rate ({formData.country === 'Reino Unido' ? '£' : '€'})</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={formData.rentalPrice || formData.price}
                          onChange={(e) => setFormData({ ...formData, rentalPrice: e.target.value, price: e.target.value })}
                          placeholder="e.g. 250"
                          className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none text-sm font-bold"
                        />
                        <select
                          value={formData.pricingUnit}
                          onChange={(e) => setFormData({ ...formData, pricingUnit: e.target.value })}
                          className="px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none text-sm font-bold cursor-pointer shrink-0"
                        >
                          {PRICING_UNITS.map(unit => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Departure Location */}
                    <div>
                      <label className="text-xs font-bold uppercase text-sky-200">Departure Location / Marina</label>
                      <input
                        type="text"
                        value={formData.departureLocation}
                        onChange={(e) => setFormData({ ...formData, departureLocation: e.target.value })}
                        placeholder="e.g. Southampton Marina, Pontoon 4"
                        className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none text-sm mt-1"
                      />
                    </div>

                    {/* Passenger Capacity */}
                    <div>
                      <label className="text-xs font-bold uppercase text-sky-200">Passenger Capacity</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={formData.passengerCapacity}
                        onChange={(e) => setFormData({ ...formData, passengerCapacity: e.target.value })}
                        placeholder="e.g. 8 passengers"
                        className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none text-sm mt-1"
                      />
                    </div>

                    {/* Minimum Hire Duration */}
                    <div>
                      <label className="text-xs font-bold uppercase text-sky-200">Minimum Hire Duration</label>
                      <input
                        type="text"
                        value={formData.minimumHireDuration}
                        onChange={(e) => setFormData({ ...formData, minimumHireDuration: e.target.value })}
                        placeholder="e.g. 2 Hours or 1 Day"
                        className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none text-sm mt-1"
                      />
                    </div>

                    {/* Skipper Included */}
                    <div>
                      <label className="text-xs font-bold uppercase text-sky-200">Skipper / Captain Included?</label>
                      <select
                        value={formData.skipperIncluded === true ? 'Yes' : (formData.skipperIncluded === false ? 'No' : formData.skipperIncluded)}
                        onChange={(e) => setFormData({ ...formData, skipperIncluded: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none text-sm mt-1 cursor-pointer font-bold"
                      >
                        <option value="Yes">Yes (Skipper Included)</option>
                        <option value="No">No (Bareboat / Self-Drive)</option>
                        <option value="Optional">Optional (On Request)</option>
                      </select>
                    </div>

                    {/* Fuel Included */}
                    <div>
                      <label className="text-xs font-bold uppercase text-sky-200">Fuel Included?</label>
                      <select
                        value={formData.fuelIncluded === true ? 'Yes' : (formData.fuelIncluded === false ? 'No' : formData.fuelIncluded)}
                        onChange={(e) => setFormData({ ...formData, fuelIncluded: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none text-sm mt-1 cursor-pointer font-bold"
                      >
                        <option value="Yes">Yes (Fuel Included)</option>
                        <option value="No">No (Pay Fuel Used)</option>
                      </select>
                    </div>

                    {/* Security Deposit */}
                    <div>
                      <label className="text-xs font-bold uppercase text-sky-200">Security Deposit ({formData.country === 'Reino Unido' ? '£' : '€'})</label>
                      <input
                        type="text"
                        value={formData.securityDeposit}
                        onChange={(e) => setFormData({ ...formData, securityDeposit: e.target.value })}
                        placeholder="e.g. 500 (Refundable)"
                        className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none text-sm mt-1"
                      />
                    </div>

                    {/* Equipment Included */}
                    <div>
                      <label className="text-xs font-bold uppercase text-sky-200">Available Equipment</label>
                      <input
                        type="text"
                        value={formData.availableEquipment}
                        onChange={(e) => setFormData({ ...formData, availableEquipment: e.target.value })}
                        placeholder="e.g. Life jackets, GPS, Fishing gear, Watersports"
                        className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none text-sm mt-1"
                      />
                    </div>

                    {/* Rental Rules */}
                    <div className="md:col-span-2">
                      <label className="text-xs font-bold uppercase text-sky-200">Rental Rules & Licensing Requirements</label>
                      <input
                        type="text"
                        value={formData.rentalRules}
                        onChange={(e) => setFormData({ ...formData, rentalRules: e.target.value })}
                        placeholder="e.g. RYA Level 2 required for bareboat, Age 21+, No pets, Max 8 people"
                        className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none text-sm mt-1"
                      />
                    </div>

                    {/* Availability Notes */}
                    <div className="md:col-span-2">
                      <label className="text-xs font-bold uppercase text-sky-200">Availability & Seasonal Notes</label>
                      <input
                        type="text"
                        value={formData.availabilityNotes}
                        onChange={(e) => setFormData({ ...formData, availabilityNotes: e.target.value })}
                        placeholder="e.g. Available April - October, weekend bookings require 48h advance notice"
                        className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none text-sm mt-1"
                      />
                    </div>
                  </div>
                </div>
              )}
              {/* Mobile Sticky Preview Header */}
              <div className="lg:hidden sticky top-16 z-30 bg-white/95 backdrop-blur-md border border-indigo-100 rounded-2xl p-3 shadow-lg mb-4 flex items-center gap-3">
                {formData.images[0] ? (
                  <img src={formData.images[0]} alt="Cover" className="w-12 h-12 object-cover rounded-xl shrink-0" />
                ) : (
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                    📷
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-900 truncate">{formData.title || 'Untitled Listing'}</p>
                  <p className="text-xs font-black text-indigo-600">
                    {formData.category === '💚 Doações & Solidariedade' ? 'Free (Donation)' : formData.price ? (formData.country === 'Reino Unido' ? `£${formData.price}` : `€${formData.price}`) : 'Price on request'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold truncate">{formData.category} • {formData.city || 'No city'}</p>
                </div>
              </div>

              {/* Boat Category Technical Specs */}
              {isBoatCategory && (
                <div className="space-y-6">
                  {/* Boat Specs Group 1: Type, Manufacturer, Model, Year, Condition */}
                  <div className="p-6 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl space-y-5 shadow-xl border border-slate-800">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                        <Anchor size={20} />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-white">Boat Identification</h3>
                        <p className="text-xs text-slate-300">Enter technical boat details</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-300">Boat Type</label>
                        <select
                          value={formData.boatType}
                          onChange={(e) => setFormData({ ...formData, boatType: e.target.value })}
                          disabled={!isAdmin && isEditLocked}
                          className="w-full px-3.5 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none text-sm"
                        >
                          <option value="">Select boat type...</option>
                          {BOAT_TYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-300">Manufacturer</label>
                        <input
                          type="text"
                          value={formData.manufacturer}
                          onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                          placeholder="Ex: Princess, Sunseeker"
                          disabled={!isAdmin && isEditLocked}
                          className="w-full px-3.5 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-300">Model</label>
                        <input
                          type="text"
                          value={formData.model}
                          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                          placeholder="Ex: V48, Oceanis 40.1"
                          disabled={!isAdmin && isEditLocked}
                          className="w-full px-3.5 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-300">Year</label>
                        <input
                          type="number"
                          min="1900"
                          max={new Date().getFullYear() + 1}
                          value={formData.year}
                          onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                          placeholder="Ex: 2021"
                          disabled={!isAdmin && isEditLocked}
                          className="w-full px-3.5 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none text-sm"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-bold uppercase text-slate-300">Condition</label>
                        <select
                          value={formData.condition}
                          onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                          disabled={!isAdmin && isEditLocked}
                          className="w-full px-3.5 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none text-sm"
                        >
                          <option value="">Select condition...</option>
                          {BOAT_CONDITIONS.map((cond) => (
                            <option key={cond} value={cond}>{cond}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Dimensions */}
                  <div className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl space-y-4">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Ruler size={18} className="text-indigo-600" /> Dimensions & Construction
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700">Length (LOA)</label>
                        <input
                          type="text"
                          value={formData.length}
                          onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                          placeholder="Ex: 38 ft / 11.6 m"
                          className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700">Beam (Width)</label>
                        <input
                          type="text"
                          value={formData.beam}
                          onChange={(e) => setFormData({ ...formData, beam: e.target.value })}
                          placeholder="Ex: 12 ft / 3.6 m"
                          className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700">Draft</label>
                        <input
                          type="text"
                          value={formData.draft}
                          onChange={(e) => setFormData({ ...formData, draft: e.target.value })}
                          placeholder="Ex: 3.5 ft / 1.0 m"
                          className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700">Hull Material</label>
                        <select
                          value={formData.hullMaterial}
                          onChange={(e) => setFormData({ ...formData, hullMaterial: e.target.value })}
                          className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm"
                        >
                          <option value="">Select material...</option>
                          {BOAT_HULL_MATERIALS.map((mat) => (
                            <option key={mat} value={mat}>{mat}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Engine & Mechanics */}
                  <div className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl space-y-4">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Gauge size={18} className="text-indigo-600" /> Engine & Mechanics
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700">Engine Brand</label>
                        <input
                          type="text"
                          value={formData.engineBrand}
                          onChange={(e) => setFormData({ ...formData, engineBrand: e.target.value })}
                          placeholder="Ex: Volvo Penta"
                          className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700">Horsepower</label>
                        <input
                          type="text"
                          value={formData.horsepower}
                          onChange={(e) => setFormData({ ...formData, horsepower: e.target.value })}
                          placeholder="Ex: 300 HP"
                          className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700">Engine Hours</label>
                        <input
                          type="text"
                          value={formData.engineHours}
                          onChange={(e) => setFormData({ ...formData, engineHours: e.target.value })}
                          placeholder="Ex: 250 hrs"
                          className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700">Fuel Type</label>
                        <select
                          value={formData.fuelType}
                          onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}
                          className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm"
                        >
                          <option value="">Select fuel...</option>
                          {BOAT_FUEL_TYPES.map((fuel) => (
                            <option key={fuel} value={fuel}>{fuel}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Accommodations & Compliance */}
                  <div className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl space-y-4">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Compass size={18} className="text-indigo-600" /> Accommodations & Extras
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700">Cabins</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.cabins}
                          onChange={(e) => setFormData({ ...formData, cabins: e.target.value })}
                          className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700">Berths</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.berths}
                          onChange={(e) => setFormData({ ...formData, berths: e.target.value })}
                          className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700">Bathrooms</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.bathrooms}
                          onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                          className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700">Trailer</label>
                        <select
                          value={formData.trailerIncluded}
                          onChange={(e) => setFormData({ ...formData, trailerIncluded: e.target.value })}
                          className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm"
                        >
                          <option value="No">No</option>
                          <option value="Yes">Yes</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Non-boat category specs if applicable */}
              {!isBoatCategory && (
                <div className="p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl space-y-4">
                  <p className="text-xs text-slate-500 font-medium">
                    Technical boat specifications are skipped for <strong>{formData.category || 'this category'}</strong>. Click continue to proceed.
                  </p>
                </div>
              )}

              {/* Step 2 Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-200 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep(1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-6 py-3.5 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  ← Back
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep(3);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 cursor-pointer"
                >
                  Continue →
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3 OF 3: REVIEW & PLAN */}
          {currentStep === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Mobile Sticky Preview Header */}
              <div className="lg:hidden sticky top-16 z-30 bg-white/95 backdrop-blur-md border border-indigo-100 rounded-2xl p-3 shadow-lg mb-4 flex items-center gap-3">
                {formData.images[0] ? (
                  <img src={formData.images[0]} alt="Cover" className="w-12 h-12 object-cover rounded-xl shrink-0" />
                ) : (
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                    📷
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-900 truncate">{formData.title || 'Untitled Listing'}</p>
                  <p className="text-xs font-black text-indigo-600">
                    {formData.category === '💚 Doações & Solidariedade' ? 'Free (Donation)' : formData.price ? (formData.country === 'Reino Unido' ? `£${formData.price}` : `€${formData.price}`) : 'Price on request'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold truncate">{formData.category} • {formData.city || 'No city'}</p>
                </div>
              </div>

              {/* Complete Listing Summary */}
              <div className="p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl space-y-3">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span>📋</span> Complete Listing Summary
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-white p-4 rounded-2xl border border-slate-200">
                  <div>
                    <span className="text-slate-400 block font-semibold">Title</span>
                    <span className="font-extrabold text-slate-800">{formData.title || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Price</span>
                    <span className="font-extrabold text-indigo-600">
                      {formData.category === '💚 Doações & Solidariedade' ? 'Free' : formData.price ? (formData.country === 'Reino Unido' ? `£${formData.price}` : `€${formData.price}`) : 'On request'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Category</span>
                    <span className="font-bold text-slate-800">{formData.category || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Region & City</span>
                    <span className="font-bold text-slate-800">{formData.region ? `${formData.region} • ` : ''}{formData.city || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Contact Phone</span>
                    <span className="font-bold text-slate-800">{formData.useProfilePhone ? (profile?.phone || 'Profile Phone') : (formData.contactPhone || '—')}</span>
                  </div>
                  {formData.year && (
                    <div>
                      <span className="text-slate-400 block font-semibold">Year / Specs</span>
                      <span className="font-bold text-slate-800">{formData.year} {formData.length ? `• ${formData.length}` : ''}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Select Plan (prices controlled by Admin settings) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span>⭐</span> Choose Listing Plan
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500">
                    {formData.listingIntent === 'hire' || formData.category === 'Boats for Hire' ? '⚓ Boat for Hire' : '🛥️ Boat for Sale'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Standard Listing */}
                  <button
                    type="button"
                    disabled={!isAdmin && isEditLocked}
                    onClick={() => setFormData({ ...formData, plan: 'standard' })}
                    className={`p-5 rounded-3xl border-2 text-left transition-all relative overflow-hidden cursor-pointer ${
                      formData.plan === 'standard' || (!formData.plan || formData.plan === 'free')
                        ? 'border-emerald-600 bg-emerald-50/40 ring-4 ring-emerald-100'
                        : 'border-slate-200 bg-white hover:border-emerald-300'
                    }`}
                  >
                    <div className="absolute top-0 right-0 bg-slate-800 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                      Standard
                    </div>
                    <p className="font-black text-slate-900 text-base">Standard Listing</p>
                    <p className="text-xs text-slate-500 mt-0.5">30 days active listing in marketplace search</p>

                    <ul className="text-xs text-slate-600 space-y-1.5 my-4 font-medium">
                      <li>📷 <strong>Up to {getMaxPhotosForPlan('standard')} Photos</strong></li>
                      <li>💬 Direct WhatsApp Contact</li>
                      <li>🔍 Standard Search & Category</li>
                    </ul>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-500">Duration: 30 Days</span>
                      <span className="font-black text-emerald-700 text-base">
                        £{getPlanPrice('standard').toFixed(2)}
                      </span>
                    </div>
                  </button>

                  {/* Featured Listing */}
                  <button
                    type="button"
                    disabled={!isAdmin && isEditLocked}
                    onClick={() => setFormData({ ...formData, plan: 'featured' })}
                    className={`p-5 rounded-3xl border-2 text-left transition-all relative overflow-hidden cursor-pointer ${
                      formData.plan === 'featured' || formData.plan === 'local' || formData.plan === 'highlight'
                        ? 'border-amber-500 bg-amber-50/40 ring-4 ring-amber-100'
                        : 'border-slate-200 bg-white hover:border-amber-300'
                    }`}
                  >
                    <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-yellow-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                      Featured ⭐
                    </div>
                    <p className="font-black text-slate-900 text-base">Featured Listing</p>
                    <p className="text-xs text-slate-500 mt-0.5">Homepage highlight & priority placement</p>

                    <ul className="text-xs text-slate-600 space-y-1.5 my-4 font-medium">
                      <li>🌟 <strong>Includes Standard benefits</strong></li>
                      <li>📷 <strong>Up to {getMaxPhotosForPlan('featured')} Photos</strong></li>
                      <li>🌟 <strong>Homepage Highlight</strong></li>
                      <li>🌟 Priority in Search Results</li>
                    </ul>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-500">Duration: 30 Days</span>
                      <span className="font-black text-amber-600 text-base">
                        £{getPlanPrice('featured').toFixed(2)}
                      </span>
                    </div>
                  </button>

                  {/* Premium Featured */}
                  <button
                    type="button"
                    disabled={!isAdmin && isEditLocked}
                    onClick={() => setFormData({ ...formData, plan: 'premium' })}
                    className={`p-5 rounded-3xl border-2 text-left transition-all relative overflow-hidden cursor-pointer ${
                      formData.plan === 'premium' || formData.plan === 'national'
                        ? 'border-indigo-600 bg-indigo-50/40 ring-4 ring-indigo-100'
                        : 'border-slate-200 bg-white hover:border-indigo-300'
                    }`}
                  >
                    <div className="absolute top-0 right-0 bg-gradient-to-l from-indigo-600 to-indigo-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                      Premium 👑
                    </div>
                    <p className="font-black text-slate-900 text-base">Premium Featured</p>
                    <p className="text-xs text-slate-500 mt-0.5">Top positions inside featured section & max reach</p>

                    <ul className="text-xs text-slate-600 space-y-1.5 my-4 font-medium">
                      <li>👑 <strong>Includes Featured benefits</strong></li>
                      <li>📷 <strong>Up to {getMaxPhotosForPlan('premium')} Photos</strong></li>
                      <li>🚀 <strong>Top Spot Priority</strong></li>
                      <li>💥 Maximum Exposure</li>
                    </ul>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-500">Duration: 30 Days</span>
                      <span className="font-black text-indigo-600 text-base">
                        £{getPlanPrice('premium').toFixed(2)}
                      </span>
                    </div>
                  </button>
                </div>

                {isStaff && (
                  <div className="p-4 bg-amber-500/10 border-2 border-amber-500/25 rounded-2xl flex items-center gap-3 mt-4">
                    <input
                      id="isPermanentFeatured"
                      type="checkbox"
                      checked={formData.isPermanentFeatured}
                      onChange={(e) => setFormData(prev => ({ ...prev, isPermanentFeatured: e.target.checked }))}
                      className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
                    />
                    <label htmlFor="isPermanentFeatured" className="text-xs font-bold text-slate-800 cursor-pointer">
                      ⭐ Permanent Staff Highlight (Never Expires)
                    </label>
                  </div>
                )}
              </div>

              {/* Order Summary Breakdown */}
              <div className="p-6 bg-slate-50/80 border-2 border-slate-200/80 rounded-3xl space-y-3">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span>💳</span> Order Summary
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between font-medium text-slate-700">
                    <span>
                      {formData.plan === 'premium' ? 'Premium Featured Listing' : formData.plan === 'featured' ? 'Featured Listing' : 'Standard Listing'} (30 Days)
                    </span>
                    <span className="font-bold text-slate-900">
                      £{getPlanPrice(formData.plan).toFixed(2)}
                    </span>
                  </div>

                  {formData.mediaBoostEnabled && (
                    <div className="flex items-center justify-between font-medium text-slate-700">
                      <span className="flex items-center gap-1.5 text-indigo-700 font-bold">
                        <span>📹</span> Media Boost — 60s Video Extra
                      </span>
                      <span className="font-bold text-indigo-600">
                        {originalAd?.videoPaid ? 'Included (Paid)' : '£2.00'}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-black text-slate-900">
                    <span>Total Payment</span>
                    <span className="text-indigo-600 text-lg">
                      £{getCheckoutTotalAmountFormatted()}
                    </span>
                  </div>
                </div>
              </div>

              {formError && (
                <div className="p-4 bg-rose-50 border-2 border-rose-200 text-rose-800 rounded-2xl flex items-center justify-between text-xs font-bold">
                  <span>{formError}</span>
                  <button type="button" onClick={() => setFormError(null)}>
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Step 3 Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-200 mt-8">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep(2);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-6 py-3.5 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  ← Back
                </button>

                <button
                  id="btn-submit-ad"
                  type="submit"
                  disabled={loading}
                  className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-extrabold text-base transition-all shadow-xl shadow-indigo-200 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCcw className="animate-spin text-white" size={18} />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>
                      {checkRequiresPayment() 
                        ? 'Proceed to Payment →' 
                        : (id ? 'Save Changes' : 'Publish Listing')}
                    </span>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </form>
      </motion.div>
    </div>

    {/* Right Column: Sticky Live Listing Preview Panel (Desktop) */}
    <div className="hidden lg:block lg:col-span-5 xl:col-span-4">
      <div className="sticky top-24 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <span>👁️</span> Live Listing Preview
          </span>
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
            Real-time
          </span>
        </div>

        {/* Live Rendered Card */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm transition-all duration-200">
          {/* Photo Container */}
          <div className="aspect-[4/3] bg-slate-900 relative overflow-hidden">
            {formData.images.length > 0 ? (
              <img
                src={formData.images[0]}
                alt={formData.title || 'Preview'}
                className={formData.listingType === 'informativo' ? "w-full h-full object-contain p-2 bg-slate-50" : "w-full h-full object-cover"}
                style={formData.listingType !== 'informativo' ? getAdImageStyle(imagePositionX, imagePositionY, imageZoom) : undefined}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-100/80">
                <ImageIcon size={32} className="opacity-30" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Photo Preview</span>
              </div>
            )}

            {/* Badge Overlay */}
            <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 shadow-md">
              <span>
                {formData.plan === 'national' ? 'National ⭐⭐⭐' : formData.plan === 'local' ? 'Local ⭐' : 'Standard'}
              </span>
            </div>

            {/* Photos Count */}
            {formData.images.length > 0 && (
              <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                📷 {formData.images.length}
              </div>
            )}
          </div>

          {/* Card Body */}
          <div className="p-4 space-y-2 text-left">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
              <span className="text-indigo-600 uppercase tracking-wider truncate max-w-[140px]">
                {formData.category || 'Category'}
              </span>
              <span className="flex items-center gap-1 text-slate-600 shrink-0">
                <MapPin size={12} /> {formData.city || 'City'}
              </span>
            </div>

            <h4 className="font-extrabold text-slate-900 text-sm line-clamp-2 leading-snug">
              {formData.title || 'Listing Title'}
            </h4>

            <div className="text-base font-black text-indigo-600 pt-1">
              {formData.category === '💚 Doações & Solidariedade'
                ? 'Free (Donation)'
                : formData.price
                ? (formData.country === 'Reino Unido' ? `£${formData.price}` : `€${formData.price}`)
                : 'Price on Application'}
            </div>

            {/* Technical specs summary */}
            {(formData.year || formData.boatType || formData.length || formData.horsepower) && (
              <div className="pt-2 border-t border-slate-200/60 flex flex-wrap gap-1 text-[10px] text-slate-600 font-semibold">
                {formData.boatType && <span className="bg-slate-200/70 px-2 py-0.5 rounded-md">{formData.boatType}</span>}
                {formData.year && <span className="bg-slate-200/70 px-2 py-0.5 rounded-md">{formData.year}</span>}
                {formData.length && <span className="bg-slate-200/70 px-2 py-0.5 rounded-md">{formData.length}</span>}
                {formData.horsepower && <span className="bg-slate-200/70 px-2 py-0.5 rounded-md">{formData.horsepower}</span>}
              </div>
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate-400 font-medium text-center leading-relaxed">
          This live preview updates automatically as you fill in details across all 3 steps.
        </p>
      </div>
    </div>
  </div>

      {/* Stripe Checkout Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100"
            >
              {/* Header */}
              <div className="relative p-6 bg-gradient-to-br from-indigo-900 to-slate-950 text-white">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setLoading(false);
                  }}
                  className="absolute top-4 right-4 text-white/75 hover:text-white bg-white/10 p-2 rounded-full transition-all"
                >
                  <X size={16} />
                </button>
                <div className="flex items-center gap-2 text-indigo-400 font-black tracking-widest text-[10px] uppercase">
                  <ShieldCheck size={14} />
                  <span>Stripe Secure Hosted Checkout</span>
                </div>
                <h3 className="text-xl font-bold mt-2">Highlight Your Listing</h3>
                <p className="text-xs text-slate-300 mt-1">Multiply your views by up to 10x and sell faster.</p>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                {/* Summary */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>
                      {formData.plan === 'premium' ? 'Premium Featured Listing (30 days)' : formData.plan === 'featured' || formData.plan === 'local' || formData.plan === 'national' ? 'Featured Listing (30 days)' : 'Standard Listing (30 days)'}
                    </span>
                    <span className="font-bold text-slate-900">
                      £{getPlanPrice(formData.plan).toFixed(2)}
                    </span>
                  </div>
                  {formData.mediaBoostEnabled && (
                    <div className="flex justify-between text-xs text-slate-600">
                      <span className="font-bold text-indigo-700">Media Boost — Listing Video (60s)</span>
                      <span className="font-bold text-indigo-600">
                        {originalAd?.videoPaid ? 'Paid' : '£2.00'}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Fees & processing</span>
                    <span className="font-semibold text-emerald-600">Free</span>
                  </div>
                  <div className="border-t border-slate-200/50 pt-2 flex justify-between text-sm font-bold text-slate-900">
                    <span>Total due</span>
                    <span className="text-indigo-600">
                      £{getCheckoutTotalAmountFormatted()}
                    </span>
                  </div>
                </div>

                {/* Stripe Hosted Checkout Notice */}
                <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Encrypted Stripe Checkout</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      You will be redirected securely to Stripe's encrypted payment checkout to complete your transaction with Visa, Mastercard, or Apple Pay.
                    </p>
                  </div>
                </div>

                {/* Security and Logos */}
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">🔒 256-bit SSL Secure</span>
                  <div className="flex gap-1.5 opacity-60">
                    <span className="px-1 py-0.5 border border-slate-200 rounded bg-slate-50 font-black text-[8px] tracking-tighter">VISA</span>
                    <span className="px-1 py-0.5 border border-slate-200 rounded bg-slate-50 font-black text-[8px] tracking-tighter">MC</span>
                    <span className="px-1 py-0.5 border border-slate-200 rounded bg-slate-50 font-black text-[8px] tracking-tighter">STRIPE</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleStripeCheckout}
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white font-extrabold py-4 rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <RefreshCcw className="animate-spin" size={16} /> Connecting to Stripe Checkout...
                      </span>
                    ) : (
                      <span>
                        Pay £{getCheckoutTotalAmountFormatted()} with Stripe
                      </span>
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setLoading(false);
                    }}
                    className="w-full text-center py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                  >
                    Cancel and return to listing
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {duplicateWarning && duplicateWarning.show && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100"
            >
              {/* Header */}
              {duplicateWarning.level === 'confirmed' ? (
                <div className="relative p-6 bg-red-50 border-b border-red-100 text-slate-900 flex items-start gap-4">
                  <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center shrink-0">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-red-950">Exact Duplicate Listing</h3>
                    <p className="text-xs text-red-700 mt-1 font-medium">
                      This listing appears to be an exact duplicate of one you already published.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative p-6 bg-amber-50 border-b border-amber-100 text-slate-900 flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-amber-950">Similar Listing Found</h3>
                    <p className="text-xs text-amber-800 mt-1 font-medium">
                      We found a similar listing. Please confirm that this is a different boat before continuing.
                    </p>
                  </div>
                </div>
              )}

              {/* Body */}
              <div className="p-6 space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">Matching Details:</span>
                  <p className="text-sm text-slate-800 leading-relaxed font-semibold">
                    {duplicateWarning.reason}
                  </p>
                  {duplicateWarning.explanationDetails && (
                    <p className="text-xs text-slate-600 leading-relaxed bg-white p-2.5 rounded-xl border border-slate-100 font-mono">
                      {duplicateWarning.explanationDetails}
                    </p>
                  )}
                  {duplicateWarning.matchedFields && duplicateWarning.matchedFields.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {duplicateWarning.matchedFields.map((field) => (
                        <span key={field} className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md uppercase tracking-wider">
                          {field.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {duplicateWarning.level === 'confirmed' ? (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Duplicate listings are strictly prevented to maintain marketplace quality. Please review or update your existing advertisement.
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    If this is a different boat (e.g. same price or marina, but different specifications/photos), you can safely continue publishing.
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="p-6 pt-0 flex flex-col sm:flex-row gap-3">
                {duplicateWarning.matchedAdId && (
                  <button
                    type="button"
                    onClick={() => {
                      window.open(`/listing/${duplicateWarning.matchedAdId}`, '_blank');
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3.5 px-4 rounded-xl transition-all text-center text-sm cursor-pointer border border-slate-200 flex items-center justify-center gap-1.5"
                  >
                    View existing listing
                  </button>
                )}

                {duplicateWarning.level === 'confirmed' ? (
                  <button
                    type="button"
                    onClick={() => setDuplicateWarning(null)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-extrabold py-3.5 px-4 rounded-xl transition-all text-center text-sm shadow-md cursor-pointer"
                  >
                    Edit listing details
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      const finalAdData = duplicateWarning.adData;
                      const finalAdId = duplicateWarning.adId;
                      finalAdData.duplicateUserChoice = 'continued_different_boat';
                      setDuplicateWarning(null);
                      
                      if (checkRequiresPayment()) {
                        setPendingAdData(finalAdData);
                        setShowPaymentModal(true);
                      } else {
                        await executeSaveAd(finalAdData, finalAdId);
                      }
                    }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 px-4 rounded-xl transition-all text-center text-sm shadow-md cursor-pointer"
                  >
                    Continue — this is a different boat
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Global Save Success Temporary Overlay (2 seconds feedback) */}
        {saveSuccessMsg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white border border-slate-100 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                <Check size={32} strokeWidth={3} className="animate-pulse" />
              </div>
              <h3 className="text-xl font-brand font-black text-slate-900">Saved Successfully!</h3>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">{saveSuccessMsg}</p>
            </motion.div>
          </motion.div>
        )}

        {/* Foto Source Selector Menu Modality */}
        {showPhotoSourceMenu && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50">
            {/* Dark dismissable backdrop overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPhotoSourceMenu(false)}
              className="absolute inset-0 bg-slate-950/40"
            />

            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border border-slate-100 p-6 space-y-4 z-10 text-slate-800"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Add Photo</h3>
                <button
                  type="button"
                  onClick={() => setShowPhotoSourceMenu(false)}
                  className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-full transition-all cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 gap-3 pt-2">
                {/* Clean Camera option */}
                <button
                  type="button"
                  onClick={() => {
                    setShowPhotoSourceMenu(false);
                    // Minimal delay to let backdrop clear properly
                    setTimeout(() => cameraInputRef.current?.click(), 150);
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl font-black text-sm text-left border border-indigo-150 transition-all active:scale-95 cursor-pointer shadow-2xs"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                    <Camera size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-extrabold text-sm text-slate-900">Take Photo (Camera)</p>
                    <p className="text-[11px] text-slate-500 font-medium">Opens native camera to take a photo</p>
                  </div>
                </button>

                {/* Gallery option */}
                <button
                  type="button"
                  onClick={() => {
                    setShowPhotoSourceMenu(false);
                    setTimeout(() => fileInputRef.current?.click(), 150);
                  }}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-2xl font-black text-sm text-left border border-slate-200 transition-all active:scale-95 cursor-pointer shadow-2xs"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center font-bold">
                    <ImageIcon size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-extrabold text-sm text-slate-900">Choose from Gallery</p>
                    <p className="text-[11px] text-slate-500 font-medium">Select one or more saved images</p>
                  </div>
                </button>
              </div>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={() => setShowPhotoSourceMenu(false)}
                className="w-full text-center py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Back
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CreateAd;
