import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { timingSafeEqual } from 'node:crypto';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const FIRESTORE_DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';

let stripeClient: Stripe | null = null;

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

    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(rawServiceAccount);
    } catch {
      const decoded = Buffer.from(rawServiceAccount, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded);
    }

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

async function verifyAdminRequest(req: Request, db: any) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return {
      ok: false as const,
      status: 401,
      code: 'AUTH_TOKEN_MISSING',
      message: 'Authentication required.'
    };
  }

  let decodedToken;

  try {
    decodedToken = await getAuth(getApp()).verifyIdToken(match[1]);
  } catch {
    return {
      ok: false as const,
      status: 401,
      code: 'AUTH_TOKEN_INVALID',
      message: 'Invalid or expired Firebase authentication token.'
    };
  }

  const email =
    typeof decodedToken.email === 'string'
      ? decodedToken.email.trim().toLowerCase()
      : '';

  const explicitAdminEmails = new Set([
    'valtailubereats@gmail.com',
    'valtail@gmail.com',
    'generalsales2021@gmail.com',
  ]);

  if (explicitAdminEmails.has(email)) {
    return {
      ok: true as const,
      uid: decodedToken.uid,
      email
    };
  }

  const userDoc = await db.collection('users').doc(decodedToken.uid).get();
  const role = userDoc.exists ? userDoc.data()?.role : null;

  if (role !== 'admin') {
    return {
      ok: false as const,
      status: 403,
      code: 'ADMIN_ACCESS_REQUIRED',
      message: 'Administrator access required.'
    };
  }

  return {
    ok: true as const,
    uid: decodedToken.uid,
    email
  };
}


