export type AdStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'expired' | 'archived' | 'sold';
export type AdLifecycleStatus = 'active' | 'inactive' | 'near_expiration' | 'expired' | 'archived' | 'sold';
export type AdPlan = 'free' | 'local' | 'national' | 'highlight' | 'intermediate' | 'premium';

export interface RenewalAction {
  date: any; // Firestore Timestamp
  action: 'renewal' | 'plan_change';
  previousExpiration: any;
  newExpiration: any;
  plan: AdPlan;
}

export interface Review {
  id: string;
  adId: string;
  adTitle: string;
  adCategory?: string;
  sellerId: string;
  buyerId?: string;
  buyerName: string;
  rating: number; // 1-5
  comment: string;
  success: boolean; // "Correu tudo bem com a negociação?"
  createdAt: any; // Firestore Timestamp
  reviewerId?: string;
  revieweeId?: string;
}

export interface MarketplaceSettings {
  id: 'global';
  planDurations: {
    free: number; // days
    local: number;
    national: number;
    showcase?: number;
    intermediate?: number;
    premium?: number;
  };
  planPrices: {
    local: number;
    national: number;
    showcase: number;
  };
  maxImages: {
    free: number;
    local: number;
    national: number;
    showcase?: number;
    intermediate?: number;
    premium?: number;
  };
  maxShowcaseProducts?: number;
  expirationAction: 'archive' | 'delete';
  warningDays: number;
  categories?: string[];
  ptRibbonScale?: number;
  showTotalAdsBadge?: boolean;
  highlightSpeed?: number;
  showTotalUsersBadge?: boolean;
  searchGroupBgColor?: string;
  searchGroupOpacity?: number;
  compactCardMode?: boolean;
  enableFotosFeature?: boolean;
  launchPromoActive?: boolean;
}

export interface BannerDeviceConfig {
  posX: number;             // 0 to 100 (% horizontal)
  posY: number;             // 0 to 100 (% vertical)
  width: number;            // 10 to 100 (%)
  height: number;           // 0 = auto, or px
  paddingVertical: number;   // 0 to 60 (px)
  paddingHorizontal: number; // 0 to 60 (px)
  borderRadius: number;     // 0 to 50 (px)
  bgOpacity: number;        // 0 to 100 (%)
  bgColor: string;          // Hex color e.g. '#0f172a'
  fontSize: number;         // 8 to 36 (px)
  textAlign: 'left' | 'center' | 'right';
  textColor?: string;       // Hex color e.g. '#ffffff'
  backdropBlur?: number;    // 0 to 24 (px)
  customTextPt?: string;    // Custom message for PT
  customTextEn?: string;    // Custom message for UK
}

export interface BannerConfig {
  id: string;
  enabled: boolean;
  desktop: BannerDeviceConfig;
  mobile: BannerDeviceConfig;
  updatedAt?: any;
  updatedBy?: string;
}

export const DEFAULT_BANNER_DEVICE_DESKTOP: BannerDeviceConfig = {
  posX: 96,
  posY: 90,
  width: 55,
  height: 0,
  paddingVertical: 14,
  paddingHorizontal: 22,
  borderRadius: 16,
  bgOpacity: 75,
  bgColor: '#0f172a',
  fontSize: 15,
  textAlign: 'right',
  textColor: '#ffffff',
  backdropBlur: 12,
  customTextPt: '',
  customTextEn: ''
};

export const DEFAULT_BANNER_DEVICE_MOBILE: BannerDeviceConfig = {
  posX: 95,
  posY: 90,
  width: 88,
  height: 0,
  paddingVertical: 10,
  paddingHorizontal: 14,
  borderRadius: 12,
  bgOpacity: 75,
  bgColor: '#0f172a',
  fontSize: 11,
  textAlign: 'right',
  textColor: '#ffffff',
  backdropBlur: 12,
  customTextPt: '',
  customTextEn: ''
};

export const DEFAULT_BANNER_CONFIG: BannerConfig = {
  id: 'bannerConfig',
  enabled: true,
  desktop: DEFAULT_BANNER_DEVICE_DESKTOP,
  mobile: DEFAULT_BANNER_DEVICE_MOBILE
};

export interface UserProfile {
  id?: string;
  uid: string;
  name: string;
  email: string;
  phone: string;
  city?: string;
  role?: 'user' | 'admin' | 'moderator' | 'content_creator';
  acceptedTerms: boolean;
  acceptedTermsAt: any; // Firestore Timestamp
  lastLoginAt?: any; // Firestore Timestamp
  ratingAverage?: number;
  ratingCount?: number;
  referralCode?: string;
  referredUsersCount?: number;
  referredBy?: string;
  referralCredits?: number;
  pointsFromAds?: number;
  country?: 'United Kingdom';
  showcaseActive?: boolean;
  showcaseApproved?: boolean;
  showcaseName?: string;
  showcaseSlug?: string;
  showcaseCategory?: string;
  showcaseLogo?: string;
  showcaseCover?: string;
  showcaseDescription?: string;
  showcaseWhatsapp?: string;
  showcaseFacebook?: string;
  showcaseInstagram?: string;
  showcasePlan?: 'basic' | 'premium';
}

