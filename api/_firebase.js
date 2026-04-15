'use strict';

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const getFirebaseApp = () => {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  console.log('[firebase] SERVICE_ACCOUNT_KEY present:', !!serviceAccountJson);
  console.log('[firebase] PROJECT_ID present:', !!projectId);

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    return initializeApp({ credential: cert(serviceAccount) });
  }

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  }

  throw new Error('[firebase] No credentials found. Set FIREBASE_SERVICE_ACCOUNT_KEY or the three split vars.');
};

const verifyFirebaseToken = async (req, res) => {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token.' });
    return null;
  }

  const idToken = authorization.slice('Bearer '.length);
  try {
    const app = getFirebaseApp();
    return await getAuth(app).verifyIdToken(idToken);
  } catch (error) {
    console.error('[firebase] Token verification failed:', error.message);
    res.status(401).json({ error: 'Invalid Firebase ID token.' });
    return null;
  }
};

/**
 * Crea el documento del usuario en Firestore si no existe todavía.
 * Se llama al hacer login por primera vez.
 */
const registerUserIfNew = async (uid) => {
  const app = getFirebaseApp();
  const db = getFirestore(app);
  const auth = getAuth(app);
  const userRef = db.collection('usuarios').doc(uid);

  const doc = await userRef.get();
  if (doc.exists) {
    console.log(`[register] Usuario ${uid} ya existe en Firestore`);
    return;
  }

  const userRecord = await auth.getUser(uid);
  const now = FieldValue.serverTimestamp();

  await userRef.set({
    uid,
    email: userRecord.email || null,
    displayName: userRecord.displayName || null,
    photoURL: userRecord.photoURL || null,
    premium: false,
    premiumExpiresAt: null,
    premiumGrantedAt: null,
    premiumSource: null,
    lastStripeSessionId: null,
    payments: [],
    createdAt: now,
    updatedAt: now,
  });

  console.log(`[register] Usuario ${uid} creado en Firestore`);
};

/**
 * Calcula la fecha de expiración: siempre 6 meses exactos desde el momento del pago.
 */
const calcNewExpiration = () => {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth() + 6,
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  );
};

/**
 * Escribe/actualiza el documento del usuario en Firestore al completar un pago.
 */
const syncUserToFirestore = async (uid, userRecord, session, source) => {
  const app = getFirebaseApp();
  const db = getFirestore(app);
  const now = FieldValue.serverTimestamp();
  const nowIso = new Date().toISOString(); // Para usar dentro de arrays (serverTimestamp no aplica)
  const userRef = db.collection('usuarios').doc(uid);

  const newExpiration = calcNewExpiration();
  const newExpirationTimestamp = Timestamp.fromDate(newExpiration);

  const paymentEntry = session
    ? {
        stripeSessionId: session.id,
        stripePaymentStatus: session.payment_status,
        stripeAmountTotal: session.amount_total,
        stripeCurrency: session.currency,
        source,
        grantedAt: nowIso,
        expiresAt: newExpiration.toISOString(),
      }
    : null;

  const updatePayload = {
    premium: true,
    premiumGrantedAt: now,
    premiumExpiresAt: newExpirationTimestamp,
    premiumSource: source,
    email: userRecord.email || null,
    displayName: userRecord.displayName || null,
    updatedAt: now,
    ...(paymentEntry && {
      payments: FieldValue.arrayUnion(paymentEntry),
      lastStripeSessionId: session.id,
    }),
  };

  await userRef.set(
    { uid, createdAt: now, ...updatePayload },
    { merge: true }
  );

  console.log(`[firestore] Usuario ${uid} actualizado. premiumExpiresAt: ${newExpiration.toISOString()}`);

  return newExpirationTimestamp;
};

/**
 * Otorga premium vía Custom Claims y registra el pago en Firestore.
 */
const grantPremiumAccessFromSession = async (session, source) => {
  const firebaseUid = session?.metadata?.firebaseUid || session?.client_reference_id;
  if (!firebaseUid) throw new Error('Session has no firebase uid metadata.');

  const paymentStatus = session.payment_status;
  if (paymentStatus !== 'paid' && paymentStatus !== 'no_payment_required') {
    throw new Error(`Session ${session.id} not paid. payment_status=${paymentStatus}`);
  }

  const app = getFirebaseApp();
  const auth = getAuth(app);
  const userRecord = await auth.getUser(firebaseUid);
  const existingClaims = userRecord.customClaims || {};

  // Primero sincronizar Firestore para obtener la fecha de expiración calculada
  let expiresAt;
  try {
    expiresAt = await syncUserToFirestore(firebaseUid, userRecord, session, source);
  } catch (err) {
    console.error('[firestore] Sync failed — code:', err.code);
    console.error('[firestore] Sync failed — message:', err.message);
    console.error('[firestore] Sync failed — stack:', err.stack);
  }

  // Actualizar Custom Claims con la fecha de expiración
  await auth.setCustomUserClaims(firebaseUid, {
    ...existingClaims,
    premium: true,
    premiumSource: source,
    premiumSessionId: session.id,
    premiumUpdatedAt: Date.now(),
    premiumExpiresAt: expiresAt ? expiresAt.toMillis() : null,
  });

  console.log(`[firebase] premium=true set for uid ${firebaseUid}`);
};

module.exports = { verifyFirebaseToken, grantPremiumAccessFromSession, registerUserIfNew };
