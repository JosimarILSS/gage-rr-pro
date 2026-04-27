import 'dotenv/config';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY in environment.');
}

const PRODUCT_NAME = process.env.STRIPE_PRODUCT_NAME || 'Acceso premium por 6 meses - Gage RR Pro';
const PRODUCT_ID = process.env.STRIPE_PRODUCT_ID;
const UNIT_AMOUNT = Number(process.env.STRIPE_AMOUNT_MXN || 15000);
const CURRENCY = (process.env.STRIPE_CURRENCY || 'mxn').toLowerCase();

if (!Number.isInteger(UNIT_AMOUNT) || UNIT_AMOUNT <= 0) {
  throw new Error('STRIPE_AMOUNT_MXN must be a positive integer in minor units (for MXN, cents).');
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

const resolveProductId = async () => {
  if (PRODUCT_ID) {
    const product = await stripe.products.retrieve(PRODUCT_ID);
    if (product.deleted) throw new Error(`Product ${PRODUCT_ID} is deleted.`);
    return product.id;
  }

  const created = await stripe.products.create({
    name: PRODUCT_NAME,
    active: true,
  });
  return created.id;
};

const main = async () => {
  const productId = await resolveProductId();
  const price = await stripe.prices.create({
    product: productId,
    currency: CURRENCY,
    unit_amount: UNIT_AMOUNT,
  });

  console.log('Stripe product:', productId);
  console.log('Stripe price created:', price.id);
  console.log(`Use this in .env -> STRIPE_PRICE_ID=${price.id}`);
};

main().catch((error) => {
  console.error('Failed to create Stripe price:', error);
  process.exit(1);
});
