export type AdStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'expired' | 'archived' | 'sold';
export type AdLifecycleStatus = 'active' | 'inactive' | 'near_expiration' | 'expired' | 'archived' | 'sold';
export type AdPlan = 'standard' | 'featured' | 'premium' | 'free' | 'local' | 'national' | 'highlight' | 'intermediate';

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
    standard: number; // days
    featured: number;
    premium: number;
    free?: number; // legacy
    local?: number;
    national?: number;
    showcase?: number;
    intermediate?: number;
  };
  planPrices: {
    standard: number;
    featured: number;
    premium: number;
    marketplaceAdditional?: number;
    local?: number; // legacy
    national?: number;
    showcase?: number;
  };
  maxImages: {
    standard: number;
    featured: number;
    premium: number;
    free?: number; // legacy
    local?: number;
    national?: number;
    showcase?: number;
    intermediate?: number;
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
  featuredSalesColor?: string;
  featuredHireColor?: string;
  compactCardMode?: boolean;
  enableFotosFeature?: boolean;
  launchPromoActive?: boolean;
  enablePortugalMarket?: boolean;
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
  financeAccess?: boolean;
  marketplaceFreeListingUsed?: boolean;
  marketplaceFreeListingUsedAt?: any;
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
  region?: string;
  country?: string;
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
  displayName?: string;
  publicDescription?: string;
  profileImageUrl?: string;
  createdAt?: any;
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

export type ListingIntent = 'sale' | 'hire';

export const PRICING_UNITS = [
  'Per Hour',
  'Per Half Day',
  'Per Day',
  'Per Week'
] as const;

export type PricingUnit = typeof PRICING_UNITS[number];

export interface Ad {
  id: string;
  title: string;
  description: string;
  price?: number;
  imageUrl: string; // Keep for backward compatibility, but use images[0]
  images: string[];
  city: string;
  region?: string;
  country?: 'United Kingdom' | 'Portugal' | 'Reino Unido' | 'Ambos' | string;
  category: string;
  sellerId: string;
  sellerPhone: string;
  sellerName: string;
  status: AdStatus;
  adStatus?: AdLifecycleStatus;
  isHidden?: boolean;
  plan?: AdPlan;
  marketplaceListingType?: 'free_first' | 'paid_additional';
  marketplaceFreeBenefitConsumed?: boolean;
  marketplaceListingFee?: number;
  paymentProductType?: string;
  paidAt?: any; // Firestore Timestamp
  stripeCheckoutSessionId?: string;
  paymentConfirmationEmailSent?: boolean;
  paymentConfirmationEmailStatus?: string;
  paymentConfirmationEmailError?: string;
  featuredLevel?: string;
  selectedAddOns?: string[];
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
  duplicateLevel?: 'confirmed' | 'possible' | 'none';
  duplicateReason?: string;
  duplicateOf?: string;
  duplicateScore?: number;
  duplicateMatchedFields?: string[];
  duplicateUserChoice?: 'continued_different_boat' | 'blocked' | 'reviewed';
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

  // Media Boost Fields
  mediaBoostEnabled?: boolean;
  videoUrl?: string | null;
  videoStoragePath?: string | null;
  tempVideoPath?: string | null;
  tempVideoUrl?: string | null;
  videoDurationSeconds?: number | null;
  videoFileSize?: number | null;
  videoMimeType?: string | null;
  videoPaid?: boolean;
  mediaBoostPrice?: number;

  // Rental / Hire Specific Fields
  listingIntent?: 'sale' | 'hire';
  pricingUnit?: 'Per Hour' | 'Per Half Day' | 'Per Day' | 'Per Week' | string;
  rentalPrice?: number;
  departureLocation?: string;
  passengerCapacity?: number | string;
  skipperIncluded?: 'Yes' | 'No' | boolean;
  fuelIncluded?: 'Yes' | 'No' | boolean;
  minimumHireDuration?: string;
  securityDeposit?: number | string;
  availableEquipment?: string[] | string;
  rentalRules?: string;
  availabilityNotes?: string;

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
  'Petrol',
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

export const UK_REGIONS = [
  'England',
  'Scotland',
  'Wales',
  'Northern Ireland',
  'Other'
] as const;

export type UKRegion = typeof UK_REGIONS[number];

export const CITIES_BY_REGION: Record<string, string[]> = {
  'England': [
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
    'Weymouth',
    'Ipswich',
    'Chichester',
    'Torquay',
    'Brixham',
    'Dover',
    'Harwich',
    'Whitby',
    'Newcastle',
    'Hull'
  ],
  'Scotland': [
    'Glasgow',
    'Edinburgh',
    'Aberdeen',
    'Dundee',
    'Inverness',
    'Oban',
    'Troon',
    'Largs',
    'Kip',
    'Fort William',
    'Peterhead',
    'Stornoway',
    'Lerwick',
    'Kirkwall'
  ],
  'Wales': [
    'Cardiff',
    'Swansea',
    'Milford Haven',
    'Conwy',
    'Bangor',
    'Holyhead',
    'Tenby',
    'Aberystwyth',
    'Pwllheli'
  ],
  'Northern Ireland': [
    'Belfast',
    'Bangor (NI)',
    'Derry / Londonderry',
    'Carrickfergus',
    'Portrush',
    'Newry',
    'Larne'
  ],
  'Other': [
    'Channel Islands',
    'Isle of Man',
    'Other'
  ]
};

export const CITIES = Array.from(
  new Set(Object.values(CITIES_BY_REGION).flat())
);

export const PORTUGAL_CITIES = CITIES;

export const UK_CITIES = CITIES;

export function getRegionForCity(city: string | undefined | null): string {
  if (!city) return 'England';
  const norm = city.trim().toLowerCase();
  for (const [region, cities] of Object.entries(CITIES_BY_REGION)) {
    if (cities.some(c => c.toLowerCase() === norm)) {
      return region;
    }
  }
  return 'England';
}

export const COUNTRY_CODES = [
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+1', country: 'United States', flag: '🇺🇸' },
  { code: '+30', country: 'Greece', flag: '🇬🇷' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱' },
  { code: '+32', country: 'Belgium', flag: '🇧🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+34', country: 'Spain', flag: '🇪🇸' },
  { code: '+36', country: 'Hungary', flag: '🇭🇺' },
  { code: '+39', country: 'Italy', flag: '🇮🇹' },
  { code: '+40', country: 'Romania', flag: '🇷🇴' },
  { code: '+43', country: 'Austria', flag: '🇦🇹' },
  { code: '+45', country: 'Denmark', flag: '🇩🇰' },
  { code: '+46', country: 'Sweden', flag: '🇸🇪' },
  { code: '+48', country: 'Poland', flag: '🇵🇱' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+351', country: 'Portugal', flag: '🇵🇹' },
  { code: '+352', country: 'Luxembourg', flag: '🇱🇺' },
  { code: '+353', country: 'Ireland', flag: '🇮🇪' },
  { code: '+356', country: 'Malta', flag: '🇲🇹' },
  { code: '+357', country: 'Cyprus', flag: '🇨🇾' },
  { code: '+358', country: 'Finland', flag: '🇫🇮' },
  { code: '+359', country: 'Bulgaria', flag: '🇧🇬' },
  { code: '+370', country: 'Lithuania', flag: '🇱🇹' },
  { code: '+371', country: 'Latvia', flag: '🇱🇻' },
  { code: '+372', country: 'Estonia', flag: '🇪🇪' },
  { code: '+385', country: 'Croatia', flag: '🇭🇷' },
  { code: '+386', country: 'Slovenia', flag: '🇸🇮' },
  { code: '+420', country: 'Czechia', flag: '🇨🇿' },
  { code: '+421', country: 'Slovakia', flag: '🇸🇰' },
  { code: '+1', country: 'Canada', flag: '🇨🇦' },
  { code: '+7', country: 'Kazakhstan', flag: '🇰🇿' },
  { code: '+7', country: 'Russia', flag: '🇷🇺' },
  { code: '+20', country: 'Egypt', flag: '🇪🇬' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
  { code: '+39', country: 'Vatican City', flag: '🇻🇦' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭' },
  { code: '+47', country: 'Norway', flag: '🇳🇴' },
  { code: '+51', country: 'Peru', flag: '🇵🇪' },
  { code: '+52', country: 'Mexico', flag: '🇲🇽' },
  { code: '+53', country: 'Cuba', flag: '🇨🇺' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴' },
  { code: '+58', country: 'Venezuela', flag: '🇻🇪' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭' },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+66', country: 'Thailand', flag: '🇹🇭' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷' },
  { code: '+84', country: 'Viet Nam', flag: '🇻🇳' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+90', country: 'Türkiye', flag: '🇹🇷' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+92', country: 'Pakistan', flag: '🇵🇰' },
  { code: '+93', country: 'Afghanistan', flag: '🇦🇫' },
  { code: '+94', country: 'Sri Lanka', flag: '🇱🇰' },
  { code: '+95', country: 'Myanmar', flag: '🇲🇲' },
  { code: '+98', country: 'Iran', flag: '🇮🇷' },
  { code: '+211', country: 'South Sudan', flag: '🇸🇸' },
  { code: '+212', country: 'Morocco', flag: '🇲🇦' },
  { code: '+213', country: 'Algeria', flag: '🇩🇿' },
  { code: '+216', country: 'Tunisia', flag: '🇹🇳' },
  { code: '+218', country: 'Libya', flag: '🇱🇾' },
  { code: '+220', country: 'Gambia', flag: '🇬🇲' },
  { code: '+221', country: 'Senegal', flag: '🇸🇳' },
  { code: '+222', country: 'Mauritania', flag: '🇲🇷' },
  { code: '+223', country: 'Mali', flag: '🇲🇱' },
  { code: '+224', country: 'Guinea', flag: '🇬🇳' },
  { code: '+225', country: 'Côte d\'Ivoire', flag: '🇨🇮' },
  { code: '+226', country: 'Burkina Faso', flag: '🇧🇫' },
  { code: '+227', country: 'Niger', flag: '🇳🇪' },
  { code: '+228', country: 'Togo', flag: '🇹🇬' },
  { code: '+229', country: 'Benin', flag: '🇧🇯' },
  { code: '+230', country: 'Mauritius', flag: '🇲🇺' },
  { code: '+231', country: 'Liberia', flag: '🇱🇷' },
  { code: '+232', country: 'Sierra Leone', flag: '🇸🇱' },
  { code: '+233', country: 'Ghana', flag: '🇬🇭' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
  { code: '+235', country: 'Chad', flag: '🇹🇩' },
  { code: '+236', country: 'Central African Republic', flag: '🇨🇫' },
  { code: '+237', country: 'Cameroon', flag: '🇨🇲' },
  { code: '+238', country: 'Cabo Verde', flag: '🇨🇻' },
  { code: '+239', country: 'São Tomé and Príncipe', flag: '🇸🇹' },
  { code: '+240', country: 'Equatorial Guinea', flag: '🇬🇶' },
  { code: '+241', country: 'Gabon', flag: '🇬🇦' },
  { code: '+242', country: 'Congo', flag: '🇨🇬' },
  { code: '+243', country: 'Democratic Republic of the Congo', flag: '🇨🇩' },
  { code: '+244', country: 'Angola', flag: '🇦🇴' },
  { code: '+245', country: 'Guinea-Bissau', flag: '🇬🇼' },
  { code: '+246', country: 'Diego Garcia', flag: '🇮🇴' },
  { code: '+247', country: 'Ascension Island', flag: '🇦🇨' },
  { code: '+248', country: 'Seychelles', flag: '🇸🇨' },
  { code: '+249', country: 'Sudan', flag: '🇸🇩' },
  { code: '+250', country: 'Rwanda', flag: '🇷🇼' },
  { code: '+251', country: 'Ethiopia', flag: '🇪🇹' },
  { code: '+252', country: 'Somalia', flag: '🇸🇴' },
  { code: '+253', country: 'Djibouti', flag: '🇩🇯' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪' },
  { code: '+255', country: 'Tanzania', flag: '🇹🇿' },
  { code: '+256', country: 'Uganda', flag: '🇺🇬' },
  { code: '+257', country: 'Burundi', flag: '🇧🇮' },
  { code: '+258', country: 'Mozambique', flag: '🇲🇿' },
  { code: '+260', country: 'Zambia', flag: '🇿🇲' },
  { code: '+261', country: 'Madagascar', flag: '🇲🇬' },
  { code: '+262', country: 'French Southern/Indian Ocean territories', flag: '🇷🇪' },
  { code: '+263', country: 'Zimbabwe', flag: '🇿🇼' },
  { code: '+264', country: 'Namibia', flag: '🇳🇦' },
  { code: '+265', country: 'Malawi', flag: '🇲🇼' },
  { code: '+266', country: 'Lesotho', flag: '🇱🇸' },
  { code: '+267', country: 'Botswana', flag: '🇧🇼' },
  { code: '+268', country: 'Eswatini', flag: '🇸🇿' },
  { code: '+269', country: 'Comoros', flag: '🇰🇲' },
  { code: '+290', country: 'Saint Helena and Tristan da Cunha', flag: '🇸🇭' },
  { code: '+291', country: 'Eritrea', flag: '🇪🇷' },
  { code: '+297', country: 'Aruba', flag: '🇦🇼' },
  { code: '+298', country: 'Faroe Islands', flag: '🇫🇴' },
  { code: '+299', country: 'Greenland', flag: '🇬🇱' },
  { code: '+350', country: 'Gibraltar', flag: '🇬🇮' },
  { code: '+354', country: 'Iceland', flag: '🇮🇸' },
  { code: '+355', country: 'Albania', flag: '🇦🇱' },
  { code: '+373', country: 'Moldova', flag: '🇲🇩' },
  { code: '+374', country: 'Armenia', flag: '🇦🇲' },
  { code: '+375', country: 'Belarus', flag: '🇧🇾' },
  { code: '+376', country: 'Andorra', flag: '🇦🇩' },
  { code: '+377', country: 'Monaco', flag: '🇲🇨' },
  { code: '+378', country: 'San Marino', flag: '🇸🇲' },
  { code: '+380', country: 'Ukraine', flag: '🇺🇦' },
  { code: '+381', country: 'Serbia', flag: '🇷🇸' },
  { code: '+382', country: 'Montenegro', flag: '🇲🇪' },
  { code: '+383', country: 'Kosovo', flag: '🇽🇰' },
  { code: '+387', country: 'Bosnia and Herzegovina', flag: '🇧🇦' },
  { code: '+389', country: 'North Macedonia', flag: '🇲🇰' },
  { code: '+423', country: 'Liechtenstein', flag: '🇱🇮' },
  { code: '+500', country: 'Falkland Islands', flag: '🇫🇰' },
  { code: '+501', country: 'Belize', flag: '🇧🇿' },
  { code: '+502', country: 'Guatemala', flag: '🇬🇹' },
  { code: '+503', country: 'El Salvador', flag: '🇸🇻' },
  { code: '+504', country: 'Honduras', flag: '🇭🇳' },
  { code: '+505', country: 'Nicaragua', flag: '🇳🇮' },
  { code: '+506', country: 'Costa Rica', flag: '🇨🇷' },
  { code: '+507', country: 'Panama', flag: '🇵🇦' },
  { code: '+508', country: 'Saint Pierre and Miquelon', flag: '🇵🇲' },
  { code: '+509', country: 'Haiti', flag: '🇭🇹' },
  { code: '+590', country: 'Guadeloupe', flag: '🇬🇵' },
  { code: '+591', country: 'Bolivia', flag: '🇧🇴' },
  { code: '+592', country: 'Guyana', flag: '🇬🇾' },
  { code: '+593', country: 'Ecuador', flag: '🇪🇨' },
  { code: '+594', country: 'French Guiana', flag: '🇬🇫' },
  { code: '+595', country: 'Paraguay', flag: '🇵🇾' },
  { code: '+596', country: 'Martinique', flag: '🇲🇶' },
  { code: '+597', country: 'Suriname', flag: '🇸🇷' },
  { code: '+598', country: 'Uruguay', flag: '🇺🇾' },
  { code: '+599', country: 'Bonaire, Sint Eustatius and Saba', flag: '🇧🇶' },
  { code: '+599', country: 'Curaçao', flag: '🇨🇼' },
  { code: '+670', country: 'Timor-Leste', flag: '🇹🇱' },
  { code: '+672', country: 'Norfolk Island', flag: '🇳🇫' },
  { code: '+673', country: 'Brunei', flag: '🇧🇳' },
  { code: '+674', country: 'Nauru', flag: '🇳🇷' },
  { code: '+675', country: 'Papua New Guinea', flag: '🇵🇬' },
  { code: '+676', country: 'Tonga', flag: '🇹🇴' },
  { code: '+677', country: 'Solomon Islands', flag: '🇸🇧' },
  { code: '+678', country: 'Vanuatu', flag: '🇻🇺' },
  { code: '+679', country: 'Fiji', flag: '🇫🇯' },
  { code: '+680', country: 'Palau', flag: '🇵🇼' },
  { code: '+681', country: 'Wallis and Futuna', flag: '🇼🇫' },
  { code: '+682', country: 'Cook Islands', flag: '🇨🇰' },
  { code: '+683', country: 'Niue', flag: '🇳🇺' },
  { code: '+685', country: 'Samoa', flag: '🇼🇸' },
  { code: '+686', country: 'Kiribati', flag: '🇰🇮' },
  { code: '+687', country: 'New Caledonia', flag: '🇳🇨' },
  { code: '+688', country: 'Tuvalu', flag: '🇹🇻' },
  { code: '+689', country: 'French Polynesia', flag: '🇵🇫' },
  { code: '+690', country: 'Tokelau', flag: '🇹🇰' },
  { code: '+691', country: 'Micronesia', flag: '🇫🇲' },
  { code: '+692', country: 'Marshall Islands', flag: '🇲🇭' },
  { code: '+850', country: 'North Korea', flag: '🇰🇵' },
  { code: '+852', country: 'Hong Kong', flag: '🇭🇰' },
  { code: '+853', country: 'Macao', flag: '🇲🇴' },
  { code: '+855', country: 'Cambodia', flag: '🇰🇭' },
  { code: '+856', country: 'Laos', flag: '🇱🇦' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩' },
  { code: '+886', country: 'Taiwan', flag: '🇹🇼' },
  { code: '+960', country: 'Maldives', flag: '🇲🇻' },
  { code: '+961', country: 'Lebanon', flag: '🇱🇧' },
  { code: '+962', country: 'Jordan', flag: '🇯🇴' },
  { code: '+963', country: 'Syria', flag: '🇸🇾' },
  { code: '+964', country: 'Iraq', flag: '🇮🇶' },
  { code: '+965', country: 'Kuwait', flag: '🇰🇼' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+967', country: 'Yemen', flag: '🇾🇪' },
  { code: '+968', country: 'Oman', flag: '🇴🇲' },
  { code: '+970', country: 'Palestine', flag: '🇵🇸' },
  { code: '+971', country: 'United Arab Emirates', flag: '🇦🇪' },
  { code: '+972', country: 'Israel', flag: '🇮🇱' },
  { code: '+973', country: 'Bahrain', flag: '🇧🇭' },
  { code: '+974', country: 'Qatar', flag: '🇶🇦' },
  { code: '+975', country: 'Bhutan', flag: '🇧🇹' },
  { code: '+976', country: 'Mongolia', flag: '🇲🇳' },
  { code: '+977', country: 'Nepal', flag: '🇳🇵' },
  { code: '+992', country: 'Tajikistan', flag: '🇹🇯' },
  { code: '+993', country: 'Turkmenistan', flag: '🇹🇲' },
  { code: '+994', country: 'Azerbaijan', flag: '🇦🇿' },
  { code: '+995', country: 'Georgia', flag: '🇬🇪' },
  { code: '+996', country: 'Kyrgyzstan', flag: '🇰🇬' },
  { code: '+998', country: 'Uzbekistan', flag: '🇺🇿' },
  { code: '+1242', country: 'Bahamas', flag: '🇧🇸' },
  { code: '+1246', country: 'Barbados', flag: '🇧🇧' },
  { code: '+1264', country: 'Anguilla', flag: '🇦🇮' },
  { code: '+1268', country: 'Antigua and Barbuda', flag: '🇦🇬' },
  { code: '+1284', country: 'British Virgin Islands', flag: '🇻🇬' },
  { code: '+1340', country: 'United States Virgin Islands', flag: '🇻🇮' },
  { code: '+1345', country: 'Cayman Islands', flag: '🇰🇾' },
  { code: '+1441', country: 'Bermuda', flag: '🇧🇲' },
  { code: '+1473', country: 'Grenada', flag: '🇬🇩' },
  { code: '+1649', country: 'Turks and Caicos Islands', flag: '🇹🇨' },
  { code: '+1658', country: 'Jamaica', flag: '🇯🇲' },
  { code: '+1664', country: 'Montserrat', flag: '🇲🇸' },
  { code: '+1670', country: 'Northern Mariana Islands', flag: '🇲🇵' },
  { code: '+1671', country: 'Guam', flag: '🇬🇺' },
  { code: '+1684', country: 'American Samoa', flag: '🇦🇸' },
  { code: '+1721', country: 'Sint Maarten', flag: '🇸🇽' },
  { code: '+1758', country: 'Saint Lucia', flag: '🇱🇨' },
  { code: '+1767', country: 'Dominica', flag: '🇩🇲' },
  { code: '+1784', country: 'Saint Vincent and the Grenadines', flag: '🇻🇨' },
  { code: '+1787', country: 'Puerto Rico', flag: '🇵🇷' },
  { code: '+1809', country: 'Dominican Republic', flag: '🇩🇴' },
  { code: '+1829', country: 'Dominican Republic', flag: '🇩🇴' },
  { code: '+1849', country: 'Dominican Republic', flag: '🇩🇴' },
  { code: '+1868', country: 'Trinidad and Tobago', flag: '🇹🇹' },
  { code: '+1869', country: 'Saint Kitts and Nevis', flag: '🇰🇳' },
  { code: '+1876', country: 'Jamaica', flag: '🇯🇲' },
  { code: '+1939', country: 'Puerto Rico', flag: '🇵🇷' },
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


