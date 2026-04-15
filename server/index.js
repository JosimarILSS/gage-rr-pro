import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import admin from 'firebase-admin';
import Stripe from 'stripe';

const PORT = Number(process.env.PORT || 4242);
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const STRIPE_AMOUNT_MXN = Number(process.env.STRIPE_AMOUNT_MXN || 15000);
const STRIPE_PRODUCT_NAME = process.env.STRIPE_PRODUCT_NAME || 'Acceso premium de por vida - Gage RR Pro';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY in environment.');
}

if (!STRIPE_PUBLISHABLE_KEY) {
  throw new Error('Missing STRIPE_PUBLISHABLE_KEY in environment.');
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

const initFirebaseAdmin = () => {
  if (admin.apps.length > 0) return;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
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

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
};

initFirebaseAdmin();

const app = express();

const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS policy.'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

app.use((req, res, next) => {
  if (req.path === '/api/stripe/webhook') {
    next();
    return;
  }
  corsMiddleware(req, res, next);
});

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!STRIPE_WEBHOOK_SECRET) {
    res.status(503).send('Webhook secret is not configured.');
    return;
  }

  const signature = req.headers['stripe-signature'];

  if (!signature) {
    res.status(400).send('Missing Stripe signature.');
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error);
    res.status(400).send('Invalid Stripe signature.');
    return;
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      await grantPremiumAccessFromSession(session, 'webhook');
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed:', error);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const verifyFirebaseToken = async (req, res) => {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token.' });
    return null;
  }

  const idToken = authorization.slice('Bearer '.length);
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    res.status(401).json({ error: 'Invalid Firebase ID token.' });
    return null;
  }
};

const grantPremiumAccessFromSession = async (session, source) => {
  const firebaseUid = session?.metadata?.firebaseUid || session?.client_reference_id;
  if (!firebaseUid) {
    throw new Error('Session has no firebase uid metadata.');
  }

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

app.post('/api/stripe/create-checkout-session', async (req, res) => {
  const decodedToken = await verifyFirebaseToken(req, res);
  if (!decodedToken) return;

  try {
    const userRecord = await admin.auth().getUser(decodedToken.uid);
    if (userRecord.customClaims?.premium === true) {
      res.json({ alreadyPaid: true });
      return;
    }

    const origin = req.headers.origin || APP_URL;
    const successUrl = `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/?checkout=cancel`;

    const lineItems = STRIPE_PRICE_ID
      ? [{ price: STRIPE_PRICE_ID, quantity: 1 }]
      : [
          {
            price_data: {
              currency: 'mxn',
              product_data: { name: STRIPE_PRODUCT_NAME },
              unit_amount: STRIPE_AMOUNT_MXN,
            },
            quantity: 1,
          },
        ];

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: decodedToken.email || undefined,
      client_reference_id: decodedToken.uid,
      metadata: {
        firebaseUid: decodedToken.uid,
      },
    });

    res.json({
      sessionId: session.id,
      publishableKey: STRIPE_PUBLISHABLE_KEY,
      url: session.url,
    });
  } catch (error) {
    console.error('Failed to create Stripe checkout session:', error);
    res.status(500).json({ error: 'Could not create checkout session.' });
  }
});

app.post('/api/stripe/confirm-session', async (req, res) => {
  const decodedToken = await verifyFirebaseToken(req, res);
  if (!decodedToken) return;

  const sessionId = req.body?.sessionId;
  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: 'Missing sessionId.' });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionUid = session?.metadata?.firebaseUid || session?.client_reference_id;

    if (!sessionUid || sessionUid !== decodedToken.uid) {
      res.status(403).json({ error: 'This checkout session does not belong to the current user.' });
      return;
    }

    await grantPremiumAccessFromSession(session, 'confirm-session');
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to confirm checkout session:', error);
    res.status(500).json({ error: 'Could not confirm checkout session.' });
  }
});

app.listen(PORT, () => {
  console.log(`Stripe server listening on http://localhost:${PORT}`);
});
