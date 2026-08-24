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

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function resolveRefundRecipientEmail(db: any, adData: any) {
  const directCandidates = [
    adData.contactEmail,
    adData.sellerEmail,
    adData.userEmail,
    adData.ownerEmail,
    adData.email,
  ];

  for (const candidate of directCandidates) {
    if (
      typeof candidate === 'string' &&
      candidate.trim() &&
      candidate.includes('@')
    ) {
      return candidate.trim().toLowerCase();
    }
  }

  const ownerUidCandidates = [
    adData.sellerId,
    adData.userId,
    adData.ownerId,
    adData.createdBy,
  ];

  for (const uidCandidate of ownerUidCandidates) {
    if (typeof uidCandidate !== 'string' || !uidCandidate.trim()) continue;

    const uid = uidCandidate.trim();

    for (const collectionName of ['users', 'profiles']) {
      try {
        const snapshot = await db.collection(collectionName).doc(uid).get();
        if (!snapshot.exists) continue;

        const data = snapshot.data() || {};
        for (const emailField of ['email', 'userEmail', 'contactEmail']) {
          const value = data[emailField];
          if (
            typeof value === 'string' &&
            value.trim() &&
            value.includes('@')
          ) {
            return value.trim().toLowerCase();
          }
        }
      } catch (error) {
        console.warn(
          `[Finance Refund Email] Could not read ${collectionName}/${uid}:`,
          error
        );
      }
    }

    try {
      const authUser = await getAuth(getApp()).getUser(uid);
      if (
        typeof authUser.email === 'string' &&
        authUser.email.trim() &&
        authUser.email.includes('@')
      ) {
        return authUser.email.trim().toLowerCase();
      }
    } catch (error) {
      console.warn(
        `[Finance Refund Email] Could not resolve Firebase Auth email for ${uid}:`,
        error
      );
    }
  }

  return '';
}

