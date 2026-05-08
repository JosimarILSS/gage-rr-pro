'use strict';

const { getFirestore } = require('firebase-admin/firestore');
const { getFirebaseApp, verifyFirebaseToken } = require('../_firebase.js');
const {
  COMPANIES_COLLECTION,
  mapCompanyDoc,
  normalizeCompanyIdInput,
} = require('../_companies.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const decodedToken = await verifyFirebaseToken(req, res);
  if (!decodedToken) return;

  try {
    const app = getFirebaseApp();
    const db = getFirestore(app);
    const userSnap = await db.collection('usuarios').doc(decodedToken.uid).get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const companyId =
      normalizeCompanyIdInput(userData.companyId) ||
      normalizeCompanyIdInput(decodedToken.companyId);

    if (!companyId) {
      res.status(200).json({ ok: true, companyBrand: null });
      return;
    }

    const companySnap = await db.collection(COMPANIES_COLLECTION).doc(companyId).get();
    if (!companySnap.exists) {
      res.status(200).json({ ok: true, companyBrand: null });
      return;
    }

    res.status(200).json({
      ok: true,
      companyBrand: mapCompanyDoc(companySnap),
    });
  } catch (error) {
    console.error('[user-company-brand] Failed:', error.message);
    res.status(500).json({ error: 'Could not read company brand.' });
  }
};
