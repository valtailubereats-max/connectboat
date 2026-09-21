import type { Request, Response } from 'express';
import { randomBytes, createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { brokerDb, brokerIdentity, getBrokerState, hasValidBrokerReferral, isEligibleBrokerAd } from './brokerProgram';

const text = (value: unknown, max: number) => String(value || '').trim().slice(0, max);
const hash = (code: string) => createHash('sha256').update(code.trim().toUpperCase()).digest('hex');

function validUrl(value: string) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}

export default async function brokerHandler(req: Request, res: Response) {
  try {
    const actor = await brokerIdentity(req);
    const db = brokerDb();
    const action = text(req.body?.action, 47).replace(/^broker_/, '');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

    if (action === 'status') {
      const uid = actor.isAdmin && req.body?.uid ? text(req.body.uid, 128) : actor.uid;
      const state = await getBrokerState(db, uid);
      const application = await db.collection('brokerApplications').doc(uid).get();
      const validReferral = state.profile?.status === 'active' ? await hasValidBrokerReferral(db, uid) : false;
      return res.json({ ...state, ads: undefined, application: application.data() || null, validReferral, referralLink: `${req.headers.origin || 'https://connectboat.co.uk'}/brokers?ref=${encodeURIComponent(uid)}` });
    }

    if (action === 'apply') {
      const data = req.body || {};
      const links = Array.isArray(data.boatLinks) ? data.boatLinks.map((item: unknown) => text(item, 500)) : [];
      const proofType = text(data.proofType, 30);
      const proof = text(data.proof, 500);
      const fields = ['fullName', 'companyName', 'professionalEmail', 'phone', 'website', 'description'];
      if (fields.some(key => !text(data[key], 1000)) || links.length < 3 || links.some((url: string) => !validUrl(url)) ||
          new Set(links).size !== links.length || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(data.professionalEmail, 200)) ||
          !validUrl(text(data.website, 500)) || !['company_number', 'broker_profile', 'association', 'insurance_certificate'].includes(proofType) ||
          !proof || (proofType !== 'company_number' && !validUrl(proof))) {
        return res.status(400).json({ error: 'Complete all fields, three boat links and one valid professional proof.' });
      }
      const ref = db.collection('brokerApplications').doc(actor.uid);
      const referredBy = text(data.referredBy, 128);
      const referrer = referredBy && referredBy !== actor.uid ? await db.collection('brokerProfiles').doc(referredBy).get() : null;
      const identityRefs = [db.collection('brokerApplicantKeys').doc(`email_${hash(text(data.professionalEmail, 200))}`)];
      if (proofType === 'company_number') identityRefs.push(db.collection('brokerApplicantKeys').doc(`company_${hash(proof)}`));
      await db.runTransaction(async tx => {
        const [current, ...identities] = await Promise.all([tx.get(ref), ...identityRefs.map(item => tx.get(item))]);
        if (current.exists && !['rejected', 'draft'].includes(current.data()?.status)) throw new Error('An application is already under review or approved.');
        if (identities.some(item => item.exists && item.data()?.uid !== actor.uid)) throw new Error('This company or professional email has already been used in another broker application.');
        for (const keyRef of identityRefs) tx.set(keyRef, { uid: actor.uid, createdAt: FieldValue.serverTimestamp() }, { merge: true });
        tx.set(ref, { uid: actor.uid, fullName: text(data.fullName, 100), companyName: text(data.companyName, 150), professionalEmail: text(data.professionalEmail, 200).toLowerCase(), phone: text(data.phone, 40), website: text(data.website, 500), boatLinks: links.slice(0, 10), description: text(data.description, 1500), proofType, proof, referredBy: referrer?.data()?.status === 'active' ? referredBy : null, status: 'pending', submittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      });
      return res.json({ success: true });
    }

    if (action === 'activate') {
      const code = text(req.body?.code, 100).toUpperCase();
      if (!/^CB-[A-Z0-9]{16}$/.test(code)) return res.status(400).json({ error: 'Invalid broker code.' });
      const codeRef = db.collection('brokerCodes').doc(hash(code));
      const profileRef = db.collection('brokerProfiles').doc(actor.uid);
      await db.runTransaction(async tx => {
        const [codeSnap, profileSnap] = await Promise.all([tx.get(codeRef), tx.get(profileRef)]);
        const issued = codeSnap.data();
        if (!issued || issued.status !== 'issued' || issued.uid !== actor.uid || issued.expiresAt?.toDate?.() < new Date() || profileSnap.exists) throw new Error('Code expired, already used or assigned to another account.');
        tx.update(codeRef, { status: 'used', usedAt: FieldValue.serverTimestamp(), usedBy: actor.uid });
        tx.set(profileRef, { uid: actor.uid, status: 'active', initialTier: issued.initialTier, currentDiscount: issued.initialTier, activatedAt: FieldValue.serverTimestamp(), referredBy: issued.referredBy || null, codeId: codeRef.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      });
      return res.json({ success: true });
    }

    if (action === 'recordApproval') {
      if (!actor.isAdmin && !actor.isModerator) return res.status(403).json({ error: 'Staff access required.' });
      const adId = text(req.body?.adId, 128);
      const ad = await db.collection('ads').doc(adId).get();
      if (!ad.exists || !isEligibleBrokerAd(ad.data() || {})) return res.status(409).json({ error: 'Listing is not paid and approved.' });
      try { await db.collection('brokerEligibleAds').doc(adId).create({ adId, sellerId: ad.data()?.sellerId, category: ad.data()?.category, paidAt: ad.data()?.paidAt, approvedAt: new Date() }); }
      catch (error: any) { if (error.code !== 6) throw error; }
      return res.json({ success: true });
    }
    if (!actor.isAdmin) return res.status(403).json({ error: 'Admin access required.' });
    if (action === 'list') {
      const [applications, profiles, codes] = await Promise.all([db.collection('brokerApplications').get(), db.collection('brokerProfiles').get(), db.collection('brokerCodes').get()]);
      return res.json({ applications: applications.docs.map(doc => ({ id: doc.id, ...doc.data() })), profiles: profiles.docs.map(doc => ({ id: doc.id, ...doc.data() })), codes: codes.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
    }
    if (action === 'decide') {
      const uid = text(req.body?.uid, 128);
      const decision = text(req.body?.decision, 20);
      if (!uid || !['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'Invalid decision.' });
      const ref = db.collection('brokerApplications').doc(uid);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.status !== 'pending') return res.status(409).json({ error: 'Application is not pending.' });
      await ref.update({ status: decision, internalNote: text(req.body?.note, 1500), reviewedAt: FieldValue.serverTimestamp(), reviewedBy: actor.uid });
      return res.json({ success: true });
    }
    if (action === 'note') {
      const uid = text(req.body?.uid, 128);
      const ref = db.collection('brokerApplications').doc(uid);
      if (!(await ref.get()).exists) return res.status(404).json({ error: 'Application not found.' });
      await ref.update({ internalNote: text(req.body?.note, 1500), noteUpdatedAt: FieldValue.serverTimestamp(), noteUpdatedBy: actor.uid });
      return res.json({ success: true });
    }
    if (action === 'issue') {
      const uid = text(req.body?.uid, 128);
      const application = await db.collection('brokerApplications').doc(uid).get();
      const existingProfile = await db.collection('brokerProfiles').doc(uid).get();
      const tier = Number(req.body?.initialTier || 5);
      if (application.data()?.status !== 'approved' || existingProfile.data()?.status === 'active' || ![5, 10, 20, 30].includes(tier)) return res.status(409).json({ error: 'An approved, inactive application and valid starting tier are required.' });
      const code = `CB-${randomBytes(8).toString('hex').toUpperCase()}`;
      const expires = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
      if (expires && (!Number.isFinite(expires.getTime()) || expires <= new Date())) return res.status(400).json({ error: 'Expiry must be in the future.' });
      await db.collection('brokerCodes').doc(hash(code)).create({ uid, status: 'issued', initialTier: tier, referredBy: application.data()?.referredBy || null, issuedAt: FieldValue.serverTimestamp(), issuedBy: actor.uid, expiresAt: expires });
      return res.json({ success: true, code });
    }
    if (action === 'revoke') {
      const uid = text(req.body?.uid, 128);
      const reason = text(req.body?.reason, 1000);
      if (!uid || !reason) return res.status(400).json({ error: 'Account and reason are required.' });
      const profileRef = db.collection('brokerProfiles').doc(uid);
      const profile = await profileRef.get();
      if (!profile.exists) return res.status(404).json({ error: 'Broker not found.' });
      await profileRef.update({ status: 'revoked', revokedAt: FieldValue.serverTimestamp(), revokedBy: actor.uid, revocationReason: reason });
      return res.json({ success: true });
    }
    if (action === 'revokeCode') {
      const codeId = text(req.body?.codeId, 100);
      const ref = db.collection('brokerCodes').doc(codeId);
      const snap = await ref.get();
      if (snap.data()?.status !== 'issued') return res.status(409).json({ error: 'Only unused codes can be revoked.' });
      await ref.update({ status: 'revoked', revokedAt: FieldValue.serverTimestamp(), revokedBy: actor.uid });
      return res.json({ success: true });
    }
    return res.status(400).json({ error: 'Unknown action.' });
  } catch (error: any) {
    const message = String(error?.message || 'Broker request failed.');
    return res.status(message === 'UNAUTHENTICATED' ? 401 : 400).json({ error: message });
  }
}
