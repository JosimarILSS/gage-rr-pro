'use strict';

const Stripe = require('stripe');
const { grantPremiumAccessFromSession } = require('../_firebase.js');
const { isAppCheckoutSession } = require('./_metadata.js');

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

  console.log('[webhook] STRIPE_SECRET_KEY present:', !!STRIPE_SECRET_KEY);
  console.log('[webhook] STRIPE_WEBHOOK_SECRET present:', !!STRIPE_WEBHOOK_SECRET);

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error('[webhook] Missing env vars');
    res.status(503).send('Webhook is not configured.');
    return;
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    res.status(400).send('Missing Stripe signature.');
    return;
  }

  // bodyParser: false → el body llega como stream crudo, necesario para verificar firma de Stripe.
  const rawBody = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  const stripe = new Stripe(STRIPE_SECRET_KEY);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('[webhook] Signature verification failed:', error.message);
    res.status(400).send(`Webhook error: ${error.message}`);
    return;
  }

  console.log(`[webhook] Event received: ${event.type}`);

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object;
      if (!isAppCheckoutSession(session)) {
        console.log(`[webhook] Ignoring external checkout session ${session.id}`);
        res.status(200).json({ received: true, ignored: true });
        return;
      }

      console.log(`[webhook] Processing session ${session.id}, payment_status=${session.payment_status}`);
      await grantPremiumAccessFromSession(session, 'webhook');
      console.log(`[webhook] Premium granted for session ${session.id}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[webhook] Processing failed:', error.message);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
}

// Desactiva el bodyParser de Vercel para recibir el body crudo de Stripe.
handler.config = { api: { bodyParser: false } };

module.exports = handler;
