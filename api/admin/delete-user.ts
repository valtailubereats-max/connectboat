import type { Request, Response } from 'express';
import * as admin from 'firebase-admin';

const PROJECT_ID = 'navlink-489413';
const DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';

let dbInstance: any = null;

function getAdminServices() {
  const firebaseAdmin = (admin as any).default || admin;

  if (!(firebaseAdmin.apps || []).length) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson) {
      let serviceAccount: any;
      try {
        serviceAccount = JSON.parse(serviceAccountJson);
      } catch {
        serviceAccount = JSON.parse(Buffer.from(serviceAccountJson, 'base64').toString('utf-8'));
      }
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount),
        projectId: PROJECT_ID,
      });
    } else {
      firebaseAdmin.initializeApp({ projectId: PROJECT_ID });
    }
  }

  if (!dbInstance) {
    dbInstance = firebaseAdmin.firestore();
    try {
      dbInstance.settings({ databaseId: DATABASE_ID });
    } catch {
      // Firestore settings may already be frozen by another request in the same process.
    }
  }

  return { firebaseAdmin, db: dbInstance };
}

async function requireAdmin(req: Request, firebaseAdmin: any, db: any) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error: any = new Error('Authentication required.');
    error.statusCode = 401;
    error.code = 'AUTH_TOKEN_MISSING';
    throw error;
  }

  let decodedToken: any;
  try {
    decodedToken = await firebaseAdmin.auth().verifyIdToken(match[1]);
  } catch {
    const error: any = new Error('Invalid or expired Firebase authentication token.');
    error.statusCode = 401;
    error.code = 'AUTH_TOKEN_INVALID';
    throw error;
  }

  const email = String(decodedToken.email || '').trim().toLowerCase();
  const explicitAdminEmails = new Set([
    'valtailubereats@gmail.com',
    'valtail@gmail.com',
    'generalsales2021@gmail.com',
  ]);
  const userDoc = await db.collection('users').doc(decodedToken.uid).get();
  const role = userDoc.exists ? userDoc.data()?.role : null;

  if (!explicitAdminEmails.has(email) && role !== 'admin') {
    const error: any = new Error('Administrator access required.');
    error.statusCode = 403;
    error.code = 'ADMIN_ACCESS_REQUIRED';
    throw error;
  }

  return { uid: decodedToken.uid, email };
}

type Association = {
  collection: string;
  label: string;
  field?: string;
  documentId?: boolean;
  sensitive?: boolean;
};

const ASSOCIATIONS: Association[] = [
  { collection: 'sellerPublicProfiles', label: 'Perfil público / vitrine', documentId: true },
  { collection: 'brokerApplications', label: 'Candidatura de broker', documentId: true },
  { collection: 'brokerProfiles', label: 'Perfil de broker', documentId: true },
  { collection: 'ads', label: 'Anúncios', field: 'sellerId', sensitive: true },
  { collection: 'ads', label: 'Anúncios comprados', field: 'buyerId', sensitive: true },
  { collection: 'ads', label: 'Anúncios reivindicados', field: 'claimedBy', sensitive: true },
  { collection: 'advertisingOrders', label: 'Pedidos/pagamentos de publicidade', field: 'userId', sensitive: true },
  { collection: 'advertisingCampaigns', label: 'Campanhas de publicidade', field: 'userId', sensitive: true },
  { collection: 'partnerVoucherUsages', label: 'Utilizações de vouchers', field: 'userId', sensitive: true },
  { collection: 'favorites', label: 'Favoritos', field: 'userId' },
  { collection: 'notifications', label: 'Notificações', field: 'userId' },
  { collection: 'reports', label: 'Denúncias', field: 'userId' },
  { collection: 'referrals', label: 'Convites recebidos', field: 'referredUserId' },
  { collection: 'referrals', label: 'Convites enviados', field: 'inviterId' },
  { collection: 'adInterests', label: 'Interesses em anúncios', field: 'userId' },
  { collection: 'adInterests', label: 'Interesses recebidos', field: 'sellerId' },
  { collection: 'reviews', label: 'Avaliações feitas', field: 'reviewerId' },
  { collection: 'reviews', label: 'Avaliações como vendedor', field: 'sellerId' },
  { collection: 'reviews', label: 'Avaliações como comprador', field: 'buyerId' },
  { collection: 'suggestions', label: 'Sugestões', field: 'userId' },
  { collection: 'showcaseProductInterests', label: 'Interesses na vitrine', field: 'sellerId' },
  { collection: 'participations', label: 'Participações em sorteios', field: 'userId' },
  { collection: 'shares', label: 'Partilhas de sorteios', field: 'userId' },
  { collection: 'businessClaimRequests', label: 'Pedidos de reivindicação', field: 'userId' },
  { collection: 'videos', label: 'Vídeos', field: 'ownerId' },
  { collection: 'marineEvents', label: 'Eventos submetidos', field: 'submittedByUserId' },
  { collection: 'boatShowMoments', label: 'Momentos de eventos', field: 'userId' },
  { collection: 'eventContacts', label: 'Contactos de eventos criados', field: 'createdBy' },
  { collection: 'financeExpenses', label: 'Despesas financeiras registadas', field: 'createdByUid', sensitive: true },
];

