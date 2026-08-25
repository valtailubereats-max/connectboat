import type { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

const PROJECT_ID = 'navlink-489413';
const DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';
let dbInstance: FirebaseFirestore.Firestore | null = null;

function getFirebaseAdmin() {
  const firebaseAdmin = (admin as any).default || admin;
  if (!firebaseAdmin.apps?.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is missing.');
    let serviceAccount: any;
    try { serviceAccount = JSON.parse(raw); }
    catch { serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8')); }
    if (typeof serviceAccount.private_key === 'string') serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount),
      projectId: PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'navlink-489413.firebasestorage.app',
    });
  }
  return firebaseAdmin;
}

function getDb() {
  const firebaseAdmin = getFirebaseAdmin();
  if (!dbInstance) {
    dbInstance = firebaseAdmin.firestore();
    try { dbInstance.settings({ databaseId: DATABASE_ID }); } catch {}
  }
  return dbInstance;
}

function stripDataUrl(value: string) {
  if (!value) return null;
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function esc(value: string) {
  return String(value || '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  }[ch] as string));
}

async function savePublicPng(orderId: string, index: number, buffer: Buffer) {
  const firebaseAdmin = getFirebaseAdmin();
  const bucket = firebaseAdmin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET || 'navlink-489413.firebasestorage.app');
  const token = randomUUID();
  const filePath = `advertising/generated/${orderId}/option-${Date.now()}-${index}.png`;
  const file = bucket.file(filePath);

  await file.save(buffer, {
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

async function generateBackground(ai: GoogleGenAI, prompt: string, reference?: { mimeType: string; data: string } | null) {
  const contents: any = reference
    ? { parts: [{ inlineData: reference }, { text: prompt }] }
    : prompt;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image',
    contents,
    config: {
      responseFormat: {
        image: {
          aspectRatio: '21:9',
          imageSize: '2K',
        },
      },
    } as any,
  });

  const parts = response?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part: any) => part.inlineData?.data);
  if (!imagePart?.inlineData?.data) throw new Error('Gemini did not return an image.');
  return Buffer.from(imagePart.inlineData.data, 'base64');
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  try {
    const {
      orderId, accessToken, advertiserName, headline, subheadline, cta, style, brief,
      logoDataUrl, referenceDataUrl,
    } = req.body || {};

    if (!orderId || !accessToken || !headline) {
      return res.status(400).json({ success: false, error: 'Missing required design fields.' });
    }

    const db = getDb();
    const ref = db.collection('advertisingOrders').doc(String(orderId));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'Advertising order not found.' });

    const order = snap.data() || {};
    if (order.accessToken !== accessToken) return res.status(403).json({ success: false, error: 'Invalid order access token.' });
    if (order.paymentStatus !== 'paid') return res.status(402).json({ success: false, error: 'Payment must be confirmed before AI banner generation.' });

    const maxGenerations = Math.max(1, Math.min(5, Number(order.aiGenerationsIncluded || 3)));
    const generationCount = Number(order.generationCount || 0);
    if (generationCount >= maxGenerations) {
      return res.status(400).json({
        success: false,
        error: 'AI generation allowance used.',
        errorMessage: `This campaign includes ${maxGenerations} AI generation round${maxGenerations === 1 ? '' : 's'}.`,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
    const ai = new GoogleGenAI({ apiKey });

    const reference = stripDataUrl(String(referenceDataUrl || ''));
    const logo = stripDataUrl(String(logoDataUrl || ''));

    const brand = String(advertiserName || order.advertiserName || 'Advertiser').trim();
    const safeHeadline = String(headline).trim().slice(0, 72);
    const safeSubheadline = String(subheadline || '').trim().slice(0, 110);
    const safeCta = String(cta || 'Learn More').trim().slice(0, 28);
    const safeStyle = String(style || 'Premium Marine').trim().slice(0, 40);
    const safeBrief = String(brief || '').trim().slice(0, 500);

    const variantPrompts = [
      'bright premium marine photography, clean modern commercial composition, sophisticated blue tones',
      'high-end minimalist commercial photography, elegant negative space, crisp premium lighting',
      'bold modern advertising photography, dynamic composition, strong visual impact, professional brand feel',
    ];

    const urls: string[] = [];

    for (let i = 0; i < 3; i++) {
      const prompt = `
Create ONLY the photographic/illustrative BACKGROUND for a very wide commercial website banner.
Do NOT add any text, logos, letters, numbers, buttons, watermarks or UI.
Business: ${brand}
Requested style: ${safeStyle}
Business brief: ${safeBrief || 'Professional marine-related business advertising to UK boat owners and buyers.'}
Visual direction: ${variantPrompts[i]}
The final banner will be 1600x240 pixels, so keep important subjects in the RIGHT HALF and keep the LEFT HALF visually calmer for later text overlay.
Make it professional, realistic and suitable for a premium UK marine marketplace.
`;

      const bg = await generateBackground(ai, prompt, reference);

      const background = await sharp(bg)
        .resize(1600, 240, { fit: 'cover', position: 'centre' })
        .modulate({ saturation: 0.92, brightness: 0.92 })
        .png()
        .toBuffer();

      const overlaySvg = Buffer.from(`
        <svg width="1600" height="240" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="shade" x1="0" x2="1">
              <stop offset="0%" stop-color="#071426" stop-opacity="0.94"/>
              <stop offset="46%" stop-color="#071426" stop-opacity="0.79"/>
              <stop offset="72%" stop-color="#071426" stop-opacity="0.22"/>
              <stop offset="100%" stop-color="#071426" stop-opacity="0.02"/>
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="1600" height="240" fill="url(#shade)"/>
          <text x="58" y="56" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="700" fill="#7dd3fc">${esc(brand.toUpperCase())}</text>
          <text x="58" y="111" font-family="Arial, Helvetica, sans-serif" font-size="43" font-weight="900" fill="#ffffff">${esc(safeHeadline)}</text>
          ${safeSubheadline ? `<text x="58" y="151" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="500" fill="#dbeafe">${esc(safeSubheadline)}</text>` : ''}
          <rect x="58" y="174" rx="13" ry="13" width="${Math.max(145, safeCta.length * 13 + 42)}" height="43" fill="#2563eb"/>
          <text x="79" y="202" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="800" fill="#ffffff">${esc(safeCta)}</text>
        </svg>
      `);

      const composites: sharp.OverlayOptions[] = [{ input: overlaySvg, top: 0, left: 0 }];

      if (logo) {
        try {
          const logoBuffer = await sharp(Buffer.from(logo.data, 'base64'))
            .resize({ width: 190, height: 68, fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer();
          composites.push({ input: logoBuffer, top: 18, left: 1325 });
        } catch (logoError) {
          console.warn('[Advertising AI] Logo could not be composited:', logoError);
        }
      }

      const finalBanner = await sharp(background)
        .composite(composites)
        .png({ compressionLevel: 8 })
        .toBuffer();

      urls.push(await savePublicPng(String(orderId), i + 1, finalBanner));
    }

    await ref.set({
      generatedBanners: urls,
      generationCount: generationCount + 1,
      workflowStatus: 'design_generated',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(200).json({ success: true, bannerUrls: urls });
  } catch (error: any) {
    console.error('[Advertising AI Banner]', error);
    return res.status(500).json({
      success: false,
      error: 'AI_BANNER_GENERATION_FAILED',
      errorMessage: error?.message || 'Unable to generate banner options.',
    });
  }
}
