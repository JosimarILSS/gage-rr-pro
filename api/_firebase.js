import admin from 'firebase-admin';

export const initFirebaseAdmin = () => {
  if (admin.apps.length > 0) return;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return;
  }

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
    return;
  }

  admin.initializeApp({ credential: admin.credential.applicationDefault() });
};

export const verifyFirebaseToken = async (req, res) => {
  initFirebaseAdmin();
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token.' });
    return null;
  }

  const idToken = authorization.slice('Bearer '.length);
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    res.status(401).json({ error: 'Invalid Firebase ID token.' });
    return null;
  }
};

export const grantPremiumAccessFromSession = async (session, source) => {
  initFirebaseAdmin();
  const firebaseUid = session?.metadata?.firebaseUid || session?.client_reference_id;
  if (!firebaseUid) throw new Error('Session has no firebase uid metadata.');

  const paymentStatus = session.payment_status;
  if (paymentStatus !== 'paid' && paymentStatus !== 'no_payment_required') {
    throw new Error(`Session ${session.id} is not paid yet. payment_status=${paymentStatus}`);
  }

  const auth = admin.auth();
  const userRecord = await auth.getUser(firebaseUid);
  const existingClaims = userRecord.customClaims || {};
  await auth.setCustomUserClaims(firebaseUid, {
    ...existingClaims,
    premium: true,
    premiumSource: source,
    premiumSessionId: session.id,
    premiumUpdatedAt: Date.now(),
  });
};
