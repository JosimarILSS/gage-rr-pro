'use strict';

const Stripe = require('stripe');
const { verifyFirebaseToken } = require('../_firebase.js');
const { getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { isToolEnabled } = require('../_tools.js');
const { buildAppCheckoutMetadata } = require('./_metadata.js');

const normalizeReturnPath = (value) => {
  if (typeof value !== 'string') return '/';

  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('://')) return '/';

  const pathname = trimmed.split('?')[0].split('#')[0];
  return pathname || '/';
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;
  const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
  const STRIPE_AMOUNT_MXN = Number(process.env.STRIPE_AMOUNT_MXN || 15000);
  const STRIPE_PRODUCT_NAME = process.env.STRIPE_PRODUCT_NAME || 'Acceso premium por 6 meses - Gage RR Pro';

  console.log('[create-checkout] STRIPE_SECRET_KEY present:', !!STRIPE_SECRET_KEY);
  console.log('[create-checkout] STRIPE_PUBLISHABLE_KEY present:', !!STRIPE_PUBLISHABLE_KEY);
  console.log('[create-checkout] STRIPE_AMOUNT_MXN:', STRIPE_AMOUNT_MXN);
  console.log('[create-checkout] STRIPE_PRICE_ID:', STRIPE_PRICE_ID || '(not set, using price_data)');

  if (!STRIPE_SECRET_KEY || !STRIPE_PUBLISHABLE_KEY) {
    console.error('[create-checkout] Missing Stripe env vars');
    res.status(503).json({ error: 'Stripe is not configured.' });
    return;
  }

  const decodedToken = await verifyFirebaseToken(req, res);
  if (!decodedToken) return;

  const stripe = new Stripe(STRIPE_SECRET_KEY);

  try {
    const app = getApps()[0];
    const userRecord = await getAuth(app).getUser(decodedToken.uid);
    if (
      userRecord.customClaims?.premium === true &&
      isToolEnabled(userRecord.customClaims?.premiumTools, 'gage-rr', true)
    ) {
      res.json({ alreadyPaid: true });
      return;
    }

    const origin = req.headers.origin || process.env.APP_URL || 'https://gage-rr-pro.vercel.app';
    const returnPath = normalizeReturnPath(req.body?.returnPath);
    const successUrl = `${origin}${returnPath}?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}${returnPath}?checkout=cancel`;

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
      metadata: buildAppCheckoutMetadata(decodedToken.uid),
      payment_intent_data: {
        metadata: buildAppCheckoutMetadata(decodedToken.uid),
      },
    });

    console.log('[create-checkout] Session created:', session.id);

    res.json({
      sessionId: session.id,
      publishableKey: STRIPE_PUBLISHABLE_KEY,
      url: session.url,
    });
  } catch (error) {
    console.error('[create-checkout] Failed:', error.message);
    res.status(500).json({ error: 'Could not create checkout session.' });
  }
};
