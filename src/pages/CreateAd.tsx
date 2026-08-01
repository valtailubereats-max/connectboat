import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType, getDocWithCacheFallback } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { clearHomeCache } from '../utils/cache';
import { sendEmailGeneric } from '../utils/emailService';
import { CITIES, Ad, MarketplaceSettings, PORTUGAL_CITIES, UK_CITIES, BOAT_TYPES, BOAT_CONDITIONS, BOAT_FUEL_TYPES, BOAT_HULL_MATERIALS } from '../types';
import { SearchableCitySelect } from '../components/SearchableCitySelect';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Tag, MapPin, Euro, FileText, ChevronLeft, Upload, X, Plus, RefreshCcw, Link, AlertCircle, Check, Camera, Anchor, Compass, Gauge, ShieldCheck, Ruler, Fuel, Sparkles } from 'lucide-react';
import { compressImage } from '../lib/imageUtils';
import { normalizeDescription } from '../utils/textFormatter';
import { parsePrice } from '../utils';
import { getSourceSiteFromUrl, getSupportedMarketplace, getSupportedMarketplacesMessage } from '../utils/marketplaces';
import { isImportedOrExternalAd, normalizeAndLimitImages, sanitizeFirestorePayload } from '../utils/adSanitizer';
import { getCardFramingStyle, getAdFraming, logFramingDiagnostic } from '../utils/imageFraming';