async function countAssociation(db: any, association: Association, uid: string) {
  if (association.documentId) {
    const snapshot = await db.collection(association.collection).doc(uid).get();
    return snapshot.exists ? 1 : 0;
  }

  const aggregate = await db.collection(association.collection)
    .where(association.field, '==', uid)
    .count()
    .get();
  return Number(aggregate.data().count || 0);
}

async function inspectAssociations(db: any, uid: string) {
  const results = await Promise.all(ASSOCIATIONS.map(async (association) => ({
    ...association,
    count: await countAssociation(db, association, uid),
  })));
  return results.filter((item) => item.count > 0);
}

export default async function deleteUserHandler(req: Request, res: Response) {
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const { firebaseAdmin, db } = getAdminServices();
    const actingAdmin = await requireAdmin(req, firebaseAdmin, db);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = body.action === 'delete' ? 'delete' : 'preview';
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';

    if (!userId) {
      return res.status(400).json({ success: false, error: 'MISSING_USER_ID', errorMessage: 'User ID is required.' });
    }
    if (userId === actingAdmin.uid) {
      return res.status(400).json({ success: false, error: 'SELF_DELETE_FORBIDDEN', errorMessage: 'Não pode excluir a sua própria conta.' });
    }

    const [profileSnapshot, authResult] = await Promise.all([
      db.collection('users').doc(userId).get(),
      firebaseAdmin.auth().getUser(userId).then((record: any) => ({ record })).catch((error: any) => {
        if (error?.code === 'auth/user-not-found') return { record: null };
        throw error;
      }),
    ]);

    const profile = profileSnapshot.exists ? profileSnapshot.data() || {} : {};
    const authUser = authResult.record;
    if (!profileSnapshot.exists && !authUser) {
      return res.status(404).json({ success: false, error: 'USER_NOT_FOUND', errorMessage: 'Utilizador não encontrado no Authentication nem no Firestore.' });
    }

    const associations = await inspectAssociations(db, userId);
    const summary = {
      uid: userId,
      name: profile.name || authUser?.displayName || 'Sem nome',
      email: profile.email || authUser?.email || 'Sem email',
      hasAuthAccount: Boolean(authUser),
      hasFirestoreProfile: profileSnapshot.exists,
      associations,
    };

    if (action === 'preview') {
      return res.status(200).json({ success: true, canDelete: associations.length === 0, user: summary });
    }

    if (associations.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'ASSOCIATED_DATA_FOUND',
        errorMessage: 'A exclusão foi bloqueada porque existem dados associados que precisam de revisão.',
        user: summary,
      });
    }

    if (authUser) {
      await firebaseAdmin.auth().deleteUser(userId);
    }
    if (profileSnapshot.exists) {
      await db.collection('users').doc(userId).delete();
    }

    return res.status(200).json({ success: true, deletedUserId: userId });
  } catch (error: any) {
    console.error('[Admin Delete User]', error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: error?.code || 'DELETE_USER_FAILED',
      errorMessage: error?.message || 'Não foi possível excluir o utilizador.',
    });
  }
}
