console.log('[MODULE] resend-payment-email loaded');

import type { Request, Response } from 'express';
import * as admin from 'firebase-admin';

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


async function verifyStaffRequest(req: Request, db: any) {
  const firebaseAdmin = (admin as any).default || admin;
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    const error: any = new Error('Authentication required.');
    error.statusCode = 401;
    error.code = 'AUTH_TOKEN_MISSING';
    throw error;
  }

  let decodedToken: any;
  try {
    decodedToken = await firebaseAdmin.auth().verifyIdToken(match[1]);
  } catch (err) {
    const error: any = new Error('Invalid or expired Firebase authentication token.');
    error.statusCode = 401;
    error.code = 'AUTH_TOKEN_INVALID';
    throw error;
  }

  const email = typeof decodedToken.email === 'string'
    ? decodedToken.email.trim().toLowerCase()
    : '';

  // Preserve the same explicit admin accounts already recognised by
  // the ConnectBoat Firestore rules.
  const explicitAdminEmails = new Set([
    'valtailubereats@gmail.com',
    'valtail@gmail.com',
    'generalsales2021@gmail.com',
  ]);

  if (explicitAdminEmails.has(email)) {
    return {
      uid: decodedToken.uid,
      email,
      role: 'admin',
    };
  }

  // AdminAds is available to both administrators and moderators,
  // therefore this endpoint mirrors that legitimate staff access.
  const userDoc = await db.collection('users').doc(decodedToken.uid).get();
  const role = userDoc.exists ? userDoc.data()?.role : null;

  if (role !== 'admin' && role !== 'moderator') {
    const error: any = new Error('Administrator or moderator access required.');
    error.statusCode = 403;
    error.code = 'STAFF_ACCESS_REQUIRED';
    throw error;
  }

  return {
    uid: decodedToken.uid,
    email,
    role,
  };
}

