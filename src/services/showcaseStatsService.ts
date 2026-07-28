import { doc, setDoc, increment, getDoc, collection, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';

const STORAGE_VIEW_PREFIX = 'ml_showcase_view_';
const STORAGE_WA_PREFIX = 'ml_wa_click_';
const STORAGE_PROD_PREFIX = 'ml_prod_view_';

// 1 hora de cooldown para visualização pública e cliques para evitar falsos abusos ou cliques em sequência rápida
const VIEW_COOLDOWN = 60 * 60 * 1000; 
const WA_COOLDOWN = 5 * 1000; // 5 segundos para cliques repetidos no WhatsApp
const PROD_COOLDOWN = 10 * 60 * 1000; // 10 minutos para produto individual

/**
 * Obtém a data corrente no fuso horário local/UTC no formato Y-MM-DD
 */
export function getLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Incrementa a visualização da vitrine (showcase views)
 */
export async function incrementShowcaseView(sellerId: string): Promise<void> {
  if (!sellerId) return;
  
  // Evitar contagens abusivas / múltiplos envios por refresh rápido ou spam
  const key = `${STORAGE_VIEW_PREFIX}${sellerId}`;
  const lastViewStr = localStorage.getItem(key);
  const now = Date.now();
  if (lastViewStr) {
    const elapsed = now - parseInt(lastViewStr, 10);
    if (elapsed < VIEW_COOLDOWN) {
      return; // Ainda no cooldown
    }
  }

  try {
    const dateStr = getLocalDateString();
    
    // 1. Snapshot acumulado geral (Lifetime)
    const lifetimeRef = doc(db, 'showcaseStats', sellerId);
    await setDoc(lifetimeRef, {
      views: increment(1),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // 2. Snapshot diário
    const dailyRef = doc(db, 'showcaseStats', sellerId, 'dailyStats', dateStr);
    await setDoc(dailyRef, {
      views: increment(1),
      date: dateStr,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    localStorage.setItem(key, now.toString());
  } catch (err) {
    console.error('Erro ao registrar visualização da vitrine:', err);
  }
}

/**
 * Incrementa cliques no WhatsApp (contactar empreendedor / pedir produto)
 */
export async function incrementWhatsappClick(sellerId: string, productId?: string): Promise<void> {
  if (!sellerId) return;

  const key = productId 
    ? `${STORAGE_WA_PREFIX}${sellerId}_${productId}` 
    : `${STORAGE_WA_PREFIX}${sellerId}_main`;
    
  const lastClickStr = localStorage.getItem(key);
  const now = Date.now();
  if (lastClickStr) {
    const elapsed = now - parseInt(lastClickStr, 10);
    if (elapsed < WA_COOLDOWN) {
      return; 
    }
  }

  try {
    const dateStr = getLocalDateString();

    // 1. Snapshot geral
    const lifetimeRef = doc(db, 'showcaseStats', sellerId);
    await setDoc(lifetimeRef, {
      whatsappClicks: increment(1),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // 2. Snapshot diário
    const dailyRef = doc(db, 'showcaseStats', sellerId, 'dailyStats', dateStr);
    await setDoc(dailyRef, {
      whatsappClicks: increment(1),
      date: dateStr,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    localStorage.setItem(key, now.toString());
  } catch (err) {
    console.error('Erro ao registrar clique de whatsapp:', err);
  }
}

/**
 * Incrementa a visualização individual de produto
 */
export async function incrementProductView(sellerId: string, productId: string): Promise<void> {
  if (!sellerId || !productId) return;

  const key = `${STORAGE_PROD_PREFIX}${sellerId}_${productId}`;
  const lastViewStr = localStorage.getItem(key);
  const now = Date.now();
  if (lastViewStr) {
    const elapsed = now - parseInt(lastViewStr, 10);
    if (elapsed < PROD_COOLDOWN) {
      return;
    }
  }

  try {
    const dateStr = getLocalDateString();

    // 1. Snapshot geral
    const lifetimeRef = doc(db, 'showcaseStats', sellerId);
    await setDoc(lifetimeRef, {
      [`productViews.${productId}`]: increment(1),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // 2. Snapshot diário
    const dailyRef = doc(db, 'showcaseStats', sellerId, 'dailyStats', dateStr);
    await setDoc(dailyRef, {
      [`productViews.${productId}`]: increment(1),
      date: dateStr,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    localStorage.setItem(key, now.toString());
  } catch (err) {
    console.error('Erro ao registrar visualização de produto:', err);
  }
}

export interface AggregatedStatsResult {
  lifetime: {
    views: number;
    whatsappClicks: number;
    productViews: Record<string, number>;
  };
  last7Days: {
    views: number;
    whatsappClicks: number;
    productViews: Record<string, number>;
  };
  last30Days: {
    views: number;
    whatsappClicks: number;
    productViews: Record<string, number>;
  };
  hasData: boolean;
}

/**
 * Obtém as estatísticas acumuladas de forma otimizada para o empreendedor
 */
export async function getShowcaseStats(sellerId: string): Promise<AggregatedStatsResult> {
  const result: AggregatedStatsResult = {
    lifetime: { views: 0, whatsappClicks: 0, productViews: {} },
    last7Days: { views: 0, whatsappClicks: 0, productViews: {} },
    last30Days: { views: 0, whatsappClicks: 0, productViews: {} },
    hasData: false
  };

  try {
    // 1. Buscar Lifetime
    const lifetimeRef = doc(db, 'showcaseStats', sellerId);
    const snap = await getDoc(lifetimeRef);
    if (snap.exists()) {
      const data = snap.data();
      result.lifetime.views = data.views || 0;
      result.lifetime.whatsappClicks = data.whatsappClicks || 0;
      result.lifetime.productViews = data.productViews || {};
      result.hasData = true;
    }

    // 2. Buscar snapshots diários no subcollection
    const dailyRef = collection(db, 'showcaseStats', sellerId, 'dailyStats');
    const dailySnap = await getDocs(dailyRef);

    if (!dailySnap.empty) {
      result.hasData = true;
      const today = new Date();
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);

      dailySnap.docs.forEach((d) => {
        const statsDoc = d.data();
        const dateStr = statsDoc.date; 
        if (!dateStr) return;

        const docDate = new Date(dateStr);
        // Reset time component for pristine date calculations
        docDate.setHours(0, 0, 0, 0);

        const views = statsDoc.views || 0;
        const clicks = statsDoc.whatsappClicks || 0;
        const prodViewsMap = statsDoc.productViews || {};

        // Se está dentro dos últimos 30 dias
        if (docDate >= thirtyDaysAgo) {
          result.last30Days.views += views;
          result.last30Days.whatsappClicks += clicks;
          Object.entries(prodViewsMap).forEach(([pid, count]) => {
            if (typeof count === 'number') {
              result.last30Days.productViews[pid] = (result.last30Days.productViews[pid] || 0) + count;
            }
          });
        }

        // Se está dentro dos últimos 7 dias
        if (docDate >= sevenDaysAgo) {
          result.last7Days.views += views;
          result.last7Days.whatsappClicks += clicks;
          Object.entries(prodViewsMap).forEach(([pid, count]) => {
            if (typeof count === 'number') {
              result.last7Days.productViews[pid] = (result.last7Days.productViews[pid] || 0) + count;
            }
          });
        }
      });
    }
  } catch (err) {
    console.error('Erro ao buscar estatísticas da vitrine:', err);
  }

  return result;
}