export interface ShowcaseProduct {
  id: string;
  userId: string;
  name: string;
  description: string;
  price?: number | null;
  images: string[];
  active: boolean;
  order: number;
  createdAt: any;
}

export interface Ad {
  id: string;
  title: string;
  description: string;
  price?: number;
  imageUrl: string; // Keep for backward compatibility, but use images[0]
  images: string[];
  city: string;
  country?: 'United Kingdom' | 'Portugal' | 'Reino Unido' | 'Ambos';
  category: string;
  sellerId: string;
  sellerPhone: string;
  sellerName: string;
  status: AdStatus;
  adStatus?: AdLifecycleStatus;
  plan?: AdPlan;
  expirationDate?: any; // Firestore Timestamp
  renewalHistory?: RenewalAction[];
  views?: number;
  whatsappClicks?: number;
  userNotified?: boolean;
  createdAt: any; // Firestore Timestamp
  contactEmail?: string;
  externalUrl?: string;
  isFeatured?: boolean;
  isPermanentFeatured?: boolean;
  featuredUntil?: any; // Firestore Timestamp
  pointsEarned?: boolean;
  imagePositionX?: number;
  imagePositionY?: number;
  imageZoom?: number;
  coverImageSettings?: {
    imageUrl?: string;
    x?: number;
    y?: number;
    zoom?: number;
  };
  buyerId?: string;
  buyerName?: string;
  soldAt?: any; // Firestore Timestamp
  soldOutsidePlatform?: boolean;
  sourceUrl?: string;
  externalListing?: boolean;
  demoListing?: boolean;
  sourceSite?: string;
  sourceListingId?: string;
  sourceCheckedAt?: any;
  importedBy?: string;
  importedAt?: any;
  externalStatus?: 'active' | 'removed' | 'unknown';
  salary?: string;
  contractType?: string;
  workSchedule?: string;
  serviceCoverage?: 'city' | 'radius20' | 'radius50' | 'county' | 'uk' | 'portugal' | 'online';
  companyName?: string;
  experienceRequired?: string;
  contactPhone?: string;
  useProfilePhone?: boolean;
  isDuplicate?: boolean;
  duplicateReason?: string;
  duplicateOf?: string;
  listingType?: 'normal' | 'informativo';
  listingMode?: 'external' | 'claimable';
  currency?: string;
  priceOnApplication?: boolean;
  priceRequiresReview?: boolean;
  locationRequiresReview?: boolean;
  targetUrl?: string;
  isClaimableBusiness?: boolean;
  claimStatus?: 'unclaimed' | 'pending' | 'claimed';
  claimedBy?: string | null;
  claimedAt?: any;
  businessViews?: number;
  invitationMilestonesSent?: string[];
  invitationStatus?: 'not_sent' | 'sent' | 'responded';
  invitationSentAt?: any;
  invitationLastMessage?: string;
  invitationCount?: number;

  // Boating Specific Fields (Phase 4)
  boatType?: string;
  manufacturer?: string;
  model?: string;
  year?: number | string;
  condition?: string;
  length?: string;
  beam?: string;
  draft?: string;
  fuelType?: string;
  engineBrand?: string;
  horsepower?: string;
  engineHours?: string;
  cabins?: string;
  berths?: string;
  bathrooms?: string;
  hullMaterial?: string;
  trailerIncluded?: string;
  vatPaid?: string;
  ceCertified?: string;
  location?: string;
  county?: string;
}

export const BOAT_TYPES = [
  'Motorboat',
  'Sailboat',
  'RIB',
  'Jet Ski',
  'Canal Boat',
  'Narrowboat',
  'Fishing Boat',
  'Catamaran',
  'Yacht',
  'Houseboat',
  'Commercial Boat',
  'Other'
];

export const BOAT_CONDITIONS = [
  'New',
  'Used - Excellent',
  'Used - Good',
  'Used - Fair',
  'Restored / Refitted',
  'Project / Needs Work'
];

export const BOAT_FUEL_TYPES = [
  'Diesel',
  'Petrol / Gasoline',
  'Electric',
  'Hybrid',
  'Solar',
  'None / Manual',
  'Other'
];

export const BOAT_HULL_MATERIALS = [
  'Fiberglass / GRP',
  'Aluminium',
  'Steel',
  'Wood',
  'Carbon Fibre',
  'Inflatable / Hypalon',
  'Composite',
  'Other'
];

export interface Favorite {
  id: string;
  userId: string;
  adId: string;
  createdAt: any; // Firestore Timestamp
}

