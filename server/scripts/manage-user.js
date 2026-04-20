/**
 * Script de administración de usuarios
 *
 * Uso:
 *   node server/scripts/manage-user.js --email usuario@ejemplo.com --premium true
 *   node server/scripts/manage-user.js --email usuario@ejemplo.com --premium false
 *   node server/scripts/manage-user.js --email usuario@ejemplo.com --premium true --unlimited
 *   node server/scripts/manage-user.js --email usuario@ejemplo.com --premium true --months 8
 *
 * Opciones:
 *   --email      Correo del usuario (requerido)
 *   --premium    true | false (requerido)
 *   --unlimited  Si se incluye, premiumExpiresAt queda en null (acceso ilimitado)
 *   --months     Meses de premium cuando --premium true (por defecto: 6)
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
const monthsArg = get('--months');

if (!email || !premiumArg) {
  console.error(
    'Uso: node server/scripts/manage-user.js --email <correo> --premium <true|false> [--unlimited] [--months <n>]'
  );
  process.exit(1);
}

const premium = premiumArg === 'true';
const months = monthsArg ? Number(monthsArg) : 6;

if (monthsArg && (!Number.isInteger(months) || months <= 0)) {
  console.error('❌ --months debe ser un entero mayor a 0. Ejemplo: --months 8');
  process.exit(1);
}

if (!premium && monthsArg) {
  console.error('❌ --months solo aplica cuando --premium true');
  process.exit(1);
}

if (unlimited && monthsArg) {
  console.error('❌ No combines --unlimited con --months. Elige uno de los dos.');
  process.exit(1);
}

// ─── Lógica principal ─────────────────────────────────────────────────────────

const addMonths = (date, amount) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
};

const toDateOrNull = (value) => {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'number') return new Date(value);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

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

  // 2. Leer documento actual (si existe) para extender premium vigente sin penalizar
  const userRef = db.collection('usuarios').doc(uid);
  const snap = await userRef.get();

  // 3. Calcular fecha de expiración
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
      const existingExpiration = snap.exists ? toDateOrNull(snap.data().premiumExpiresAt) : null;
      const baseDate =
        existingExpiration && existingExpiration.getTime() > now.getTime()
          ? existingExpiration
          : now;
      premiumExpiresAt = addMonths(baseDate, months);
      premiumExpiresAtTimestamp = Timestamp.fromDate(premiumExpiresAt);
      console.log(`✓ Meses agregados: ${months}`);
      if (existingExpiration && existingExpiration.getTime() > now.getTime()) {
        console.log(
          `✓ Premium vigente detectado; extensión desde ${existingExpiration.toLocaleDateString('es-MX', { dateStyle: 'long' })}`
        );
      }
      console.log(
        `✓ Acceso premium hasta: ${premiumExpiresAt.toLocaleDateString('es-MX', { dateStyle: 'long' })}`
      );
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
    if (unlimited) {
      console.log('  Tipo:     Ilimitado');
      console.log('  Expira:   Nunca (ilimitado)');
    } else {
      console.log(`  Tipo:     Por tiempo (${months} ${months === 1 ? 'mes' : 'meses'})`);
      console.log(
        `  Expira:   ${premiumExpiresAt ? premiumExpiresAt.toLocaleDateString('es-MX', { dateStyle: 'long' }) : 'N/D'}`
      );
    }
  }
  console.log('─────────────────────────────────────\n');

} catch (err) {
  console.error('❌ Error inesperado:', err.message);
  process.exit(1);
}
