import { db } from '../firebase';
import { collection, doc, setDoc, deleteDoc, getDocs, serverTimestamp } from 'firebase/firestore';

export interface MarketingMaterial {
  id: string;
  title: string;
  category: string;
  type: 'Text' | 'Image/Banner' | 'Video' | 'Link' | 'Texto' | 'Imagem/Banner' | 'Vídeo';
  description: string;
  content: string; // The copy text or main URL
  mediaUrl?: string; // Additional image/video/file URL when applicable
  createdAt: string; // ISO date string
  createdBy: string; // email or identifier of creator
  visualType?: 'gradient' | 'image';
  visualValue?: string; // tailwind class or background style
}

export interface MarketingCategory {
  id: string;
  name: string;
}

const LOCAL_STORAGE_KEY = 'connectboat_marketing_materials';
const CATEGORIES_LOCAL_STORAGE_KEY = 'connectboat_marketing_categories';

const DEFAULT_CATEGORIES: MarketingCategory[] = [
  { id: 'cat-geral', name: 'General' },
  { id: 'cat-convites', name: 'Invitations' },
  { id: 'cat-whatsapp', name: 'WhatsApp' },
  { id: 'cat-facebook', name: 'Facebook' },
  { id: 'cat-instagram', name: 'Instagram' },
  { id: 'cat-banners', name: 'Banners' },
  { id: 'cat-videos', name: 'Videos' },
  { id: 'cat-empresas', name: 'Marine Businesses' },
  { id: 'cat-lancamentos', name: 'New Listings' }
];

const DEFAULT_MATERIALS: MarketingMaterial[] = [
  {
    id: 'convite-testes-luso-1',
    title: 'Testing Invitation - ConnectBoat',
    category: 'Invitations',
    type: 'Texto',
    description: 'Official invitation for users to participate in testing ConnectBoat.',
    content: `Hello! ⛵ You're invited to test ConnectBoat! 🇬🇧\n\nWe are the UK's dedicated boat and marine marketplace for vessels, engines, equipment, charters, and nautical services. Connect directly with buyers and sellers on WhatsApp! 🚀\n\nList your boat or gear for free today!\nVisit now: ${window.location.origin}\n\nYour feedback is greatly appreciated! 🤝`,
    mediaUrl: '',
    createdAt: '2026-06-13T10:11:52Z',
    createdBy: 'Admin',
    visualType: 'gradient',
    visualValue: 'from-sky-600 to-indigo-500'
  },
  {
    id: 'boas-vindas-geral-2',
    title: 'Welcome to ConnectBoat',
    category: 'General',
    type: 'Texto',
    description: 'General presentation of the platform for new boaters and buyers.',
    content: `Discover ConnectBoat! ⛵ The UK's premier marketplace for boats, yachts, jet skis, marine parts, and charter services. Buy, sell, and deal directly! 🚀\n\nVisit now: ${window.location.origin}`,
    mediaUrl: '',
    createdAt: '2026-06-13T10:11:52Z',
    createdBy: 'Admin',
    visualType: 'gradient',
    visualValue: 'from-blue-600 to-sky-400'
  },
  {
    id: 'venda-carros-3',
    title: 'Fast Boat Sales',
    category: 'WhatsApp',
    type: 'Texto',
    description: 'Incentive campaign to sell boats and watercraft quickly.',
    content: `Looking to sell your boat or RIB hassle-free? 🚤 On ConnectBoat, list in minutes and chat directly with buyers on WhatsApp. Fast, free, and secure! ⚓\n\nPost your ad here: ${window.location.origin}/create-ad`,
    mediaUrl: '',
    createdAt: '2026-06-13T10:11:52Z',
    createdBy: 'Admin',
    visualType: 'gradient',
    visualValue: 'from-emerald-600 to-teal-400'
  }
];

export function getLocalCategories(): MarketingCategory[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CATEGORIES_LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_CATEGORIES));
      return DEFAULT_CATEGORIES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('[MarketingService] Error reading categories from localStorage:', err);
    return DEFAULT_CATEGORIES;
  }
}

export function saveLocalCategory(category: MarketingCategory): MarketingCategory[] {
  const current = getLocalCategories();
  const existingIndex = current.findIndex(c => c.id === category.id);
  
  if (existingIndex > -1) {
    current[existingIndex] = category;
  } else {
    current.push(category);
  }
  
  localStorage.setItem(CATEGORIES_LOCAL_STORAGE_KEY, JSON.stringify(current));
  return current;
}

export function deleteLocalCategory(id: string): MarketingCategory[] {
  const current = getLocalCategories();
  const filtered = current.filter(c => c.id !== id);
  localStorage.setItem(CATEGORIES_LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  return filtered;
}

export async function syncCategoryToFirestore(category: MarketingCategory): Promise<void> {
  try {
    await setDoc(doc(db, 'marketing_categories', category.id), {
      ...category,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log('[MarketingService] Synced category with firestore successfully');
  } catch (err) {
    console.warn('[MarketingService] Firestore category sync skipped or failed:', err);
  }
}

export async function deleteCategoryFromFirestore(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'marketing_categories', id));
    console.log('[MarketingService] Deleted category from firestore successfully');
  } catch (err) {
    console.warn('[MarketingService] Firestore category delete skipped or failed:', err);
  }
}

export function getLocalMaterials(): MarketingMaterial[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_MATERIALS));
      return DEFAULT_MATERIALS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('[MarketingService] Error reading from localStorage:', err);
    return DEFAULT_MATERIALS;
  }
}

export function saveLocalMaterial(material: MarketingMaterial): MarketingMaterial[] {
  const current = getLocalMaterials();
  const existingIndex = current.findIndex(m => m.id === material.id);
  
  if (existingIndex > -1) {
    current[existingIndex] = material;
  } else {
    current.push(material);
  }
  
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
  return current;
}

export function deleteLocalMaterial(id: string): MarketingMaterial[] {
  const current = getLocalMaterials();
  const filtered = current.filter(m => m.id !== id);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  return filtered;
}

// Transparently handle Firestore updates so that if rules are deployed later, we are 100% ready!
export async function syncToFirestore(material: MarketingMaterial): Promise<void> {
  try {
    await setDoc(doc(db, 'marketing_materials', material.id), {
      ...material,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log('[MarketingService] Synced material with firestore successfully');
  } catch (err) {
    // Graceously catch and ignore permission errors, since localStorage acts as the primary sandbox database
    console.warn('[MarketingService] Firestore sync skipped or failed (unconfigured rules):', err);
  }
}

export async function deleteFromFirestore(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'marketing_materials', id));
    console.log('[MarketingService] Deleted material from firestore successfully');
  } catch (err) {
    console.warn('[MarketingService] Firestore delete skipped or failed:', err);
  }
}
