import type { Request, Response } from 'express';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { randomBytes } from 'crypto';

const PROJECT_ID = 'navlink-489413';
const DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';

let stripeClient: Stripe | null = null;
let dbInstance: FirebaseFirestore.Firestore | null = null;

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is missing.');
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

function getDb() {
  const firebaseAdmin = (admin as any).default || admin;
  if (!firebaseAdmin.apps?.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is missing.');
    let serviceAccount: any;
    try { serviceAccount = JSON.parse(raw); }
    catch { serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8')); }
    if (typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount),
      projectId: PROJECT_ID,
    });
  }
  if (!dbInstance) {
    dbInstance = firebaseAdmin.firestore();
    try { dbInstance.settings({ databaseId: DATABASE_ID }); } catch {}
  }
  return dbInstance;
}

const validSeconds = new Set([4, 6, 8, 10]);
const validDays = new Set([7, 14, 30]);

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  try {
    const { advertiserName, contactEmail, targetUrl, displaySeconds, durationDays, successUrl, cancelUrl } = req.body || {};

    if (!advertiserName || !contactEmail || !targetUrl) {
      return res.status(400).json({ success: false, error: 'MISSING_FIELDS', errorMessage: 'Business name, email and website are required.' });
    }
    if (!/^https?:\/\//i.test(String(targetUrl))) {
      return res.status(400).json({ success: false, error: 'INVALID_URL', errorMessage: 'Website URL must start with http:// or https://' });
    }

    const seconds = Number(displaySeconds);
    const days = Number(durationDays);
    if (!validSeconds.has(seconds) || !validDays.has(days)) {
      return res.status(400).json({ success: false, error: 'INVALID_PACKAGE', errorMessage: 'Invalid advertising package.' });
    }

    const db = getDb();
    const settingsSnap = await db.collection('settings').doc('advertisingSales').get();
    const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};

    if (settings.enabled !== true) {
      return res.status(400).json({ success: false, error: 'SALES_DISABLED', errorMessage: 'Online advertising sales are currently disabled.' });
    }

    const priceMap: Record<number, number> = {
      4: Number(settings.price4s30d || 0),
      6: Number(settings.price6s30d || 0),
      8: Number(settings.price8s30d || 0),
      10: Number(settings.price10s30d || 0),
    };

    const price30 = priceMap[seconds];
    if (!Number.isFinite(price30) || price30 <= 0) {
      return res.status(400).json({ success: false, error: 'PRICE_NOT_CONFIGURED', errorMessage: 'This advertising package has no configured price.' });
    }

    const amount = Math.round((price30 * days / 30) * 100) / 100;
    const amountCents = Math.round(amount * 100);

    const accessToken = randomBytes(24).toString('hex');
    const orderRef = db.collection('advertisingOrders').doc();

    await orderRef.set({
      advertiserName: String(advertiserName).trim(),
      contactEmail: String(contactEmail).trim().toLowerCase(),
      targetUrl: String(targetUrl).trim(),
      displaySeconds: seconds,
      durationDays: days,
      amountExpected: amount,
      currency: 'GBP',
      paymentStatus: 'pending',
      workflowStatus: 'awaiting_payment',
      accessToken,
      aiGenerationsIncluded: Math.max(1, Math.min(5, Number(settings.aiGenerationsIncluded || 3))),
      generationCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const origin = String(successUrl || 'https://connectboat.co.uk/advertise?payment=success').split('?')[0];
    const cancelOrigin = String(cancelUrl || 'https://connectboat.co.uk/advertise?payment=cancelled').split('?')[0];

    const success = `${origin}?payment=success&order_id=${encodeURIComponent(orderRef.id)}&access_token=${encodeURIComponent(accessToken)}`;
    const cancel = `${cancelOrigin}?payment=cancelled&order_id=${encodeURIComponent(orderRef.id)}&access_token=${encodeURIComponent(accessToken)}`;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: String(contactEmail).trim().toLowerCase(),
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: `ConnectBoat Advertising — ${seconds}s exposure`,
            description: `${days}-day rotating banner campaign with AI banner creator and admin approval`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      metadata: {
        itemType: 'advertising_campaign',
        advertisingOrderId: orderRef.id,
        displaySeconds: String(seconds),
        durationDays: String(days),
      },
      success_url: success,
      cancel_url: cancel,
    });

    await orderRef.set({
      stripeCheckoutSessionId: session.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(200).json({
      success: true,
      checkoutUrl: session.url,
      orderId: orderRef.id,
    });
  } catch (error: any) {
    console.error('[Advertising Checkout]', error);
    return res.status(500).json({
      success: false,
      error: 'ADVERTISING_CHECKOUT_FAILED',
      errorMessage: error?.message || 'Unable to start advertising checkout.',
    });
  }
}
