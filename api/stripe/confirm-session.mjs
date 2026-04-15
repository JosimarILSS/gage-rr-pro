import Stripe from 'stripe';
import { verifyFirebaseToken, grantPremiumAccessFromSession } from '../_firebase.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

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
      res.status(403).json({ error: 'This checkout session does not belong to the current user.' });
      return;
    }

    await grantPremiumAccessFromSession(session, 'confirm-session');
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to confirm checkout session:', error);
    res.status(500).json({ error: 'Could not confirm checkout session.' });
  }
}
