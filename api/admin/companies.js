'use strict';

const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getFirebaseApp, verifyFirebaseToken } = require('../_firebase.js');
const {
  COMPANIES_COLLECTION,
  buildCompanyPayload,
  mapCompanyDoc,
} = require('../_companies.js');

const parseAllowedAdminEmails = (rawValue) =>
  (rawValue || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const ADMIN_ALLOWED_EMAILS = parseAllowedAdminEmails(
  process.env.ADMIN_ALLOWED_EMAILS || 'j.diaz@ilssg.org'
);

const ensureAuthorizedAdmin = async (req, res) => {
  const decodedToken = await verifyFirebaseToken(req, res);
  if (!decodedToken) return null;

  const requesterEmail = (decodedToken.email || '').toLowerCase();
  const provider = decodedToken.firebase?.sign_in_provider || '';
  const isAllowedAdminEmail = ADMIN_ALLOWED_EMAILS.includes(requesterEmail);

  if (!isAllowedAdminEmail || provider !== 'google.com') {
    res.status(403).json({ error: 'Forbidden. Admin access requires Google sign-in with authorized email.' });
    return null;
  }

  return decodedToken;
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const decodedToken = await ensureAuthorizedAdmin(req, res);
  if (!decodedToken) return;

  const app = getFirebaseApp();
  const db = getFirestore(app);

  if (req.method === 'GET') {
    try {
      const snap = await db
        .collection(COMPANIES_COLLECTION)
        .orderBy('nameLower')
        .limit(250)
        .get();

      res.status(200).json({
        ok: true,
        companies: snap.docs.map(mapCompanyDoc),
      });
    } catch (error) {
      console.error('[admin-companies:list] Failed:', error.message);
      res.status(500).json({ error: 'Could not list companies.' });
    }
    return;
  }

  const { payload, error } = buildCompanyPayload(req.body);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  try {
    const now = FieldValue.serverTimestamp();
    const docRef = await db.collection(COMPANIES_COLLECTION).add({
      ...payload,
      createdBy: decodedToken.uid,
      createdAt: now,
      updatedAt: now,
    });
    const createdSnap = await docRef.get();

    res.status(201).json({
      ok: true,
      company: mapCompanyDoc(createdSnap),
    });
  } catch (error) {
    console.error('[admin-companies:create] Failed:', error.message);
    res.status(500).json({ error: 'Could not create company.' });
  }
};
