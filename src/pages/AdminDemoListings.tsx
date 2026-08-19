import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Check, AlertCircle, RefreshCcw, ExternalLink, Tag, Trash2, 
  Layers, Anchor, ShieldCheck, CheckSquare, Square, Edit3, ChevronDown, ChevronUp, Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Ad, BOAT_TYPES } from '../types';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, clearDocsCache } from '../firebase';
import { clearHomeCache } from '../utils/cache';
import { formatPrice, parsePrice } from '../utils';

export interface PresetItem {
  id: string; // local temporary id
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  images: string[];
  city: string;
  country: 'United Kingdom' | 'Portugal';
  category: string;
  sellerId: string;
  sellerName: string;
  sellerPhone: string;
  externalListing: boolean;
  demoListing: boolean;
  sourceUrl?: string;
  sourceSite?: string;
  sourceListingId?: string;
  externalStatus?: 'active' | 'removed' | 'unknown';
  // Boat specs
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
  serviceCoverage?: 'city' | 'radius20' | 'radius50' | 'county' | 'uk' | 'portugal' | 'online';
  // State tracking
  selected: boolean;
  existsInDb?: boolean;
  dbId?: string;
  expanded?: boolean;
}

const INITIAL_PRESETS: PresetItem[] = [
  // 5 EXTERNAL LISTINGS (Real UK Marine Marketplaces)
  {
    id: 'preset-ext-1',
    title: 'Princess V48 Express Yacht (2021)',
    description: 'Extracted from YachtWorld UK: Princess V48 equipped with twin Volvo Penta IPS 600 engines (870HP total), joystick control, hydraulic bathing platform, air conditioning, underwater lights, and full Garmin electronics suite. Perfectly maintained for Solent and offshore cruising.',
    price: 695000,
    imageUrl: 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&w=1200&q=80',
    images: ['https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&w=1200&q=80'],
    city: 'Southampton',
    country: 'United Kingdom',
    category: 'Yacht',
    sellerId: 'connectboat-external-partner',
    sellerName: 'ConnectBoat External Partner',
    sellerPhone: '',
    externalListing: true,
    demoListing: false,
    sourceUrl: 'https://www.yachtworld.com/yacht/2021-princess-v48-9283741/',
    sourceSite: 'YachtWorld UK',
    sourceListingId: 'yw-9283741',
    externalStatus: 'active',
    boatType: 'Motorboat',
    manufacturer: 'Princess',
    model: 'V48',
    year: 2021,
    length: '15.49 m (50.8 ft)',
    beam: '4.34 m',
    draft: '1.14 m',
    engineBrand: 'Twin Volvo Penta IPS600',
    horsepower: '870 HP',
    fuelType: 'Diesel',
    hullMaterial: 'Fibreglass (GRP)',
    cabins: '2',
    berths: '4',
    bathrooms: '2',
    selected: true,
  },
  {
    id: 'preset-ext-2',
    title: 'Hallberg-Rassy 340 Sailing Yacht (2019)',
    description: 'Extracted from Apollo Duck UK: Hallberg-Rassy 340 in excellent blue-water condition. Teak decks, twin wheel steering, bow thruster, Raymarine Axiom chartplotter, full battened mainsail, furling jib, and Yanmar 29HP diesel engine.',
    price: 245000,
    imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    images: ['https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80'],
    city: 'Plymouth',
    country: 'United Kingdom',
    category: 'Boats for Sale',
    sellerId: 'connectboat-external-partner',
    sellerName: 'ConnectBoat External Partner',
    sellerPhone: '',
    externalListing: true,
    demoListing: false,
    sourceUrl: 'https://www.apolloduck.com/boat/hallberg-rassy-340-for-sale/732109',
    sourceSite: 'Apollo Duck UK',
    sourceListingId: 'ad-732109',
    externalStatus: 'active',
    boatType: 'Sailboat',
    manufacturer: 'Hallberg-Rassy',
    model: '340',
    year: 2019,
    length: '10.36 m (34 ft)',
    beam: '3.47 m',
    draft: '1.88 m',
    engineBrand: 'Yanmar 3YM30X',
    horsepower: '29 HP',
    fuelType: 'Diesel',
    hullMaterial: 'Fibreglass (GRP)',
    cabins: '2',
    berths: '6',
    bathrooms: '1',
    selected: true,
  },
  {
    id: 'preset-ext-3',
    title: 'Brig Eagle 6.7 Custom RIB (2022)',
    description: 'Extracted from Boatshop24 UK: High-performance family RIB with black ORCA Hypalon tubes, SeaDek teak flooring, Fusion marine audio, Garmin echoMAP GPS, hydraulic steering, and Suzuki 200HP outboard.',
    price: 58900,
    imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
    images: ['https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80'],
    city: 'Poole',
    country: 'United Kingdom',
    category: 'Boats for Sale',
    sellerId: 'connectboat-external-partner',
    sellerName: 'ConnectBoat External Partner',
    sellerPhone: '',
    externalListing: true,
    demoListing: false,
    sourceUrl: 'https://www.boatshop24.com/en/brig-eagle-67/boat-ad/2183921',
    sourceSite: 'Boatshop24 UK',
    sourceListingId: 'bs24-2183921',
    externalStatus: 'active',
    boatType: 'RIB',
    manufacturer: 'Brig',
    model: 'Eagle 6.7',
    year: 2022,
    length: '6.70 m (22 ft)',
    beam: '2.55 m',
    engineBrand: 'Suzuki DF200 APX',
    horsepower: '200 HP',
    engineHours: '78 hrs',
    fuelType: 'Gasoline',
    selected: true,
  },
  {
    id: 'preset-ext-4',
    title: 'Warrior 165 Sea Fishing Boat (2020)',
    description: 'Extracted from BoatsAndOutboards UK: Well-equipped Warrior 165 coastal fishing boat with protective cuddy cabin, Lowrance Hook Reveal fishfinder/GPS, Cobra VHF radio, live bait well, stainless steel arch rod holders, and heavy-duty roller trailer.',
    price: 18500,
    imageUrl: 'https://images.unsplash.com/photo-1520255870062-bd79d3865de7?auto=format&fit=crop&w=1200&q=80',
    images: ['https://images.unsplash.com/photo-1520255870062-bd79d3865de7?auto=format&fit=crop&w=1200&q=80'],
    city: 'Lymington',
    country: 'United Kingdom',
    category: 'Boats for Sale',
    sellerId: 'connectboat-external-partner',
    sellerName: 'ConnectBoat External Partner',
    sellerPhone: '',
    externalListing: true,
    demoListing: false,
    sourceUrl: 'https://www.boatsandoutboards.co.uk/fishing-boats/warrior-165-for-sale/891234',
    sourceSite: 'BoatsAndOutboards UK',
    sourceListingId: 'bao-891234',
    externalStatus: 'active',
    boatType: 'Fishing Boat',
    manufacturer: 'Warrior',
    model: '165',
    year: 2020,
    length: '5.03 m (16.5 ft)',
    engineBrand: 'Mariner F75 FourStroke',
    horsepower: '75 HP',
    fuelType: 'Gasoline',
    selected: true,
  },
  {
    id: 'preset-ext-5',
    title: 'Aqualine 57ft Cruiser Narrowboat (2018)',
    description: 'Extracted from The Boat Market UK: Luxury 57ft narrowboat built by Aqualine. High gloss oak interior, solid fuel stove, Webasto central heating, solar array, and Barrus Shire 45HP diesel engine. Ideal for liveaboard or canal cruising.',
    price: 89950,
    imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    images: ['https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80'],
    city: 'London',
    country: 'United Kingdom',
    category: 'Boats for Sale',
    sellerId: 'connectboat-external-partner',
    sellerName: 'ConnectBoat External Partner',
    sellerPhone: '',
    externalListing: true,
    demoListing: false,
    sourceUrl: 'https://www.theboatmarket.co.uk/narrowboats/aqualine-57-cruiser/304812',
    sourceSite: 'The Boat Market UK',
    sourceListingId: 'tbm-304812',
    externalStatus: 'active',
    boatType: 'Narrowboat',
    manufacturer: 'Aqualine',
    model: '57 Cruiser Stern',
    year: 2018,
    length: '17.37 m (57 ft)',
    engineBrand: 'Barrus Shire',
    horsepower: '45 HP',
    fuelType: 'Diesel',
    selected: true,
  },

  // 5 DEMO LISTINGS (Fictional Examples Across Categories)
  {
    id: 'preset-demo-6',
    title: 'Sea-Doo GTX Limited 300 Jet Ski (2023)',
    description: 'This is an example listing created for demonstration purposes and is not available for purchase.\n\n2023 Sea-Doo GTX Limited 300 in Metallic Blue. Premium Bluetooth audio system, color display, iBR intelligent brake and reverse, waterproof phone compartment, and aluminum trailer.',
    price: 19200,
    imageUrl: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=80',
    images: ['https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=80'],
    city: 'Portsmouth',
    country: 'United Kingdom',
    category: 'Boats for Sale',
    sellerId: 'connectboat-demo-seller',
    sellerName: 'ConnectBoat Example Seller',
    sellerPhone: '',
    externalListing: false,
    demoListing: true,
    boatType: 'Jet Ski',
    manufacturer: 'Sea-Doo',
    model: 'GTX Limited 300',
    year: 2023,
    horsepower: '300 HP',
    fuelType: 'Gasoline',
    selected: true,
  },
  {
    id: 'preset-demo-7',
    title: 'Yamaha F115 LB FourStroke Outboard Engine',
    description: 'This is an example listing created for demonstration purposes and is not available for purchase.\n\nYamaha F115 115HP 4-Stroke long shaft outboard engine. Low running hours, full service history, includes digital gauge kit and side mount remote controller.',
    price: 9800,
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    images: ['https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80'],
    city: 'Falmouth',
    country: 'United Kingdom',
    category: 'Boat Engines',
    sellerId: 'connectboat-demo-seller',
    sellerName: 'ConnectBoat Example Seller',
    sellerPhone: '',
    externalListing: false,
    demoListing: true,
    manufacturer: 'Yamaha',
    model: 'F115 LB',
    horsepower: '115 HP',
    fuelType: 'Gasoline',
    selected: true,
  },
  {
    id: 'preset-demo-8',
    title: 'De Graaff 2600kg Twin Axle Roller Boat Trailer',
    description: 'This is an example listing created for demonstration purposes and is not available for purchase.\n\nHeavy duty twin axle roller boat trailer for boats up to 6.8 metres or 2000kg load. Fully galvanized steel chassis, waterproof LED lights, 2-speed winch, and flush kit.',
    price: 3450,
    imageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80',
    images: ['https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80'],
    city: 'Southampton',
    country: 'United Kingdom',
    category: 'Trailers',
    sellerId: 'connectboat-demo-seller',
    sellerName: 'ConnectBoat Example Seller',
    sellerPhone: '',
    externalListing: false,
    demoListing: true,
    manufacturer: 'De Graaff',
    model: '2600kg Twin Axle',
    selected: true,
  },
  {
    id: 'preset-demo-9',
    title: 'Raymarine Axiom 9 Pro MFD GPS Plotter',
    description: 'This is an example listing created for demonstration purposes and is not available for purchase.\n\nRaymarine Axiom 9 Pro-S 9-inch Multifunction Display with HybridTouch controls, built-in High CHIRP Sonar, Lighthouse 4 OS, and NMEA2000 networking kit.',
    price: 1850,
    imageUrl: 'https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?auto=format&fit=crop&w=1200&q=80',
    images: ['https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?auto=format&fit=crop&w=1200&q=80'],
    city: 'Brighton',
    country: 'United Kingdom',
    category: 'Marine Electronics',
    sellerId: 'connectboat-demo-seller',
    sellerName: 'ConnectBoat Example Seller',
    sellerPhone: '',
    externalListing: false,
    demoListing: true,
    manufacturer: 'Raymarine',
    model: 'Axiom 9 Pro-S',
    selected: true,
  },
  {
    id: 'preset-demo-10',
    title: 'Annual Solent Premium Marina Berth & Yacht Support',
    description: 'This is an example listing created for demonstration purposes and is not available for purchase.\n\nPremium annual pontoon mooring berth up to 12m in Solent waters. Includes 24/7 security, fresh water, shore power connection, Wi-Fi access, and haul-out discount.',
    price: 4800,
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    images: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80'],
    city: 'Cowes',
    country: 'United Kingdom',
    category: 'Boat Services',
    sellerId: 'connectboat-demo-seller',
    sellerName: 'ConnectBoat Example Seller',
    sellerPhone: '',
    externalListing: false,
    demoListing: true,
    serviceCoverage: 'uk',
    selected: true,
  },
];

