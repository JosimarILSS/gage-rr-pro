/**
 * Script de administración de usuarios
 *
 * Uso:
 *   node server/scripts/manage-user.js --email usuario@ejemplo.com --premium true
 *   node server/scripts/manage-user.js --email usuario@ejemplo.com --premium false
 *   node server/scripts/manage-user.js --email usuario@ejemplo.com --premium true --unlimited
 *
 * Opciones:
 *   --email      Correo del usuario (requerido)
 *   --premium    true | false (requerido)
 *   --unlimited  Si se incluye, premiumExpiresAt queda en null (acceso ilimitado)
 */

import 'dotenv/config';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

// ─── Inicializar Firebase Admin ───────────────────────────────────────────────

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (getApps().length === 0) {
  if (serviceAccountJson) {
    initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
  } else if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    console.error('❌ Faltan credenciales de Firebase. Revisa tu .env');
    process.exit(1);
  }
}

const auth = getAuth();
const db = getFirestore();

// ─── Parsear argumentos ───────────────────────────────────────────────────────

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const email = get('--email');
const premiumArg = get('--premium');
const unlimited = args.includes('--unlimited');

if (!email || !premiumArg) {
  console.error('Uso: node server/scripts/manage-user.js --email <correo> --premium <true|false> [--unlimited]');
  process.exit(1);
}

const premium = premiumArg === 'true';

// ─── Lógica principal ─────────────────────────────────────────────────────────

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

try {
  // 1. Buscar usuario en Firebase Auth por correo, o crearlo si no existe
  let userRecord;
  let wasCreated = false;
  try {
    userRecord = await auth.getUserByEmail(email);
    console.log(`✓ Usuario encontrado: ${userRecord.uid} (${email})`);
  } catch {
    // No existe — crearlo en Firebase Auth
    userRecord = await auth.createUser({ email });
    wasCreated = true;
    console.log(`✓ Usuario creado en Firebase Auth: ${userRecord.uid} (${email})`);
    console.log('  (El usuario deberá usar "Olvidé mi contraseña" o Google Sign-In la primera vez que entre)');
  }

  const uid = userRecord.uid;

  // 2. Calcular fecha de expiración
  const now = new Date();
  let premiumExpiresAt = null;
  let premiumExpiresAtTimestamp = null;

  if (premium) {
    if (unlimited) {
      // null = acceso ilimitado manual
      premiumExpiresAt = null;
      premiumExpiresAtTimestamp = null;
      console.log('✓ Modo: acceso ilimitado (sin fecha de expiración)');
    } else {
      premiumExpiresAt = new Date(now.getTime() + SIX_MONTHS_MS);
      premiumExpiresAtTimestamp = Timestamp.fromDate(premiumExpiresAt);
      console.log(`✓ Acceso premium hasta: ${premiumExpiresAt.toLocaleDateString('es-MX', { dateStyle: 'long' })}`);
    }
  }

  // 3. Actualizar Custom Claim
  const existingClaims = userRecord.customClaims || {};
  await auth.setCustomUserClaims(uid, {
    ...existingClaims,
    premium,
    premiumSource: premium ? 'manual' : null,
    premiumUpdatedAt: Date.now(),
    premiumExpiresAt: premiumExpiresAtTimestamp ? premiumExpiresAtTimestamp.toMillis() : null,
  });
  console.log(`✓ Custom Claim actualizado: premium=${premium}`);

  // 4. Crear o actualizar documento en Firestore
  const userRef = db.collection('usuarios').doc(uid);
  const snap = await userRef.get();
  const serverNow = FieldValue.serverTimestamp();

  if (!snap.exists) {
    // Primera vez — crear documento completo
    await userRef.set({
      uid,
      email: userRecord.email || null,
      displayName: userRecord.displayName || null,
      photoURL: userRecord.photoURL || null,
      premium,
      premiumExpiresAt: premiumExpiresAtTimestamp,
      premiumGrantedAt: premium ? serverNow : null,
      premiumSource: premium ? 'manual' : null,
      lastStripeSessionId: null,
      payments: [],
      createdAt: serverNow,
      updatedAt: serverNow,
    });
    console.log('✓ Documento creado en Firestore (usuario nuevo)');
  } else {
    // Ya existe — actualizar solo los campos relevantes
    const update = {
      premium,
      premiumExpiresAt: premiumExpiresAtTimestamp,
      premiumSource: premium ? (snap.data().premiumSource || 'manual') : null,
      updatedAt: serverNow,
    };
    if (premium && !snap.data().premiumGrantedAt) {
      update.premiumGrantedAt = serverNow;
    }
    if (!premium) {
      update.premiumGrantedAt = null;
    }
    await userRef.update(update);
    console.log('✓ Documento actualizado en Firestore');
  }

  // ─── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────');
  console.log('  Resumen del usuario');
  console.log('─────────────────────────────────────');
  console.log(`  UID:      ${uid}`);
  console.log(`  Email:    ${email}`);
  console.log(`  Estado:   ${wasCreated ? 'Creado nuevo' : 'Actualizado'}`);
  console.log(`  Premium:  ${premium}`);
  if (premium) {
    console.log(`  Expira:   ${premiumExpiresAt ? premiumExpiresAt.toLocaleDateString('es-MX', { dateStyle: 'long' }) : 'Nunca (ilimitado)'}`);
  }
  console.log('─────────────────────────────────────\n');

} catch (err) {
  console.error('❌ Error inesperado:', err.message);
  process.exit(1);
}
