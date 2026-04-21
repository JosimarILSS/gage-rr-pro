'use strict';

const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getFirebaseApp, verifyFirebaseToken } = require('../_firebase.js');

const parseAllowedAdminEmails = (rawValue) =>
  (rawValue || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const ADMIN_ALLOWED_EMAILS = parseAllowedAdminEmails(
  process.env.ADMIN_ALLOWED_EMAILS || 'j.diaz@ilssg.org'
);

const addMonths = (date, amount) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
};

const toDateOrNull = (value) => {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'number') return new Date(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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

const parsePageSize = (rawValue) => {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) return 30;
  return Math.min(parsed, 100);
};

const toIsoOrNull = (value) => {
  const parsed = toDateOrNull(value);
  return parsed ? parsed.toISOString() : null;
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const decodedToken = await ensureAuthorizedAdmin(req, res);
  if (!decodedToken) return;

  const app = getFirebaseApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  if (req.method === 'GET') {
    const pageSize = parsePageSize(req.query?.pageSize);
    const pageToken = typeof req.query?.pageToken === 'string' ? req.query.pageToken : undefined;

    try {
      const listedUsers = await auth.listUsers(pageSize, pageToken);
      const userRecords = listedUsers.users || [];

      const usersRef = db.collection('usuarios');
      const profileRefs = userRecords.map((record) => usersRef.doc(record.uid));
      const profileDocs = profileRefs.length > 0 ? await db.getAll(...profileRefs) : [];

      const profileByUid = new Map();
      profileDocs.forEach((docSnap) => {
        profileByUid.set(docSnap.id, docSnap.exists ? docSnap.data() : null);
      });

      const nowMs = Date.now();
      const users = userRecords.map((record) => {
        const profile = profileByUid.get(record.uid) || {};
        const email = (record.email || profile.email || '').toLowerCase();
        const premiumFromFirestore = typeof profile.premium === 'boolean' ? profile.premium : undefined;
        const premiumFromClaims = typeof record.customClaims?.premium === 'boolean'
          ? record.customClaims.premium
          : false;
        const premium = premiumFromFirestore ?? premiumFromClaims;

        const expiresAtDate = toDateOrNull(profile.premiumExpiresAt) || toDateOrNull(record.customClaims?.premiumExpiresAt);
        const grantedAtDate = toDateOrNull(profile.premiumGrantedAt);
        const premiumActive = premium && (!expiresAtDate || expiresAtDate.getTime() > nowMs);

        return {
          uid: record.uid,
          email,
          displayName: record.displayName || profile.displayName || null,
          photoURL: record.photoURL || profile.photoURL || null,
          premium,
          premiumActive,
          premiumUnlimited: premium && !expiresAtDate,
          premiumGrantedAt: grantedAtDate ? grantedAtDate.toISOString() : null,
          premiumExpiresAt: expiresAtDate ? expiresAtDate.toISOString() : null,
          createdAt: toIsoOrNull(profile.createdAt || record.metadata?.creationTime),
          lastSignInAt: toIsoOrNull(record.metadata?.lastSignInTime),
        };
      });

      res.status(200).json({
        ok: true,
        users,
        nextPageToken: listedUsers.pageToken || null,
      });
    } catch (error) {
      console.error('[admin-user-access:list] Failed:', error.message);
      res.status(500).json({ error: 'Could not list users.' });
    }
    return;
  }

  const emailRaw = req.body?.email;
  const premiumRaw = req.body?.premium;
  const unlimitedRaw = req.body?.unlimited;
  const monthsRaw = req.body?.months;

  const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';
  const premium = typeof premiumRaw === 'boolean' ? premiumRaw : null;
  const unlimited = unlimitedRaw === true;
  const months = monthsRaw == null || monthsRaw === '' ? 6 : Number(monthsRaw);

  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: 'Invalid email.' });
    return;
  }

  if (premium === null) {
    res.status(400).json({ error: 'premium must be true or false.' });
    return;
  }

  if (!premium && unlimited) {
    res.status(400).json({ error: 'unlimited only applies when premium is true.' });
    return;
  }

  if (premium && !unlimited && (!Number.isInteger(months) || months <= 0)) {
    res.status(400).json({ error: 'months must be a positive integer.' });
    return;
  }

  try {
    let userRecord;
    let created = false;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (err) {
      if (err?.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({ email });
        created = true;
      } else {
        throw err;
      }
    }

    const uid = userRecord.uid;
    const userRef = db.collection('usuarios').doc(uid);
    const snap = await userRef.get();
    const now = new Date();

    let premiumExpiresAt = null;
    let premiumExpiresAtTimestamp = null;

    if (premium) {
      if (unlimited) {
        premiumExpiresAt = null;
        premiumExpiresAtTimestamp = null;
      } else {
        const currentExpiration = snap.exists ? toDateOrNull(snap.data().premiumExpiresAt) : null;
        const baseDate =
          currentExpiration && currentExpiration.getTime() > now.getTime()
            ? currentExpiration
            : now;
        premiumExpiresAt = addMonths(baseDate, months);
        premiumExpiresAtTimestamp = Timestamp.fromDate(premiumExpiresAt);
      }
    }

    const existingClaims = userRecord.customClaims || {};
    await auth.setCustomUserClaims(uid, {
      ...existingClaims,
      premium,
      premiumSource: premium ? 'manual' : null,
      premiumUpdatedAt: Date.now(),
      premiumExpiresAt: premiumExpiresAtTimestamp ? premiumExpiresAtTimestamp.toMillis() : null,
    });

    const serverNow = FieldValue.serverTimestamp();
    if (!snap.exists) {
      await userRef.set({
        uid,
        email: userRecord.email || null,
        displayName: userRecord.displayName || null,
        photoURL: userRecord.photoURL || null,
        premium,
        premiumExpiresAt: premiumExpiresAtTimestamp,
        premiumGrantedAt: premium ? serverNow : null,
        premiumSource: premium ? 'manual' : null,
        lastStripeSessionId: null,
        payments: [],
        createdAt: serverNow,
        updatedAt: serverNow,
      });
    } else {
      const update = {
        premium,
        premiumExpiresAt: premiumExpiresAtTimestamp,
        premiumSource: premium ? (snap.data().premiumSource || 'manual') : null,
        updatedAt: serverNow,
      };
      if (premium && !snap.data().premiumGrantedAt) {
        update.premiumGrantedAt = serverNow;
      }
      if (!premium) {
        update.premiumGrantedAt = null;
      }
      await userRef.update(update);
    }

    res.status(200).json({
      ok: true,
      uid,
      email,
      created,
      premium,
      unlimited: premium ? unlimited : false,
      monthsApplied: premium && !unlimited ? months : null,
      expiresAt: premiumExpiresAt ? premiumExpiresAt.toISOString() : null,
      premiumGrantedAt: premium ? now.toISOString() : null,
    });
  } catch (error) {
    console.error('[admin-user-access] Failed:', error.message);
    res.status(500).json({ error: 'Could not manage user access.' });
  }
};
