import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import { randomBytes, randomUUID } from 'crypto';

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
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'navlink-489413.firebasestorage.app',
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


const ADVERTISING_EXPOSURE_SECONDS = new Set([4, 6, 8, 10]);
const ADVERTISING_DURATION_DAYS = new Set([7, 14, 30]);

const ADVERTISING_CATEGORIES = new Set([
  'Boats & Yachts', 'Marine Services', 'Marinas', 'Boat Equipment & Electronics',
  'Fishing & Watersports', 'Coastal Hotels & Resorts', 'Waterfront Restaurants & Hospitality',
  'Luxury Travel & Tourism', 'Aviation & Helicopters', 'Marine Property & Real Estate',
  'Insurance & Finance', 'Automotive & Towing', 'Other Marine-Related Business',
]);

function getAdvertisingPrice(settings: any, seconds: number, days: number): number {
  const map: Record<number, number> = {
    4: Number(settings?.price4s30d || 0),
    6: Number(settings?.price6s30d || 0),
    8: Number(settings?.price8s30d || 0),
    10: Number(settings?.price10s30d || 0),
  };

  const thirtyDayPrice = map[seconds] || 0;
  return Math.round((thirtyDayPrice * days / 30) * 100) / 100;
}

function stripDataUrl(value: string) {
  if (!value) return null;
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function xmlEscape(value: string) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }[character] as string));
}

