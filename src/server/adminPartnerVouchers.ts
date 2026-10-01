import type { Request, Response } from 'express';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const COUNTERS = ['usageCount', 'attributedListingsCount', 'fundedFreeStandardCount', 'firstFreeAttributedCount'] as const;

function normaliseCode(value: unknown) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

function optionalTimestamp(value: unknown, endOfDay = false): Timestamp | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('INVALID_DATE');
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  if (Number.isNaN(date.getTime())) throw new Error('INVALID_DATE');
  return Timestamp.fromDate(date);
}

function serialise(value: any): any {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialise);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialise(item)]));
  }
  return value;
}

function readInput(body: any, creating: boolean) {
  const code = normaliseCode(body.code);
  const partnerName = String(body.partnerName || '').trim();
  if (creating && !code) throw new Error('INVALID_CODE');
  if (!partnerName) throw new Error('INVALID_PARTNER_NAME');
  const allowedCategories = Array.isArray(body.allowedCategories)
    ? [...new Set<string>(body.allowedCategories.map((item: unknown) => String(item || '').trim()).filter(Boolean))]
    : [];
  if (allowedCategories.length > 100 || allowedCategories.some(category => category.length > 120)) throw new Error('INVALID_CATEGORIES');

  let maxUses: number | null = null;
  if (body.maxUses !== undefined && body.maxUses !== null && body.maxUses !== '') {
    maxUses = Number(body.maxUses);
    if (!Number.isInteger(maxUses) || maxUses < 1) throw new Error('INVALID_MAX_USES');
  }
  return {
    code, partnerName, active: body.active === true, allowedCategories, maxUses,
    startsAt: optionalTimestamp(body.startsAt), expiresAt: optionalTimestamp(body.expiresAt, true),
  };
}

export async function handleAdminPartnerVouchers(
  req: Request,
  res: Response,
  db: FirebaseFirestore.Firestore,
  admin: { uid: string; email: string },
) {
  try {
    const action = String(req.body?.action || '');
    if (action === 'partnerVouchersList') {
      const snapshot = await db.collection('partnerVouchers').get();
      const vouchers = snapshot.docs.map(doc => ({ code: doc.id, ...serialise(doc.data()) }))
        .sort((a: any, b: any) => String(a.code).localeCompare(String(b.code)));
      return res.status(200).json({ success: true, vouchers });
    }

    if (action === 'partnerVoucherUsagesList') {
      const code = normaliseCode(req.body?.code);
      if (!code) return res.status(400).json({ success: false, error: 'INVALID_CODE', errorMessage: 'Voucher code is required.' });
      const snapshot = await db.collection('partnerVoucherUsages').where('partnerCode', '==', code).get();
      const usages = snapshot.docs.map(doc => ({ id: doc.id, ...serialise(doc.data()) }))
        .sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      return res.status(200).json({ success: true, usages });
    }

    if (action === 'partnerVoucherCreate') {
      const input = readInput(req.body, true);
      const ref = db.collection('partnerVouchers').doc(input.code);
      if ((await ref.get()).exists) return res.status(409).json({ success: false, error: 'VOUCHER_EXISTS', errorMessage: 'A voucher with this code already exists.' });
      const data: Record<string, any> = {
        partnerName: input.partnerName, active: input.active, allowedCategories: input.allowedCategories,
        usageCount: 0, attributedListingsCount: 0, fundedFreeStandardCount: 0, firstFreeAttributedCount: 0,
        createdAt: FieldValue.serverTimestamp(), createdByUid: admin.uid, createdByEmail: admin.email,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (input.startsAt) data.startsAt = input.startsAt;
      if (input.expiresAt) data.expiresAt = input.expiresAt;
      if (input.maxUses !== null) data.maxUses = input.maxUses;
      await ref.create(data);
      return res.status(201).json({ success: true, code: input.code });
    }

    if (action === 'partnerVoucherUpdate') {
      const input = readInput(req.body, false);
      const code = normaliseCode(req.body?.code);
      if (!code) return res.status(400).json({ success: false, error: 'INVALID_CODE', errorMessage: 'Voucher code is required.' });
      const ref = db.collection('partnerVouchers').doc(code);
      if (!(await ref.get()).exists) return res.status(404).json({ success: false, error: 'VOUCHER_NOT_FOUND', errorMessage: 'Voucher not found.' });
      const updates: Record<string, any> = {
        partnerName: input.partnerName, active: input.active, allowedCategories: input.allowedCategories,
        startsAt: input.startsAt || FieldValue.delete(), expiresAt: input.expiresAt || FieldValue.delete(),
        maxUses: input.maxUses === null ? FieldValue.delete() : input.maxUses,
        updatedAt: FieldValue.serverTimestamp(), updatedByUid: admin.uid, updatedByEmail: admin.email,
      };
      for (const counter of COUNTERS) delete updates[counter];
      await ref.update(updates);
      return res.status(200).json({ success: true, code });
    }
    return res.status(400).json({ success: false, error: 'INVALID_ACTION', errorMessage: 'Unknown Partner Voucher action.' });
  } catch (error: any) {
    const code = String(error?.message || 'UNKNOWN_ERROR');
    const messages: Record<string, string> = {
      INVALID_CODE: 'Voucher code is required and may contain only letters, numbers, underscores and hyphens.',
      INVALID_PARTNER_NAME: 'Partner Name is required.', INVALID_CATEGORIES: 'Allowed Categories are invalid.',
      INVALID_DATE: 'Starts At and Expires At must be valid dates.',
      INVALID_MAX_USES: 'Max Uses must be a positive whole number or left empty.',
    };
    console.error('[Admin Partner Vouchers]', error);
    return res.status(messages[code] ? 400 : 500).json({ success: false, error: code, errorMessage: messages[code] || 'Could not manage Partner Vouchers.' });
  }
}
