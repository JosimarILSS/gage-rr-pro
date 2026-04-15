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

/**
 * Escribe o actualiza el documento users/{uid} en Firestore con los datos del pago.
 * Si el documento no existe lo crea; si ya existe hace merge para no sobreescribir
 * campos que pudieran haberse puesto manualmente (p. ej. acceso gratuito manual).
 */
const syncUserToFirestore = async (uid, userRecord, session, source) => {
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const userRef = db.collection('usuarios').doc(uid);

  const paymentEntry = session
    ? {
        stripeSessionId: session.id,
        stripePaymentStatus: session.payment_status,
        stripeAmountTotal: session.amount_total,        // en centavos
        stripeCurrency: session.currency,
        source,
        grantedAt: now,
      }
    : null;

  // Datos que siempre se actualizan al otorgar premium
  const premiumData = {
    premium: true,
    premiumGrantedAt: now,
    premiumSource: source,
    email: userRecord.email || null,
    displayName: userRecord.displayName || null,
    updatedAt: now,
  };

  // Si hay sesión de Stripe, añadimos el pago al array de pagos
  const updatePayload = paymentEntry
    ? {
        ...premiumData,
        payments: admin.firestore.FieldValue.arrayUnion(paymentEntry),
        lastStripeSessionId: session.id,
      }
    : premiumData;

  // setMerge para no sobreescribir campos manuales (p. ej. nota interna, acceso manual)
  await userRef.set(
    {
      uid,
      createdAt: now,   // solo se escribe si el doc no existe (merge lo respeta)
      ...updatePayload,
    },
    { merge: true }
  );
};

/**
 * Otorga premium vía Custom Claims y registra el evento en Firestore.
 * Funciona para pagos de Stripe (webhook / confirm-session).
 */
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

  // 1. Actualizar Custom Claims (lo que usa el frontend para verificar acceso)
  await auth.setCustomUserClaims(firebaseUid, {
    ...existingClaims,
    premium: true,
    premiumSource: source,
    premiumSessionId: session.id,
    premiumUpdatedAt: Date.now(),
  });

  // 2. Registrar en Firestore para seguimiento
  try {
    await syncUserToFirestore(firebaseUid, userRecord, session, source);
  } catch (err) {
    // No bloquear el flujo de pago si Firestore falla
    console.error('Firestore sync failed (non-fatal):', err);
  }
};
