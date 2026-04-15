import Stripe from 'stripe';
import { grantPremiumAccessFromSession } from '../_firebase.mjs';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Vercel must NOT parse the body — Stripe needs the raw bytes to verify the signature.
export const config = { api: { bodyParser: false } };

const getRawBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    res.status(503).send('Webhook is not configured.');
    return;
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    res.status(400).send('Missing Stripe signature.');
    return;
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);
  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch {
    res.status(400).send('Could not read request body.');
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error);
    res.status(400).send('Invalid Stripe signature.');
    return;
  }

  try {
    console.log(`[webhook] event received: ${event.type}`);

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object;
      console.log(`[webhook] processing session ${session.id}, payment_status=${session.payment_status}`);
      await grantPremiumAccessFromSession(session, 'webhook');
      console.log(`[webhook] grantPremiumAccess completed for session ${session.id}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[webhook] processing failed:', error);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
}
