import type { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { sendEmailDirect } from '../email/send.ts';

const PROJECT_ID = 'navlink-489413';
const DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';

let dbInstance: any = null;

function getAdminDb() {
  const firebaseAdmin = (admin as any).default || admin;

  if (!dbInstance) {
    const apps = firebaseAdmin.apps || [];
    if (!apps.length) {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (serviceAccountJson) {
        try {
          let serviceAccount;
          try {
            serviceAccount = JSON.parse(serviceAccountJson);
          } catch (e) {
            const decoded = Buffer.from(serviceAccountJson, 'base64').toString('utf-8');
            serviceAccount = JSON.parse(decoded);
          }
          firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert(serviceAccount),
            projectId: PROJECT_ID,
          });
        } catch (e: any) {
          console.error(`[Resend Email getAdminDb] Service Account init failed: ${e.message}. Falling back to default app init.`);
          firebaseAdmin.initializeApp({ projectId: PROJECT_ID });
        }
      } else {
        firebaseAdmin.initializeApp({ projectId: PROJECT_ID });
      }
    }

    dbInstance = firebaseAdmin.firestore();
    if (DATABASE_ID) {
      try {
        dbInstance.settings({ databaseId: DATABASE_ID });
      } catch (e) {
        // Settings already applied
      }
    }
  }

  return dbInstance;
}

export default async function resendPaymentEmailHandler(req: Request, res: Response) {
  // Ensure JSON response header is set immediately
  res.setHeader('Content-Type', 'application/json');

  let currentStep = '[1] Endpoint started';

  try {
    console.log('[1] Endpoint started');

    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'METHOD_NOT_ALLOWED',
        errorMessage: 'Method not allowed. Use POST.'
      });
    }

    currentStep = '[2] Admin authenticated / Request body parsed';
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }
    console.log('[2] Admin request validated');

    currentStep = '[3] Received adId';
    const adId = body.adId;
    console.log(`[3] Received adId: "${adId}"`);

    if (!adId || typeof adId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'MISSING_AD_ID',
        errorMessage: 'O ID do anúncio (adId) é obrigatório.'
      });
    }

    currentStep = '[4] Firestore initialized';
    const db = getAdminDb();
    console.log('[4] Firestore initialized');

    currentStep = '[5] Querying Firestore for listing';
    const adDoc = await db.collection('ads').doc(adId).get();

    if (!adDoc.exists) {
      console.warn(`[5] Ad document not found in Firestore for id: ${adId}`);
      return res.status(404).json({
        success: false,
        error: 'AD_NOT_FOUND',
        errorMessage: `Anúncio com ID "${adId}" não foi encontrado no banco de dados.`
      });
    }
    const adData = adDoc.data() || {};
    console.log(`[5] Listing found: "${adData.title || adId}"`);

    currentStep = '[6] Searching seller email';
    const recipientEmail = adData.sellerEmail || adData.email || adData.userEmail;

    if (!recipientEmail || !recipientEmail.includes('@')) {
      console.warn(`[6] No valid seller email in ad data:`, adData);
      return res.status(400).json({
        success: false,
        error: 'NO_RECIPIENT_EMAIL',
        errorMessage: 'Não foi encontrado nenhum e-mail válido para este anunciante no cadastro do anúncio.'
      });
    }
    console.log(`[6] Seller email found: ${recipientEmail}`);

    currentStep = '[7] Preparing email payload';
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
    console.log('[7] Email payload prepared');

    currentStep = '[8] Calling Resend via sendEmailDirect';
    console.log(`[8] Calling Resend for recipient: ${recipientEmail}...`);
    const dispatchResult = await sendEmailDirect(recipientEmail, 'recibo_pagamento_anuncio', emailPayload);
    console.log('[9] Resend response received:', JSON.stringify(dispatchResult));

    currentStep = '[10] Updating Firestore status';
    await db.collection('ads').doc(adId).update({
      paymentConfirmationEmailSent: true,
      paymentConfirmationEmailStatus: 'sent',
      paymentConfirmationEmailSentAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
      paymentConfirmationEmailError: null,
    });
    console.log('[10] Firestore updated successfully');

    currentStep = '[11] Success';
    console.log(`[11] Success sending receipt email to ${recipientEmail} for adId ${adId}`);

    return res.status(200).json({
      success: true,
      message: `E-mail de confirmação enviado com sucesso para ${recipientEmail}!`,
      dispatchResult
    });

  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Admin Resend Payment Email ERROR at step "${currentStep}"]:`, error);

    // Attempt to log failure in Firestore without throwing
    try {
      const db = getAdminDb();
      const firebaseAdmin = (admin as any).default || admin;
      if (req.body?.adId && typeof req.body.adId === 'string') {
        await db.collection('ads').doc(req.body.adId).update({
          paymentConfirmationEmailStatus: 'failed',
          paymentConfirmationEmailError: `Error at ${currentStep}: ${errorMsg}`,
          paymentConfirmationEmailLastAttemptAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (dbErr) {
      console.warn('[Admin Resend Payment Email] Could not log failure to Firestore:', dbErr);
    }

    return res.status(500).json({
      success: false,
      stepFailed: currentStep,
      error: errorMsg,
      errorMessage: `Erro no passo ${currentStep}: ${errorMsg}`,
      stack: process.env.NODE_ENV !== 'production' ? (error as Error)?.stack : undefined
    });
  }
}
