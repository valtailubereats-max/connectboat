import type { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { sendEmailDirect } from '../email/send.ts';

const PROJECT_ID = 'navlink-489413';
const DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';

function getAdminDb() {
  const firebaseAdmin = (admin as any).default || admin;
  if (!firebaseAdmin.apps.length) {
    firebaseAdmin.initializeApp({ projectId: PROJECT_ID });
  }
  return firebaseAdmin.firestore(DATABASE_ID);
}

export default async function resendPaymentEmailHandler(req: Request, res: Response) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED', errorMessage: 'Method not allowed' });
  }

  try {
    const { adId } = req.body || {};

    if (!adId || typeof adId !== 'string') {
      return res.status(400).json({ success: false, error: 'MISSING_AD_ID', errorMessage: 'O ID do anúncio é obrigatório.' });
    }

    const db = getAdminDb();
    const adDoc = await db.collection('ads').doc(adId).get();

    if (!adDoc.exists) {
      return res.status(404).json({ success: false, error: 'AD_NOT_FOUND', errorMessage: 'Anúncio não encontrado.' });
    }

    const adData = adDoc.data() || {};
    const recipientEmail = adData.sellerEmail || adData.email || adData.userEmail;

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return res.status(400).json({ 
        success: false, 
        error: 'NO_RECIPIENT_EMAIL', 
        errorMessage: 'Não foi encontrado nenhum e-mail válido para este anunciante.' 
      });
    }

    const firebaseAdmin = (admin as any).default || admin;
    const isHire = adData.category === 'aluguel' || adData.listingType === 'hire' || adData.type === 'hire';
    const activePlan = (adData.plan || 'standard').toLowerCase();

    let planTitle = 'Standard Listing';
    let planPrice = '£2.99';
    if (activePlan === 'premium') {
      planTitle = 'Premium Featured Listing';
      planPrice = '£9.99';
    } else if (activePlan === 'featured' || activePlan === 'national' || activePlan === 'local') {
      planTitle = 'Featured Listing';
      planPrice = '£4.99';
    }

    const hasMediaBoost = !!adData.mediaBoostEnabled || !!adData.videoPaid;
    let totalNumeric = activePlan === 'premium' ? 9.99 : (activePlan === 'featured' || activePlan === 'national' || activePlan === 'local' ? 4.99 : 2.99);
    if (hasMediaBoost) {
      totalNumeric += 2.00;
    }

    let baseUrl = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || 'https://www.connectboat.co.uk';
    baseUrl = baseUrl.replace(/\/$/, '');

    const emailPayload = {
      userName: adData.sellerName || 'Valued Advertiser',
      adTitle: adData.title || 'Boat Listing',
      adId: adId,
      listingType: isHire ? 'Boat for Hire' : 'Boat for Sale',
      planTitle: planTitle,
      planPrice: planPrice,
      hasMediaBoost: hasMediaBoost,
      mediaBoostPrice: '£2.00',
      totalAmount: `£${totalNumeric.toFixed(2)}`,
      paymentDate: adData.paidAt?.toDate ? adData.paidAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      expiryDate: adData.expirationDate?.toDate ? adData.expirationDate.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      paymentRef: adData.stripeCheckoutSessionId || adId,
      adUrl: `${baseUrl}/anuncio/${adId}`,
      manageUrl: `${baseUrl}/profile`,
    };

    const dispatchResult = await sendEmailDirect(recipientEmail, 'recibo_pagamento_anuncio', emailPayload);

    await db.collection('ads').doc(adId).update({
      paymentConfirmationEmailSent: true,
      paymentConfirmationEmailStatus: 'sent',
      paymentConfirmationEmailSentAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      paymentConfirmationEmailError: null,
    });

    return res.status(200).json({
      success: true,
      message: `E-mail de confirmação enviado com sucesso para ${recipientEmail}!`,
      dispatchResult
    });

  } catch (err: any) {
    console.error('[Resend Payment Email ERROR]:', err);
    if (req.body?.adId) {
      try {
        const db = getAdminDb();
        const firebaseAdmin = (admin as any).default || admin;
        await db.collection('ads').doc(req.body.adId).update({
          paymentConfirmationEmailStatus: 'failed',
          paymentConfirmationEmailError: err.message || String(err),
          paymentConfirmationEmailLastAttemptAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) {}
    }

    return res.status(500).json({
      success: false,
      error: 'RESEND_FAILED',
      errorMessage: err.message || 'Falha ao reenviar o e-mail de confirmação de pagamento.'
    });
  }
}