export interface Report {
  id: string;
  adId: string;
  userId: string;
  reason: string;
  details?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: any; // Firestore Timestamp
}

export interface DailyMetric {
  id: string; // YYYY-MM-DD
  date: any; // Firestore Timestamp
  users: {
    total: number;
    activeLast7Days: number;
    distributionByCity: { [city: string]: number };
  };
  ads: {
    total: number;
    byStatus: { [status: string]: number };
    byCategory: { [category: string]: number };
    createdToday: number;
  };
  interactions: {
    whatsappClicks: number;
    views: number;
    renewals: number;
    favorites: number;
  };
  notifications: {
    warningsSent: number;
    renewalsAfterWarning: number;
    ignoresAfterWarning: number;
  };
}

export const CATEGORIES = [
  'Boats for Sale',
  'Boats for Hire',
  'Boat Parts',
  'Boat Engines',
  'Marine Electronics',
  'Trailers',
  'Marinas',
  'Boat Services',
  'Accessories',
  'Wanted'
];

export const CITIES = [
  'Southampton',
  'Portsmouth',
  'Plymouth',
  'Cowes',
  'Poole',
  'Lymington',
  'Hamble',
  'Dartmouth',
  'Falmouth',
  'London',
  'Brighton',
  'Bristol',
  'Liverpool',
  'Manchester',
  'Windermere',
  'Edinburgh',
  'Glasgow',
  'Belfast',
  'Cardiff',
  'Weymouth',
  'Other'
];

export const PORTUGAL_CITIES = CITIES;

export const UK_CITIES = CITIES;

export const COUNTRY_CODES = [
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+353', country: 'Ireland', flag: '🇮🇪' },
  { code: '+1', country: 'United States', flag: '🇺🇸' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+34', country: 'Spain', flag: '🇪🇸' },
  { code: '+39', country: 'Italy', flag: '🇮🇹' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱' },
];

export interface AdInterest {
  id: string; // deterministic ID: `${adId}_${interestedUserId}`
  adId: string;
  sellerId: string;
  interestedUserId: string;
  interestedUserName: string;
  createdAt: any; // Firestore Timestamp
  source: 'whatsapp';
}

export interface PhotoStoreItem {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  active: boolean;
  createdAt: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
  createdBy: string;
}

export interface GiveawayWinner {
  userId: string;
  name: string;
  email: string;
  drawDate: any; // Firestore Timestamp or Date ISO string
  status: 'Awaiting Contact' | 'Contacted' | 'Prize Delivered' | 'Aguardando Contacto' | 'Prémio Entregue';
  prizeImage?: string;
  prizeTitle?: string;
  country?: string;
}

export interface Giveaway {
  id: string;
  title: string;
  description: string;
  prizeImage: string;
  country: 'Portugal' | 'Reino Unido' | 'Ambos';
  startDate: string; // ISO-8601 string or date input
  endDate: string; // ISO-8601 string or date input
  rules: string;
  winnersCount: number;
  drawNumber?: number;
  status: 'Ativo' | 'Encerrado' | 'Finalizado';
  createdAt: any; // Firestore Timestamp
  createdBy: string;
  winners?: GiveawayWinner[];
  videoUrl?: string;
  videoBase64?: string;
}

export interface GiveawayParticipation {
  id: string; // `${giveawayId}_${userId}`
  giveawayId: string;
  userId: string;
  userName: string;
  userEmail: string;
  name?: string;
  email?: string;
  sharesCount: number;
  ticketsCount: number;
  lastShareAt?: any; // Firestore Timestamp
  lastShareChannel?: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface GiveawayShare {
  id?: string;
  giveawayId: string;
  userId: string;
  channel: string;
  createdAt: any; // Firestore Timestamp
}

export interface SystemHealthAlert {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'alert' | 'critical';
  source: 'ads' | 'email' | 'import' | 'firestore' | 'vitrines' | 'sorteios' | 'destaque';
  createdAt: any; // Date or Firestore Timestamp
  status: 'aberto' | 'resolvido';
  recommendedAction: string;
  relatedLink: string;
}

export interface CommunityVideo {
  id: string;
  slug: string;
  youtubeUrl: string;
  youtubeId: string;
  title: string;
  channelName: string;
  category: string;
  country: string;
  description: string;
  thumbnailUrl: string;
  isFeatured: boolean;
  active: boolean;
  createdAt: any; // Firestore Timestamp
  createdBy: string;
  
  // Future Expansion/Creator Fields
  ownerId?: string | null;
  ownerName?: string | null;
  channelId?: string | null;
  channelUrl?: string | null;
  createdByRole?: 'admin' | 'content_creator' | string;
  status?: 'pending' | 'approved' | 'rejected' | 'disabled';
  updatedAt?: any; // Firestore Timestamp
}


