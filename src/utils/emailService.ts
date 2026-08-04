import { doc, getDoc, query, collection, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Centralized Email Service for ConnectBoat
 * 
 * Triggers automated email notifications via backend endpoint (/api/email/send).
 * Handles failures silently to ensure zero disruptions to primary app workflows.
 */

export interface EmailData {
  anuncio_submetido: {
    sellerName: string;
    adTitle: string;
    adId: string;
  };
  anuncio_aprovado: {
    sellerName: string;
    adTitle: string;
    adId: string;
  };
  anuncio_rejeitado: {
    sellerName: string;
    adTitle: string;
    reason: string;
  };
  anuncio_pendente_staff: {
    staffEmails: string[];
    adTitle: string;
    adId: string;
    sellerName: string;
  };
  interesse_contacto: {
    sellerName: string;
    adTitle: string;
    interestedName: string;
    adId: string;
  };
  review_recebida: {
    sellerName: string;
    reviewerName: string;
    rating: number;
    comment: string;
    adTitle: string;
  };
  compra_concluida: {
    sellerName: string;
    buyerName: string;
    adTitle: string;
  };
  pagamento_confirmado: {
    userName: string;
    planName: string;
    amount?: string;
  };
  boas_vindas: {
    userName: string;
  };
  alerta_saude_sistema: {
    adminName: string;
    previousLevel?: string;
    currentLevel: string;
    healthPercentage: number;
    alertDetailsString: string; // HTML or text listing alerts
    actionRequired: string;
  };
}

/**
 * Verifica se um e-mail ou UID pertence a um administrador ou moderador.
 */
export async function isUserStaff(emailOrUid: string): Promise<boolean> {
  if (!emailOrUid) return false;
  try {
    if (!emailOrUid.includes('@')) {
      const userDoc = await getDoc(doc(db, 'users', emailOrUid));
      if (userDoc.exists()) {
        const role = userDoc.data()?.role;
        return role === 'admin' || role === 'moderator';
      }
    } else {
      const q = query(collection(db, 'users'), where('email', '==', emailOrUid));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const role = querySnapshot.docs[0].data()?.role;
        return role === 'admin' || role === 'moderator';
      }
    }
  } catch (err) {
    console.warn('[EmailService] Erro ao verificar se usuário é staff:', err);
  }
  return false;
}

/**
 * Determina se o envio do e-mail automático deve ser bloqueado para anúncios criados por admin/moderador.
 */
async function shouldBlockEmail(template: string, to: string | string[], data: any): Promise<boolean> {
  if (data && data.adId) {
    try {
      const adDocSnap = await getDoc(doc(db, 'ads', data.adId));
      if (adDocSnap.exists()) {
        const adInfo = adDocSnap.data();
        if (adInfo && adInfo.sellerId) {
          const sellerIsStaff = await isUserStaff(adInfo.sellerId);
          if (sellerIsStaff) {
            console.log(`[EmailService] Bloqueando email silenciosamente para o template ${template} pois o criador do anúncio é admin/moderador.`);
            return true;
          }
        }
      }
    } catch (err) {
      console.warn('[EmailService] Erro ao buscar anúncio para verificar bloqueio:', err);
    }
  }

  const adRelatedTemplates = ['anuncio_aprovado', 'anuncio_rejeitado', 'interesse_contacto', 'review_recebida', 'compra_concluida'];
  if (adRelatedTemplates.includes(template)) {
    const recipients = Array.isArray(to) ? to : [to];
    for (const recipient of recipients) {
      const isStaff = await isUserStaff(recipient);
      if (isStaff) {
        console.log(`[EmailService] Bloqueando email silenciosamente para ${recipient} pois pertence a admin/moderador.`);
        return true;
      }
    }
  }

  return false;
}

/**
 * Envia uma requisição de email para o endpoint backend.
 */
export async function sendEmailGeneric<T extends keyof EmailData>(
  template: T,
  to: string | string[],
  data: EmailData[T]
): Promise<{ success: boolean; error?: string }> {
  try {
    const isEnabled = localStorage.getItem('emails_enabled') !== 'false';
    if (!isEnabled) {
      console.log(`[EmailService] Envio de e-mails desativado via configuração local para o template: ${template}`);
      return { success: true };
    }

    // Verificar se o email deve ser bloqueado sob as regras de admin/moderador (Objetivo 2)
    const blocked = await shouldBlockEmail(template, to, data);
    if (blocked) {
      return { success: true };
    }

    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template,
        to,
        data,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao enviar email`);
    }

    const resJson = await response.json();
    return resJson;
  } catch (err: any) {
    console.warn(`[EmailService] Falha não impeditiva ao disparar email (${template}):`, err?.message || err);
    // Log asynchronously to avoid blocking the caller
    addDoc(collection(db, 'system_health_events'), {
      type: 'email_failure',
      error: err?.message || String(err),
      timestamp: new Date(),
      template
    }).catch(logErr => console.warn('[EmailService] Failed to write failure event log:', logErr));
    
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Helper para obter o email de um vendedor a partir do sellerId
 */
export async function getSellerEmail(sellerId: string): Promise<string | null> {
  if (!sellerId) return null;
  try {
    const userDocSnap = await getDoc(doc(db, 'users', sellerId));
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      return userData?.email || null;
    }
  } catch (err) {
    console.warn(`[EmailService] Não foi possível consultar o email do vendedor ${sellerId}:`, err);
  }
  return null;
}
