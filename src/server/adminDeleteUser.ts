import type { Request, Response } from 'express';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'navlink-489413';
const DATABASE_ID = 'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';

function getAdminServices() {
  if (!getApps().length) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is missing.');
    }

    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      serviceAccount = JSON.parse(Buffer.from(serviceAccountJson, 'base64').toString('utf-8'));
    }

    if (typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    initializeApp({
      credential: cert(serviceAccount),
      projectId: PROJECT_ID,
    });
  }

  const app = getApp();
  return {
    auth: getAuth(app),
    db: getFirestore(app, DATABASE_ID),
  };
}

async function requireAdmin(req: Request, auth: any, db: any) {
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
    decodedToken = await auth.verifyIdToken(match[1]);
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
  res.setHeader('Cache-Control', 'no-store');

  const traceId = `delete-user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let stage = 'request-start';

  const logStage = (nextStage: string, details: Record<string, unknown> = {}) => {
    stage = nextStage;
    console.info('[Admin Delete User]', { traceId, stage, ...details });
  };

  try {
    logStage('validate-method', { method: req.method });
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED', stage, traceId });
    }

    logStage('initialize-admin-services');
    const { auth, db } = getAdminServices();
    logStage('verify-admin');
    const actingAdmin = await requireAdmin(req, auth, db);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = body.action === 'delete' ? 'delete' : 'preview';
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    logStage('validate-request', { action });

    if (!userId) {
      return res.status(400).json({ success: false, error: 'MISSING_USER_ID', errorMessage: 'User ID is required.', stage, traceId });
    }
    if (userId === actingAdmin.uid) {
      return res.status(400).json({ success: false, error: 'SELF_DELETE_FORBIDDEN', errorMessage: 'Não pode excluir a sua própria conta.', stage, traceId });
    }

    logStage('load-target-user');
    const [profileSnapshot, authResult] = await Promise.all([
      db.collection('users').doc(userId).get(),
      auth.getUser(userId).then((record: any) => ({ record })).catch((error: any) => {
        if (error?.code === 'auth/user-not-found') return { record: null };
        throw error;
      }),
    ]);

    const profile = profileSnapshot.exists ? profileSnapshot.data() || {} : {};
    const authUser = authResult.record;
    if (!profileSnapshot.exists && !authUser) {
      return res.status(404).json({ success: false, error: 'USER_NOT_FOUND', errorMessage: 'Utilizador não encontrado no Authentication nem no Firestore.', stage, traceId });
    }

    logStage('inspect-associations', {
      action,
      hasAuthAccount: Boolean(authUser),
      hasFirestoreProfile: profileSnapshot.exists,
    });
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
      logStage('preview-complete', { associationGroups: associations.length });
      return res.status(200).json({ success: true, canDelete: associations.length === 0, user: summary, traceId });
    }

    if (associations.length > 0) {
      logStage('delete-blocked-associated-data', { associationGroups: associations.length });
      return res.status(409).json({
        success: false,
        error: 'ASSOCIATED_DATA_FOUND',
        errorMessage: 'A exclusão foi bloqueada porque existem dados associados que precisam de revisão.',
        user: summary,
        stage,
        traceId,
      });
    }

    if (authUser) {
      logStage('delete-auth');
      await auth.deleteUser(userId);
      logStage('delete-auth-complete');
    }
    if (profileSnapshot.exists) {
      logStage('delete-firestore-profile');
      await db.collection('users').doc(userId).delete();
      logStage('delete-firestore-profile-complete');
    }

    logStage('delete-complete');
    return res.status(200).json({ success: true, deletedUserId: userId, traceId });
  } catch (error: any) {
    const errorCode = typeof error?.code === 'string' ? error.code : 'DELETE_USER_FAILED';
    const errorMessage = error?.message || 'Não foi possível excluir o utilizador.';
    console.error('[Admin Delete User]', {
      traceId,
      stage,
      errorCode,
      errorMessage,
    });
    return res.status(error?.statusCode || 500).json({
      success: false,
      error: errorCode,
      errorMessage,
      stage,
      traceId,
    });
  }
}
