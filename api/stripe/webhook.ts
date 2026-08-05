import type { Request, Response } from 'express';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';

export const config = {
  api: {
    bodyParser: false,
  },
};

const PROJECT_ID = 'navlink-489413';
const DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';

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

async function sendPaymentEmail(toEmail: string, userName: string, planName: string, amountFormatted?: string) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || 'ConnectBoat <no-reply@connectboat.co.uk>';
  const emailReplyTo = process.env.EMAIL_REPLY_TO || 'contato@connectboat.co.uk';

  if (!toEmail || !toEmail.includes('@')) return;

  if (resendApiKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [toEmail],
          subject: `💳 Payment Confirmed: ${planName}`,
          reply_to: emailReplyTo,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
              <div style="background-color: #0f172a; padding: 24px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 22px;">⛵ ConnectBoat</h1>
                <p style="margin: 4px 0 0 0; color: #38bdf8; font-size: 12px; font-weight: 600; text-transform: uppercase;">UK Boat & Marine Marketplace</p>
              </div>
              <div style="padding: 30px; color: #334155;">
                <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${userName || 'Valued Member'},</p>
                <p>We have received your payment for <strong>${planName}</strong>.</p>
                ${amountFormatted ? `<p style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 6px; color: #166534; font-weight: bold;">Amount Paid: ${amountFormatted}</p>` : ''}
                <p>Your subscription features are now fully active on ConnectBoat.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;">
                <p style="font-size: 12px; color: #64748b; margin: 0;">If you have any questions, please write to us at <a href="mailto:contato@connectboat.co.uk" style="color: #0284c7;">contato@connectboat.co.uk</a>.</p>
              </div>
            </div>
          `
        })
      });
      console.log(`[Stripe Webhook Email] Sent payment confirmation email to ${toEmail}`);
    } catch (err) {
      console.warn(`[Stripe Webhook Email Error] Failed to send receipt:`, err);
    }
  }
}

let dbInstance: admin.firestore.Firestore | null = null;

function getAdminDb(): admin.firestore.Firestore {
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
          console.error(`[Stripe Webhook getAdminDb] Service Account init failed: ${e.message}. Falling back to default app init.`);
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
  return dbInstance!;
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
    const { itemType, adId, userId, plan, showcaseDataJson } = metadata;

    try {
      const db = getAdminDb();

      if (itemType === 'featured_ad' || itemType === 'ad_listing' || itemType === 'ad_promotion') {
        if (!adId) {
          console.error(`[Stripe Webhook Error] itemType is '${itemType}' but adId is missing from metadata!`);
        } else {
          const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          const activePlan = (plan || 'standard').toLowerCase();
          
          let level = 'standard';
          let isFeatured = false;
          let humanPlanTitle = 'Standard Listing';

          if (activePlan === 'premium') {
            level = 'premium';
            isFeatured = true;
            humanPlanTitle = 'Premium Featured Listing (£9.99)';
          } else if (activePlan === 'featured' || activePlan === 'national' || activePlan === 'local') {
            level = activePlan === 'national' ? 'national' : 'featured';
            isFeatured = true;
            humanPlanTitle = 'Featured Listing (£4.99)';
          } else {
            level = 'standard';
            isFeatured = false;
            humanPlanTitle = 'Standard Listing (£2.99)';
          }

          const firebaseAdmin = (admin as any).default || admin;
          await db.collection('ads').doc(adId).set(
            {
              plan: activePlan,
              status: 'approved',
              isFeatured: isFeatured,
              featuredLevel: level,
              expirationDate: firebaseAdmin.firestore.Timestamp.fromDate(thirtyDaysFromNow),
              featuredUntil: firebaseAdmin.firestore.Timestamp.fromDate(thirtyDaysFromNow),
              featuredActivatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
              paidAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          console.log(`[Stripe Webhook] Successfully updated ad ${adId} to plan ${activePlan} (featuredLevel: ${level})`);

          // Dispatch confirmation email
          const customerEmail = session.customer_details?.email || session.customer_email;
          if (customerEmail) {
            const currencySymbol = session.currency?.toUpperCase() === 'GBP' ? '£' : '€';
            const amountFormatted = session.amount_total ? `${currencySymbol}${(session.amount_total / 100).toFixed(2)}` : undefined;
            sendPaymentEmail(
              customerEmail,
              session.customer_details?.name || 'Valued Member',
              `ConnectBoat - ${humanPlanTitle}`,
              amountFormatted
            ).catch(err => console.warn('[Stripe Email Error]', err));
          }
        }
      } else if (itemType === 'digital_showcase' && userId) {
        let showcaseData: any = {};
        if (showcaseDataJson) {
          try {
            showcaseData = JSON.parse(showcaseDataJson);
          } catch (e) {
            console.warn('[Stripe Webhook] Failed to parse showcaseDataJson metadata', e);
          }
        }

        const userFields: Record<string, any> = {
          showcasePaid: true,
          showcasePlan: 'premium',
          showcaseActive: true,
        };

        if (showcaseData.showcaseName) userFields.showcaseName = showcaseData.showcaseName;
        if (showcaseData.showcaseSlug) userFields.showcaseSlug = showcaseData.showcaseSlug;
        if (showcaseData.country) userFields.country = showcaseData.country;
        if (showcaseData.city) userFields.city = showcaseData.city;

        await db.collection('users').doc(userId).set(userFields, { merge: true });
        console.log(`[Stripe Webhook] Successfully updated user ${userId} for digital showcase`);

        const sellerProfileFields: Record<string, any> = {
          ...userFields,
          showcaseApproved: true,
        };

        if (showcaseData.showcaseCategory) sellerProfileFields.showcaseCategory = showcaseData.showcaseCategory;
        if (showcaseData.showcaseLogo) sellerProfileFields.showcaseLogo = showcaseData.showcaseLogo;
        if (showcaseData.showcaseCover) sellerProfileFields.showcaseCover = showcaseData.showcaseCover;
        if (showcaseData.showcaseDescription) sellerProfileFields.showcaseDescription = showcaseData.showcaseDescription;
        if (showcaseData.showcaseWhatsapp) sellerProfileFields.showcaseWhatsapp = showcaseData.showcaseWhatsapp;
        if (showcaseData.showcaseFacebook) sellerProfileFields.showcaseFacebook = showcaseData.showcaseFacebook;
        if (showcaseData.showcaseInstagram) sellerProfileFields.showcaseInstagram = showcaseData.showcaseInstagram;

        await db.collection('sellerPublicProfiles').doc(userId).set(sellerProfileFields, { merge: true });
        console.log(`[Stripe Webhook] Successfully updated sellerPublicProfile ${userId} for digital showcase`);
      }
    } catch (err: any) {
      console.error(`[Stripe Webhook Fulfillment Error]: ${err.message}`, err);
      return res.status(500).send(`Firestore update failed: ${err.message}`);
    }
  }

  return res.status(200).json({ received: true });
}

