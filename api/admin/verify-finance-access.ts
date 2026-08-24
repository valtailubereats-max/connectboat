import type { Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const FIRESTORE_DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';

function getAdminDb() {
  if (!getApps().length) {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawServiceAccount) throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is missing.');

    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(rawServiceAccount);
    } catch {
      serviceAccount = JSON.parse(Buffer.from(rawServiceAccount, 'base64').toString('utf-8'));
    }

    if (typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    initializeApp({ credential: cert(serviceAccount) });
  }

  return getFirestore(getApp(), FIRESTORE_DATABASE_ID);
}

function passwordsMatch(received: string, expected: string) {
  const a = Buffer.from(received, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function verifyFinanceAccess(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const configuredPassword = process.env.FINANCE_ACCESS_PASSWORD;
    if (!configuredPassword) {
      return res.status(503).json({
        success: false,
        error: 'FINANCE_PASSWORD_NOT_CONFIGURED',
        errorMessage: 'Financial access password is not configured on the server.',
      });
    }

    const db = getAdminDb();

    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ success: false, error: 'AUTH_TOKEN_MISSING' });
    }

    let decodedToken;
    try {
      decodedToken = await getAuth(getApp()).verifyIdToken(match[1]);
    } catch {
      return res.status(401).json({ success: false, error: 'AUTH_TOKEN_INVALID' });
    }

    const email = typeof decodedToken.email === 'string' ? decodedToken.email.trim().toLowerCase() : '';
    const financeOwnerEmails = new Set([
      'valtailubereats@gmail.com',
      'valtail@gmail.com',
      'generalsales2021@gmail.com',
    ]);
    const isOwner = financeOwnerEmails.has(email);

    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const isAuthorizedAdmin = userData.role === 'admin' && userData.financeAccess === true;

    if (!isOwner && !isAuthorizedAdmin) {
      return res.status(403).json({
        success: false,
        error: 'FINANCE_ACCESS_DENIED',
        errorMessage: 'Financial access has not been granted to this administrator.',
      });
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password || !passwordsMatch(password, configuredPassword)) {
      return res.status(403).json({
        success: false,
        error: 'INVALID_FINANCE_PASSWORD',
        errorMessage: 'Incorrect financial access password.',
      });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[verify-finance-access]', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      errorMessage: 'Unable to verify financial access.',
    });
  }
}