// Local private email dispatch function via direct Resend HTTP API fetch call
async function sendPaymentEmailDirect(recipientEmail: string, data: any) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not configured on the server');
  }

  const fromEmail = process.env.EMAIL_FROM || 'ConnectBoat <no-reply@connectboat.co.uk>';
  const replyTo = process.env.EMAIL_REPLY_TO || 'contato@connectboat.co.uk';

  let baseUrl = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || process.env.APP_URL || 'https://www.connectboat.co.uk';
  baseUrl = baseUrl.replace(/\/$/, '');

  const subject = `Your ConnectBoat listing payment is confirmed`;
  const awaitingApproval = data.awaitingApproval === true;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f8fafc; padding: 20px 0;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <tr style="background-color: #0f172a;">
                <td style="padding: 24px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.05em;">⛵ ConnectBoat</h1>
                  <p style="margin: 4px 0 0 0; color: #38bdf8; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">UK Boat & Marine Marketplace</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px; color: #334155; font-size: 15px; line-height: 1.6;">
                  <p style="font-size: 16px; font-weight: bold; margin-top: 0; color: #0f172a;">Hello ${data.userName || 'Valued Member'},</p>
                  <p style="color: #475569; margin-bottom: 20px;">
                    ${awaitingApproval
                      ? 'Thank you for advertising on ConnectBoat! Your payment has been confirmed. Your listing is now awaiting admin or moderator approval before publication.'
                      : 'Thank you for advertising on ConnectBoat! Your payment has been confirmed and your listing is now <strong>active</strong>.'}
                  </p>
                  <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td>
                          <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #166534; display: block;">Payment Status</span>
                          <span style="font-size: 18px; font-weight: 800; color: #15803d;">${awaitingApproval ? 'CONFIRMED / AWAITING APPROVAL' : 'CONFIRMED & ACTIVE'}</span>
                        </td>
                        <td align="right" style="font-size: 20px; font-weight: 800; color: #166534;">${data.totalAmount || 'Paid'}</td>
                      </tr>
                    </table>
                  </div>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 24px; font-size: 14px;">
                    <tr>
                      <td colspan="2" style="padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Itemized Summary</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; color: #475569;">${data.planTitle || 'Listing Fee'}</td>
                      <td align="right" style="padding: 10px 0; font-weight: bold; color: #0f172a;">${data.planPrice || 'Paid'}</td>
                    </tr>
                    ${data.hasMediaBoost ? `
                    <tr>
                      <td style="padding: 10px 0; color: #475569;">Media Boost (60s Listing Video)</td>
                      <td align="right" style="padding: 10px 0; font-weight: bold; color: #0f172a;">${data.mediaBoostPrice || '£2.00'}</td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="padding-top: 12px; border-top: 2px solid #cbd5e1; font-weight: 800; color: #0f172a; font-size: 15px;">Total Paid</td>
                      <td align="right" style="padding-top: 12px; border-top: 2px solid #cbd5e1; font-weight: 800; color: #0284c7; font-size: 16px;">${data.totalAmount || 'Paid'}</td>
                    </tr>
                  </table>
                  <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Listing & Transaction Details</h3>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; color: #334155;">
                      <tr>
                        <td style="padding: 5px 0; color: #64748b; width: 40%;">Listing Title:</td>
                        <td style="padding: 5px 0; font-weight: bold; color: #0f172a;">${data.adTitle || 'Boat Listing'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; color: #64748b;">Listing Reference:</td>
                        <td style="padding: 5px 0; font-family: monospace; color: #0f172a;">#${data.adId}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; color: #64748b;">Listing Type:</td>
                        <td style="padding: 5px 0; font-weight: bold; color: #0f172a;">${data.listingType || 'Boat for Sale'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; color: #64748b;">Status:</td>
                        <td style="padding: 5px 0;"><span style="background: ${awaitingApproval ? '#fef3c7' : '#dcfce7'}; color: ${awaitingApproval ? '#b45309' : '#15803d'}; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">${awaitingApproval ? 'Awaiting Approval' : 'Active'}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; color: #64748b;">Payment Date:</td>
                        <td style="padding: 5px 0; color: #0f172a;">${data.paymentDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 5px 0; color: #64748b;">${awaitingApproval ? 'Listing Period:' : 'Expiry Date:'}</td>
                        <td style="padding: 5px 0; color: #0f172a; font-weight: bold;">${data.expiryDate}</td>
                      </tr>
                      ${data.paymentRef ? `
                      <tr>
                        <td style="padding: 5px 0; color: #64748b;">Session / Payment Ref:</td>
                        <td style="padding: 5px 0; font-family: monospace; font-size: 11px; color: #64748b;">${data.paymentRef}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </div>
                  <div style="text-align: center; margin: 25px 0;">
                    ${awaitingApproval ? '' : `<a href="${data.adUrl || `${baseUrl}/anuncio/${data.adId}`}" target="_blank" style="background-color: #0284c7; color: #ffffff; padding: 12px 22px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block; font-size: 14px; margin-right: 8px; margin-bottom: 8px;">Open Listing</a>`}
                    <a href="${data.manageUrl || `${baseUrl}/profile`}" target="_blank" style="background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 12px 22px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block; font-size: 14px; margin-bottom: 8px;">My Listings</a>
                  </div>
                  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                  <p style="font-size: 12px; color: #64748b; margin: 0;">Need assistance or have questions? Contact us at <a href="mailto:contato@connectboat.co.uk" style="color: #0284c7; text-decoration: underline;">contato@connectboat.co.uk</a>.</p>
                </td>
              </tr>
              <tr style="background-color: #f1f5f9;">
                <td style="padding: 20px; text-align: center; color: #64748b; font-size: 12px;">
                  <p style="margin: 0 0 6px 0; font-weight: 700;">ConnectBoat UK</p>
                  <p style="margin: 0;">United Kingdom Marine & Boat Marketplace</p>
                  <p style="margin: 12px 0 0 0; font-size: 10px; color: #94a3b8;">This is an automated notification. Please write to contato@connectboat.co.uk for customer support.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  console.log(`[sendPaymentEmailDirect] Dispatching to Resend for ${recipientEmail}...`);

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [recipientEmail],
      reply_to: replyTo,
      subject: subject,
      html: htmlContent,
    }),
  });

  const responseText = await resendResponse.text();
  let jsonRes: any = {};
  try {
    jsonRes = JSON.parse(responseText);
  } catch (e) {
    // Raw text response
  }

  if (!resendResponse.ok) {
    const errorDetail = jsonRes.message || jsonRes.error || responseText || `HTTP ${resendResponse.status}`;
    console.error(`[sendPaymentEmailDirect] Resend API error (${resendResponse.status}):`, errorDetail);
    throw new Error(`Resend API Error (HTTP ${resendResponse.status}): ${errorDetail}`);
  }

  console.log(`[sendPaymentEmailDirect] Success! Email ID:`, jsonRes.id || 'sent');
  return jsonRes;
}