async function saveAdvertisingImage(orderId: string, option: number, pngBuffer: Buffer) {
  const bucket = getStorage(getApp()).bucket(
    process.env.FIREBASE_STORAGE_BUCKET || 'navlink-489413.firebasestorage.app'
  );

  const token = randomUUID();
  const filePath = `advertising/generated/${orderId}/option-${Date.now()}-${option}.png`;
  const file = bucket.file(filePath);

  await file.save(pngBuffer, {
    resumable: false,
    metadata: {
      contentType: 'image/png',
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
}

async function advertisingCreateCheckout(req: Request, res: Response) {
  const {
    advertiserName,
    contactEmail,
    targetUrl,
    businessCategory,
    displaySeconds,
    durationDays,
    successUrl,
    cancelUrl,
  } = req.body || {};

  const seconds = Number(displaySeconds);
  const days = Number(durationDays);

  if (!advertiserName || !contactEmail || !targetUrl) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_FIELDS',
      errorMessage: 'Business name, email and destination website are required.',
    });
  }

  if (!businessCategory || !ADVERTISING_CATEGORIES.has(String(businessCategory))) {
    return res.status(400).json({ success: false, error: 'INVALID_ADVERTISING_CATEGORY', errorMessage: 'Choose a business category relevant to the ConnectBoat audience.' });
  }

  if (!/^https?:\/\//i.test(String(targetUrl))) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_URL',
      errorMessage: 'Destination website must start with http:// or https://',
    });
  }

  if (!ADVERTISING_EXPOSURE_SECONDS.has(seconds) || !ADVERTISING_DURATION_DAYS.has(days)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_ADVERTISING_PACKAGE',
      errorMessage: 'Invalid advertising exposure or duration.',
    });
  }

  const db = getAdminDb();
  const settingsSnapshot = await db.collection('settings').doc('advertisingSales').get();
  const settings = settingsSnapshot.exists ? settingsSnapshot.data() || {} : {};

  if (settings.enabled !== true) {
    return res.status(400).json({
      success: false,
      error: 'ADVERTISING_SALES_DISABLED',
      errorMessage: 'Online advertising sales are currently disabled.',
    });
  }

  const amount = getAdvertisingPrice(settings, seconds, days);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'ADVERTISING_PRICE_NOT_CONFIGURED',
      errorMessage: 'This advertising package has no configured price.',
    });
  }

  const accessToken = randomBytes(24).toString('hex');
  const orderRef = db.collection('advertisingOrders').doc();

  await orderRef.set({
    advertiserName: String(advertiserName).trim(),
    contactEmail: String(contactEmail).trim().toLowerCase(),
    targetUrl: String(targetUrl).trim(),
    businessCategory: String(businessCategory),
    displaySeconds: seconds,
    durationDays: days,
    amountExpected: amount,
    currency: 'GBP',
    paymentStatus: 'pending',
    workflowStatus: 'awaiting_payment',
    accessToken,
    aiGenerationsIncluded: Math.max(1, Math.min(5, Number(settings.aiGenerationsIncluded || 3))),
    generationCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const origin = String(successUrl || 'https://connectboat.co.uk/advertise?payment=success').split('?')[0];
  const cancelOrigin = String(cancelUrl || 'https://connectboat.co.uk/advertise?payment=cancelled').split('?')[0];

  const success = `${origin}?payment=success&order_id=${encodeURIComponent(orderRef.id)}&access_token=${encodeURIComponent(accessToken)}`;
  const cancel = `${cancelOrigin}?payment=cancelled&order_id=${encodeURIComponent(orderRef.id)}&access_token=${encodeURIComponent(accessToken)}`;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: String(contactEmail).trim().toLowerCase(),
    payment_intent_data: {
      receipt_email: String(contactEmail).trim().toLowerCase(),
    },
    line_items: [{
      price_data: {
        currency: 'gbp',
        product_data: {
          name: `ConnectBoat Advertising — ${seconds}s exposure`,
          description: `${days}-day rotating banner campaign with AI Banner Creator and ConnectBoat approval`,
        },
        unit_amount: Math.round(amount * 100),
      },
      quantity: 1,
    }],
    managed_payments: {
      enabled: false,
    } as any,
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
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return res.status(200).json({
    success: true,
    url: session.url,
    checkoutUrl: session.url,
    sessionId: session.id,
    orderId: orderRef.id,
  });
}

async function advertisingGetOrder(req: Request, res: Response) {
  const { orderId, accessToken } = req.body || {};

  if (!orderId || !accessToken) {
    return res.status(400).json({ success: false, error: 'Missing advertising order access details.' });
  }

  const snapshot = await getAdminDb().collection('advertisingOrders').doc(String(orderId)).get();

  if (!snapshot.exists) {
    return res.status(404).json({ success: false, error: 'Advertising order not found.' });
  }

  const data = snapshot.data() || {};
  if (data.accessToken !== accessToken) {
    return res.status(403).json({ success: false, error: 'Invalid advertising order access token.' });
  }

  return res.status(200).json({
    success: true,
    order: {
      id: snapshot.id,
      paymentStatus: data.paymentStatus || 'pending',
      workflowStatus: data.workflowStatus || 'awaiting_payment',
      advertiserName: data.advertiserName || '',
      targetUrl: data.targetUrl || '',
      businessCategory: data.businessCategory || '',
      displaySeconds: Number(data.displaySeconds || 4),
      durationDays: Number(data.durationDays || 30),
      amountPaid: typeof data.amountPaid === 'number' ? data.amountPaid : null,
      currency: data.currency || 'GBP',
      generatedBanners: Array.isArray(data.generatedBanners) ? data.generatedBanners : [],
      selectedBannerUrl: data.selectedBannerUrl || '',
      adminProposalUrl: data.adminProposalUrl || '',
      adminProposalMessage: data.adminProposalMessage || '',
      customerNote: data.customerNote || '',
      adminIntervened: data.adminIntervened === true,
      generationCount: Number(data.generationCount || 0),
      aiGenerationsIncluded: Number(data.aiGenerationsIncluded || 3),
      adminNote: data.adminNote || '',
    },
  });
}

async function generateAiBackground(
  ai: GoogleGenAI,
  prompt: string,
  reference: { mimeType: string; data: string } | null
) {
  const contents: any = reference
    ? {
        parts: [
          { inlineData: { mimeType: reference.mimeType, data: reference.data } },
          { text: prompt },
        ],
      }
    : prompt;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image',
    contents,
    config: {
      responseModalities: ['IMAGE'],
      responseFormat: {
        image: {
          aspectRatio: '21:9',
          imageSize: '2K',
        },
      },
    } as any,
  });

  const parts = response?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part: any) => part?.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    throw new Error('Gemini did not return an image.');
  }

  return Buffer.from(imagePart.inlineData.data, 'base64');
}