const AdminDemoListings: React.FC = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<PresetItem[]>(INITIAL_PRESETS);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Check duplicate status against Firestore on mount
  useEffect(() => {
    checkDuplicateListings();
  }, []);

  const checkDuplicateListings = async () => {
    setCheckingDuplicates(true);
    try {
      const adsRef = collection(db, 'ads');
      const snap = await getDocs(adsRef);
      const existingAds = snap.docs.map(d => ({ id: d.id, ...d.data() } as Ad));

      setItems(prevItems =>
        prevItems.map(item => {
          // Check by sourceUrl first, or title match
          const match = existingAds.find(ad => 
            (item.sourceUrl && ad.sourceUrl === item.sourceUrl) ||
            (ad.title?.toLowerCase() === item.title.toLowerCase())
          );

          if (match) {
            return {
              ...item,
              existsInDb: true,
              dbId: match.id,
              selected: false // uncheck existing by default
            };
          }
          return {
            ...item,
            existsInDb: false,
            dbId: undefined
          };
        })
      );
    } catch (err: any) {
      console.error('[AdminDemoListings] Error checking duplicate listings:', err);
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const toggleSelect = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  const toggleSelectAll = (select: boolean) => {
    setItems(prev => prev.map(item => ({ ...item, selected: select })));
  };

  const toggleExpand = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, expanded: !item.expanded } : item));
  };

  const updateItemField = (id: string, field: keyof PresetItem, value: any) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handlePublishSelected = async () => {
    const selectedItems = items.filter(i => i.selected);
    if (selectedItems.length === 0) {
      setStatusMsg({ type: 'error', text: 'Please select at least one listing to publish.' });
      return;
    }

    setPublishing(true);
    setStatusMsg({ type: 'info', text: `Publishing ${selectedItems.length} listing(s)...` });

    try {
      let publishedCount = 0;
      for (const item of selectedItems) {
        const payload: Partial<Ad> = {
          title: item.title,
          description: item.description,
          price: item.price,
          imageUrl: item.imageUrl,
          images: item.images,
          city: item.city,
          country: item.country === 'Portugal' ? 'Portugal' : 'Reino Unido',
          category: item.category,
          sellerId: item.sellerId,
          sellerName: item.sellerName,
          sellerPhone: item.sellerPhone,
          status: 'approved',
          adStatus: 'active',
          views: 0,
          whatsappClicks: 0,
          createdAt: serverTimestamp(),
          externalListing: item.externalListing,
          demoListing: item.demoListing,
          sourceUrl: item.sourceUrl || undefined,
          sourceSite: item.sourceSite || undefined,
          sourceListingId: item.sourceListingId || undefined,
          sourceCheckedAt: item.externalListing ? new Date() : undefined,
          externalStatus: item.externalListing ? 'active' : undefined,
          boatType: item.boatType || undefined,
          manufacturer: item.manufacturer || undefined,
          model: item.model || undefined,
          year: item.year ? String(item.year) : undefined,
          length: item.length || undefined,
          beam: item.beam || undefined,
          draft: item.draft || undefined,
          fuelType: item.fuelType || undefined,
          engineBrand: item.engineBrand || undefined,
          horsepower: item.horsepower || undefined,
          engineHours: item.engineHours || undefined,
          cabins: item.cabins || undefined,
          berths: item.berths || undefined,
          bathrooms: item.bathrooms || undefined,
          hullMaterial: item.hullMaterial || undefined,
          serviceCoverage: item.serviceCoverage || undefined,
        };

        await addDoc(collection(db, 'ads'), payload);
        publishedCount++;
      }

      setStatusMsg({
        type: 'success',
        text: `Success! ${publishedCount} demo/external listing(s) created in Firestore successfully.`
      });

      clearHomeCache();
      clearDocsCache();

      // Refresh duplicate check to show newly published items
      await checkDuplicateListings();
    } catch (err: any) {
      console.error('[AdminDemoListings] Batch publish error:', err);
      setStatusMsg({ type: 'error', text: `Error creating listings: ${err.message || String(err)}` });
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteAllDemoContent = async () => {
    setDeleting(true);
    setStatusMsg({ type: 'info', text: 'Searching and removing demo listings from Firestore...' });

    try {
      const adsRef = collection(db, 'ads');
      const snap = await getDocs(adsRef);
      
      const demoDocs = snap.docs.filter(docSnap => {
        const d = docSnap.data();
        return d.demoListing === true || d.externalListing === true || d.sellerId === 'connectboat-demo-seller' || d.sellerId === 'connectboat-external-partner';
      });

      let removedCount = 0;
      for (const d of demoDocs) {
        await deleteDoc(doc(db, 'ads', d.id));
        removedCount++;
      }

      setStatusMsg({
        type: 'success',
        text: `Removal Complete! ${removedCount} demo/external listing(s) removed from database.`
      });

      setShowDeleteModal(false);
      await checkDuplicateListings();
    } catch (err: any) {
      console.error('[AdminDemoListings] Error deleting demo content:', err);
      setStatusMsg({ type: 'error', text: `Error deleting content: ${err.message || String(err)}` });
    } finally {
      setDeleting(false);
    }
  };

  if (!isAdmin) {
    return <div className="p-8 text-center font-bold text-slate-700">Access restricted to administrators.</div>;
  }

  const selectedCount = items.filter(i => i.selected).length;
  const existingCount = items.filter(i => i.existsInDb).length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-xl border border-slate-800">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-xs font-bold border border-indigo-400/30">
            <Sparkles size={14} /> Marketplace Population Tool
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            Create Demo & External Listings
          </h1>
          <p className="text-slate-300 text-xs md:text-sm font-medium max-w-2xl">
            Populate ConnectBoat with 10 high-quality listings (5 real UK external listings with source links + 5 demo examples identified as demo content).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={checkDuplicateListings}
            disabled={checkingDuplicates}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCcw size={14} className={checkingDuplicates ? 'animate-spin' : ''} />
            Check DB
          </button>
          
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-rose-500/30 cursor-pointer"
          >
            <Trash2 size={14} />
            Delete Demo Content
          </button>
        </div>
      </div>

      {/* Alert / Status Toast */}
      <AnimatePresence>
        {statusMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl border text-sm font-bold flex items-center justify-between gap-3 ${
              statusMsg.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : statusMsg.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-sky-50 border-sky-200 text-sky-800'
            }`}
          >
            <span>{statusMsg.text}</span>
            <button onClick={() => setStatusMsg(null)} className="text-xs opacity-70 hover:opacity-100 font-black cursor-pointer">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Bar & Actions */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleSelectAll(selectedCount < items.length)}
            className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition cursor-pointer"
          >
            {selectedCount === items.length ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} />}
            {selectedCount === items.length ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-xs font-bold text-slate-500">
            {selectedCount} of {items.length} selected ({existingCount} in DB)
          </span>
        </div>

        <button
          onClick={handlePublishSelected}
          disabled={publishing || selectedCount === 0}
          className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md hover:shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Sparkles size={16} />
          {publishing ? 'Creating Listings...' : `Create ${selectedCount} Selected Listings`}
        </button>
      </div>

      {/* List / Grid of 10 Items */}
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`bg-white rounded-2xl border transition-all overflow-hidden ${
              item.selected ? 'border-indigo-300 shadow-md ring-1 ring-indigo-200' : 'border-slate-200 opacity-80'
            }`}
          >
            {/* Top Bar of item */}
            <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
              <div className="flex items-start gap-3 min-w-0">
                <button
                  onClick={() => toggleSelect(item.id)}
                  className="mt-1 text-slate-400 hover:text-indigo-600 transition cursor-pointer shrink-0"
                >
                  {item.selected ? <CheckSquare size={20} className="text-indigo-600" /> : <Square size={20} />}
                </button>

                <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-200 shrink-0 border border-slate-200">
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {item.externalListing ? (
                      <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
                        <ExternalLink size={10} /> External ({item.sourceSite || 'URL'})
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                        <Tag size={10} /> Demo Listing
                      </span>
                    )}

                    <span className="text-[10px] font-extrabold text-slate-500 uppercase bg-slate-200 px-2 py-0.5 rounded">
                      {item.category}
                    </span>

                    {item.existsInDb && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-emerald-200">
                        ✓ In DB
                      </span>
                    )}
                  </div>

                  <h3 className="font-extrabold text-slate-900 text-sm md:text-base leading-snug truncate">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold truncate">
                    {item.city}, {item.country} • {formatPrice(item.price, item.country)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 transition cursor-pointer"
                >
                  <Edit3 size={12} />
                  {item.expanded ? 'Hide Edit' : 'Edit Details'}
                  {item.expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>
            </div>

            {/* Expanded Editor Form */}
            {item.expanded && (
              <div className="p-4 md:p-6 border-t border-slate-100 bg-white space-y-4 text-xs font-sans">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Title</label>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => updateItemField(item.id, 'title', e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Price (£ / €)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.price !== undefined && item.price !== null ? formatPrice(item.price) : ''}
                      onChange={(e) => updateItemField(item.id, 'price', parsePrice(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Category</label>
                    <input
                      type="text"
                      value={item.category}
                      onChange={(e) => updateItemField(item.id, 'category', e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 block mb-1">City</label>
                    <input
                      type="text"
                      value={item.city}
                      onChange={(e) => updateItemField(item.id, 'city', e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Boat Type</label>
                    <input
                      type="text"
                      value={item.boatType || ''}
                      onChange={(e) => updateItemField(item.id, 'boatType', e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                      placeholder="e.g. Motorboat, Sailboat, RIB"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Manufacturer / Brand</label>
                    <input
                      type="text"
                      value={item.manufacturer || ''}
                      onChange={(e) => updateItemField(item.id, 'manufacturer', e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold"
                    />
                  </div>

                  {item.externalListing && (
                    <div className="sm:col-span-2 md:col-span-3">
                      <label className="font-bold text-indigo-700 block mb-1">External Source URL (sourceUrl)</label>
                      <input
                        type="text"
                        value={item.sourceUrl || ''}
                        onChange={(e) => updateItemField(item.id, 'sourceUrl', e.target.value)}
                        className="w-full p-2 bg-indigo-50/50 border border-indigo-200 text-indigo-900 rounded-lg font-mono text-[11px]"
                      />
                    </div>
                  )}

                  <div className="sm:col-span-2 md:col-span-3">
                    <label className="font-bold text-slate-600 block mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={item.description}
                      onChange={(e) => updateItemField(item.id, 'description', e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center font-bold">
              <Trash2 size={24} />
            </div>
            <h3 className="text-xl font-black text-slate-900">Remove Demo Listings?</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              This action will search and delete from Firestore all listings marked as <code className="bg-slate-100 px-1 py-0.5 rounded font-bold">demoListing: true</code> or <code className="bg-slate-100 px-1 py-0.5 rounded font-bold">externalListing: true</code>.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAllDemoContent}
                disabled={deleting}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition shadow-md disabled:opacity-50 cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDemoListings;
