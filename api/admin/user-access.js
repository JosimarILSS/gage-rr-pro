'use strict';

const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getFirebaseApp, verifyFirebaseToken } = require('../_firebase.js');

const ADMIN_EMAIL = 'j.diaz@ilssg.org';

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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const decodedToken = await verifyFirebaseToken(req, res);
  if (!decodedToken) return;

  const requesterEmail = (decodedToken.email || '').toLowerCase();
  const provider = decodedToken.firebase?.sign_in_provider || '';

  if (requesterEmail !== ADMIN_EMAIL || provider !== 'google.com') {
    res.status(403).json({ error: 'Forbidden. Admin access requires Google sign-in with authorized email.' });
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

  const app = getFirebaseApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

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
    });
  } catch (error) {
    console.error('[admin-user-access] Failed:', error.message);
    res.status(500).json({ error: 'Could not manage user access.' });
  }
};
