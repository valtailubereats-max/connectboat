import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let stripeClient: Stripe | null = null;

const FIRESTORE_DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is missing.');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

function getAdminDb() {
  if (!getApps().length) {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawServiceAccount) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is missing.');
    }

    const serviceAccount = JSON.parse(rawServiceAccount);

    if (typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  return getFirestore(getApp(), FIRESTORE_DATABASE_ID);
}

function getValidConfiguredPrice(value: unknown, fallback: number): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback;
  }
  return numericValue;
}

export default async function createCheckoutSessionHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const {
      itemType,
      plan,
      country,
      currency: requestedCurrency,
      userId,
      userEmail,
      adId,
      showcaseData,
      mediaBoostEnabled,
      successUrl,
      cancelUrl
    } = req.body || {};

    if (!itemType) {
      return res.status(400).json({ success: false, error: 'Missing required itemType' });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return res.status(400).json({
        success: false,
        error: 'STRIPE_NOT_CONFIGURED',
        errorMessage: 'Stripe Secret Key (STRIPE_SECRET_KEY) is not configured in environment variables.'
      });
    }

    const stripe = getStripe();

    // Determine currency: default GBP for UK, EUR for Portugal & rest
    const isUK =
      country === 'Reino Unido' ||
      country === 'United Kingdom' ||
      requestedCurrency?.toLowerCase() === 'gbp';

    const currency = isUK ? 'gbp' : 'eur';
    const currencySymbol = isUK ? '£' : '€';

    // Server-side source of truth for listing plan prices.
    // Never trust a plan price sent by the browser.
    const db = getAdminDb();
    const settingsSnapshot = await db.collection('settings').doc('global').get();
    const settingsData = settingsSnapshot.exists ? settingsSnapshot.data() : {};
    const configuredPlanPrices = settingsData?.planPrices || {};

    const standardPrice = getValidConfiguredPrice(configuredPlanPrices.standard, 2.99);
    const featuredPrice = getValidConfiguredPrice(configuredPlanPrices.featured, 4.99);
    const premiumPrice = getValidConfiguredPrice(configuredPlanPrices.premium, 9.99);

    let productName = '';
    let productDescription = '';
    let amountCents = Math.round(standardPrice * 100);

    // Calculate base plan price using the trusted Firestore settings.
    const activePlan = (plan || 'standard').toLowerCase();

    if (activePlan === 'premium') {
      amountCents = Math.round(premiumPrice * 100);
      productName = 'ConnectBoat - Premium Featured Listing';
      productDescription = `30-day top priority exposure & premium badge (${currencySymbol}${premiumPrice.toFixed(2)}) for listing ${adId ? '#' + adId : ''}`.trim();
    } else if (activePlan === 'featured' || activePlan === 'national' || activePlan === 'local') {
      amountCents = Math.round(featuredPrice * 100);
      productName = 'ConnectBoat - Featured Listing';
      productDescription = `30-day homepage highlight & featured badge (${currencySymbol}${featuredPrice.toFixed(2)}) for listing ${adId ? '#' + adId : ''}`.trim();
    } else if (activePlan === 'standard' || activePlan === 'free') {
      amountCents = Math.round(standardPrice * 100);
      productName = 'ConnectBoat - Standard Listing';
      productDescription = `30-day active listing (${currencySymbol}${standardPrice.toFixed(2)}) for listing ${adId ? '#' + adId : ''}`.trim();
    } else if (itemType === 'digital_showcase') {
      amountCents = 899;
      const name = showcaseData?.showcaseName || 'Business Showcase';
      productName = `ConnectBoat - Digital Showcase (${name})`;
      productDescription = `Monthly Digital Showcase subscription (${currencySymbol}8.99/month)`;
    } else {
      amountCents = Math.round(standardPrice * 100);
      productName = 'ConnectBoat - Standard Listing';
      productDescription = `30-day active listing (${currencySymbol}${standardPrice.toFixed(2)})`;
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency,
          product_data: {
            name: productName,
            description: productDescription,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ];

    const hasMediaBoost = !!mediaBoostEnabled;
    if (hasMediaBoost) {
      lineItems.push({
        price_data: {
          currency,
          product_data: {
            name: 'Media Boost — 60-second listing video',
            description: `Optional paid extra (${currencySymbol}2.00) to showcase video on listing`,
          },
          unit_amount: 200,
        },
        quantity: 1,
      });
    }

    const metadata: Record<string, string> = {
      itemType: String(itemType),
      userId: String(userId || ''),
      adId: String(adId || ''),
      plan: String(activePlan),
      country: String(country || ''),
      mediaBoostEnabled: hasMediaBoost ? 'true' : 'false',
    };

    if (showcaseData) {
      try {
        metadata.showcaseDataJson = JSON.stringify(showcaseData);
      } catch (e) {
        console.warn('[Stripe Session] Failed to stringify showcaseData', e);
      }
    }

    const isValidEmail =
      userEmail &&
      typeof userEmail === 'string' &&
      userEmail.includes('@');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: isValidEmail ? userEmail : undefined,
      payment_intent_data: isValidEmail
        ? {
            receipt_email: userEmail,
          }
        : undefined,
      line_items: lineItems,
      managed_payments: {
        enabled: false,
      } as any,
      metadata,
      success_url:
        successUrl ||
        `${req.headers.origin || 'http://localhost:3000'}?stripe_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        cancelUrl ||
        `${req.headers.origin || 'http://localhost:3000'}?stripe_cancel=true`,
    });

    return res.status(200).json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error('[Stripe create-checkout-session Error]:', err);
    return res.status(500).json({
      success: false,
      error: 'STRIPE_ERROR',
      errorMessage: err.message || 'Error creating Stripe checkout session'
    });
  }
}