async function advertisingGenerateBanner(req: Request, res: Response) {
  const {
    orderId,
    accessToken,
    advertiserName,
    headline,
    subheadline,
    cta,
    style,
    brief,
    logoDataUrl,
    referenceDataUrl,
  } = req.body || {};

  if (!orderId || !accessToken || !headline) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_DESIGN_FIELDS',
      errorMessage: 'Order access and a main headline are required.',
    });
  }

  const db = getAdminDb();
  const orderRef = db.collection('advertisingOrders').doc(String(orderId));
  const snapshot = await orderRef.get();

  if (!snapshot.exists) {
    return res.status(404).json({ success: false, error: 'Advertising order not found.' });
  }

  const order = snapshot.data() || {};
  if (order.accessToken !== accessToken) {
    return res.status(403).json({ success: false, error: 'Invalid advertising order access token.' });
  }

  if (order.paymentStatus !== 'paid') {
    return res.status(402).json({
      success: false,
      error: 'PAYMENT_REQUIRED',
      errorMessage: 'Payment must be confirmed before AI banner generation.',
    });
  }

  const allowedRounds = Math.max(1, Math.min(5, Number(order.aiGenerationsIncluded || 3)));
  const usedRounds = Number(order.generationCount || 0);

  if (usedRounds >= allowedRounds) {
    return res.status(400).json({
      success: false,
      error: 'AI_GENERATION_ALLOWANCE_USED',
      errorMessage: `This campaign includes ${allowedRounds} AI generation round${allowedRounds === 1 ? '' : 's'}.`,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const reference = stripDataUrl(String(referenceDataUrl || ''));
  const logo = stripDataUrl(String(logoDataUrl || ''));

  const brand = String(advertiserName || order.advertiserName || 'Advertiser').trim().slice(0, 50);
  const mainHeadline = String(headline).trim().slice(0, 60);
  const supportingText = String(subheadline || '').trim().slice(0, 88);
  const callToAction = String(cta || 'Learn More').trim().slice(0, 24);
  const visualStyle = String(style || 'Premium Marine').trim().slice(0, 40);
  const businessBrief = String(brief || '').trim().slice(0, 400);

  const variants = [
    'premium marine photography, calm clean composition, refined blue tones',
    'high-end minimalist commercial photography, elegant negative space and premium lighting',
    'bold modern advertising photography, dynamic professional composition and strong visual impact',
  ];

  const urls: string[] = [];

  for (let index = 0; index < 3; index += 1) {
    const backgroundPrompt = `
Create only the photographic or illustrative BACKGROUND for a very wide professional website advertising banner.
Do not add any words, letters, logos, numbers, buttons, watermarks, UI or branding.
Business: ${brand}
Style: ${visualStyle}
Brief: ${businessBrief || 'Professional business advertising to UK boat owners and marine customers.'}
Visual direction: ${variants[index]}
Keep the important visual subject mainly on the RIGHT HALF.
Keep the LEFT HALF calmer and darker because large readable text will be added there later.
Premium, commercial, realistic, clean and suitable for the ConnectBoat UK marine marketplace.
`;

    const rawBackground = await generateAiBackground(ai, backgroundPrompt, reference);

    const background = await sharp(rawBackground)
      .resize(1600, 240, { fit: 'cover', position: 'centre' })
      .modulate({ brightness: 0.96, saturation: 0.92 })
      .png()
      .toBuffer();

    const buttonWidth = Math.max(150, Math.min(310, callToAction.length * 12 + 48));

    const overlaySvg = Buffer.from(`
      <svg width="1600" height="240" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="shade" x1="0" x2="1">
            <stop offset="0%" stop-color="#071426" stop-opacity="0.96"/>
            <stop offset="48%" stop-color="#071426" stop-opacity="0.78"/>
            <stop offset="75%" stop-color="#071426" stop-opacity="0.16"/>
            <stop offset="100%" stop-color="#071426" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <rect width="1600" height="240" fill="url(#shade)"/>
        <text x="54" y="48" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="#7dd3fc">${xmlEscape(brand.toUpperCase())}</text>
        <text x="54" y="104" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="900" fill="#ffffff">${xmlEscape(mainHeadline)}</text>
        ${supportingText ? `<text x="54" y="143" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="500" fill="#dbeafe">${xmlEscape(supportingText)}</text>` : ''}
        <rect x="54" y="171" width="${buttonWidth}" height="44" rx="12" fill="#2563eb"/>
        <text x="76" y="199" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="800" fill="#ffffff">${xmlEscape(callToAction)}</text>
      </svg>
    `);

    const overlays: sharp.OverlayOptions[] = [
      { input: overlaySvg, top: 0, left: 0 },
    ];

    if (logo) {
      try {
        const logoBuffer = await sharp(Buffer.from(logo.data, 'base64'))
          .resize({ width: 180, height: 62, fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();

        overlays.push({
          input: logoBuffer,
          top: 18,
          left: 1385,
        });
      } catch (logoError) {
        console.warn('[Advertising AI] Logo could not be added:', logoError);
      }
    }

    const finalBanner = await sharp(background)
      .composite(overlays)
      .png({ compressionLevel: 8 })
      .toBuffer();

    urls.push(await saveAdvertisingImage(String(orderId), index + 1, finalBanner));
  }

  await orderRef.set({
    generatedBanners: urls,
    generationCount: usedRounds + 1,
    workflowStatus: 'design_generated',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return res.status(200).json({
    success: true,
    bannerUrls: urls,
  });
}


async function advertisingPrepareReadyBannerUpload(req: Request, res: Response) {
  const {
    orderId,
    accessToken,
    fileName,
    mimeType,
    width,
    height,
    fileSize,
  } = req.body || {};

  if (!orderId || !accessToken || !fileName || !mimeType) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_READY_BANNER_FIELDS',
      errorMessage: 'Order access and banner file details are required.',
    });
  }

  const db = getAdminDb();
  const orderRef = db.collection('advertisingOrders').doc(String(orderId));
  const snapshot = await orderRef.get();

  if (!snapshot.exists) {
    return res.status(404).json({
      success: false,
      error: 'ADVERTISING_ORDER_NOT_FOUND',
      errorMessage: 'Advertising order not found.',
    });
  }

  const order = snapshot.data() || {};

  if (order.accessToken !== accessToken) {
    return res.status(403).json({
      success: false,
      error: 'INVALID_ADVERTISING_ACCESS_TOKEN',
      errorMessage: 'Invalid advertising order access token.',
    });
  }

  if (order.paymentStatus !== 'paid') {
    return res.status(402).json({
      success: false,
      error: 'PAYMENT_REQUIRED',
      errorMessage: 'Payment must be confirmed before submitting a banner.',
    });
  }

  const parsedWidth = Number(width || 0);
  const parsedHeight = Number(height || 0);
  const parsedFileSize = Number(fileSize || 0);

  if (!['image/png', 'image/jpeg', 'image/webp'].includes(String(mimeType))) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_BANNER_FILE',
      errorMessage: 'Use a PNG, JPG/JPEG or WebP banner image.',
    });
  }

  if (parsedFileSize > 8 * 1024 * 1024) {
    return res.status(400).json({
      success: false,
      error: 'BANNER_FILE_TOO_LARGE',
      errorMessage: 'The advertising image must be 8MB or smaller.',
    });
  }

  const ratio = parsedWidth / Math.max(1, parsedHeight);
  const standardRatio = 16 / 9;
  if (
    parsedWidth <= parsedHeight ||
    parsedWidth < 1280 || parsedHeight < 720 ||
    parsedWidth > 3840 || parsedHeight > 2160 ||
    Math.abs(ratio - standardRatio) > 0.025
  ) {
    return res.status(400).json({
      success: false,
      error: 'BANNER_DIMENSIONS_NOT_SUITABLE',
      errorMessage: `Advertising artwork must be horizontal 16:9, between 1280×720 and 3840×2160. Received ${parsedWidth}×${parsedHeight}px.`,
    });
  }

  const bucket = getStorage(getApp()).bucket(
    process.env.FIREBASE_STORAGE_BUCKET || 'navlink-489413.firebasestorage.app'
  );

  const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '-');
  const objectPath = `advertising/customer-ready/${String(orderId)}/${Date.now()}_${safeName}`;
  const file = bucket.file(objectPath);

  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 10 * 60 * 1000,
    contentType: String(mimeType),
  });

  await orderRef.set({
    pendingReadyBannerPath: objectPath,
    pendingReadyBannerWidth: parsedWidth,
    pendingReadyBannerHeight: parsedHeight,
    pendingReadyBannerMimeType: String(mimeType),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return res.status(200).json({
    success: true,
    uploadUrl,
    objectPath,
  });
}

async function advertisingFinalizeReadyBannerUpload(req: Request, res: Response) {
  const {
    orderId,
    accessToken,
    objectPath,
    customerNote,
  } = req.body || {};

  if (!orderId || !accessToken || !objectPath) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_FINALIZE_FIELDS',
      errorMessage: 'Missing banner upload confirmation details.',
    });
  }

  const db = getAdminDb();
  const orderRef = db.collection('advertisingOrders').doc(String(orderId));
  const snapshot = await orderRef.get();

  if (!snapshot.exists) {
    return res.status(404).json({
      success: false,
      error: 'ADVERTISING_ORDER_NOT_FOUND',
      errorMessage: 'Advertising order not found.',
    });
  }

  const order = snapshot.data() || {};

  if (order.accessToken !== accessToken) {
    return res.status(403).json({
      success: false,
      error: 'INVALID_ADVERTISING_ACCESS_TOKEN',
      errorMessage: 'Invalid advertising order access token.',
    });
  }

  if (order.paymentStatus !== 'paid') {
    return res.status(402).json({
      success: false,
      error: 'PAYMENT_REQUIRED',
      errorMessage: 'Payment must be confirmed before submitting a banner.',
    });
  }

  if (order.pendingReadyBannerPath !== objectPath) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_BANNER_UPLOAD_PATH',
      errorMessage: 'This uploaded banner does not match the current advertising order.',
    });
  }

  const bucket = getStorage(getApp()).bucket(
    process.env.FIREBASE_STORAGE_BUCKET || 'navlink-489413.firebasestorage.app'
  );
  const file = bucket.file(String(objectPath));

  const [exists] = await file.exists();
  if (!exists) {
    return res.status(400).json({
      success: false,
      error: 'BANNER_UPLOAD_NOT_FOUND',
      errorMessage: 'The banner upload was not found. Please try again.',
    });
  }

  const [sourceBuffer] = await file.download();

  // Preserve the customer's approved 16:9 composition exactly: no crop, no stretch and no background fill.
  // We only rotate EXIF orientation and web-optimize the file.
  const pipeline = sharp(sourceBuffer).rotate();
  const sourceMeta = await pipeline.metadata();
  const normalizedWidth = Math.min(1920, Number(sourceMeta.width || order.pendingReadyBannerWidth || 1920));
  const finalBanner = await sharp(sourceBuffer)
    .rotate()
    .resize({ width: normalizedWidth, withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: 88 })
    .toBuffer();
  const finalMeta = await sharp(finalBanner).metadata();

  const downloadToken = randomUUID();
  const finalPath = `advertising/customer-ready/${String(orderId)}/final-${Date.now()}.webp`;
  const finalFile = bucket.file(finalPath);

  await finalFile.save(finalBanner, {
    resumable: false,
    metadata: {
      contentType: 'image/webp',
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  const bannerUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(finalPath)}` +
    `?alt=media&token=${downloadToken}`;

  await orderRef.set({
    generatedBanners: [bannerUrl],
    selectedBannerUrl: bannerUrl,
    workflowStatus: 'pending_approval',
    designSource: 'customer_16x9_artwork',
    originalBannerWidth: Number(order.pendingReadyBannerWidth || 0),
    originalBannerHeight: Number(order.pendingReadyBannerHeight || 0),
    originalBannerMimeType: String(order.pendingReadyBannerMimeType || ''),
    adaptedBannerWidth: Number(finalMeta.width || 0),
    adaptedBannerHeight: Number(finalMeta.height || 0),
    submittedForApprovalAt: FieldValue.serverTimestamp(),
    customerNote: String(customerNote || '').trim().slice(0, 1000),
    adminNote: '',
    adminProposalUrl: FieldValue.delete(),
    adminProposalMessage: FieldValue.delete(),
    pendingReadyBannerPath: FieldValue.delete(),
    pendingReadyBannerWidth: FieldValue.delete(),
    pendingReadyBannerHeight: FieldValue.delete(),
    pendingReadyBannerMimeType: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  try {
    await file.delete();
  } catch (cleanupError) {
    console.warn('[Advertising ready banner] Temporary source cleanup failed:', cleanupError);
  }

  return res.status(200).json({
    success: true,
    bannerUrl,
    workflowStatus: 'pending_approval',
    adaptedDimensions: { width: Number(finalMeta.width || 0), height: Number(finalMeta.height || 0) },
  });
}


async function publishAdvertisingCampaignFromOrder(
  orderRef: any,
  order: any,
  imageUrl: string,
  approvedBy: string
) {
  const db = getAdminDb();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setDate(end.getDate() + Math.max(1, Number(order.durationDays || 30)) - 1);
  const startDate = now.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  const amountPaid = Number(order.amountPaid || 0);
  const paidDate = order.paidDate || new Date().toISOString().slice(0, 10);

  let campaignId = String(order.campaignId || '');
  if (campaignId) {
    await db.collection('advertisingCampaigns').doc(campaignId).set({
      enabled: true,
      imageUrl,
      targetUrl: order.targetUrl || '',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } else {
    const campaignRef = await db.collection('advertisingCampaigns').add({
      enabled: true,
      advertiserName: order.advertiserName || 'Advertiser',
      businessCategory: order.businessCategory || '',
      imageUrl,
      targetUrl: order.targetUrl || '',
      altText: `${order.advertiserName || 'Advertiser'} sponsored banner`,
      displaySeconds: Number(order.displaySeconds || 4),
      startDate,
      endDate,
      amountPaid: Number.isFinite(amountPaid) ? Math.round(amountPaid * 100) / 100 : 0,
      currency: order.currency || 'GBP',
      paymentStatus: 'paid',
      paidDate,
      stripeFee: typeof order.stripeFee === 'number' ? order.stripeFee : 0,
      stripeNetReceived: typeof order.stripeNetReceived === 'number' ? order.stripeNetReceived : null,
      stripeCheckoutSessionId: order.stripeCheckoutSessionId || '',
      stripePaymentIntentId: order.stripePaymentIntentId || '',
      orderId: orderRef.id,
      source: 'customer_checkout',
      impressions: 0,
      clicks: 0,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: approvedBy,
      updatedAt: FieldValue.serverTimestamp(),
    });
    campaignId = campaignRef.id;
  }

  await orderRef.set({
    workflowStatus: 'approved',
    selectedBannerUrl: imageUrl,
    approvedAt: FieldValue.serverTimestamp(),
    approvedBy,
    campaignId,
    campaignStartDate: startDate,
    campaignEndDate: endDate,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { campaignId, startDate, endDate };
}

async function advertisingCustomerReviewAdminProposal(req: Request, res: Response) {
  const { orderId, accessToken, decision, customerMessage } = req.body || {};
  if (!orderId || !accessToken || !['approve', 'reject'].includes(String(decision))) {
    return res.status(400).json({ success: false, error: 'Missing customer review details.' });
  }

  const db = getAdminDb();
  const orderRef = db.collection('advertisingOrders').doc(String(orderId));
  const snapshot = await orderRef.get();
  if (!snapshot.exists) {
    return res.status(404).json({ success: false, error: 'Advertising order not found.' });
  }

  const order = snapshot.data() || {};
  if (order.accessToken !== accessToken) {
    return res.status(403).json({ success: false, error: 'Invalid advertising order access token.' });
  }
  if (order.paymentStatus !== 'paid') {
    return res.status(402).json({ success: false, error: 'Payment is not confirmed.' });
  }
  if (order.workflowStatus !== 'customer_review' || !order.adminProposalUrl) {
    return res.status(400).json({ success: false, error: 'There is no admin proposal waiting for review.' });
  }

  if (decision === 'reject') {
    const note = String(customerMessage || '').trim();
    if (!note) {
      return res.status(400).json({ success: false, error: 'Tell ConnectBoat what you would like changed.' });
    }
    await orderRef.set({
      workflowStatus: 'customer_rejected_admin_proposal',
      customerNote: note.slice(0, 1000),
      customerRespondedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return res.status(200).json({ success: true, workflowStatus: 'customer_rejected_admin_proposal' });
  }

  const published = await publishAdvertisingCampaignFromOrder(
    orderRef,
    order,
    String(order.adminProposalUrl),
    'customer_approved_admin_proposal'
  );

  await orderRef.set({
    customerNote: String(customerMessage || '').trim().slice(0, 1000),
    customerRespondedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return res.status(200).json({
    success: true,
    workflowStatus: 'approved',
    campaignId: published.campaignId,
  });
}

async function advertisingSelectBanner(req: Request, res: Response) {
  const { orderId, accessToken, selectedBannerUrl } = req.body || {};

  if (!orderId || !accessToken || !selectedBannerUrl) {
    return res.status(400).json({ success: false, error: 'Missing banner selection details.' });
  }

  const db = getAdminDb();
  const orderRef = db.collection('advertisingOrders').doc(String(orderId));
  const snapshot = await orderRef.get();

  if (!snapshot.exists) {
    return res.status(404).json({ success: false, error: 'Advertising order not found.' });
  }

  const order = snapshot.data() || {};
  if (order.accessToken !== accessToken) {
    return res.status(403).json({ success: false, error: 'Invalid advertising order access token.' });
  }

  if (order.paymentStatus !== 'paid') {
    return res.status(402).json({ success: false, error: 'Payment is not confirmed.' });
  }

  const generated = Array.isArray(order.generatedBanners) ? order.generatedBanners : [];
  if (!generated.includes(selectedBannerUrl)) {
    return res.status(400).json({ success: false, error: 'Selected banner is not part of this campaign.' });
  }

  await orderRef.set({
    selectedBannerUrl,
    workflowStatus: 'pending_approval',
    submittedForApprovalAt: FieldValue.serverTimestamp(),
    adminNote: '',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return res.status(200).json({ success: true });
}

export default async function createCheckoutSessionHandler(req: Request, res: Response) {
  if (req.method === 'POST') {
    const advertisingAction = String(req.body?.action || '');

    try {
      if (advertisingAction === 'advertising_create_checkout') {
        return await advertisingCreateCheckout(req, res);
      }
      if (advertisingAction === 'advertising_get_order') {
        return await advertisingGetOrder(req, res);
      }
      if (advertisingAction === 'advertising_prepare_ready_banner_upload') {
        return await advertisingPrepareReadyBannerUpload(req, res);
      }
      if (advertisingAction === 'advertising_finalize_ready_banner_upload') {
        return await advertisingFinalizeReadyBannerUpload(req, res);
      }
      if (advertisingAction === 'advertising_customer_review_admin_proposal') {
        return await advertisingCustomerReviewAdminProposal(req, res);
      }
      if (advertisingAction === 'advertising_select_banner') {
        return await advertisingSelectBanner(req, res);
      }
    } catch (advertisingError: any) {
      console.error('[Advertising consolidated endpoint]', advertisingError);
      return res.status(500).json({
        success: false,
        error: 'ADVERTISING_ACTION_FAILED',
        errorMessage: advertisingError?.message || 'Advertising request failed.',
      });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const {
      itemType,
      plan,
      country,
      category,
      currency: requestedCurrency,
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
    const db = getAdminDb();

    let authenticatedUserId = '';
    let authenticatedUserEmail = '';
    let authenticatedAdData: Record<string, any> | null = null;

    if (itemType === 'ad_listing') {
      const authHeader = req.headers.authorization || '';
      const match = authHeader.match(/^Bearer\s+(.+)$/i);

      if (!match) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHENTICATED',
          errorMessage: 'Authentication is required to start Stripe Checkout.'
        });
      }

      let decodedToken;
      try {
        decodedToken = await getAuth(getApp()).verifyIdToken(match[1]);
      } catch (authError) {
        console.warn('[Stripe Session] Invalid Firebase ID token', authError);
        return res.status(401).json({
          success: false,
          error: 'INVALID_AUTH_TOKEN',
          errorMessage: 'Your login session is invalid or expired. Please sign in again.'
        });
      }

      authenticatedUserId = decodedToken.uid;
      authenticatedUserEmail =
        typeof decodedToken.email === 'string' ? decodedToken.email : '';

      if (!adId || typeof adId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'MISSING_AD_ID',
          errorMessage: 'A valid listing ID is required for payment.'
        });
      }

      const adSnapshot = await db.collection('ads').doc(adId).get();

      if (!adSnapshot.exists) {
        return res.status(404).json({
          success: false,
          error: 'AD_NOT_FOUND',
          errorMessage: 'The listing could not be found before payment.'
        });
      }

      const adData = adSnapshot.data() || {};
      authenticatedAdData = adData;
      if (adData.sellerId !== authenticatedUserId) {
        return res.status(403).json({
          success: false,
          error: 'AD_OWNERSHIP_MISMATCH',
          errorMessage: 'You are not authorised to pay for this listing.'
        });
      }
    }

    // Determine currency: default GBP for UK, EUR for Portugal & rest
    const isUK =
      country === 'Reino Unido' ||
      country === 'United Kingdom' ||
      requestedCurrency?.toLowerCase() === 'gbp';

    const currency = isUK ? 'gbp' : 'eur';
    const currencySymbol = isUK ? '£' : '€';

    // Server-side source of truth for listing plan prices.
    // Never trust a plan price sent by the browser.
    const settingsSnapshot = await db.collection('settings').doc('global').get();
    const settingsData = settingsSnapshot.exists ? settingsSnapshot.data() : {};
    const configuredPlanPrices = settingsData?.planPrices || {};

    const standardPrice = getValidConfiguredPrice(configuredPlanPrices.standard, 4.99);
    const featuredPrice = getValidConfiguredPrice(configuredPlanPrices.featured, 7.99);
    const premiumPrice = getValidConfiguredPrice(configuredPlanPrices.premium, 12.99);

    let productName = '';
    let productDescription = '';
    let amountCents = Math.round(standardPrice * 100);

    // Calculate base plan price using the trusted Firestore settings.
    const activePlan = (plan || 'standard').toLowerCase();
    const savedListingCategory = String(authenticatedAdData?.category || category || '').trim();
    const isPaidBoatListing =
      itemType === 'ad_listing' &&
      (savedListingCategory === 'Boats for Sale' || savedListingCategory === 'Boats for Hire');

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

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // The listing fee is charged only for Boats for Sale and Boats for Hire.
    // Other categories remain free; Stripe is used only when a paid extra is selected.
    if (itemType !== 'ad_listing' || isPaidBoatListing) {
      lineItems.push({
        price_data: {
          currency,
          product_data: {
            name: productName,
            description: productDescription,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      });
    }

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

    if (lineItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'NO_PAYMENT_REQUIRED',
        errorMessage: 'This listing category is free and no paid extra was selected.'
      });
    }

    const metadata: Record<string, string> = {
      itemType: String(itemType),
      userId: String(itemType === 'ad_listing' ? authenticatedUserId : ''),
      adId: String(adId || ''),
      plan: String(activePlan),
      country: String(country || ''),
      category: savedListingCategory,
      mediaBoostEnabled: hasMediaBoost ? 'true' : 'false',
    };

    if (showcaseData) {
      try {
        metadata.showcaseDataJson = JSON.stringify(showcaseData);
      } catch (e) {
        console.warn('[Stripe Session] Failed to stringify showcaseData', e);
      }
    }

    const checkoutEmail =
      itemType === 'ad_listing' ? authenticatedUserEmail : '';

    const isValidEmail =
      checkoutEmail &&
      typeof checkoutEmail === 'string' &&
      checkoutEmail.includes('@');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: isValidEmail ? checkoutEmail : undefined,
      payment_intent_data: isValidEmail
        ? {
            receipt_email: checkoutEmail,
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
