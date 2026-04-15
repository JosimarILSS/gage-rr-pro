# Stripe + Firebase Integration

## 1) Variables de entorno

1. Copia `.env.example` a `.env`.
2. Pega la configuración Web de Firebase (`VITE_FIREBASE_*`) desde Firebase Console > Project settings > Your apps > Web app > SDK setup and configuration.
3. Configura llaves de Stripe y credenciales de Firebase Admin.
4. Si no usas `STRIPE_PRICE_ID`, define `STRIPE_AMOUNT_MXN` en centavos.

## 2) Ejecutar en local

1. Frontend: `npm run dev`
2. Backend pagos: `npm run server`

## 2.1) Crear Product + Price en Stripe (recomendado)

1. Configura en `.env`:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_AMOUNT_MXN` (centavos)
   - `STRIPE_PRODUCT_NAME`
2. Ejecuta:
   `npm run stripe:create-price`
3. Copia el valor mostrado y pégalo en:
   `STRIPE_PRICE_ID=price_xxx`

## 3) Webhook local de Stripe

1. Instala Stripe CLI.
2. Reenvía eventos al backend:
   `stripe listen --forward-to http://localhost:4242/api/stripe/webhook`
3. Copia el `whsec_...` mostrado y pégalo en `STRIPE_WEBHOOK_SECRET`.

## 4) Flujo de pago

1. Usuario autenticado en Firebase.
2. Frontend crea sesión de checkout en `/api/stripe/create-checkout-session`.
3. Stripe redirige al checkout.
4. Tras pago:
   - Webhook `checkout.session.completed` asigna `custom claim premium=true` al usuario en Firebase Auth.
   - Frontend también llama `/api/stripe/confirm-session` al volver para sincronizar.
