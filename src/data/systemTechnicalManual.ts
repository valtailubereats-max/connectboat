export type ManualItemType = 
  | 'Page' 
  | 'Button' 
  | 'Form' 
  | 'Flow' 
  | 'Admin' 
  | 'Firestore' 
  | 'Monetisation' 
  | 'Showcase' 
  | 'Listings';

export interface ManualItem {
  id: string;
  title: string;
  type: ManualItemType;
  description: string;
  route: string;
  mainFile: string;
  relatedComponents: string[];
  relatedFunctions: string[];
  firestoreCollections: string[];
  access: string;
  buttons: string[];
  actions: string[];
  technicalNotes: string;
  failurePoints: string[];
  tags: string[];
}

export interface TechnicalFlow {
  id: string;
  title: string;
  description: string;
  startPoint: string;
  buttonsInvolved: string[];
  pagesInvolved: string[];
  mainFiles: string[];
  firestoreCollections: string[];
  expectedResult: string;
}

export const manualItems: ManualItem[] = [
  {
    id: 'home',
    title: 'Home Page',
    type: 'Page',
    description: 'Main entry page of ConnectBoat. Displays dynamic banner, featured channels, featured listings, and showcase grids or carousels.',
    route: '/',
    mainFile: 'src/pages/Home.tsx',
    relatedComponents: ['src/components/AdCard.tsx', 'src/components/ShowcaseStats.tsx'],
    relatedFunctions: ['fetchAds', 'fetchShowcases', 'setCountry', 'handleSearch'],
    firestoreCollections: ['ads', 'showcases', 'settings'],
    access: 'Public (Any visitor)',
    buttons: ['Country Switcher', 'Search Field', 'Post Listing Button', 'View All Showcases', 'View More Listings'],
    actions: ['Redirect to listing creation', 'Filter listings by selected region', 'Perform text search by title or tags'],
    technicalNotes: 'The home page loads data based on the active selection in AuthContext or localStorage. Approved showcases are listed in the entrepreneur carousel.',
    failurePoints: [
      'Flagcdn.com API failure when rendering flag icons.',
      'Excessive Firestore reads if pagination or listing limit is omitted.',
      'Heavy hero cover images affecting First Contentful Paint.'
    ],
    tags: ['home', 'landing page', 'showcases', 'listings', 'search', 'uk']
  },
  {
    id: 'navbar-menu',
    title: 'Navbar & User Menu',
    type: 'Button',
    description: 'Persistent navigation bar present across all pages. Allows navigation to Home, Jobs, Pricing, Create Listing, Notifications, and access to the User Menu.',
    route: 'All routes (Global)',
    mainFile: 'src/App.tsx',
    relatedComponents: ['src/hooks/useClickOutside.ts'],
    relatedFunctions: ['getUserSignature', 'logout', 'toggleNotifications'],
    firestoreCollections: ['users', 'notifications', 'ads'],
    access: 'Public buttons; profile and admin panels restricted',
    buttons: ['Post Listing (+)', 'Notification Bell', 'User Badge', 'Log Out', 'Admin Panel'],
    actions: ['Navigate to /create-ad', 'Navigate to /admin (if admin)', 'Log out', 'View unread notifications'],
    technicalNotes: 'The user badge displays initials or the user profile name. Replaces legacy navigation triggers.',
    failurePoints: [
      'Menu dropdown truncated on extremely small mobile screens.',
      'Notification bell failing to update in real time if query snapshot fails.'
    ],
    tags: ['navbar', 'menu', 'header', 'navigation', 'post', 'admin']
  },
  {
    id: 'criar-anuncio',
    title: 'Create / Edit Listing',
    type: 'Form',
    description: 'Multi-step form interface for creating boat, yacht, gear, or marine service listings. Allows category selection, multi-image upload, price definition, location setting, and plan choice.',
    route: '/create-ad, /edit-ad/:id',
    mainFile: 'src/pages/CreateAd.tsx',
    relatedComponents: ['src/components/SearchableCitySelect.tsx'],
    relatedFunctions: ['handleSubmitAd', 'uploadImagesToStorage', 'handlePlanSelection'],
    firestoreCollections: ['ads', 'users', 'settings'],
    access: 'Authenticated User',
    buttons: ['Submit Images', 'Choose Plan (Free, Local, National)', 'Publish Listing', 'Save Changes'],
    actions: ['Upload files to Firebase Storage', 'Write document to "ads" collection', 'Send admin notification for approval'],
    technicalNotes: 'For paid plans, listing status defaults to "pending" for admin moderation. Images are validated against plan limits set in global settings.',
    failurePoints: [
      'Oversized file upload exceeding Storage quotas.',
      'Form error if user profile details are incomplete.'
    ],
    tags: ['create', 'post', 'listing', 'form', 'images', 'plan', 'upload']
  },
  {
    id: 'detalhes-anuncio',
    title: 'Listing Details Page',
    type: 'Page',
    description: 'Detailed view page for a specific listing. Displays image carousel, price, location map, formatted description, direct WhatsApp contact button, and seller details.',
    route: '/anuncio/:id',
    mainFile: 'src/pages/AdDetails.tsx',
    relatedComponents: ['src/components/ReviewModal.tsx'],
    relatedFunctions: ['toggleFavoriteGlobal', 'incrementViewCount', 'sendWhatsAppMessage'],
    firestoreCollections: ['ads', 'users', 'reviews'],
    access: 'Public',
    buttons: ['Contact via WhatsApp', 'Save to Favourites', 'View Seller Details', 'Report Listing', 'Write Review'],
    actions: ['Increment views count in Firestore', 'Toggle listing ID in user favourites array', 'Load seller reviews'],
    technicalNotes: 'Google map is embedded via responsive iframe based on location. Unsplash fallbacks are used if images are missing.',
    failurePoints: [
      'Google Maps iframe block due to unencoded special characters.',
      'WhatsApp button phone number missing international country code format.'
    ],
    tags: ['listing', 'details', 'view', 'map', 'seller', 'whatsapp']
  },
  {
    id: 'perfil',
    title: 'Profile / My Dashboard',
    type: 'Page',
    description: 'Personal area for authenticated users to manage personal details (Name, Phone, Region), active and pending listings, Digital Showcase, reviews, and billing information.',
    route: '/profile',
    mainFile: 'src/pages/Profile.tsx',
    relatedComponents: ['src/components/ShowcaseInterests.tsx', 'src/components/ShowcaseStats.tsx'],
    relatedFunctions: ['updateProfile', 'saveShowcaseSettings', 'handleUserDeletion'],
    firestoreCollections: ['users', 'ads', 'showcaseProducts', 'purchases'],
    access: 'Authenticated User (Account owner)',
    buttons: ['Save Changes', 'Configure Showcase', 'Billing History', 'Delete Account', 'Add Showcase Product'],
    actions: ['Update user document in "users" collection', 'Submit commercial showcase data (logo, cover, WhatsApp)'],
    technicalNotes: 'Uses URL query parameters for tab navigation (e.g., ?tab=profile, ?tab=ads, ?tab=showcase).',
    failurePoints: [
      'Required fields left blank preventing profile save.',
      'Broken image URLs for showcase logo or cover banner.'
    ],
    tags: ['profile', 'data', 'edit', 'user', 'account', 'showcase']
  },
  {
    id: 'meus-anuncios',
    title: 'My Listings',
    type: 'Listings',
    description: 'User dashboard section containing all user-created listings. Allows status monitoring (Approved, Pending, Rejected, Expired), plan renewal, and marking items as sold.',
    route: '/profile?tab=ads',
    mainFile: 'src/pages/Profile.tsx',
    relatedComponents: ['src/components/AdCard.tsx'],
    relatedFunctions: ['deleteAd', 'renewAdPlan', 'markAsSold'],
    firestoreCollections: ['ads'],
    access: 'Authenticated User',
    buttons: ['Edit', 'Delete', 'Mark as Sold', 'Promote Plan', 'Renew Listing'],
    actions: ['Change listing status to "sold" or "archived"', 'Restore expired listings to pending post-payment'],
    technicalNotes: 'Listings are filtered locally by `where("userId", "==", user.uid)`. Marking as sold removes the listing from public search.',
    failurePoints: [
      'Missing composite index in Firestore for userId and orderby filtering.'
    ],
    tags: ['listings', 'manage', 'renew', 'feature', 'delete']
  },
  {
    id: 'favoritos',
    title: 'Favourites',
    type: 'Listings',
    description: 'User dashboard section displaying saved listings to track price and availability changes.',
    route: '/profile?tab=favorites',
    mainFile: 'src/pages/Profile.tsx',
    relatedComponents: ['src/components/AdCard.tsx'],
    relatedFunctions: ['toggleFavoriteGlobal', 'fetchFavoriteAds'],
    firestoreCollections: ['users', 'ads'],
    access: 'Authenticated User',
    buttons: ['Remove from Favourites', 'View Listing Details', 'Contact Seller'],
    actions: ['Remove listing ID from the "favorites" array in the user document'],
    technicalNotes: 'Favourites are stored as string IDs in the user document. Orphaned IDs from deleted listings are ignored safely.',
    failurePoints: [
      'Render error when loading data for a deleted favourited listing.'
    ],
    tags: ['favourites', 'saved', 'listings', 'interest']
  },
  {
    id: 'compras',
    title: 'Purchases (History)',
    type: 'Monetisation',
    description: 'Transaction history and receipt records generated by promotion plans or showcase activation.',
    route: '/profile?tab=purchases',
    mainFile: 'src/pages/Profile.tsx',
    relatedComponents: [],
    relatedFunctions: ['fetchUserPurchases'],
    firestoreCollections: ['purchases'],
    access: 'Authenticated User',
    buttons: ['View Receipt', 'Export Invoice', 'Contact Support'],
    actions: ['Fetch user purchase collection documents'],
    technicalNotes: 'Displays all simulated or actual checkout payments executed on the platform.',
    failurePoints: [
      'Time zone differences in purchase date formatting.'
    ],
    tags: ['purchases', 'invoices', 'payments', 'plans', 'receipt']
  },
  {
    id: 'avaliacoes',
    title: 'Seller Reviews',
    type: 'Page',
    description: 'Reputation system showing buyer reviews and star ratings (1 to 5) for sellers to build trust on ConnectBoat.',
    route: '/profile?tab=reviews',
    mainFile: 'src/pages/Profile.tsx',
    relatedComponents: ['src/components/ReviewModal.tsx'],
    relatedFunctions: ['submitReview', 'calculateAverageRating'],
    firestoreCollections: ['reviews', 'users'],
    access: 'Any authenticated user can review; viewing is public',
    buttons: ['Write Feedback', 'Submit Review', 'Select Star Rating'],
    actions: ['Write review document and update seller "ratingAverage" in users collection'],
    technicalNotes: 'Average rating is stored denormalised in the user profile to speed up home and ad details rendering.',
    failurePoints: [
      'Users attempting to review themselves.',
      'Division by zero when calculating average for zero ratings.'
    ],
    tags: ['reviews', 'feedback', 'stars', 'reputation', 'seller']
  },
  {
    id: 'leads-interesses',
    title: 'Leads / Product Interests',
    type: 'Flow',
    description: 'Showcase dashboard panel where business owners monitor enquiries and buyer interest.',
    route: '/profile?tab=interests',
    mainFile: 'src/components/ShowcaseInterests.tsx',
    relatedComponents: [],
    relatedFunctions: ['fetchShowcaseInterests', 'resolveInterestState'],
    firestoreCollections: ['showcaseInterests', 'showcaseProducts'],
    access: 'Logistics / Showcase Owner',
    buttons: ['View Lead Details', 'Mark as Resolved', 'Export List'],
    actions: ['Load interest submissions from showcase products for post-sale tracking'],
    technicalNotes: 'Leads are saved whenever an authenticated user submits an enquiry for a showcase product.',
    failurePoints: [
      'Slow synchronization if leads collection grows without pagination.'
    ],
    tags: ['leads', 'interests', 'contacts', 'enquiries', 'interactions']
  },
  {
    id: 'anuncios-destaque',
    title: 'Featured Listing Channels',
    type: 'Listings',
    description: 'Home page sections rotating promoted listings with national or local boost plans.',
    route: '/',
    mainFile: 'src/pages/Home.tsx',
    relatedComponents: ['src/components/AdCard.tsx'],
    relatedFunctions: ['fetchFeaturedAds'],
    firestoreCollections: ['ads'],
    access: 'Public',
    buttons: ['Click Listing', 'Carousel Navigation Arrows'],
    actions: ['Filter approved listings ordered by plan priority (national > local > free)'],
    technicalNotes: 'Firestore query retrieves active listings ordered by plan level. National listings appear site-wide.',
    failurePoints: [
      'Lack of rotation if few paid listings exist.'
    ],
    tags: ['featured', 'carousel', 'main', 'visibility']
  },
  {
    id: 'destaque-local',
    title: 'Local Boost Plan',
    type: 'Monetisation',
    description: 'Plan enabling sellers to promote their listing specifically within their declared region or city.',
    route: '/create-ad, /profile?tab=ads',
    mainFile: 'src/pages/CreateAd.tsx',
    relatedComponents: [],
    relatedFunctions: ['selectLocalPlan', 'processPlanSubscription'],
    firestoreCollections: ['ads', 'purchases', 'settings'],
    access: 'Authenticated User',
    buttons: ['Select Local Plan', 'Checkout Simulation'],
    actions: ['Set plan field to "local" on ad document and log purchase report'],
    technicalNotes: 'Expiry days correspond to global "planDurations.local" settings.',
    failurePoints: [
      'Listing location mismatch with local search filters.'
    ],
    tags: ['featured', 'local', 'plan', 'payment', 'region']
  },
  {
    id: 'destaque-nacional',
    title: 'National Boost Plan',
    type: 'Monetisation',
    description: 'Top priority plan lifting the listing across nationwide search feeds.',
    route: '/create-ad, /profile?tab=ads',
    mainFile: 'src/pages/CreateAd.tsx',
    relatedComponents: [],
    relatedFunctions: ['selectNationalPlan', 'processPlanSubscription'],
    firestoreCollections: ['ads', 'purchases', 'settings'],
    access: 'Authenticated User',
    buttons: ['Select National Boost', 'Pay Subscription'],
    actions: ['Set plan field to "national" in Firestore and extend validity period'],
    technicalNotes: 'National listings display a decorative "National" badge on the listing card.',
    failurePoints: [
      'Missing or disabled national plan configurations in global settings.'
    ],
    tags: ['featured', 'national', 'plan', 'payment', 'uk', 'top']
  },
  {
    id: 'pagina-precos',
    title: 'Pricing Page',
    type: 'Page',
    description: 'Informational page detailing available pricing plans for advertising and digital showcases on ConnectBoat.',
    route: '/precos',
    mainFile: 'src/pages/Precos.tsx',
    relatedComponents: [],
    relatedFunctions: [],
    firestoreCollections: ['settings'],
    access: 'Public',
    buttons: ['Post Listing Now', 'Activate Showcase', 'Contact Commercial Support'],
    actions: ['Redirect user to creation or profile page based on plan selection'],
    technicalNotes: 'Prices are loaded dynamically from global settings document.',
    failurePoints: [
      'Currency symbol formatting errors if not matched to active region.'
    ],
    tags: ['pricing', 'plans', 'local', 'national', 'showcase', 'subscription']
  },
  {
    id: 'convites-qrcode',
    title: 'Invitations & QR Code System',
    type: 'Flow',
    description: 'Referral feature allowing users to share invitation links or download dynamic QR codes to earn referral credits.',
    route: '/convite, /admin/invitations',
    mainFile: 'src/pages/Convite.tsx',
    relatedComponents: [],
    relatedFunctions: ['generateInvitationCode', 'renderDynamicQRCode', 'addReferralCredits'],
    firestoreCollections: ['users', 'invitations'],
    access: 'Authenticated Users to share; Admin to manage',
    buttons: ['Copy Invite Link', 'Download QR Code Image', 'Validate Admin Code'],
    actions: ['Register new referral in "invitations" collection linking referrer and referee'],
    technicalNotes: 'QR Code is rendered dynamically using SVG/Canvas libraries with direct referral link.',
    failurePoints: [
      'Unreadable QR Code under low screen brightness.',
      'Self-referral loop attempts.'
    ],
    tags: ['invites', 'qr code', 'referral', 'invite', 'register']
  },
  {
    id: 'marketing',
    title: 'Marketing Kit',
    type: 'Admin',
    description: 'Administrative tool to manage promotional materials, banners, and digital flyers for social media sharing.',
    route: '/admin/marketing',
    mainFile: 'src/pages/AdminMarketing.tsx',
    relatedComponents: [],
    relatedFunctions: ['fetchMaterials', 'addMarketingMaterial', 'deleteMarketingMaterial'],
    firestoreCollections: ['marketingMaterials'],
    access: 'Admin or Moderator',
    buttons: ['Add Material', 'Download Banner', 'Delete Material', 'Copy Share Link'],
    actions: ['Save promotional material in Firestore and store banner image'],
    technicalNotes: 'Supports social, print, and story marketing media categories.',
    failurePoints: [
      'Unsupported file format upload.'
    ],
    tags: ['marketing', 'banners', 'kit', 'share', 'social media']
  },
  {
    id: 'importacao-olx',
    title: 'AI Web Scraper & Import Tool',
    type: 'Admin',
    description: 'AI-assisted feature allowing admins to import listings by pasting external URLs from supported marketplaces.',
    route: '/admin/import',
    mainFile: 'src/pages/AdminImport.tsx',
    relatedComponents: [],
    relatedFunctions: ['scrapeMetadataLink', 'processWithGemini', 'confirmAutomationImport'],
    firestoreCollections: ['ads', 'settings'],
    access: 'Admin Only',
    buttons: ['Paste URL', 'Run AI Analysis', 'Import to System', 'Clear Fields'],
    actions: ['Invoke server API for web scraping and Gemini AI parsing'],
    technicalNotes: 'Extracts title, price, description, and images from external source URL.',
    failurePoints: [
      'Source page layout changes breaking scraper logic.',
      'Gemini API token quota exhaustion.'
    ],
    tags: ['import', 'ai', 'scraper', 'create', 'apollo duck', 'boats and outboards']
  },
  {
    id: 'sistema-saude',
    title: 'System Health Monitor',
    type: 'Admin',
    description: 'Automated platform health and integrity monitoring system with alert logging and email notifications.',
    route: '/admin/health',
    mainFile: 'src/pages/AdminSystemHealth.tsx',
    relatedComponents: ['src/utils/healthService.ts'],
    relatedFunctions: ['runHealthChecks', 'logHealthEvent', 'handleHealthLevelChangeEmails'],
    firestoreCollections: ['system_health_alerts', 'system_health_events', 'settings'],
    access: 'Admin Only',
    buttons: ['Run Health Check', 'Clear Resolved', 'Mark as Resolved', 'Simulate Incident', 'Reset Health Status'],
    actions: ['Execute database health checks', 'Write alerts to system_health_alerts', 'Send email notifications on status changes'],
    technicalNotes: 'Health scoring system calculates status from 0% to 100% based on open alerts and severity levels.',
    failurePoints: [
      'Notification email loops prevented by 30-minute anti-spam threshold.'
    ],
    tags: ['health', 'monitor', 'alerts', 'status', 'verification']
  },
  {
    id: 'admin-dashboard',
    title: 'Admin Dashboard Overview',
    type: 'Admin',
    description: 'Operational control center displaying platform performance statistics, active listing counts, billing totals, and pending reviews.',
    route: '/admin/dashboard, /admin',
    mainFile: 'src/pages/AdminDashboard.tsx',
    relatedComponents: ['src/components/ShowcaseStats.tsx'],
    relatedFunctions: ['loadDashboardMetrics', 'fetchRecentActivities'],
    firestoreCollections: ['ads', 'users', 'purchases', 'settings'],
    access: 'Admin Only',
    buttons: ['Detailed Statistics', 'View Purchases', 'Filter Period'],
    actions: ['Aggregate financial and operational metrics from Firestore'],
    technicalNotes: 'Provides high-level system overview and operational metrics.',
    failurePoints: [
      'High query overhead when aggregating large collections.'
    ],
    tags: ['dashboard', 'statistics', 'admin', 'overview', 'charts']
  },
  {
    id: 'gerir-anuncios',
    title: 'Manage & Moderate Listings',
    type: 'Admin',
    description: 'Moderation section for approving, rejecting, or suspending submitted listings.',
    route: '/admin/ads',
    mainFile: 'src/pages/AdminAds.tsx',
    relatedComponents: [],
    relatedFunctions: ['approveAdState', 'rejectAdState', 'archiveExpiredAds'],
    firestoreCollections: ['ads', 'notifications'],
    access: 'Admin or Moderator',
    buttons: ['Approve Listing', 'Reject Listing', 'Add Justification', 'Search Listing'],
    actions: ['Update ad status to "approved" or "rejected" and trigger user notification'],
    technicalNotes: 'Filters listings by status (pending, approved, rejected, expired).',
    failurePoints: [
      'Missing rejection reason causing user confusion.'
    ],
    tags: ['listings', 'approve', 'reject', 'moderate', 'manage']
  },
  {
    id: 'utilizadores',
    title: 'Manage Users',
    type: 'Admin',
    description: 'Member management section to update user roles (user, moderator, admin) or handle suspensions.',
    route: '/admin/users',
    mainFile: 'src/pages/AdminUsers.tsx',
    relatedComponents: [],
    relatedFunctions: ['changeUserRole', 'banUserAccount', 'adjustCreditsManually'],
    firestoreCollections: ['users'],
    access: 'Admin Only',
    buttons: ['Make Admin', 'Make Moderator', 'Revoke Access', 'View Profile'],
    actions: ['Update "role" attribute in user document'],
    technicalNotes: 'Includes safety guards preventing self-revocation of admin privileges.',
    failurePoints: [
      'Account suspension failing to archive active listings immediately.'
    ],
    tags: ['users', 'roles', 'admin', 'ban', 'moderator']
  },
  {
    id: 'definicoes',
    title: 'System Settings',
    type: 'Admin',
    description: 'Technical configuration panel for platform rules, listing durations, promotion prices, and feature toggles.',
    route: '/admin/settings',
    mainFile: 'src/pages/AdminSettings.tsx',
    relatedComponents: [],
    relatedFunctions: ['saveGlobalSettings', 'restoreDefaultSystemSettings'],
    firestoreCollections: ['settings'],
    access: 'Admin Only',
    buttons: ['Save Settings', 'Clear Parameters', 'Enable Compact Mode', 'Restore Defaults'],
    actions: ['Update "global" document in settings collection'],
    technicalNotes: 'All components load pricing and duration parameters from this central document.',
    failurePoints: [
      'Negative values in numeric limits causing form rendering bugs.'
    ],
    tags: ['settings', 'configuration', 'pricing', 'limits']
  },
  {
    id: 'notificacoes-sistema',
    title: 'Internal Notifications',
    type: 'Firestore',
    description: 'Notification engine storing approval messages, plan updates, and system alerts for users.',
    route: 'All (Header Bell)',
    mainFile: 'src/App.tsx',
    relatedComponents: [],
    relatedFunctions: ['addNotificationSystem', 'markNotificationAsRead', 'deleteNotification'],
    firestoreCollections: ['notifications'],
    access: 'Notification recipient or Admin',
    buttons: ['Mark as Read', 'Clear All', 'Click Notification Link'],
    actions: ['Set "read" to true on notification document'],
    technicalNotes: 'Real-time query snapshot indexed by userId drives the red unread badge in header.',
    failurePoints: [
      'Unread count mismatch due to transient network drops.'
    ],
    tags: ['notifications', 'alert', 'notice', 'bell']
  },
  {
    id: 'firestore-rules',
    title: 'Firestore Security Rules',
    type: 'Firestore',
    description: 'Server-side access control protocol governing read/write permissions across Firestore collections.',
    route: 'N/A (Server Level)',
    mainFile: 'firestore.rules',
    relatedComponents: [],
    relatedFunctions: [],
    firestoreCollections: ['All collections'],
    access: 'Firebase Server',
    buttons: [],
    actions: ['Validate JWT tokens, verify uid, and enforce role permissions'],
    technicalNotes: 'Configured in root directory to prevent unauthorized data access.',
    failurePoints: [
      'Silent read errors if authenticated user ID does not match path rule expectation.'
    ],
    tags: ['rules', 'firestore', 'security', 'database']
  },
  {
    id: 'storage-rules',
    title: 'Cloud Storage Rules',
    type: 'Firestore',
    description: 'Security protocol for file uploads and asset storage in Firebase Storage bucket.',
    route: 'N/A',
    mainFile: 'storage.rules',
    relatedComponents: [],
    relatedFunctions: [],
    firestoreCollections: ['N/A (Storage Bucket)'],
    access: 'Storage Server',
    buttons: [],
    actions: ['Enforce authenticated file upload rules for image formats (JPG, PNG, WEBP)'],
    technicalNotes: 'Restricts file sizes to under 5MB per image.',
    failurePoints: [
      'Frontend upload rejection caused by MIME type mismatch.'
    ],
    tags: ['storage', 'rules', 'bucket', 'security', 'upload']
  },
  {
    id: 'destaques-permanentes',
    title: 'Permanent Admin Featured Listings',
    type: 'Admin',
    description: 'Administrative feature to pin specific listings permanently to home page carousels as fallbacks.',
    route: '/create-ad, /edit-ad/:id',
    mainFile: 'src/pages/CreateAd.tsx',
    relatedComponents: ['src/pages/Home.tsx', 'src/components/SearchableCitySelect.tsx'],
    relatedFunctions: ['fetchFeatured', 'filteredFeaturedAds', 'handleSubmit', 'handleCountryChange'],
    firestoreCollections: ['ads', 'users', 'settings'],
    access: 'Admins & Moderators Only',
    buttons: ['Enable Permanent Boost (Toggle)', 'Boost Scope (Local/National)', 'Display Region (UK/Both)'],
    actions: [
      'Bypass payment checkout for permanent featured status',
      'Set regional visibility to Both or specific country',
      'Exempt listing from automatic expiration filters'
    ],
    technicalNotes: 'Sets "isPermanentFeatured" to true with a far-future expiry date.',
    failurePoints: [
      'Conflict when attempting billing operations on manually pinned listings.'
    ],
    tags: ['featured', 'permanent', 'carousel', 'fallback', 'admin']
  },
  {
    id: 'pwa-install',
    title: 'Progressive Web App (PWA) Setup',
    type: 'Page',
    description: 'Allows ConnectBoat to be installed directly on mobile devices and desktop without app store friction.',
    route: 'All routes (Global)',
    mainFile: 'public/manifest.json',
    relatedComponents: ['src/hooks/usePWA.ts', 'src/components/PWAInstallButton.tsx', 'public/sw.js'],
    relatedFunctions: ['installApp', 'dismissInstall', 'registerServiceWorker'],
    firestoreCollections: [],
    access: 'Public',
    buttons: ['"📱 Install App" (Desktop User Menu)', '"📱 Install App" (Mobile Navigation)', '"📱 Install App" (Footer)'],
    actions: [
      'Automatically hide install prompts if running in standalone mode',
      'Trigger browser native install prompt on Android/Chromium',
      'Show step-by-step instructions modal on iOS Safari'
    ],
    technicalNotes: 'Uses immediate activation service worker and Network-First caching strategy.',
    failurePoints: [
      'Non-HTTPS connection blocking native browser install prompt.'
    ],
    tags: ['pwa', 'install', 'offline', 'safari', 'chrome', 'android', 'ios']
  },
  {
    id: 'footer-system',
    title: 'Universal Footer Structure',
    type: 'Page',
    description: 'Unified responsive footer organizing navigation links, legal information, and support contacts.',
    route: 'All routes (Global)',
    mainFile: 'src/App.tsx',
    relatedComponents: ['src/components/PWAInstallButton.tsx'],
    relatedFunctions: [],
    firestoreCollections: [],
    access: 'Public',
    buttons: ['WhatsApp Support', 'Install App (PWA)', 'Digital Showcases'],
    actions: [
      'Redirect to contato@connectboat.co.uk for email support',
      'Open WhatsApp support in new tab',
      'Navigate to legal and help pages'
    ],
    technicalNotes: 'Footer links structured in responsive 4-column layout on desktop.',
    failurePoints: [
      'Broken link if navigating to unregistered route.'
    ],
    tags: ['footer', 'structure', 'support', 'legal', 'community', 'uk']
  },
  {
    id: 'partilha-dinamica',
    title: 'Dynamic Sharing System',
    type: 'Flow',
    description: 'Unified sharing engine adapting content dynamically based on current page context.',
    route: 'Global (via triggerShare and ShareModal)',
    mainFile: 'src/utils/shareUtils.ts',
    relatedComponents: ['src/components/ShareModal.tsx', 'src/App.tsx', 'src/pages/AdDetails.tsx'],
    relatedFunctions: ['triggerShare', 'generateShareText'],
    firestoreCollections: ['shares'],
    access: 'Public',
    buttons: ['Share (Navbar)', 'Share Listing (AdCard)', 'Share Showcase'],
    actions: [
      'Generate context-aware share text for active listing or showcase',
      'Open pre-filled share URLs for WhatsApp, Telegram, Facebook or copy to clipboard'
    ],
    technicalNotes: 'Centralized share handler formatted for UK marine market.',
    failurePoints: [
      'Navigator.share API unsupported in legacy browsers (fallback modal provided).'
    ],
    tags: ['share', 'whatsapp', 'telegram', 'facebook', 'modal', 'copy link']
  },
  {
    id: 'doacoes-solidariedade',
    title: '💚 Marine Equipment Donations',
    type: 'Listings',
    description: 'Community donation category for free boat parts and marine equipment.',
    route: '/create-ad, /anuncio/:id',
    mainFile: 'src/pages/CreateAd.tsx',
    relatedComponents: ['src/components/AdCard.tsx', 'src/pages/AdDetails.tsx'],
    relatedFunctions: ['handleSubmitAd', 'formatPrice'],
    firestoreCollections: ['ads'],
    access: 'Authenticated user to create, Public to view',
    buttons: ['Free Price Enforced', 'Donation Badge Enforced'],
    actions: ['Automatically enable donation boost and badge', 'Bypass payment checkout', 'Set price to £0'],
    technicalNotes: 'Selecting donation category automatically sets price to 0 and applies local boost.',
    failurePoints: [
      'Attempts to list commercial items under donation category.'
    ],
    tags: ['donation', 'community', 'free', 'equipment', 'marine']
  },
  {
    id: 'configuracao-arquitetura-email',
    title: 'Email Architecture & Settings',
    type: 'Admin',
    description: 'System email infrastructure for transactional notifications and support communications.',
    route: 'Global',
    mainFile: 'api/email/send.ts',
    relatedComponents: ['src/App.tsx', 'src/pages/FAQ.tsx'],
    relatedFunctions: ['sendEmailGeneric', 'renderEmail'],
    firestoreCollections: ['system_health_events'],
    access: 'Public for alert triggers, Server for SMTP credentials',
    buttons: ['Send Email (Support)'],
    actions: [
      'Display official support email contato@connectboat.co.uk on public pages',
      'Use serverless API routes to send automated notifications'
    ],
    technicalNotes: 'Proxy endpoint /api/email/send safely proxies emails without exposing secret keys.',
    failurePoints: [
      'Missing API key in environment variables.'
    ],
    tags: ['email', 'support', 'communication', 'architecture', 'security']
  }
];

