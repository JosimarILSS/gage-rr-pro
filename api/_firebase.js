'use strict';

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

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

  throw new Error(
    '[firebase] No credentials found. Set FIREBASE_SERVICE_ACCOUNT_KEY or the three split vars.'
  );
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

const syncUserToFirestore = async (uid, userRecord, session, source) => {
  const app = getFirebaseApp();
  const db = getFirestore(app);
  const now = FieldValue.serverTimestamp();
  const userRef = db.collection('usuarios').doc(uid);

  const paymentEntry = session
    ? {
        stripeSessionId: session.id,
        stripePaymentStatus: session.payment_status,
        stripeAmountTotal: session.amount_total,
        stripeCurrency: session.currency,
        source,
        grantedAt: now,
      }
    : null;

  const premiumData = {
    premium: true,
    premiumGrantedAt: now,
    premiumSource: source,
    email: userRecord.email || null,
    displayName: userRecord.displayName || null,
    updatedAt: now,
  };

  const updatePayload = paymentEntry
    ? {
        ...premiumData,
        payments: FieldValue.arrayUnion(paymentEntry),
        lastStripeSessionId: session.id,
      }
    : premiumData;

  await userRef.set(
    { uid, createdAt: now, ...updatePayload },
    { merge: true }
  );

  console.log(`[firestore] Usuario ${uid} sincronizado en 'usuarios'`);
};

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

  await auth.setCustomUserClaims(firebaseUid, {
    ...existingClaims,
    premium: true,
    premiumSource: source,
    premiumSessionId: session.id,
    premiumUpdatedAt: Date.now(),
  });

  console.log(`[firebase] premium=true set for uid ${firebaseUid}`);

  try {
    await syncUserToFirestore(firebaseUid, userRecord, session, source);
  } catch (err) {
    console.error('[firestore] Sync failed — code:', err.code);
    console.error('[firestore] Sync failed — message:', err.message);
    console.error('[firestore] Sync failed — stack:', err.stack);
  }
};

module.exports = { verifyFirebaseToken, grantPremiumAccessFromSession };