async function sendRefundEmailDirect(
  recipientEmail: string,
  data: {
    customerName?: string;
    listingTitle?: string;
    amountRefunded: number;
    currency?: string;
    refundId: string;
    paymentIntentId: string;
    refundDate: Date;
  }
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY environment variable is not configured on the server.'
    );
  }

  const fromEmail =
    process.env.EMAIL_FROM ||
    'ConnectBoat <no-reply@connectboat.co.uk>';

  const replyTo =
    process.env.EMAIL_REPLY_TO ||
    'contato@connectboat.co.uk';

  const currency = (data.currency || 'GBP').toUpperCase();
  const amountFormatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(data.amountRefunded);

  const refundDateFormatted = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(data.refundDate);

  const safeName = escapeHtml(data.customerName || 'ConnectBoat member');
  const safeListing = escapeHtml(data.listingTitle || 'ConnectBoat listing');
  const safeRefundId = escapeHtml(data.refundId);
  const safePaymentIntentId = escapeHtml(data.paymentIntentId);

  const subject = `ConnectBoat refund confirmed — ${amountFormatted}`;

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(subject)}</title>
      </head>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="background:#020617;padding:26px 30px;">
                    <div style="font-size:24px;font-weight:900;color:#ffffff;">⛵ ConnectBoat</div>
                    <div style="margin-top:4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#38bdf8;">UK Boat & Marine Marketplace</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 30px;">
                    <p style="margin:0 0 14px;font-size:17px;font-weight:800;">Hello ${safeName},</p>
                    <p style="margin:0 0 22px;color:#475569;line-height:1.65;">
                      Your ConnectBoat refund has been successfully submitted through Stripe.
                    </p>

                    <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:12px;padding:18px;margin-bottom:22px;">
                      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#9f1239;">Refund confirmed</div>
                      <div style="margin-top:6px;font-size:30px;font-weight:900;color:#be123c;">${amountFormatted}</div>
                    </div>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                      <tr>
                        <td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;font-weight:700;">Listing</td>
                        <td align="right" style="padding:13px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:800;">${safeListing}</td>
                      </tr>
                      <tr>
                        <td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;font-weight:700;">Refund date</td>
                        <td align="right" style="padding:13px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:800;">${escapeHtml(refundDateFormatted)}</td>
                      </tr>
                      <tr>
                        <td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;font-weight:700;">Stripe refund ID</td>
                        <td align="right" style="padding:13px 16px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:11px;">${safeRefundId}</td>
                      </tr>
                      <tr>
                        <td style="padding:13px 16px;color:#64748b;font-size:12px;font-weight:700;">Payment ID</td>
                        <td align="right" style="padding:13px 16px;font-family:monospace;font-size:11px;">${safePaymentIntentId}</td>
                      </tr>
                    </table>

                    <p style="margin:22px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
                      Your bank or card issuer controls when the refund becomes visible in your account. Processing time can vary by bank.
                    </p>

                    <p style="margin:24px 0 0;color:#475569;font-size:13px;">
                      Questions? Reply to this email or contact <strong>${escapeHtml(replyTo)}</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [recipientEmail],
      reply_to: replyTo,
      subject,
      html,
    }),
  });

  const responseText = await response.text();
  let responseData: any = {};

  try {
    responseData = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseData = {};
  }

  if (!response.ok) {
    throw new Error(
      responseData?.message ||
      responseData?.error ||
      `Resend error ${response.status}: ${responseText.slice(0, 300)}`
    );
  }

  return {
    id: responseData?.id || '',
  };
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

      const refundDate = new Date();

      await adRef.update({
        amountRefunded: newRefundedTotal,
        refundStatus: fullyRefunded ? 'refunded' : 'partially_refunded',
        refundedAt: refundDate,
        stripeRefundId: refund.id,
        stripeRefundStatus: refund.status || 'unknown',
        paymentStatus: fullyRefunded ? 'refunded' : 'partially_refunded',
        refundEmailSent: false,
        refundEmailRecipient: '',
        refundEmailResendId: '',
        refundEmailError: '',
      });

      let refundEmailSent = false;
      let refundEmailRecipient = '';
      let refundEmailResendId = '';
      let refundEmailError = '';

      try {
        refundEmailRecipient = await resolveRefundRecipientEmail(db, adData);

        if (!refundEmailRecipient) {
          throw new Error(
            'Customer email could not be resolved from the listing or user account.'
          );
        }

        const emailResult = await sendRefundEmailDirect(
          refundEmailRecipient,
          {
            customerName:
              adData.sellerName ||
              adData.userName ||
              adData.ownerName ||
              adData.contactName ||
              '',
            listingTitle: adData.title || adId,
            amountRefunded: actualRefundAmount,
            currency: adData.currency || 'GBP',
            refundId: refund.id,
            paymentIntentId,
            refundDate,
          }
        );

        refundEmailSent = true;
        refundEmailResendId = emailResult.id || '';

        await adRef.update({
          refundEmailSent: true,
          refundEmailSentAt: new Date(),
          refundEmailRecipient,
          refundEmailResendId,
          refundEmailError: '',
        });
      } catch (emailError: any) {
        refundEmailError =
          emailError?.message ||
          'Refund completed, but the confirmation email could not be sent.';

        console.error(
          `[Finance Refund Email] Refund ${refund.id} completed but email failed:`,
          emailError
        );

        await adRef.update({
          refundEmailSent: false,
          refundEmailRecipient,
          refundEmailError: refundEmailError.slice(0, 1000),
        });
      }

      return res.status(200).json({
        success: true,
        refundId: refund.id,
        stripeRefundStatus: refund.status || 'unknown',
        amountRefunded: actualRefundAmount,
        totalRefunded: newRefundedTotal,
        fullyRefunded,
        refundEmailSent,
        refundEmailRecipient,
        refundEmailResendId,
        refundEmailError,
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