export default async function resendPaymentEmailHandler(req: Request, res: Response) {
  // Guarantee application/json content-type header for every response
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

    currentStep = '[2] Request body parsed';
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }
    console.log('[2] Request body parsed successfully');

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

    currentStep = '[4.1] Verifying authenticated staff user';
    const staffUser = await verifyStaffRequest(req, db);
    console.log(`[4.1] Staff authenticated: ${staffUser.uid} (${staffUser.role})`);

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
    let recipientEmail: string | null = null;
    let emailSource: 'listing' | 'Firestore profile' | 'Firebase Authentication' | null = null;

    // 1. Search in listing document fields first
    const listingEmailCandidate = adData.sellerEmail || adData.userEmail || adData.ownerEmail || adData.contactEmail || adData.email;
    if (typeof listingEmailCandidate === 'string' && listingEmailCandidate.trim().includes('@')) {
      recipientEmail = listingEmailCandidate.trim().toLowerCase();
      emailSource = 'listing';
      console.log(`[6] Email found in listing document: ${recipientEmail}`);
    }

    // 2. If not found, get UID from sellerId, userId, ownerId, createdBy
    const sellerUidCandidate = adData.sellerId || adData.userId || adData.ownerId || adData.createdBy;
    const sellerUid = typeof sellerUidCandidate === 'string' ? sellerUidCandidate.trim() : null;

    if (!recipientEmail && sellerUid) {
      console.log(`[6] Searching user profile in Firestore for UID: "${sellerUid}"...`);
      // 3. Search in Firestore collections users/{uid} and profiles/{uid}
      try {
        const userDocRef = db.collection('users').doc(sellerUid);
        const userDocSnap = await userDocRef.get();

        if (userDocSnap.exists) {
          const uData = userDocSnap.data() || {};
          const profileEmailCandidate = uData.email || uData.userEmail || uData.contactEmail;
          if (typeof profileEmailCandidate === 'string' && profileEmailCandidate.trim().includes('@')) {
            recipientEmail = profileEmailCandidate.trim().toLowerCase();
            emailSource = 'Firestore profile';
            console.log(`[6] Email found in Firestore users/${sellerUid}: ${recipientEmail}`);
          }
        }
      } catch (uErr: any) {
        console.warn(`[6] Firestore users/${sellerUid} lookup error:`, uErr?.message || uErr);
      }

      if (!recipientEmail) {
        try {
          const profileDocRef = db.collection('profiles').doc(sellerUid);
          const profileDocSnap = await profileDocRef.get();
          if (profileDocSnap.exists) {
            const pData = profileDocSnap.data() || {};
            const profileEmailCandidate = pData.email || pData.userEmail || pData.contactEmail;
            if (typeof profileEmailCandidate === 'string' && profileEmailCandidate.trim().includes('@')) {
              recipientEmail = profileEmailCandidate.trim().toLowerCase();
              emailSource = 'Firestore profile';
              console.log(`[6] Email found in Firestore profiles/${sellerUid}: ${recipientEmail}`);
            }
          }
        } catch (pErr: any) {
          console.warn(`[6] Firestore profiles/${sellerUid} lookup error:`, pErr?.message || pErr);
        }
      }

      // 5. If still not found, try Firebase Admin Authentication
      if (!recipientEmail) {
        console.log(`[6] Searching Firebase Authentication for UID: "${sellerUid}"...`);
        try {
          const firebaseAdmin = (admin as any).default || admin;
          const userRecord = await firebaseAdmin.auth().getUser(sellerUid);
          if (userRecord && userRecord.email && userRecord.email.includes('@')) {
            recipientEmail = userRecord.email.trim().toLowerCase();
            emailSource = 'Firebase Authentication';
            console.log(`[6] Email found in Firebase Auth for UID ${sellerUid}: ${recipientEmail}`);
          }
        } catch (authErr: any) {
          console.warn(`[6] Firebase Auth lookup failed for UID ${sellerUid}:`, authErr?.message || authErr);
        }
      }
    }

    // 6. Validate email or return clear JSON failure
    if (!recipientEmail || !recipientEmail.includes('@')) {
      console.warn(`[6] Seller email resolution failed for adId ${adId} (sellerUid: ${sellerUid || 'none'})`);
      return res.status(400).json({
        success: false,
        stepFailed: '[6] Resolving seller email',
        error: 'Seller email not found in listing, user profile or Firebase Authentication.',
        errorMessage: 'Não foi encontrado nenhum e-mail válido para este anunciante no cadastro do anúncio, perfil ou Firebase Auth.'
      });
    }

    console.log(`[6] Seller email resolved successfully: ${recipientEmail} (Source: ${emailSource})`);

    currentStep = '[7] Preparing email payload';
    const firebaseAdmin = (admin as any).default || admin;
    const isHire = adData.category === 'aluguel' || adData.listingType === 'hire' || adData.type === 'hire';
    const activePlan = (adData.plan || 'standard').toLowerCase();

    const settingsSnapshot = await db.collection('settings').doc('global').get();
    const settingsData = settingsSnapshot.exists ? (settingsSnapshot.data() || {}) : {};
    const configuredPlanPrices = settingsData.planPrices || {};

    const getValidConfiguredPrice = (value: unknown, fallback: number): number => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };

    const currentPlanPrices = {
      standard: getValidConfiguredPrice(configuredPlanPrices.standard, 4.99),
      featured: getValidConfiguredPrice(configuredPlanPrices.featured, 7.99),
      premium: getValidConfiguredPrice(configuredPlanPrices.premium, 12.99),
    };

    const normalizedPlan =
      activePlan === 'premium'
        ? 'premium'
        : (activePlan === 'featured' || activePlan === 'national' || activePlan === 'local')
          ? 'featured'
          : 'standard';

    const planTitles = {
      standard: 'Standard Listing',
      featured: 'Featured Listing',
      premium: 'Premium Featured Listing',
    };

    const planTitle = planTitles[normalizedPlan];
    const hasMediaBoost = !!adData.mediaBoostEnabled || !!adData.videoPaid;
    const mediaBoostNumeric = hasMediaBoost ? 2.00 : 0;

    // Prefer the amount that Stripe actually charged when the original
    // Checkout Session is available. This keeps a resent receipt historically
    // accurate even if plan prices are changed later in Admin Settings.
    let totalNumeric: number | null = null;
    let currencySymbol = '£';

    const stripeSessionId =
      typeof adData.stripeCheckoutSessionId === 'string'
        ? adData.stripeCheckoutSessionId.trim()
        : '';

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (stripeSessionId && stripeSecretKey) {
      try {
        const stripeResponse = await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(stripeSessionId)}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${stripeSecretKey}`,
            },
          }
        );

        if (stripeResponse.ok) {
          const stripeSession: any = await stripeResponse.json();

          if (
            typeof stripeSession.amount_total === 'number' &&
            Number.isFinite(stripeSession.amount_total)
          ) {
            totalNumeric = stripeSession.amount_total / 100;
          }

          if (typeof stripeSession.currency === 'string') {
            currencySymbol =
              stripeSession.currency.toLowerCase() === 'eur' ? '€' : '£';
          }
        } else {
          console.warn(
            `[7] Stripe Checkout Session lookup failed (${stripeResponse.status}) for ${stripeSessionId}. Falling back to configured plan prices.`
          );
        }
      } catch (stripeLookupError: any) {
        console.warn(
          `[7] Stripe Checkout Session lookup error for ${stripeSessionId}:`,
          stripeLookupError?.message || stripeLookupError
        );
      }
    }

    if (totalNumeric === null) {
      totalNumeric = currentPlanPrices[normalizedPlan] + mediaBoostNumeric;
    }

    const planNumeric = Math.max(0, totalNumeric - mediaBoostNumeric);
    const planPrice = `${currencySymbol}${planNumeric.toFixed(2)}`;

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
      mediaBoostPrice: `${currencySymbol}2.00`,
      totalAmount: `${currencySymbol}${totalNumeric.toFixed(2)}`,
      paymentDate: adData.paidAt?.toDate ? adData.paidAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      awaitingApproval: adData.status !== 'approved',
      expiryDate: adData.status === 'approved' && adData.expirationDate?.toDate
        ? adData.expirationDate.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Starts 30 days from approval',
      paymentRef: adData.stripeCheckoutSessionId || adId,
      adUrl: `${baseUrl}/anuncio/${adId}`,
      manageUrl: `${baseUrl}/profile`,
    };
    console.log('[7] Email payload prepared');

    currentStep = '[8] Calling Resend via sendPaymentEmailDirect';
    const dispatchResult = await sendPaymentEmailDirect(recipientEmail, emailPayload);
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
      recipientEmail,
      emailSource,
      dispatchResult
    });

  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Admin Resend Payment Email ERROR at step "${currentStep}"]:`, error);

    const authStatusCode =
      error?.statusCode === 401 || error?.statusCode === 403
        ? error.statusCode
        : null;

    // Authentication/authorization failures must not modify the listing.
    if (authStatusCode) {
      return res.status(authStatusCode).json({
        success: false,
        stepFailed: currentStep,
        error: error?.code || 'AUTHORIZATION_FAILED',
        errorMessage: errorMsg,
      });
    }

    // Attempt to log operational failure in Firestore without throwing.
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