export const technicalFlows: TechnicalFlow[] = [
  {
    id: 'flow-criar-anuncio',
    title: 'How to create a listing',
    description: 'Basic creation and registration of boat and marine listings by users.',
    startPoint: 'Click "+" or "Post Listing" button in header',
    buttonsInvolved: ['Post Listing', 'Choose Images', 'Publish Listing'],
    pagesInvolved: ['CreateAd.tsx', 'Home.tsx'],
    mainFiles: ['src/pages/CreateAd.tsx', 'src/components/SearchableCitySelect.tsx'],
    firestoreCollections: ['ads', 'users'],
    expectedResult: 'New listing saved as free (approved immediately) or paid plan (pending moderation).'
  },
  {
    id: 'flow-destaque-local',
    title: 'How to boost a local listing',
    description: 'Promote a listing specifically within the selected region.',
    startPoint: 'Via CreateAd form choosing "Local" plan or via My Listings panel',
    buttonsInvolved: ['Select Local Plan', 'Complete Payment'],
    pagesInvolved: ['CreateAd.tsx', 'Profile.tsx', 'Precos.tsx'],
    mainFiles: ['src/pages/CreateAd.tsx', 'src/pages/Profile.tsx'],
    firestoreCollections: ['ads', 'purchases'],
    expectedResult: 'Plan changed to "local" and validity extended based on admin settings.'
  },
  {
    id: 'flow-destaque-nacional',
    title: 'How to boost a national listing',
    description: 'Elevate listing priority across nationwide search feeds.',
    startPoint: 'CreateAd form selecting "National" plan or promoting from My Listings',
    buttonsInvolved: ['Select National Boost', 'Subscribe'],
    pagesInvolved: ['CreateAd.tsx', 'Profile.tsx', 'Precos.tsx'],
    mainFiles: ['src/pages/CreateAd.tsx', 'src/pages/Profile.tsx'],
    firestoreCollections: ['ads', 'purchases'],
    expectedResult: 'Plan updated to "national", enabling top banner display and national badge.'
  },
  {
    id: 'flow-criar-vitrine',
    title: 'How to create a Digital Showcase',
    description: 'Setup commercial showcase in ConnectBoat business directory.',
    startPoint: 'Profile sidebar under "My Showcase" tab enabling "Activate Showcase"',
    buttonsInvolved: ['Activate Showcase', 'Upload Cover', 'Upload Logo', 'Save Showcase Info'],
    pagesInvolved: ['Profile.tsx', 'Empreendedores.tsx'],
    mainFiles: ['src/pages/Profile.tsx'],
    firestoreCollections: ['users'],
    expectedResult: 'Sets "showcaseActive" to true, triggering mandatory admin approval.'
  },
  {
    id: 'flow-adicionar-produto-vitrine',
    title: 'How to add a product to Showcase',
    description: 'Add products to business showcase catalogue.',
    startPoint: 'Inside "My Showcase" tab clicking "Add New Product"',
    buttonsInvolved: ['Add New Product', 'Upload Product Image', 'Save Product'],
    pagesInvolved: ['Profile.tsx', 'EmpreendedorDetalhes.tsx'],
    mainFiles: ['src/pages/Profile.tsx', 'src/components/ShowcaseStats.tsx'],
    firestoreCollections: ['showcaseProducts', 'users'],
    expectedResult: 'New document created in "showcaseProducts" collection.'
  },
  {
    id: 'flow-whatsapp-vitrine',
    title: 'How Showcase WhatsApp contact works',
    description: 'Direct buyer-to-seller communication via WhatsApp.',
    startPoint: 'Click on showcase item or "Contact Direct" button on showcase profile',
    buttonsInvolved: ['Contact via WhatsApp', 'Order via WhatsApp'],
    pagesInvolved: ['EmpreendedorDetalhes.tsx', 'EmpreendedorProduto.tsx'],
    mainFiles: ['src/pages/EmpreendedorDetalhes.tsx', 'src/pages/EmpreendedorProduto.tsx'],
    firestoreCollections: ['users', 'showcaseInterests'],
    expectedResult: 'Opens external WhatsApp link with pre-formatted message.'
  },
  {
    id: 'flow-qrcode-convite',
    title: 'How invitation QR Code works',
    description: 'Referral sharing system with referral credits.',
    startPoint: 'Click "Share & Invite" in profile or sidebar',
    buttonsInvolved: ['Copy Invite Link', 'Get QR Code PNG'],
    pagesInvolved: ['Convite.tsx'],
    mainFiles: ['src/pages/Convite.tsx'],
    firestoreCollections: ['invitations', 'users'],
    expectedResult: 'Displays referral code. Successful registrations grant credits to referrer.'
  },
  {
    id: 'flow-aprovar-anuncio',
    title: 'How to approve listings (Moderation)',
    description: 'Admin inspection to moderate submitted listings.',
    startPoint: 'Log in as Admin and navigate to "Moderate Listings"',
    buttonsInvolved: ['Approve Listing', 'Reject Listing', 'Quick Search'],
    pagesInvolved: ['AdminAds.tsx', 'AdminDashboard.tsx'],
    mainFiles: ['src/pages/AdminAds.tsx'],
    firestoreCollections: ['ads', 'notifications'],
    expectedResult: 'Ad status updated to "approved", making listing live and notifying user.'
  },
  {
    id: 'flow-importador-ia',
    title: 'How to import via Web Scraper AI',
    description: 'Accelerated listing creation using AI URL parsing.',
    startPoint: 'Navigate to "Import Listing with AI" in Admin menu',
    buttonsInvolved: ['Paste URL', 'Run AI Analysis', 'Publish to Site'],
    pagesInvolved: ['AdminImport.tsx'],
    mainFiles: ['src/pages/AdminImport.tsx'],
    firestoreCollections: ['ads'],
    expectedResult: 'Automated extraction of title, images, price, and category into draft listing.'
  },
  {
    id: 'flow-painel-precos',
    title: 'How pricing panel works',
    description: 'Update current plan pricing and promotion costs.',
    startPoint: 'Admin Panel under "Settings"',
    buttonsInvolved: ['Change Plan Prices', 'Save Changes'],
    pagesInvolved: ['AdminSettings.tsx', 'Precos.tsx'],
    mainFiles: ['src/pages/AdminSettings.tsx', 'src/pages/Precos.tsx'],
    firestoreCollections: ['settings'],
    expectedResult: 'Updated plan pricing reflected site-wide immediately.'
  },
  {
    id: 'flow-limites-fotos',
    title: 'How photo limits work',
    description: 'Image upload restriction limits based on plan level.',
    startPoint: 'Listing creation or product creation form',
    buttonsInvolved: ['Upload New File'],
    pagesInvolved: ['CreateAd.tsx', 'Profile.tsx'],
    mainFiles: ['src/pages/AdminSettings.tsx', 'src/pages/CreateAd.tsx'],
    firestoreCollections: ['settings'],
    expectedResult: 'Prevents uploading files beyond active plan allowance (e.g. max 3 images for Free plan).'
  },
  {
    id: 'flow-destaque-permanente-admin',
    title: 'How to manage Permanent Featured listings',
    description: 'Admin workflow to pin permanent featured fallback listings on home page.',
    startPoint: 'Create or edit listing as Admin, toggling "Permanent Featured"',
    buttonsInvolved: ['Enable Permanent Boost', 'Boost Scope', 'Display Region', 'Save Listing'],
    pagesInvolved: ['CreateAd.tsx', 'Home.tsx'],
    mainFiles: ['src/pages/CreateAd.tsx', 'src/pages/Home.tsx', 'src/types.ts'],
    firestoreCollections: ['ads'],
    expectedResult: 'Creates or updates listing without requiring payment, pinning it to main carousel.'
  },
  {
    id: 'flow-monitor-saude',
    title: 'System Health Monitor & Alerts',
    description: 'Automated health tracking and alert notification pipeline.',
    startPoint: 'System anomaly occurrence or opening Health Monitor page',
    buttonsInvolved: ['Run Health Check', 'Mark as Resolved', 'Clear Resolved'],
    pagesInvolved: ['AdminSystemHealth.tsx'],
    mainFiles: ['src/pages/AdminSystemHealth.tsx', 'src/utils/healthService.ts'],
    firestoreCollections: ['system_health_alerts', 'system_health_events', 'settings'],
    expectedResult: 'Visual health score indicator and email notifications sent on status drops.'
  },
  {
    id: 'flow-instalacao-pwa',
    title: 'PWA Installation Flow',
    description: 'Direct app installation on Android, iOS, or Desktop.',
    startPoint: 'User clicks "📱 Install App" in user menu, navigation, or footer',
    buttonsInvolved: ['📱 Install App', 'Got it'],
    pagesInvolved: ['All (Global PWA button)'],
    mainFiles: ['src/hooks/usePWA.ts', 'src/components/PWAInstallButton.tsx', 'public/sw.js'],
    firestoreCollections: [],
    expectedResult: 'Triggers native install prompt on Android/Chrome or step-by-step modal on iOS/Safari.'
  },
  {
    id: 'flow-doacoes-solidariedade',
    title: 'Equipment Donation Flow',
    description: 'Posting free community boat equipment and gear.',
    startPoint: 'Navigate to "Post Listing" and select "💚 Marine Equipment Donations" category',
    buttonsInvolved: ['Post Listing', 'Fill Form', 'Publish Listing'],
    pagesInvolved: ['CreateAd.tsx', 'AdDetails.tsx', 'Home.tsx'],
    mainFiles: ['src/pages/CreateAd.tsx', 'src/components/AdCard.tsx', 'src/pages/AdDetails.tsx'],
    firestoreCollections: ['ads'],
    expectedResult: 'Listing registered free of charge with automatic donation badge and local highlight.'
  }
];
