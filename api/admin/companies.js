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

const findActiveCompanyByDomainQuery = async (db, queryField, operator, emailDomain, currentCompanyId) => {
  const snap = await db
    .collection(COMPANIES_COLLECTION)
    .where(queryField, operator, emailDomain)
    .limit(5)
    .get();

  const conflictingDoc = snap.docs.find((docSnap) => {
    const data = docSnap.data() || {};
    return (
      docSnap.id !== currentCompanyId &&
      data.emailDomainEnabled === true &&
      data.isActive !== false
    );
  });

  return conflictingDoc ? mapCompanyDoc(conflictingDoc) : null;
};

const ensureUniqueActiveDomains = async (db, emailDomains, currentCompanyId = null) => {
  for (const emailDomain of emailDomains) {
    const arrayConflict = await findActiveCompanyByDomainQuery(
      db,
      'emailDomainsLower',
      'array-contains',
      emailDomain,
      currentCompanyId
    );
    if (arrayConflict) return { company: arrayConflict, emailDomain };

    const legacyConflict = await findActiveCompanyByDomainQuery(
      db,
      'emailDomainLower',
      '==',
      emailDomain,
      currentCompanyId
    );
    if (legacyConflict) return { company: legacyConflict, emailDomain };
  }

  return null;
};

module.exports = async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) {
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

  if (req.method === 'DELETE') {
    const companyId = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
    if (!companyId) {
      res.status(400).json({ error: 'Company id is required.' });
      return;
    }

    try {
      const companyRef = db.collection(COMPANIES_COLLECTION).doc(companyId);
      const companySnap = await companyRef.get();
      if (!companySnap.exists) {
        res.status(404).json({ error: 'Company not found.' });
        return;
      }

      const assignedUsersSnap = await db
        .collection('usuarios')
        .where('companyId', '==', companyId)
        .get();

      const serverNow = FieldValue.serverTimestamp();
      let batch = db.batch();
      let operations = 0;
      let affectedUsers = 0;

      for (const userDoc of assignedUsersSnap.docs) {
        batch.update(userDoc.ref, {
          companyId: null,
          updatedAt: serverNow,
        });
        operations += 1;
        affectedUsers += 1;

        if (operations >= 450) {
          await batch.commit();
          batch = db.batch();
          operations = 0;
        }
      }

      batch.delete(companyRef);
      await batch.commit();

      res.status(200).json({
        ok: true,
        id: companyId,
        affectedUsers,
      });
    } catch (error) {
      console.error('[admin-companies:delete] Failed:', error.message);
      res.status(500).json({ error: 'Could not delete company.' });
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

    if (req.method === 'PATCH') {
      const companyId = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
      if (!companyId) {
        res.status(400).json({ error: 'Company id is required.' });
        return;
      }

      const companyRef = db.collection(COMPANIES_COLLECTION).doc(companyId);
      const companySnap = await companyRef.get();
      if (!companySnap.exists) {
        res.status(404).json({ error: 'Company not found.' });
        return;
      }

      if (payload.emailDomainEnabled) {
        const conflict = await ensureUniqueActiveDomains(db, payload.emailDomains, companyId);
        if (conflict) {
          res.status(409).json({
            error: `Domain @${conflict.emailDomain} already assigned to ${conflict.company.name}.`,
          });
          return;
        }
      }

      await companyRef.update({
        ...payload,
        updatedBy: decodedToken.uid,
        updatedAt: now,
      });

      const updatedSnap = await companyRef.get();
      res.status(200).json({
        ok: true,
        company: mapCompanyDoc(updatedSnap),
      });
      return;
    }

    if (payload.emailDomainEnabled) {
      const conflict = await ensureUniqueActiveDomains(db, payload.emailDomains);
      if (conflict) {
        res.status(409).json({
          error: `Domain @${conflict.emailDomain} already assigned to ${conflict.company.name}.`,
        });
        return;
      }
    }

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