const CreateAd = () => {
  const { categories } = useSettings();
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
    reason: string;
    adData: any;
    adId: string;
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
    price: prefill?.price?.toString() || '',
    currency: 'GBP',
    priceOnApplication: false,
    priceRequiresReview: false,
    locationRequiresReview: false,
    images: [] as string[],
    city: prefill?.city || PORTUGAL_CITIES[0],
    country: (prefill?.country || 'Portugal') as 'Portugal' | 'Reino Unido' | 'Ambos',
    category: urlCategory || prefill?.category || categories[0] || 'Outros',
    plan: 'free' as 'free' | 'local' | 'national' | 'highlight',
    duration: 30, // Default for free
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
    ceCertified: prefill?.ceCertified || ''
  });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPhotoSourceMenu, setShowPhotoSourceMenu] = useState(false);
  const [pendingAdData, setPendingAdData] = useState<any>(null);
  const [mockCardNumber, setMockCardNumber] = useState('4242 •••• •••• 4242');
  const [mockExpiry, setMockExpiry] = useState('12/29');
  const [mockCVC, setMockCVC] = useState('321');
  const [mockCardName, setMockCardName] = useState('');

  useEffect(() => {
    const pCategory = new URLSearchParams(location.search).get('category');
    if (pCategory) {
      setFormData(prev => ({
        ...prev,
        category: pCategory
      }));
    }
  }, [location.search]);

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
      let targetCountry: 'Portugal' | 'Reino Unido' = 'Portugal';
      
      if (profile?.country === 'Portugal' || profile?.country === 'Reino Unido') {
        targetCountry = profile.country;
      } else if (saved === 'Portugal' || saved === 'Reino Unido') {
        targetCountry = saved;
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
          price: data.price?.toString() || '',
          images: fetchedImages.length > 0 ? fetchedImages : (data.images || []),
          city: data.city,
          country: data.country || 'Portugal',
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
          ceCertified: data.ceCertified || ''
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
    if (settings?.maxImages) {
      return settings.maxImages[formData.plan as keyof typeof settings.maxImages] || (formData.plan === 'national' ? 6 : 4);
    }
    return formData.plan === 'free' ? 2 : (formData.plan === 'national' ? 6 : 4);
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
        } catch (notifErr: any) {
          console.warn('[PENDING EMAIL] error:', notifErr.message || notifErr);
        }
      }

      clearHomeCache();
      if (id) {
        if ((isAdmin || isModerator) && originalAd?.sellerId !== user.uid) {
          setSaveSuccessMsg('Anúncio atualizado com sucesso (Edição de Staff).');
          setTimeout(() => {
            setSaveSuccessMsg(null);
            navigate('/admin/ads');
          }, 2000);
        } else {
          setSaveSuccessMsg('Anúncio atualizado! O seu anúncio voltou para a fila de aprovação do administrador.');
          setTimeout(() => {
            setSaveSuccessMsg(null);
            navigate('/profile?tab=anuncios');
          }, 2000);
        }
      } else {
        setSaveSuccessMsg('Anúncio enviado! Receberá um alerta quando o seu anúncio estiver aprovado.');
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
      showValidationError('Erro ao carregar o perfil do utilizador. Por favor recarregue a página.');
      return;
    }

    const isJob = formData.category === 'Trabalho/Empregos';
    const isSpecialCategory = formData.category === 'Imigração' || isJob;
    const isImportedAd = isImportedOrExternalAd(formData) || isImportedOrExternalAd(originalAd) || isAdmin || isModerator;

    // Contact Phone Validation (Only required for normal non-imported listings)
    if (!isImportedAd) {
      if (isSpecialCategory) {
        if (!formData.sellerPhone?.trim()) {
          showValidationError('Por favor introduza um telefone/WhatsApp de contacto.', 'txt-seller-phone');
          return;
        }
      } else {
        if (formData.useProfilePhone) {
          if (!profile?.phone?.trim()) {
            showValidationError(
              'O seu perfil não possui um telefone configurado. Introduza um telefone de contacto ou atualize o seu perfil.',
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
              'Por favor introduza um telefone de contacto para o seu anúncio.',
              'txt-contact-phone'
            );
            return;
          }
        }
      }
    }

    if (!formData.title?.trim()) {
      showValidationError('Por favor introduza o título do seu anúncio.', 'txt-ad-title');
      return;
    }

    if (!formData.description?.trim()) {
      showValidationError('Por favor introduza a descrição detalhada do seu anúncio.', 'txt-description');
      return;
    }

    const cleanFormImages = normalizeAndLimitImages(formData.images, 6);
    if (cleanFormImages.length === 0) {
      showValidationError('Por favor carregue pelo menos uma imagem válida para o seu anúncio.', 'sec-images-upload');
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
        sellerPhone: finalSellerPhoneValue || (originalAd?.sellerPhone || ''),
        contactPhone: contactPhoneValue || (originalAd?.contactPhone || ''),
        useProfilePhone: useProfilePhoneValue,
        sellerName: id && originalAd ? (originalAd.sellerName || profile.name || 'ConnectBoat') : (profile.name || 'ConnectBoat'),
        status: isStaff && id ? (originalAd?.status || 'approved') : 'pending',
        adStatus: id && originalAd ? originalAd.adStatus : 'active',
        plan: formData.category === '💚 Doações & Solidariedade' ? 'local' : formData.plan,
        expirationDate: expirationDate,
        userNotified: isStaff && id ? true : false,
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
        ceCertified: formData.ceCertified || ''
      };

      // Preservar metadados de anúncios importados/externos/reivindicáveis
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
        if (originalAd.sellerEmail) adData.sellerEmail = originalAd.sellerEmail;
        if (originalAd.externalListing !== undefined) adData.externalListing = originalAd.externalListing;
        if (originalAd.externalStatus) adData.externalStatus = originalAd.externalStatus;
        if (originalAd.demoListing !== undefined) adData.demoListing = originalAd.demoListing;
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

      const isPaidDestaque = formData.plan === 'local' || formData.plan === 'national';
      const alreadyHasThisDestaque = originalAd?.isFeatured && (originalAd?.plan === formData.plan || (originalAd?.plan === 'highlight' && formData.plan === 'local'));

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

      // 2. Buscar outros anúncios do mesmo vendedor para verificar similaridade
      const qSeller = query(collection(db, 'ads'), where('sellerId', '==', user.uid));
      const snapSeller = await getDocs(qSeller);
      const sellerAds = snapSeller.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as any));

      let isDuplicateLocal = false;
      let dupReasonLocal = '';
      let dupOfIdLocal = '';

      for (const existingAd of sellerAds) {
        if (existingAd.id === adId) continue;
        
        let matchCount = 0;
        const reasons: string[] = [];

        // Comparar título parecido
        if (areTitlesSimilarForDuplicates(adData.title, existingAd.title)) {
          matchCount++;
          reasons.push('título muito parecido');
        }
        // Comparar cidade
        if (adData.city && existingAd.city && adData.city.toLowerCase().trim() === existingAd.city.toLowerCase().trim()) {
          matchCount++;
          reasons.push('mesma cidade');
        }
        // Comparar preço
        if (adData.price > 0 && existingAd.price > 0 && Math.abs(adData.price - existingAd.price) < 0.01) {
          matchCount++;
          reasons.push('mesmo preço');
        }
        // Comparar imagem principal
        if (adData.imageUrl && existingAd.imageUrl && adData.imageUrl === existingAd.imageUrl) {
          matchCount++;
          reasons.push('mesma imagem principal');
        }

        if (matchCount >= 2) {
          isDuplicateLocal = true;
          dupReasonLocal = `Potencial duplicado com o seu anúncio "${existingAd.title}" (${reasons.join(', ')}).`;
          dupOfIdLocal = existingAd.id;
          break;
        }
      }

      if (isDuplicateLocal) {
        adData.isDuplicate = true;
        adData.duplicateReason = dupReasonLocal;
        adData.duplicateOf = dupOfIdLocal;
      } else {
        adData.isDuplicate = false;
        adData.duplicateReason = '';
        adData.duplicateOf = '';
      }

      // Se for detetado potencial duplicado, exibe aviso e interrompe para confirmação do usuário
      if (isDuplicateLocal) {
        setDuplicateWarning({
          show: true,
          reason: dupReasonLocal,
          adData: adData,
          adId: adId
        });
        setLoading(false);
        return;
      }

      // Se não houver duplicado local, prosseguir normalmente para salvar ou cobrar destaque
      if (isPaidDestaque && !alreadyHasThisDestaque && !isPromoActive && !formData.isPermanentFeatured && formData.category !== '💚 Doações & Solidariedade' && !isStaff) {
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

  const handleMockPaymentSuccess = async () => {
    if (!pendingAdData) return;
    setLoading(true);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 30); // 30 dias de duração

      const finalizedAdData = {
        ...pendingAdData,
        isFeatured: true,
        featuredUntil: tomorrow,
        featuredLevel: formData.plan === 'national' ? 'national' : 'local',
        featuredActivatedAt: new Date()
      };

      await setDoc(doc(db, 'ads', finalizedAdData.id), finalizedAdData, { merge: true });

      // Create Admin Notifications
      try {
        const staffQuery = query(
          collection(db, 'users'),
          where('role', 'in', ['admin', 'moderator'])
        );
        const staffSnapshot = await getDocs(staffQuery);
        
        const staffUids: string[] = [];
        const creatorUid = user?.uid;

        staffSnapshot.forEach(docSnap => {
          const uid = docSnap.id;
          if (uid !== creatorUid) {
            staffUids.push(uid);
          }
        });

        for (const staffUid of staffUids) {
          const notifId = `pending_${finalizedAdData.id}_${staffUid}_${Date.now()}`;
          const notifData = {
            userId: staffUid,
            title: 'Novo destaque aprovado / pendente',
            message: `Há um novo destaque pendente de aprovação: "${finalizedAdData.title}"`,
            createdAt: serverTimestamp(),
            read: false,
            adId: finalizedAdData.id,
            type: 'ad_pending'
          };
          await setDoc(doc(db, 'notifications', notifId), notifData);
        }
      } catch (notifErr) {
        console.warn('Notification warning:', notifErr);
      }

      clearHomeCache();
      const priceText = formData.country === 'Reino Unido'
        ? (formData.plan === 'national' ? '£7.99' : '£4.99')
        : (formData.plan === 'national' ? '€7.99' : '€4.99');
      const levelText = formData.plan === 'national' ? 'Destaque Nacional ⭐⭐⭐' : 'Destaque Local ⭐';

      setShowPaymentModal(false);
      setSaveSuccessMsg(`Pagamento de ${priceText} confirmado com sucesso via Stripe! O seu anúncio agora é ${levelText} por 30 dias!`);
      setTimeout(() => {
        setSaveSuccessMsg(null);
        navigate('/profile?tab=anuncios');
      }, 2000);
    } catch (err) {
      console.error(err);
      alert('Ocorreu um erro ao concluir o pagamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportAd = async () => {
    const isStaff = isAdmin || isModerator || profile?.role === 'admin' || profile?.role === 'moderator';
    if (!isStaff) {
      setImportError('Não tem permissão para realizar esta ação.');
      return;
    }

    if (!importUrl.trim()) {
      setImportError('Por favor, cole um link de anúncio.');
      return;
    }

    const regex = /^https?:\/\//i;
    if (!regex.test(importUrl)) {
      setImportError('Por favor, introduza um link válido que comece por http:// ou https://.');
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
        throw new Error(`[HTTP ${response.status}] Resposta inválida da API (/api/import-ad). Tente novamente.`);
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
            price: price !== undefined && price !== null ? price.toString() : prev.price,
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

        setImportSuccess(`Dados importados de ${sourceSiteName}. Revise as informações antes de publicar.`);
      } else {
        const stageMsg = result?.stage ? `[Fase: ${result.stage}] ` : '';
        const errorMsg = result?.error || 'Não foi possível importar os dados deste anúncio. Preencha manualmente.';
        console.error('[Import Pipeline Stage Failure]', stageMsg, errorMsg);
        throw new Error(`${stageMsg}${errorMsg}`);
      }
    } catch (err: any) {
      console.error('[Import Pipeline Error]:', err.message || err);
      setImportError(err.message || 'Não foi possível importar os dados deste anúncio. Preencha manualmente.');
    } finally {
      setIsImporting(false);
    }
  };

  const isPromoActive = settings?.launchPromoActive !== false;
  const isStaff = isAdmin || isModerator || profile?.role === 'admin' || profile?.role === 'moderator';

  if (fetching) return <div className="text-center py-20">A carregar...</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-6 font-medium transition-colors">
        <ChevronLeft size={20} /> Voltar
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100"
      >
        <h1 className="text-3xl font-bold text-slate-900 mb-8">{id ? 'Editar Anúncio' : 'Novo Anúncio'}</h1>

        {id && isEditLocked && !isAdmin && (
          <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-3xl" id="edit-locked-warning">
            <h3 className="text-md font-extrabold text-amber-800 flex items-center gap-2 mb-1">
              <span>⚠️</span> Edição Parcial Ativa (Destaque Protegido)
            </h3>
            <p className="text-xs sm:text-sm text-amber-700 leading-relaxed">
              Este anúncio tem um <strong>Destaque ativo há mais de 24 horas</strong>. Para garantir a segurança e a integridade da comunidade (evitando alterações de produto pós-pagamento), os campos estratégicos como <strong>Título, Imagens, Categoria, Localização e Tipo de Destaque</strong> estão bloqueados. 
            </p>
            <p className="text-xs sm:text-sm text-amber-700 mt-2 leading-relaxed">
              Poderá ainda alterar livremente a <strong>Descrição, Contactos de telefone/WhatsApp ou marcar como Vendido/Encerrado</strong>. Agradecemos a compreensão.
            </p>
          </div>
        )}

        {!id && (isAdmin || isModerator || profile?.role === 'admin' || profile?.role === 'moderator') && (
          <div className="mb-8 p-6 bg-indigo-50/40 border border-indigo-100/80 rounded-2xl" id="import-ad-section">
            <h3 className="text-md font-bold text-slate-900 flex items-center gap-2 mb-1">
              <Link className="text-indigo-600" size={18} />
              Criar anúncio a partir de link
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mb-4">
              Cole o link de um anúncio existente e tentaremos preencher os dados automaticamente.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Cole o link do anúncio (ex: https://...)"
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
                    A importar...
                  </>
                ) : (
                  'Importar Dados'
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
                Este anúncio foi importado de {getSourceSiteFromUrl(formData.sourceUrl)}. O botão de contacto direcionará para o anúncio original.
              </div>
            </div>
          )}

          {/* Image Upload */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                {formData.category === 'Trabalho/Empregos' ? 'Imagens da Vaga (Opcional)' : 'Imagens do Produto'}
              </label>
              <span className="text-xs font-bold text-slate-400">
                {formData.images.length} de {maxAllowed} imagens
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                      key={`${url}-${index}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="aspect-square bg-slate-100 rounded-2xl overflow-hidden relative group border border-slate-200"
                    >
                      <img 
                        src={url} 
                        alt={`Preview ${index}`} 
                        className={formData.listingType === 'informativo' ? "w-full h-full object-contain p-2 bg-slate-50" : "w-full h-full object-cover"} 
                        style={index === 0 && formData.listingType !== 'informativo' ? getAdImageStyle(imagePositionX, imagePositionY, imageZoom) : undefined} 
                      />
                      {!(isEditLocked && !isAdmin) && (
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 bg-red-500 text-white p-2 md:p-1.5 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all active:scale-95 shadow-lg z-10 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      )}
                      {index === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-indigo-600 text-white text-[10px] font-bold py-1 text-center uppercase tracking-tighter">
                          Principal
                        </div>
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
                        <span className="text-xs font-bold text-indigo-600">A carregar...</span>
                      </div>
                    ) : (
                      <>
                        <Plus className={`mx-auto mb-1 transition-colors ${isDragging ? 'text-indigo-600' : 'text-slate-300 group-hover:text-indigo-400'}`} size={32} />
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                          {isDragging ? 'Largar aqui' : 'Arrastar ou Clique'}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-tighter font-semibold">
                          (Fotos)
                        </p>
                      </>
                    )}
                  </div>
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              * A primeira imagem será a principal. Máximo 5MB por arquivo. Otimização automática aplicada.
            </p>

            {formData.images.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-5 bg-slate-50 rounded-2xl border border-slate-200/60"
              >
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <ImageIcon size={16} className="text-indigo-500" />
                  Enquadramento da Foto Principal (Ajuste Visual)
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  Clique e <strong>arraste a imagem diretamente</strong> no preview da direita. Rode a <strong>roda do rato (scroll)</strong> para aplicar zoom no computador, ou use <strong>dois dedos (gesto pinch)</strong> no telemóvel.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  {/* Both Previews Box (Original + Card Crop) - Spans 7 cols on large screens */}
                  <div className="lg:col-span-7 flex flex-col sm:flex-row gap-4 justify-center items-center">
                    
                    {/* Imagem Original Preview - Reference */}
                    <div className="flex flex-col items-center">
                      <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-tighter text-center">
                        Imagem Original (Referência)
                      </div>
                      <div className="w-[170px] h-[170px] sm:w-[180px] sm:h-[180px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-300 shadow-inner relative flex items-center justify-center">
                        <img 
                          src={formData.images[0]} 
                          alt="Imagem original sem corte" 
                          className="w-full h-full object-contain pointer-events-none"
                        />
                      </div>
                    </div>

                    {/* Como Ficará No Card Preview - Interactive */}
                    <div className="flex flex-col items-center">
                      <div className="text-[10px] font-bold text-indigo-500 uppercase mb-2 tracking-tighter text-center">
                        {formData.listingType === 'informativo' ? 'Enquadramento Inteiro' : 'Como ficará no Card (Arraste)'}
                      </div>
                      <div 
                        ref={formData.listingType === 'informativo' ? undefined : containerRef}
                        onPointerDown={formData.listingType === 'informativo' ? undefined : handlePointerDown}
                        onPointerMove={formData.listingType === 'informativo' ? undefined : handlePointerMove}
                        onPointerUp={formData.listingType === 'informativo' ? undefined : handlePointerUp}
                        onPointerCancel={formData.listingType === 'informativo' ? undefined : handlePointerUp}
                        onTouchStart={formData.listingType === 'informativo' ? undefined : handleTouchStart}
                        onTouchMove={formData.listingType === 'informativo' ? undefined : handleTouchMove}
                        onTouchEnd={formData.listingType === 'informativo' ? undefined : handleTouchEnd}
                        onTouchCancel={formData.listingType === 'informativo' ? undefined : handleTouchEnd}
                        className={`w-[170px] h-[170px] sm:w-[180px] sm:h-[180px] bg-slate-150 rounded-2xl overflow-hidden border-2 border-indigo-500 shadow-lg relative select-none touch-none group transition-all duration-200 ${
                          formData.listingType === 'informativo' ? 'cursor-default p-2 flex items-center justify-center bg-slate-100' : isDraggingImage ? 'cursor-grabbing border-indigo-600 shadow-xl scale-[1.01]' : 'cursor-grab hover:shadow-md hover:border-indigo-400'
                        }`}
                      >
                        <img 
                          src={formData.images[0]} 
                          alt="Ajuste de enquadramento" 
                          className={`w-full h-full pointer-events-none transition-all duration-75 ${
                            formData.listingType === 'informativo' ? 'object-contain' : 'object-cover'
                          }`}
                          style={formData.listingType === 'informativo' ? undefined : getAdImageStyle(imagePositionX, imagePositionY, imageZoom)}
                        />
                        {formData.listingType === 'informativo' ? (
                          <div className="absolute top-2 right-2 bg-emerald-600/95 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-tight py-1 px-2.5 rounded-full pointer-events-none shadow">
                            💻 Completo 💡
                          </div>
                        ) : (
                          <div className="absolute top-2 right-2 bg-indigo-600/90 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-tight py-1 px-2.5 rounded-full pointer-events-none shadow">
                            Arraste 🖐️
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Slider Controls Box - Spans 5 cols on large screens */}
                  <div className="lg:col-span-5 space-y-4">
                    {formData.listingType === 'informativo' ? (
                      <div className="bg-emerald-50/70 border-2 border-emerald-100 p-5 rounded-2xl space-y-3 shadow-sm">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                          <span>💡</span> Modo Informativo Ativo
                        </span>
                        <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                          Este anúncio está configurado como <strong>Anúncio Informativo</strong>.
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                          Neste modo, a imagem principal será exibida integralmente (<strong>contain</strong>) com fundo neutro suave, prevenindo cortes nas bordas seja na Home, listas ou pesquisas. Os controlos manuais de zoom e posicionamento estão desativados pois a imagem inteira é preservada automaticamente.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-slate-100/80 border border-slate-200/60 p-4 rounded-2xl space-y-3">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">✨ Instruções de Enquadramento</span>
                          <ul className="text-xs font-semibold text-slate-600 space-y-2.5">
                            <li className="flex items-start gap-2">
                              <span className="text-indigo-600 shrink-0">🖐️</span>
                              <span><strong>Mover:</strong> Arraste a imagem para cima, baixo, esquerda ou direita.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-indigo-600 shrink-0">🔍</span>
                              <span><strong>Zoom (PC):</strong> Use a roda de rolagem (scroll) do rato sobre a imagem.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-indigo-650 shrink-0">📱</span>
                              <span><strong>Zoom (Mobile):</strong> Use um gesto de pinça (pinch) com dois dedos.</span>
                            </li>
                          </ul>
                          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-500">
                            <span>Zoom Atual:</span>
                            <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-mono">{imageZoom.toFixed(2)}x</span>
                          </div>
                        </div>

                        {/* Reset/Center Buttons */}
                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setImagePositionX(50);
                              setImagePositionY(50);
                            }}
                            className="flex-1 py-1.5 px-3 text-xs font-bold text-indigo-650 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100/70 rounded-xl transition-colors cursor-pointer text-center"
                          >
                            Centralizar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setImagePositionX(50);
                              setImagePositionY(50);
                              setImageZoom(1);
                            }}
                            className="flex-1 py-1.5 px-3 text-xs font-bold text-slate-650 bg-slate-100 border border-slate-200 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer text-center"
                          >
                            Repor Ajuste
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isAdmin && (
              <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/50 p-6 rounded-3xl border-2 border-indigo-100/80 md:col-span-2 space-y-4 shadow-sm">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 text-xs uppercase tracking-wider">
                  <span>⚙️ Configurações de Administrador</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Tipo de Anúncio</label>
                    <select
                      value={formData.listingType}
                      onChange={(e) => setFormData({ ...formData, listingType: e.target.value as any })}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl focus:border-indigo-600 outline-none transition-all text-sm"
                    >
                      <option value="normal">Anúncio Normal (Abre página de detalhes)</option>
                      <option value="informativo">Anúncio Informativo (Redireciona para Link Útil)</option>
                    </select>
                  </div>
                  {formData.listingType === 'informativo' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">URL de Destino (interno. Ex: /links?categoria=imigracao)</label>
                      <input
                        type="text"
                        value={formData.targetUrl}
                        onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
                        placeholder="Ex: /links?categoria=imigracao"
                        className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl focus:border-indigo-600 outline-none transition-all text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 1: ESSENTIAL BOAT IDENTIFICATION */}
            <div className="md:col-span-2 p-6 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl space-y-6 shadow-xl border border-slate-800">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <Anchor size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                    Identificação do Barco <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30">Opcional</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">Preencha os dados da embarcação se desejar especificar detalhes técnicos.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* Boat Type */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Tipo de Barco</label>
                  <select
                    id="sel-boat-type"
                    value={formData.boatType}
                    onChange={(e) => setFormData({ ...formData, boatType: e.target.value })}
                    disabled={!isAdmin && isEditLocked}
                    className="w-full px-4 py-3.5 bg-slate-800/80 border border-slate-700 rounded-xl focus:border-indigo-400 text-white outline-none transition-all font-medium text-sm disabled:opacity-50"
                  >
                    <option value="">Selecione o tipo...</option>
                    {BOAT_TYPES.map((type) => (
                      <option key={type} value={type} className="bg-slate-900 text-white">{type}</option>
                    ))}
                  </select>
                </div>

                {/* Manufacturer */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Fabricante / Marca</label>
                  <input
                    id="txt-manufacturer"
                    type="text"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    placeholder="Ex: Princess, Sunseeker, Bavaria"
                    disabled={!isAdmin && isEditLocked}
                    className="w-full px-4 py-3.5 bg-slate-800/80 border border-slate-700 rounded-xl focus:border-indigo-400 text-white outline-none transition-all text-sm disabled:opacity-50"
                  />
                </div>

                {/* Model */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Modelo</label>
                  <input
                    id="txt-model"
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="Ex: V48, Oceanis 40.1"
                    disabled={!isAdmin && isEditLocked}
                    className="w-full px-4 py-3.5 bg-slate-800/80 border border-slate-700 rounded-xl focus:border-indigo-400 text-white outline-none transition-all text-sm disabled:opacity-50"
                  />
                </div>

                {/* Year */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Ano de Fabrico</label>
                  <input
                    id="txt-year"
                    type="number"
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="Ex: 2021"
                    disabled={!isAdmin && isEditLocked}
                    className="w-full px-4 py-3.5 bg-slate-800/80 border border-slate-700 rounded-xl focus:border-indigo-400 text-white outline-none transition-all text-sm disabled:opacity-50"
                  />
                </div>

                {/* Condition */}
                <div className="space-y-2 md:col-span-2 lg:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Condição do Barco</label>
                  <select
                    id="sel-condition"
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    disabled={!isAdmin && isEditLocked}
                    className="w-full px-4 py-3.5 bg-slate-800/80 border border-slate-700 rounded-xl focus:border-indigo-400 text-white outline-none transition-all font-medium text-sm disabled:opacity-50"
                  >
                    <option value="">Selecione a condição...</option>
                    {BOAT_CONDITIONS.map((cond) => (
                      <option key={cond} value={cond} className="bg-slate-900 text-white">{cond}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 2: DIMENSIONS & TECHNICAL SPECS (OPTIONAL) */}
            <div className="md:col-span-2 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Ruler size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    Dimensões & Construção <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Opcional</span>
                  </h3>
                  <p className="text-xs text-slate-500">Detalhes técnicos de comprimento, boca, calado e material do casco.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Comprimento (LOA)</label>
                  <input
                    type="text"
                    value={formData.length}
                    onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                    placeholder="Ex: 38 ft / 11.6 m"
                    className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-600 outline-none transition-all text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Boca (Largura)</label>
                  <input
                    type="text"
                    value={formData.beam}
                    onChange={(e) => setFormData({ ...formData, beam: e.target.value })}
                    placeholder="Ex: 12 ft / 3.6 m"
                    className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-600 outline-none transition-all text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Calado (Draft)</label>
                  <input
                    type="text"
                    value={formData.draft}
                    onChange={(e) => setFormData({ ...formData, draft: e.target.value })}
                    placeholder="Ex: 3.5 ft / 1.0 m"
                    className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-600 outline-none transition-all text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Material do Casco</label>
                  <select
                    value={formData.hullMaterial}
                    onChange={(e) => setFormData({ ...formData, hullMaterial: e.target.value })}
                    className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-600 outline-none transition-all text-sm"
                  >
                    <option value="">Selecione...</option>
                    {BOAT_HULL_MATERIALS.map((mat) => (
                      <option key={mat} value={mat}>{mat}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 3: ENGINE & MECHANICAL (OPTIONAL) */}
            <div className="md:col-span-2 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Gauge size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    Motorização & Mecânica <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Opcional</span>
                  </h3>
                  <p className="text-xs text-slate-500">Especificações do motor, potência, combustível e horas de uso.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Marca do Motor</label>
                  <input
                    type="text"
                    value={formData.engineBrand}
                    onChange={(e) => setFormData({ ...formData, engineBrand: e.target.value })}
                    placeholder="Ex: Volvo Penta, Mercury"
                    className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-600 outline-none transition-all text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Potência (HP)</label>
                  <input
                    type="text"
                    value={formData.horsepower}
                    onChange={(e) => setFormData({ ...formData, horsepower: e.target.value })}
                    placeholder="Ex: 300 HP / 2x 435 HP"
                    className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-600 outline-none transition-all text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Horas de Motor</label>
                  <input
                    type="text"
                    value={formData.engineHours}
                    onChange={(e) => setFormData({ ...formData, engineHours: e.target.value })}
                    placeholder="Ex: 250 hrs"
                    className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-600 outline-none transition-all text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Combustível</label>
                  <select
                    value={formData.fuelType}
                    onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}
                    className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-600 outline-none transition-all text-sm"
                  >
                    <option value="">Selecione...</option>
                    {BOAT_FUEL_TYPES.map((fuel) => (
                      <option key={fuel} value={fuel}>{fuel}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 4: ACCOMMODATIONS & EQUIPMENT (OPTIONAL) */}
            <div className="md:col-span-2 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Compass size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    Acomodações & Equipamento <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Opcional</span>
                  </h3>
                  <p className="text-xs text-slate-500">Número de cabines, lugares de dormida, casas de banho e reboque.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Cabines</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.cabins}
                    onChange={(e) => setFormData({ ...formData, cabins: e.target.value })}
                    placeholder="Ex: 2"
                    className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-600 outline-none transition-all text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Berths (Camas)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.berths}
                    onChange={(e) => setFormData({ ...formData, berths: e.target.value })}
                    placeholder="Ex: 4"
                    className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-600 outline-none transition-all text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Casas de Banho</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.bathrooms}
                    onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                    placeholder="Ex: 1"
                    className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-600 outline-none transition-all text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Reboque Incluído</label>
                  <select
                    value={formData.trailerIncluded}
                    onChange={(e) => setFormData({ ...formData, trailerIncluded: e.target.value })}
                    className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-600 outline-none transition-all text-sm"
                  >
                    <option value="No">Não</option>
                    <option value="Yes">Sim</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 5: LEGAL & COMPLIANCE (OPTIONAL) */}
            <div className="md:col-span-2 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    Conformidade & Impostos <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Opcional</span>
                  </h3>
                  <p className="text-xs text-slate-500">Informações fiscais e certificação marítima.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl">
                  <div>
                    <p className="text-sm font-bold text-slate-800">IVA Pago (VAT Paid)</p>
                    <p className="text-xs text-slate-500">O imposto sobre o valor acrescentado foi liquidado?</p>
                  </div>
                  <select
                    value={formData.vatPaid}
                    onChange={(e) => setFormData({ ...formData, vatPaid: e.target.value })}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                  >
                    <option value="Yes">Sim</option>
                    <option value="No">Não</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Certificado CE</p>
                    <p className="text-xs text-slate-500">Embarcação em conformidade com as diretivas CE?</p>
                  </div>
                  <select
                    value={formData.ceCertified}
                    onChange={(e) => setFormData({ ...formData, ceCertified: e.target.value })}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                  >
                    <option value="Yes">Sim</option>
                    <option value="No">Não</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Título do Anúncio *</label>
                {formData.manufacturer && formData.model && (
                  <button
                    type="button"
                    onClick={() => {
                      const autoTitle = `${formData.manufacturer} ${formData.model} ${formData.year ? `(${formData.year})` : ''}`.trim();
                      setFormData({ ...formData, title: autoTitle });
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Sparkles size={14} /> Gerar Título Automático
                  </button>
                )}
              </div>
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

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Categoria</label>
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
                className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">Seleccione uma categoria...</option>
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

            {(formData.category === 'Serviços' || formData.category?.startsWith('Serviços') || formData.category?.includes('Serviços')) && (
              <div className="space-y-3 col-span-1 md:col-span-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider block">Área de Atendimento</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl">
                  <label className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:bg-indigo-50/10 cursor-pointer transition-all shadow-sm">
                    <input
                      type="radio"
                      name="serviceCoverage"
                      value="city"
                      checked={formData.serviceCoverage === 'city'}
                      onChange={() => setFormData({ ...formData, serviceCoverage: 'city' })}
                      className="w-4.5 h-4.5 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="text-sm font-semibold text-slate-700">Apenas minha cidade</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:bg-indigo-50/10 cursor-pointer transition-all shadow-sm">
                    <input
                      type="radio"
                      name="serviceCoverage"
                      value="radius20"
                      checked={formData.serviceCoverage === 'radius20'}
                      onChange={() => setFormData({ ...formData, serviceCoverage: 'radius20' })}
                      className="w-4.5 h-4.5 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="text-sm font-semibold text-slate-700">Até 20 km</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:bg-indigo-50/10 cursor-pointer transition-all shadow-sm">
                    <input
                      type="radio"
                      name="serviceCoverage"
                      value="radius50"
                      checked={formData.serviceCoverage === 'radius50'}
                      onChange={() => setFormData({ ...formData, serviceCoverage: 'radius50' })}
                      className="w-4.5 h-4.5 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="text-sm font-semibold text-slate-700">Até 50 km</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:bg-indigo-50/10 cursor-pointer transition-all shadow-sm">
                    <input
                      type="radio"
                      name="serviceCoverage"
                      value="county"
                      checked={formData.serviceCoverage === 'county'}
                      onChange={() => setFormData({ ...formData, serviceCoverage: 'county' })}
                      className="w-4.5 h-4.5 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="text-sm font-semibold text-slate-700">
                      {formData.country === 'Reino Unido' ? 'Todo o condado' : 'Todo o distrito'}
                    </span>
                  </label>
                  {formData.country === 'Reino Unido' ? (
                    <label className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:bg-indigo-50/10 cursor-pointer transition-all shadow-sm">
                      <input
                        type="radio"
                        name="serviceCoverage"
                        value="uk"
                        checked={formData.serviceCoverage === 'uk'}
                        onChange={() => setFormData({ ...formData, serviceCoverage: 'uk' })}
                        className="w-4.5 h-4.5 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <span className="text-sm font-semibold text-slate-700">Todo o Reino Unido</span>
                    </label>
                  ) : (
                    <label className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:bg-indigo-50/10 cursor-pointer transition-all shadow-sm">
                      <input
                        type="radio"
                        name="serviceCoverage"
                        value="portugal"
                        checked={formData.serviceCoverage === 'portugal'}
                        onChange={() => setFormData({ ...formData, serviceCoverage: 'portugal' })}
                        className="w-4.5 h-4.5 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <span className="text-sm font-semibold text-slate-700">Todo Portugal</span>
                    </label>
                  )}
                  <label className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:bg-indigo-50/10 cursor-pointer transition-all shadow-sm col-span-1 sm:col-span-2 md:col-span-3">
                    <input
                      type="radio"
                      name="serviceCoverage"
                      value="online"
                      checked={formData.serviceCoverage === 'online'}
                      onChange={() => setFormData({ ...formData, serviceCoverage: 'online' })}
                      className="w-4.5 h-4.5 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="text-sm font-semibold text-slate-700">Atendimento Online</span>
                  </label>
                </div>
              </div>
            )}

            {formData.category === '💚 Doações & Solidariedade' && (
              <div className="col-span-1 md:col-span-3 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200/85 rounded-3xl shadow-sm text-left animate-pulse">
                <p className="text-sm text-emerald-800 font-extrabold flex items-center gap-1.5">
                  <span>💚</span> Obrigado pela sua generosidade!
                </p>
                <p className="text-xs text-emerald-700/95 mt-1.5 leading-relaxed font-semibold">
                  ConnectBoat values community contributions. For this reason, donated items receive special local visibility benefits to support fellow boaters.
                </p>
              </div>
            )}

            {formData.category === 'Imigração' ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Telemóvel / WhatsApp (Obrigatório)</label>
                  <input
                    type="tel"
                    value={formData.sellerPhone}
                    onChange={(e) => setFormData({ ...formData, sellerPhone: e.target.value })}
                    required={formData.category === 'Imigração'}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all"
                    placeholder="Ex: +351 912 345 678"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">E-mail de Contacto (Opcional)</label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all"
                    placeholder="exemplo@dominio.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Link Externo / Website (URL)</label>
                  <input
                    type="url"
                    value={formData.externalUrl}
                    onChange={(e) => setFormData({ ...formData, externalUrl: e.target.value })}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all"
                    placeholder="https://exemplo.com"
                  />
                </div>
              </>
            ) : formData.category === 'Trabalho/Empregos' ? (
              <>
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                    <p className="text-xs text-indigo-800 font-bold">💼 Informações da Vaga de Trabalho</p>
                    <p className="text-[11px] text-indigo-600 mt-1">Preencha as informações detalhadas sobre o emprego para atrair candidaturas qualificadas.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Empresa / Recrutador</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all"
                    placeholder="Ex: Luso Recrutamento, LDA"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Salário / Remuneração</label>
                  <input
                    type="text"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all"
                    placeholder="Ex: 1.200€ - 1.500€ / mês, 10€ / hora, A negociar"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Tipo de Contrato</label>
                  <select
                    value={formData.contractType}
                    onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all"
                  >
                    <option value="">Seleccione o tipo de contrato...</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contrato de Trabalho">Contrato de Trabalho</option>
                    <option value="Prestação de Serviços (Recibos Verdes)">Prestação de Serviços (Recibos Verdes)</option>
                    <option value="Temporário / Sazonal">Temporário / Sazonal</option>
                    <option value="Estágio">Estágio</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Horário de Trabalho</label>
                  <select
                    value={formData.workSchedule}
                    onChange={(e) => setFormData({ ...formData, workSchedule: e.target.value })}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all"
                  >
                    <option value="">Seleccione o horário...</option>
                    <option value="Período Diário">Período Diário</option>
                    <option value="Turnos">Turnos</option>
                    <option value="Horário Flexível">Horário Flexível</option>
                    <option value="Finais de Semana">Finais de Semana</option>
                    <option value="Trabalho Noturno">Trabalho Noturno</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Experiência Requerida</label>
                  <select
                    value={formData.experienceRequired}
                    onChange={(e) => setFormData({ ...formData, experienceRequired: e.target.value })}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all"
                  >
                    <option value="">Seleccione a experiência...</option>
                    <option value="Sem experiência">Sem experiência</option>
                    <option value="1-2 anos">1-2 anos</option>
                    <option value="3-5 anos">3-5 anos</option>
                    <option value="Sénior (+5 anos)">Sénior (+5 anos)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Telemóvel / WhatsApp de Contacto</label>
                  <input
                    type="tel"
                    value={formData.sellerPhone}
                    onChange={(e) => setFormData({ ...formData, sellerPhone: e.target.value })}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all"
                    placeholder="Ex: +351 912 345 678"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">E-mail de Contacto (Opcional)</label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all"
                    placeholder="exemplo@vagas.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Link de Candidatura Externa (Opcional)</label>
                  <input
                    type="url"
                    value={formData.externalUrl}
                    onChange={(e) => setFormData({ ...formData, externalUrl: e.target.value })}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all"
                    placeholder="https://vagas.recrutamento.com/vaga/123"
                  />
                </div>
              </>
            ) : formData.category === '💚 Doações & Solidariedade' ? (
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                  Preço
                </label>
                <div className="w-full px-4 py-4 bg-emerald-50 border-2 border-emerald-150 text-emerald-800 rounded-2xl font-extrabold flex items-center gap-2 select-none">
                  <span>💚 Grátis (Artigo para Doação Solidária)</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                  Preço ({formData.country === 'Reino Unido' ? '£' : '€'})
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
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all"
                    placeholder="Ex: 799,950 ou £799,950.00"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Comunidade de Publicação</label>
              <div className="relative">
                <select
                  value={formData.country}
                  disabled={!isAdmin && isEditLocked}
                  onChange={(e) => handleCountryChange(e.target.value as any)}
                  className="w-full px-4 py-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl font-bold text-emerald-800 outline-none cursor-pointer appearance-none shadow-sm hover:border-emerald-200 transition-all font-sans disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="Portugal" className="font-bold text-slate-900 bg-white">🇵🇹 Portugal</option>
                  <option value="Reino Unido" className="font-bold text-slate-900 bg-white">🇬🇧 Reino Unido</option>
                  {isStaff && (
                    <option value="Ambos" className="font-bold text-slate-900 bg-white">🌐 Ambos os Países</option>
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-emerald-800 font-bold select-none">
                  ▼
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Cidade / Região</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={20} />
                <SearchableCitySelect
                  value={formData.city}
                  disabled={!isAdmin && isEditLocked}
                  onChange={(val) => setFormData({ ...formData, city: val })}
                  placeholder="Escreva ou escolha a sua cidade"
                  country={formData.country}
                />
              </div>
            </div>

            {formData.category !== 'Imigração' && formData.category !== 'Trabalho/Empregos' && (
              <div className="space-y-4 md:col-span-2 p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl" id="contact-phone-section">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Telefone de Contacto</h4>
                  <p className="text-xs text-slate-500">Escolha o telefone que os interessados usarão para falar consigo via WhatsApp.</p>
                </div>

                <label className="flex items-center gap-3 cursor-pointer select-none py-1">
                  <input
                    type="checkbox"
                    checked={formData.useProfilePhone}
                    onChange={(e) => handleUseProfilePhoneChange(e.target.checked)}
                    className="w-5 h-5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 transition-all cursor-pointer"
                    id="chk-use-profile-phone"
                  />
                  <span className="text-sm font-bold text-slate-700">
                    Usar telefone do meu perfil <span className="text-slate-500 font-normal">({profile?.phone || 'Sem telefone configurado'})</span>
                  </span>
                </label>

                <AnimatePresence>
                  {!formData.useProfilePhone && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden space-y-2"
                    >
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mt-2">
                        Telefone de contacto do anúncio (Opcional)
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          value={formData.contactPhone}
                          onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                          className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-600 focus:outline-none transition-all text-sm"
                          placeholder={formData.country === 'Reino Unido' ? '+44 7123 456789' : '+351 912 345 678'}
                          id="txt-contact-phone"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium">
                        * Se o deixar em branco, usaremos o telefone do seu perfil como fallback para os interessados.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="space-y-4 md:col-span-2">
              {isStaff && (
                <div className="p-6 bg-amber-500/10 border-2 border-amber-500/25 rounded-3xl space-y-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🛠️</span>
                    <div>
                      <h3 className="text-sm font-black text-amber-800 uppercase tracking-wider">Painel Administrativo: Destaque Permanente</h3>
                      <p className="text-[11px] text-amber-900/75">Este anúncio pode ser configurado para nunca expirar e servir de preenchimento rotativo na Home.</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/60 rounded-2xl border border-amber-500/10 shadow-sm">
                    <div className="flex items-center gap-3">
                      <input
                        id="isPermanentFeatured"
                        type="checkbox"
                        checked={formData.isPermanentFeatured}
                        onChange={(e) => setFormData(prev => ({ ...prev, isPermanentFeatured: e.target.checked }))}
                        className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
                      />
                      <label htmlFor="isPermanentFeatured" className="text-sm font-bold text-slate-800 cursor-pointer select-none">
                        ⭐ Ativar como Destaque Permanente
                      </label>
                    </div>
                    <span className="text-[10px] font-black bg-amber-600 text-white px-2 py-1 rounded-lg uppercase tracking-wider">
                      Staff Only
                    </span>
                  </div>

                  {formData.isPermanentFeatured && (
                    <motion.div 
                      key="perm-fields"
                      initial={{ opacity: 0, y: -10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2"
                    >
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black tracking-wider text-amber-800 block">Nível do Destaque Permanente</label>
                        <select
                          value={formData.plan}
                          onChange={(e) => setFormData(prev => ({ ...prev, plan: e.target.value as any }))}
                          className="w-full px-4 py-3 bg-white border-2 border-amber-100 rounded-xl font-bold text-slate-800 outline-none cursor-pointer"
                        >
                          <option value="local">Destaque Local ⭐</option>
                          <option value="national">Destaque Nacional ⭐⭐⭐</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black tracking-wider text-amber-800 block">País de Exibição Permanente</label>
                        <select
                          value={formData.country}
                          onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value as any }))}
                          className="w-full px-4 py-3 bg-white border-2 border-amber-100 rounded-xl font-bold text-slate-800 outline-none cursor-pointer"
                        >
                          <option value="Portugal">🇵🇹 Portugal</option>
                          <option value="Reino Unido">🇬🇧 Reino Unido</option>
                          <option value="Ambos">🌐 Ambos os Países</option>
                        </select>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider block">Tipo de Anúncio & Destaque</label>
              {formData.category === '💚 Doações & Solidariedade' ? (
                <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl border-2 border-emerald-400 shadow-md relative overflow-hidden text-left col-span-1 md:col-span-3">
                  <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-black px-4 py-1.5 rounded-bl-xl uppercase tracking-wider animate-pulse flex items-center gap-1">
                    <span>Benefício Solidário Ativo</span> <span>💚</span>
                  </div>
                  
                  <h3 className="text-base font-black text-emerald-950 flex items-center gap-2 mb-3">
                    <span>🎉</span> Benefícios do seu anúncio solidário
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-emerald-800 font-semibold mb-5">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-black">✅</span> <span>Destaque Local Gratuito</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-black">✅</span> <span>Maior visibilidade na sua cidade</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-black">✅</span> <span>Selo Solidário destacado no anúncio</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-black">✅</span> <span>100% Grátis (Sem taxa de publicação ou destaque)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-black">✅</span> <span>Validade do Destaque: 30 dias de destaque gratuito</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-600 text-white border border-emerald-500 rounded-2xl text-xs space-y-1.5 font-sans">
                    <p className="font-extrabold flex items-center gap-1.5 text-white tracking-wide">
                      <span>⚠️</span> AVISO IMPORTANTE
                    </p>
                    <p className="leading-relaxed font-semibold opacity-95">
                      This listing is strictly for donations and 100% free items. Any attempt at hidden sales, deceptive advertising, or abuse will result in account suspension on ConnectBoat. Please report any irregularities to moderation.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-4">
                  
                  {/* Plano Gratuito (Normal) */}
                  <button
                    type="button"
                    disabled={!isAdmin && isEditLocked}
                    onClick={() => setFormData({ ...formData, plan: 'free' })}
                    className={`p-5 rounded-3xl border-2 text-left transition-all ${
                      formData.plan === 'free' 
                        ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-100' 
                        : 'border-slate-100 bg-slate-50 hover:border-slate-300'
                    } ${(!isAdmin && isEditLocked) ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-extrabold text-slate-900 text-sm">Anúncio Normal</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Vendas e transações pontuais grátis</p>
                      </div>
                      <span className="text-[9px] font-black bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                        Grátis
                      </span>
                    </div>
                    
                    <ul className="text-[11px] text-slate-600 space-y-1 my-3">
                      <li className="flex items-center gap-1">✅ Até 2 fotos</li>
                      <li className="flex items-center gap-1">✅ Listagens normais</li>
                      <li className="flex items-center gap-1">✅ Pesquisa e favoritos</li>
                    </ul>

                    <div className="mt-3 pt-3 border-t border-slate-200/50" onClick={(e) => e.stopPropagation()}>
                      <label className="text-[9px] uppercase font-black tracking-wider text-slate-400 block mb-1">Duração do Anúncio</label>
                      <select
                        value={formData.duration}
                        disabled={!isAdmin && isEditLocked}
                        onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0, plan: 'free' })}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold outline-none cursor-pointer disabled:opacity-50"
                      >
                        <option value={15}>15 Dias</option>
                        <option value={30}>30 Dias</option>
                      </select>
                    </div>
                  </button>

                  {/* ⭐ Destaque Local */}
                  <button
                    type="button"
                    disabled={!isAdmin && isEditLocked}
                    onClick={() => setFormData({ ...formData, plan: 'local' })}
                    className={`p-5 rounded-3xl border-2 text-left transition-all relative overflow-hidden ${
                      formData.plan === 'local' || formData.plan === 'highlight'
                        ? 'border-amber-400 bg-amber-50/20 ring-4 ring-amber-100' 
                        : 'border-slate-100 bg-slate-50 hover:border-slate-300'
                    } ${(!isAdmin && isEditLocked) ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-yellow-500 text-white text-[8px] font-black px-2 py-1 rounded-bl-xl uppercase tracking-wider shrink-0 animate-pulse">
                      Local ⭐
                    </div>
                    
                    <div className="flex justify-between items-start mb-2 mt-2">
                      <div>
                        <p className="font-extrabold text-slate-900 text-sm">Destaque Local</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Destaque na sua cidade</p>
                        {isPromoActive && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-100">
                              🎁 Gratuito no Lançamento
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <ul className="text-[11px] text-slate-600 space-y-1 my-3">
                      <li className="flex items-center gap-1">🌟 <strong>Até 4 fotos</strong></li>
                      <li className="flex items-center gap-1">🌟 Destaque local</li>
                      <li className="flex items-center gap-1">🌟 Carrossel local</li>
                      <li className="flex items-center gap-1">🌟 Etiqueta ⭐</li>
                    </ul>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-1 p-2 bg-white/50 rounded-xl border border-dashed border-amber-200">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-amber-800">Duração:</span>
                        <span className="font-extrabold text-slate-930">30 Dias</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-amber-800">Investimento:</span>
                        <span className="font-black text-amber-600 flex flex-col items-end">
                          <span className={isPromoActive ? "line-through text-slate-400 font-bold" : ""}>
                            {formData.country === 'Reino Unido' ? '£4.99' : '€4.99'}
                          </span>
                          {isPromoActive && (
                            <span className="text-emerald-600 font-black text-[9px]">Grátis 🎁</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* ⭐⭐⭐ Destaque Nacional */}
                  <button
                    type="button"
                    disabled={!isAdmin && isEditLocked}
                    onClick={() => setFormData({ ...formData, plan: 'national' })}
                    className={`p-5 rounded-3xl border-2 text-left transition-all relative overflow-hidden ${
                      formData.plan === 'national' 
                        ? 'border-indigo-500 bg-indigo-50/20 ring-4 ring-indigo-100' 
                        : 'border-slate-100 bg-slate-50 hover:border-slate-300'
                    } ${(!isAdmin && isEditLocked) ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <div className="absolute top-0 right-0 bg-gradient-to-l from-indigo-600 to-indigo-500 text-white text-[8px] font-black px-2 py-1 rounded-bl-xl uppercase tracking-wider shrink-0 animate-pulse">
                      Nacional ⭐⭐⭐
                    </div>
                    
                    <div className="flex justify-between items-start mb-2 mt-2">
                      <div>
                        <p className="font-extrabold text-slate-900 text-sm">Destaque Nacional</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Visibilidade em todo o país</p>
                        {isPromoActive && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1.5 text-[9px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-100">
                              🎁 Gratuito no Lançamento
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <ul className="text-[11px] text-slate-600 space-y-1 my-3">
                      <li className="flex items-center gap-1 font-semibold text-indigo-900">🚀 Prioridade Máxima</li>
                      <li className="flex items-center gap-1">🌟 <strong>Até 6 fotos</strong></li>
                      <li className="flex items-center gap-1">🌟 Todas as cidades</li>
                      <li className="flex items-center gap-1">🌟 Etiqueta ⭐⭐⭐</li>
                    </ul>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-1 p-2 bg-indigo-50/50 rounded-xl border border-dashed border-indigo-200">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-indigo-700">Duração:</span>
                        <span className="font-extrabold text-slate-930">30 Dias</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-indigo-700">Investimento:</span>
                        <span className="font-black text-indigo-600 flex flex-col items-end">
                          <span className={isPromoActive ? "line-through text-slate-400 font-bold" : ""}>
                            {formData.country === 'Reino Unido' ? '£7.99' : '€7.99'}
                          </span>
                          {isPromoActive && (
                            <span className="text-emerald-600 font-black text-[9px]">Grátis 🎁</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </button>

                </div>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Descrição Detalhada</label>
              <div className="relative">
                <FileText className="absolute left-4 top-6 text-slate-400" size={20} />
                <textarea
                  id="txt-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={6}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all resize-none"
                  placeholder="Descreva o estado do produto, acessórios incluídos, etc."
                />
              </div>
            </div>
          </div>

          {formError && (
            <div className="p-4 bg-rose-50 border-2 border-rose-200 text-rose-800 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold shadow-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="text-rose-600 shrink-0" size={18} />
                <span>{formError}</span>
              </div>
              <button
                type="button"
                onClick={() => setFormError(null)}
                className="text-rose-500 hover:text-rose-700 p-1"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <button
            id="btn-submit-ad"
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCcw className="animate-spin text-white" size={20} />
                <span>A processar o anúncio...</span>
              </>
            ) : id ? 'Atualizar Anúncio' : 'Publicar Anúncio'}
          </button>
        </form>
      </motion.div>

      {/* Stripe Checkout Modal Simulator */}
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
                  <span>Stripe Secure Checkout</span>
                </div>
                <h3 className="text-xl font-bold mt-2">Destaque o seu anúncio</h3>
                <p className="text-xs text-slate-300 mt-1">Multiplique em até 10x as visualizações e feche negócio rápido.</p>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                {/* Summary */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Subscrição (30 dias Destaque)</span>
                    <span className="font-bold text-slate-900">
                      {formData.country === 'Reino Unido' ? '£4.99' : '€4.99'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Taxas e processamento</span>
                    <span className="font-semibold text-emerald-600">Grátis</span>
                  </div>
                  <div className="border-t border-slate-200/50 pt-2 flex justify-between text-sm font-bold text-slate-900">
                    <span>Total a pagar</span>
                    <span className="text-indigo-600">
                      {formData.country === 'Reino Unido' ? '£4.99' : '€4.99'}
                    </span>
                  </div>
                </div>

                {/* Credit Card Fields */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">Dados do Cartão (Simulação)</span>
                  
                  <div className="border-2 border-slate-200 focus-within:border-indigo-600 rounded-2xl px-4 py-3 bg-white space-y-3 transition-all shadow-sm">
                    {/* Card Number */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Número do Cartão</label>
                      <input
                        type="text"
                        value={mockCardNumber}
                        onChange={(e) => setMockCardNumber(e.target.value)}
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
                          value={mockExpiry}
                          onChange={(e) => setMockExpiry(e.target.value)}
                          className="w-full bg-transparent border-none p-0 outline-none text-sm text-slate-900 font-medium placeholder-slate-300"
                          placeholder="MM/AA"
                        />
                      </div>
                      {/* CVC */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CVC</label>
                        <input
                          type="password"
                          value={mockCVC}
                          onChange={(e) => setMockCVC(e.target.value)}
                          className="w-full bg-transparent border-none p-0 outline-none text-sm text-slate-900 font-medium placeholder-slate-300"
                          placeholder="CVC"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Holder Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nome no Cartão</label>
                    <input
                      type="text"
                      value={mockCardName}
                      onChange={(e) => setMockCardName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 text-sm"
                      placeholder="Ex: João Silva"
                    />
                  </div>
                </div>

                {/* Security and Logos */}
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">🔒 Processamento seguro SSL</span>
                  <div className="flex gap-1.5 opacity-60">
                    <span className="px-1 py-0.5 border border-slate-200 rounded bg-slate-50 font-black text-[8px] tracking-tighter">VISA</span>
                    <span className="px-1 py-0.5 border border-slate-200 rounded bg-slate-50 font-black text-[8px] tracking-tighter">MC</span>
                    <span className="px-1 py-0.5 border border-slate-200 rounded bg-slate-50 font-black text-[8px] tracking-tighter">STRIPE</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleMockPaymentSuccess}
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white font-extrabold py-4 rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <RefreshCcw className="animate-spin" size={16} /> A processar transação...
                      </span>
                    ) : (
                      <span>Efetuar Pagamento de {formData.country === 'Reino Unido' ? '£4.99' : '€4.99'}</span>
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setLoading(false);
                    }}
                    className="w-full text-center py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-all"
                  >
                    Cancelar e voltar ao anúncio
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
              <div className="relative p-6 bg-amber-50 border-b border-amber-100 text-slate-900 flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Anúncio Parecido Detetado</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Parece que este anúncio já existe no seu perfil. Deseja revisar antes de publicar?
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <span className="text-[10px] uppercase font-black tracking-wider text-amber-700 block">Motivo do aviso:</span>
                  <p className="text-sm text-slate-700 leading-relaxed font-semibold">
                    {duplicateWarning.reason}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Publishing duplicate listings may lead to moderation action by the ConnectBoat team. We recommend updating your existing listing instead.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 pt-0 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDuplicateWarning(null);
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-4 rounded-xl transition-all text-center text-sm cursor-pointer"
                >
                  Revisar e Editar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const finalAdData = duplicateWarning.adData;
                    const finalAdId = duplicateWarning.adId;
                    setDuplicateWarning(null);
                    
                    const isPaidDestaque = finalAdData.plan === 'local' || finalAdData.plan === 'national';
                    const alreadyHasThisDestaque = originalAd?.isFeatured && (originalAd?.plan === finalAdData.plan || (originalAd?.plan === 'highlight' && finalAdData.plan === 'local'));

                    if (isPaidDestaque && !alreadyHasThisDestaque && !isPromoActive) {
                      setPendingAdData(finalAdData);
                      setShowPaymentModal(true);
                    } else {
                      await executeSaveAd(finalAdData, finalAdId);
                    }
                  }}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-4 rounded-xl transition-all text-center text-sm shadow-md cursor-pointer"
                >
                  Publicar de qualquer forma
                </button>
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
              <h3 className="text-xl font-brand font-black text-slate-900">Salvo com Sucesso!</h3>
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
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Adicionar Foto</h3>
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
                    <p className="font-extrabold text-sm text-slate-900">Tirar Foto (Câmara Nativa)</p>
                    <p className="text-[11px] text-slate-500 font-medium">Abre a câmara do telemóvel para fotografar</p>
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
                    <p className="font-extrabold text-sm text-slate-900">Escolher da Galeria</p>
                    <p className="text-[11px] text-slate-500 font-medium">Escolha uma ou mais imagens já guardadas</p>
                  </div>
                </button>
              </div>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={() => setShowPhotoSourceMenu(false)}
                className="w-full text-center py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Voltar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CreateAd;
