import Stripe from 'stripe';
import { verifyFirebaseToken } from '../_firebase.mjs';
import admin from 'firebase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;
  const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
  const STRIPE_AMOUNT_MXN = Number(process.env.STRIPE_AMOUNT_MXN || 15000);
  const STRIPE_PRODUCT_NAME = process.env.STRIPE_PRODUCT_NAME || 'Acceso premium de por vida - Gage RR Pro';

  console.log('[create-checkout] STRIPE_AMOUNT_MXN =', STRIPE_AMOUNT_MXN);
  console.log('[create-checkout] STRIPE_PRICE_ID =', STRIPE_PRICE_ID || '(not set)');

  if (!STRIPE_SECRET_KEY || !STRIPE_PUBLISHABLE_KEY) {
    res.status(503).json({ error: 'Stripe is not configured.' });
    return;
  }

  const decodedToken = await verifyFirebaseToken(req, res);
  if (!decodedToken) return;

  const stripe = new Stripe(STRIPE_SECRET_KEY);

  try {
    const userRecord = await admin.auth().getUser(decodedToken.uid);
    if (userRecord.customClaims?.premium === true) {
      res.json({ alreadyPaid: true });
      return;
    }

    const origin = req.headers.origin || process.env.APP_URL || 'https://your-app.vercel.app';
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
      metadata: { firebaseUid: decodedToken.uid },
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
}