function passwordsMatch(received: string, expected: string) {
  const a = Buffer.from(received, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function createAssistedPaymentHandler(
  req: Request,
  res: Response
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  try {
    const { action, adId, plan, successUrl, cancelUrl } = req.body || {};

    // Reuse this existing Serverless Function for the Finance password gate so
    // the Vercel Hobby project stays within its 12-function limit.
    if (action === 'verifyFinanceAccess') {
      const configuredPassword = process.env.FINANCE_ACCESS_PASSWORD;

      if (!configuredPassword) {
        return res.status(503).json({
          success: false,
          error: 'FINANCE_PASSWORD_NOT_CONFIGURED',
          errorMessage: 'Financial access password is not configured on the server.',
        });
      }

      const db = getAdminDb();
      const adminCheck = await verifyAdminRequest(req, db);

      if (!adminCheck.ok) {
        return res.status(adminCheck.status).json({
          success: false,
          error: adminCheck.code,
          errorMessage: adminCheck.message,
        });
      }

      const ownerEmails = new Set([
        'valtailubereats@gmail.com',
        'valtail@gmail.com',
        'generalsales2021@gmail.com',
      ]);

      const isOwner = ownerEmails.has(
        (adminCheck.email || '').trim().toLowerCase()
      );

      if (!isOwner) {
        const userDoc = await db.collection('users').doc(adminCheck.uid).get();
        const userData = userDoc.exists ? (userDoc.data() || {}) : {};

        if (userData.role !== 'admin' || userData.financeAccess !== true) {
          return res.status(403).json({
            success: false,
            error: 'FINANCE_ACCESS_DENIED',
            errorMessage: 'Financial access has not been granted to this administrator.',
          });
        }
      }

      const password =
        typeof req.body?.password === 'string' ? req.body.password : '';

      if (!password || !passwordsMatch(password, configuredPassword)) {
        return res.status(403).json({
          success: false,
          error: 'INVALID_FINANCE_PASSWORD',
          errorMessage: 'Incorrect financial access password.',
        });
      }

      return res.status(200).json({
        success: true,
      });
    }

    if (action === 'refundFinancePayment') {
      const configuredPassword = process.env.FINANCE_ACCESS_PASSWORD;

      if (!configuredPassword) {
        return res.status(503).json({
          success: false,
          error: 'FINANCE_PASSWORD_NOT_CONFIGURED',
          errorMessage: 'Financial access password is not configured on the server.',
        });
      }

      if (!adId || typeof adId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'MISSING_AD_ID',
          errorMessage: 'A valid listing ID is required.',
        });
      }

      const db = getAdminDb();
      const adminCheck = await verifyAdminRequest(req, db);

      if (!adminCheck.ok) {
        return res.status(adminCheck.status).json({
          success: false,
          error: adminCheck.code,
          errorMessage: adminCheck.message,
        });
      }

      const ownerEmails = new Set([
        'valtailubereats@gmail.com',
        'valtail@gmail.com',
        'generalsales2021@gmail.com',
      ]);
      const isOwner = ownerEmails.has((adminCheck.email || '').trim().toLowerCase());

      if (!isOwner) {
        const userDoc = await db.collection('users').doc(adminCheck.uid).get();
        const userData = userDoc.exists ? (userDoc.data() || {}) : {};
        if (userData.role !== 'admin' || userData.financeAccess !== true) {
          return res.status(403).json({
            success: false,
            error: 'FINANCE_ACCESS_DENIED',
            errorMessage: 'Financial access has not been granted to this administrator.',
          });
        }
      }

      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!password || !passwordsMatch(password, configuredPassword)) {
        return res.status(403).json({
          success: false,
          error: 'INVALID_FINANCE_PASSWORD',
          errorMessage: 'Incorrect financial access password.',
        });
      }

      const adRef = db.collection('ads').doc(adId);
      const adSnapshot = await adRef.get();
      if (!adSnapshot.exists) {
        return res.status(404).json({
          success: false,
          error: 'AD_NOT_FOUND',
          errorMessage: 'The listing could not be found.',
        });
      }

      const adData = adSnapshot.data() || {};
      const amountPaid = Number(adData.amountPaid || 0);
      const amountRefunded = Number(adData.amountRefunded || 0);
      const remainingAmount = Math.max(0, amountPaid - amountRefunded);
      const paymentIntentId = typeof adData.stripePaymentIntentId === 'string'
        ? adData.stripePaymentIntentId.trim()
        : '';

      if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
        return res.status(409).json({
          success: false,
          error: 'PAYMENT_AMOUNT_UNAVAILABLE',
          errorMessage: 'This transaction does not have a captured historical payment amount.',
        });
      }

      if (remainingAmount <= 0.0001) {
        return res.status(409).json({
          success: false,
          error: 'ALREADY_FULLY_REFUNDED',
          errorMessage: 'This transaction has already been fully refunded.',
        });
      }

      if (!paymentIntentId) {
        return res.status(409).json({
          success: false,
          error: 'PAYMENT_INTENT_UNAVAILABLE',
          errorMessage: 'Stripe Payment Intent is unavailable for this transaction.',
        });
      }

      const amountCents = Math.round(remainingAmount * 100);
      const stripe = getStripe();
      const refund = await stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          amount: amountCents,
          metadata: {
            source: 'connectboat_finance_dashboard',
            adId,
            refundedBy: adminCheck.email || adminCheck.uid,
          },
        },
        {
          idempotencyKey: `connectboat-finance-refund-${adId}-${Math.round(amountRefunded * 100)}-${amountCents}`,
        }
      );

      const actualRefundAmount = refund.amount / 100;
      const newRefundedTotal = Math.min(
        amountPaid,
        Math.round((amountRefunded + actualRefundAmount) * 100) / 100
      );
      const fullyRefunded = newRefundedTotal >= amountPaid - 0.0001;

      await adRef.update({
        amountRefunded: newRefundedTotal,
        refundStatus: fullyRefunded ? 'refunded' : 'partially_refunded',
        refundedAt: new Date(),
        stripeRefundId: refund.id,
        paymentStatus: fullyRefunded ? 'refunded' : 'partially_refunded',
      });

      return res.status(200).json({
        success: true,
        refundId: refund.id,
        amountRefunded: actualRefundAmount,
        totalRefunded: newRefundedTotal,
        fullyRefunded,
      });
    }

    if (
      action === 'listFinanceExpenses' ||
      action === 'addFinanceExpense' ||
      action === 'deleteFinanceExpense'
    ) {
      const configuredPassword = process.env.FINANCE_ACCESS_PASSWORD;

      if (!configuredPassword) {
        return res.status(503).json({
          success: false,
          error: 'FINANCE_PASSWORD_NOT_CONFIGURED',
          errorMessage: 'Financial access password is not configured on the server.',
        });
      }

      const db = getAdminDb();
      const adminCheck = await verifyAdminRequest(req, db);

      if (!adminCheck.ok) {
        return res.status(adminCheck.status).json({
          success: false,
          error: adminCheck.code,
          errorMessage: adminCheck.message,
        });
      }

      const ownerEmails = new Set([
        'valtailubereats@gmail.com',
        'valtail@gmail.com',
        'generalsales2021@gmail.com',
      ]);

      const isOwner = ownerEmails.has(
        (adminCheck.email || '').trim().toLowerCase()
      );

      if (!isOwner) {
        const userDoc = await db.collection('users').doc(adminCheck.uid).get();
        const userData = userDoc.exists ? (userDoc.data() || {}) : {};

        if (userData.role !== 'admin' || userData.financeAccess !== true) {
          return res.status(403).json({
            success: false,
            error: 'FINANCE_ACCESS_DENIED',
            errorMessage: 'Financial access has not been granted to this administrator.',
          });
        }
      }

      const password =
        typeof req.body?.password === 'string' ? req.body.password : '';

      if (!password || !passwordsMatch(password, configuredPassword)) {
        return res.status(403).json({
          success: false,
          error: 'INVALID_FINANCE_PASSWORD',
          errorMessage: 'Incorrect financial access password.',
        });
      }

      const expensesCollection = db.collection('financeExpenses');

      if (action === 'listFinanceExpenses') {
        const snapshot = await expensesCollection.get();
        const expenses = snapshot.docs
          .map((docSnapshot: any) => ({
            id: docSnapshot.id,
            ...docSnapshot.data(),
          }))
          .sort((a: any, b: any) =>
            String(b.expenseDate || '').localeCompare(String(a.expenseDate || ''))
          );

        return res.status(200).json({
          success: true,
          expenses,
        });
      }

      if (action === 'addFinanceExpense') {
        const expenseDate =
          typeof req.body?.expenseDate === 'string'
            ? req.body.expenseDate.trim()
            : '';
        const category =
          typeof req.body?.category === 'string'
            ? req.body.category.trim()
            : '';
        const description =
          typeof req.body?.description === 'string'
            ? req.body.description.trim()
            : '';
        const amount = Number(req.body?.amount);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_EXPENSE_DATE',
            errorMessage: 'A valid expense date is required.',
          });
        }

        if (!category || !description) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_EXPENSE_DETAILS',
            errorMessage: 'Expense category and description are required.',
          });
        }

        if (!Number.isFinite(amount) || amount <= 0) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_EXPENSE_AMOUNT',
            errorMessage: 'Expense amount must be greater than zero.',
          });
        }

        const roundedAmount = Math.round(amount * 100) / 100;
        const expenseRef = expensesCollection.doc();

        await expenseRef.set({
          expenseDate,
          category,
          description,
          amount: roundedAmount,
          currency: 'GBP',
          createdAt: new Date(),
          createdByUid: adminCheck.uid,
          createdByEmail: adminCheck.email || '',
        });

        return res.status(200).json({
          success: true,
          expense: {
            id: expenseRef.id,
            expenseDate,
            category,
            description,
            amount: roundedAmount,
            currency: 'GBP',
          },
        });
      }

      const expenseId =
        typeof req.body?.expenseId === 'string'
          ? req.body.expenseId.trim()
          : '';

      if (!expenseId) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_EXPENSE_ID',
          errorMessage: 'Expense ID is required.',
        });
      }

      const expenseRef = expensesCollection.doc(expenseId);
      const expenseSnapshot = await expenseRef.get();

      if (!expenseSnapshot.exists) {
        return res.status(404).json({
          success: false,
          error: 'EXPENSE_NOT_FOUND',
          errorMessage: 'The expense could not be found.',
        });
      }

      await expenseRef.delete();

      return res.status(200).json({
        success: true,
        expenseId,
      });
    }

    if (!adId || typeof adId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'MISSING_AD_ID',
        errorMessage: 'A valid listing ID is required.',
      });
    }

    const normalizedPlan =
      typeof plan === 'string' ? plan.trim().toLowerCase() : '';

    const allowedPlans = new Set([
      'standard',
      'featured',
      'premium'
    ]);

    if (!allowedPlans.has(normalizedPlan)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PLAN',
        errorMessage: 'Plan must be standard, featured, or premium.',
      });
    }

    const db = getAdminDb();

    const adminCheck = await verifyAdminRequest(req, db);

    if (!adminCheck.ok) {
      return res.status(adminCheck.status).json({
        success: false,
        error: adminCheck.code,
        errorMessage: adminCheck.message,
      });
    }

    const adSnapshot = await db.collection('ads').doc(adId).get();

    if (!adSnapshot.exists) {
      return res.status(404).json({
        success: false,
        error: 'AD_NOT_FOUND',
        errorMessage: 'The listing could not be found.',
      });
    }

    const adData = adSnapshot.data() || {};

    const paymentStatus =
      typeof adData.paymentStatus === 'string'
        ? adData.paymentStatus.toLowerCase()
        : '';

    const isAlreadyPaid = Boolean(
      adData.paidAt ||
      adData.paymentCompletedAt ||
      paymentStatus === 'paid' ||
      paymentStatus === 'completed'
    );

    if (isAlreadyPaid) {
      return res.status(409).json({
        success: false,
        error: 'AD_ALREADY_PAID',
        errorMessage: 'This listing is already marked as paid.',
      });
    }

    const settingsSnapshot = await db
      .collection('settings')
      .doc('global')
      .get();

    const settingsData = settingsSnapshot.exists
      ? settingsSnapshot.data()
      : {};

    const configuredPlanPrices = settingsData?.planPrices || {};

    const planPrices = {
      standard: getValidConfiguredPrice(
        configuredPlanPrices.standard,
        4.99
      ),
      featured: getValidConfiguredPrice(
        configuredPlanPrices.featured,
        7.99
      ),
      premium: getValidConfiguredPrice(
        configuredPlanPrices.premium,
        12.99
      ),
    };

    const amount =
      planPrices[normalizedPlan as keyof typeof planPrices];

    const amountCents = Math.round(amount * 100);

    const productNames = {
      standard: 'ConnectBoat - Standard Listing',
      featured: 'ConnectBoat - Featured Listing',
      premium: 'ConnectBoat - Premium Featured Listing',
    };

    const productDescriptions = {
      standard:
        `30-day active listing (£${amount.toFixed(2)}) for listing #${adId}`,
      featured:
        `30-day homepage highlight & featured badge (£${amount.toFixed(2)}) for listing #${adId}`,
      premium:
        `30-day top priority exposure & premium badge (£${amount.toFixed(2)}) for listing #${adId}`,
    };

    const origin =
      req.headers.origin || 'https://connectboat.co.uk';

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',

      line_items: [
        {
          price_data: {
            currency: 'gbp',

            product_data: {
              name:
                productNames[
                  normalizedPlan as keyof typeof productNames
                ],

              description:
                productDescriptions[
                  normalizedPlan as keyof typeof productDescriptions
                ],
            },

            unit_amount: amountCents,
          },

          quantity: 1,
        },
      ],

      managed_payments: {
        enabled: false,
      } as any,

      metadata: {
        itemType: 'ad_listing',
        adId,
        plan: normalizedPlan,
        paymentFlow: 'admin_assisted',
        createdByAdminUid: adminCheck.uid,
      },

      success_url:
        typeof successUrl === 'string' && successUrl
          ? successUrl
          : `${origin}/?assisted_payment=success&session_id={CHECKOUT_SESSION_ID}`,

      cancel_url:
        typeof cancelUrl === 'string' && cancelUrl
          ? cancelUrl
          : `${origin}/?assisted_payment=cancelled`,
    });

    if (!session.url) {
      throw new Error(
        'Stripe did not return a Checkout URL.'
      );
    }

    return res.status(200).json({
      success: true,
      url: session.url,
      sessionId: session.id,
      adId,
      plan: normalizedPlan,
      amount,
      currency: 'gbp',
    });

  } catch (err: any) {
    console.error(
      '[Admin Assisted Payment Error]:',
      err
    );

    return res.status(500).json({
      success: false,
      error: 'ASSISTED_PAYMENT_ERROR',
      errorMessage:
        err?.message ||
        'Error creating assisted Stripe Checkout.',
    });
  }
}
