import type { Request, Response } from 'express';
import Stripe from 'stripe';

export const config = {
  api: {
    bodyParser: false,
  },
};

const PROJECT_ID = 'navlink-489413';
const DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';
const FIRESTORE_REST_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

let stripeClient: Stripe | null = null;

function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia' as any,
    });
  }
  return stripeClient;
}

async function getRawBody(req: Request): Promise<Buffer> {
  if ((req as any).rawBody && Buffer.isBuffer((req as any).rawBody)) {
    return (req as any).rawBody;
  }
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', (err) => {
      reject(err);
    });
  });
}

async function patchFirestoreDoc(collectionName: string, docId: string, fields: Record<string, any>, updateFields: string[]) {
  try {
    const queryParams = updateFields.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
    const url = `${FIRESTORE_REST_BASE}/${collectionName}/${encodeURIComponent(docId)}?${queryParams}`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Stripe Webhook] Firestore REST update failed for ${collectionName}/${docId}:`, errText);
    } else {
      console.log(`[Stripe Webhook] Successfully updated Firestore ${collectionName}/${docId}`);
    }
  } catch (err) {
    console.error(`[Stripe Webhook Exception] Updating ${collectionName}/${docId}:`, err);
  }
}

export default async function stripeWebhookHandler(req: Request & { rawBody?: Buffer }, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers['stripe-signature'];

  if (!stripe) {
    return res.status(500).send('Stripe is not configured');
  }

  if (!webhookSecret) {
    return res.status(500).send('Webhook secret is not configured');
  }

  if (!sig) {
    return res.status(400).send('Missing stripe-signature header');
  }

  let rawBody: Buffer;
  try {
    rawBody = await getRawBody(req);
  } catch (err: any) {
    console.error(`[Stripe Webhook Read Error]: ${err.message}`);
    return res.status(400).send(`Error reading request body: ${err.message}`);
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error(`[Stripe Webhook Verification Error]: ${err.message}`);
    return res.status(400).send(`Webhook Signature Verification Error: ${err.message}`);
  }

  // Handle successful checkout payments
  if (event && event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};

    console.log(`[Stripe Webhook] Payment completed for session ${session.id}. ItemType: ${metadata.itemType}`);

    const { itemType, adId, userId, plan, showcaseDataJson } = metadata;

    if (itemType === 'featured_ad' && adId) {
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();
      const level = plan === 'national' ? 'national' : 'local';

      await patchFirestoreDoc(
        'ads',
        adId,
        {
          isFeatured: { booleanValue: true },
          featuredLevel: { stringValue: level },
          featuredUntil: { timestampValue: thirtyDaysFromNow },
          featuredActivatedAt: { timestampValue: now },
        },
        ['isFeatured', 'featuredLevel', 'featuredUntil', 'featuredActivatedAt']
      );
    } else if (itemType === 'digital_showcase' && userId) {
      let showcaseData: any = {};
      if (showcaseDataJson) {
        try {
          showcaseData = JSON.parse(showcaseDataJson);
        } catch (e) {
          console.warn('[Stripe Webhook] Failed to parse showcaseDataJson metadata', e);
        }
      }

      const showcaseFields: Record<string, any> = {
        showcasePaid: { booleanValue: true },
        showcasePlan: { stringValue: 'premium' },
        showcaseActive: { booleanValue: true },
      };
      const updateMask = ['showcasePaid', 'showcasePlan', 'showcaseActive'];

      if (showcaseData.showcaseName) {
        showcaseFields.showcaseName = { stringValue: showcaseData.showcaseName };
        updateMask.push('showcaseName');
      }
      if (showcaseData.showcaseSlug) {
        showcaseFields.showcaseSlug = { stringValue: showcaseData.showcaseSlug };
        updateMask.push('showcaseSlug');
      }
      if (showcaseData.country) {
        showcaseFields.country = { stringValue: showcaseData.country };
        updateMask.push('country');
      }
      if (showcaseData.city) {
        showcaseFields.city = { stringValue: showcaseData.city };
        updateMask.push('city');
      }

      await patchFirestoreDoc('users', userId, showcaseFields, updateMask);

      const sellerProfileFields: Record<string, any> = {
        ...showcaseFields,
        showcaseApproved: { booleanValue: true },
      };
      const sellerUpdateMask = [...updateMask, 'showcaseApproved'];

      if (showcaseData.showcaseCategory) {
        sellerProfileFields.showcaseCategory = { stringValue: showcaseData.showcaseCategory };
        sellerUpdateMask.push('showcaseCategory');
      }
      if (showcaseData.showcaseLogo) {
        sellerProfileFields.showcaseLogo = { stringValue: showcaseData.showcaseLogo };
        sellerUpdateMask.push('showcaseLogo');
      }
      if (showcaseData.showcaseCover) {
        sellerProfileFields.showcaseCover = { stringValue: showcaseData.showcaseCover };
        sellerUpdateMask.push('showcaseCover');
      }
      if (showcaseData.showcaseDescription) {
        sellerProfileFields.showcaseDescription = { stringValue: showcaseData.showcaseDescription };
        sellerUpdateMask.push('showcaseDescription');
      }
      if (showcaseData.showcaseWhatsapp) {
        sellerProfileFields.showcaseWhatsapp = { stringValue: showcaseData.showcaseWhatsapp };
        sellerUpdateMask.push('showcaseWhatsapp');
      }
      if (showcaseData.showcaseFacebook) {
        sellerProfileFields.showcaseFacebook = { stringValue: showcaseData.showcaseFacebook };
        sellerUpdateMask.push('showcaseFacebook');
      }
      if (showcaseData.showcaseInstagram) {
        sellerProfileFields.showcaseInstagram = { stringValue: showcaseData.showcaseInstagram };
        sellerUpdateMask.push('showcaseInstagram');
      }

      await patchFirestoreDoc('sellerPublicProfiles', userId, sellerProfileFields, sellerUpdateMask);
    }
  }

  return res.status(200).json({ received: true });
}
