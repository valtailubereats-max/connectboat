import { GoogleGenAI } from '@google/genai';
import * as admin from 'firebase-admin';

const FIREBASE_PROJECT_ID = 'navlink-489413';
const FIRESTORE_DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';
let adminDbInstance: any = null;

function getAdminDb() {
  const firebaseAdmin = (admin as any).default || admin;
  if (!adminDbInstance) {
    if (!(firebaseAdmin.apps || []).length) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (raw) {
        let serviceAccount: any;
        try { serviceAccount = JSON.parse(raw); }
        catch { serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8')); }
        if (typeof serviceAccount.private_key === 'string') serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.cert(serviceAccount), projectId: FIREBASE_PROJECT_ID });
      } else {
        firebaseAdmin.initializeApp({ projectId: FIREBASE_PROJECT_ID });
      }
    }
    adminDbInstance = firebaseAdmin.firestore();
    try { adminDbInstance.settings({ databaseId: FIRESTORE_DATABASE_ID }); } catch { /* already set */ }
  }
  return adminDbInstance;
}

async function verifyAdminRequest(req: any) {
  const firebaseAdmin = (admin as any).default || admin;
  const match = String(req.headers?.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error('Authentication required.'), { statusCode: 401 });
  const db = getAdminDb();
  const decoded = await firebaseAdmin.auth().verifyIdToken(match[1]);
  const email = String(decoded.email || '').trim().toLowerCase();
  const explicitAdmins = new Set(['valtailubereats@gmail.com', 'valtail@gmail.com', 'generalsales2021@gmail.com']);
  if (explicitAdmins.has(email)) return decoded;
  const userDoc = await db.collection('users').doc(decoded.uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') throw Object.assign(new Error('Administrator access required.'), { statusCode: 403 });
  return decoded;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  try { await verifyAdminRequest(req); }
  catch (error: any) { return res.status(error?.statusCode || 401).json({ success: false, error: error?.message || 'Authentication failed.' }); }

  try {
    const image = req.body?.image;
    if (!image) return res.status(400).json({ success: false, error: 'Image is required.' });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');

    const ai = new GoogleGenAI({ apiKey });
    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    const mimeMatch = String(image).match(/^data:([^;]+);base64,/i);
    const mimeType = mimeMatch?.[1] || 'image/jpeg';

    const prompt = `Read this business card, stand card, leaflet or contact card for ConnectBoat event prospecting.
Return ONLY strict JSON. Extract only information genuinely visible. Never invent missing data.
If a field is absent or unclear, return an empty string.
Distinguish a number explicitly labelled WhatsApp from a normal phone number when possible.
Capture social/contact links if visible.

Return exactly these fields:
{
  "name": "",
  "company": "",
  "phone": "",
  "whatsapp": "",
  "email": "",
  "website": "",
  "linkedin": "",
  "otherContact": "",
  "rawText": ""
}

rawText should contain the useful readable text from the card, compactly, so the administrator can check it later.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ inlineData: { mimeType, data: base64Data } }, { text: prompt }] },
      config: { responseMimeType: 'application/json' },
    });

    const clean = String(response.text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
    if (!clean) throw new Error('No text was returned from the card reader.');
    const data = JSON.parse(clean);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('[business-card]', error);
    return res.status(200).json({ success: false, error: error?.message || 'Could not read business card.' });
  }
}
