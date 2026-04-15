'use strict';

const Stripe = require('stripe');
const { verifyFirebaseToken, grantPremiumAccessFromSession } = require('../_firebase.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

  console.log('[confirm-session] STRIPE_SECRET_KEY present:', !!STRIPE_SECRET_KEY);

  if (!STRIPE_SECRET_KEY) {
    console.error('[confirm-session] Missing STRIPE_SECRET_KEY');
    res.status(503).json({ error: 'Stripe is not configured.' });
    return;
  }

  const decodedToken = await verifyFirebaseToken(req, res);
  if (!decodedToken) return;

  const sessionId = req.body?.sessionId;
  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: 'Missing sessionId.' });
    return;
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionUid = session?.metadata?.firebaseUid || session?.client_reference_id;

    if (!sessionUid || sessionUid !== decodedToken.uid) {
      res.status(403).json({ error: 'Session does not belong to current user.' });
      return;
    }

    await grantPremiumAccessFromSession(session, 'confirm-session');
    console.log('[confirm-session] Premium granted for uid:', decodedToken.uid);
    res.json({ ok: true });
  } catch (error) {
    console.error('[confirm-session] Failed:', error.message);
    res.status(500).json({ error: 'Could not confirm checkout session.' });
  }
};
