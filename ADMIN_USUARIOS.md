# Administración de Usuarios — Gage RR Pro

Guía de referencia para gestionar usuarios en Firebase desde la terminal.

## Requisitos

- Tener el archivo `.env` configurado en la raíz del proyecto con las credenciales de Firebase Admin.
- Tener las dependencias instaladas (`npm install`).

---

## Comandos

### Registrar usuario nuevo sin premium

Crea el usuario en Firebase Auth y en Firestore con `premium: false`.
Si el usuario ya existe, actualiza su documento sin tocar el acceso premium.

```bash
npm run user:manage -- --email correo@ejemplo.com --premium false
```

---

### Registrar usuario nuevo y darle premium por 6 meses

Crea el usuario en Firebase Auth y en Firestore con `premium: true` y `premiumExpiresAt` = hoy + 6 meses.

```bash
npm run user:manage -- --email correo@ejemplo.com --premium true
```

---

### Registrar usuario nuevo y darle premium por N meses (ejemplo: 8)

Crea el usuario y otorga premium con la cantidad de meses indicada.

```bash
npm run user:manage -- --email correo@ejemplo.com --premium true --months 8
```

---

### Registrar usuario nuevo con premium ilimitado (VIP)

Crea el usuario con `premium: true` y `premiumExpiresAt: null` (sin fecha de expiración).

```bash
npm run user:manage -- --email correo@ejemplo.com --premium true --unlimited
```

---

### Dar premium por 6 meses a usuario existente

Actualiza el documento en Firestore y el Custom Claim.
Si el usuario aún tiene acceso vigente, los meses se suman desde su fecha de expiración actual (no se penaliza la renovación anticipada).
Si ya venció, se suman desde hoy.

```bash
npm run user:manage -- --email correo@ejemplo.com --premium true
```

---

### Dar premium por N meses a usuario existente (ejemplo: 8)

Actualiza Firestore + Custom Claims con la cantidad de meses indicada.
Si el usuario aún tiene premium activo, la extensión parte desde su expiración actual.

```bash
npm run user:manage -- --email correo@ejemplo.com --premium true --months 8
```

---

### Dar premium ilimitado a usuario existente (VIP)

Actualiza `premium: true` y `premiumExpiresAt: null`.

```bash
npm run user:manage -- --email correo@ejemplo.com --premium true --unlimited
```

---

### Quitar premium a usuario existente

Actualiza `premium: false` y limpia `premiumExpiresAt` y `premiumGrantedAt`.

```bash
npm run user:manage -- --email correo@ejemplo.com --premium false
```

---

## Notas importantes

- Si el correo **no existe** en Firebase Auth, el script lo crea automáticamente.
- El usuario creado manualmente deberá iniciar sesión con **Google Sign-In** usando ese mismo correo. Al entrar, Firebase vincula automáticamente su cuenta de Google con el registro existente.
- `--months` solo aplica con `--premium true`.
- Si no envías `--months`, el script usa `6` meses por defecto.
- No se puede combinar `--months` con `--unlimited`.
- `premiumExpiresAt: null` en Firestore = acceso ilimitado. La app respeta ese valor y no bloquea al usuario aunque no tenga fecha.
- Si se pone `premium: false` manualmente en Firestore, el usuario pierde acceso inmediatamente sin importar la fecha.

---

## Estructura del documento en Firestore

Colección: `usuarios` — Documento ID: `{uid}`

| Campo | Tipo | Descripción |
|---|---|---|
| `uid` | string | UID de Firebase Auth |
| `email` | string | Correo del usuario |
| `displayName` | string | Nombre (de Google) |
| `photoURL` | string | Foto de perfil |
| `premium` | boolean | `true` = tiene acceso, `false` = sin acceso |
| `premiumSource` | string | `webhook`, `confirm-session`, `manual` o `null` |
| `premiumGrantedAt` | Timestamp | Fecha en que se otorgó el premium |
| `premiumExpiresAt` | Timestamp \| `null` | Fecha de expiración. `null` = ilimitado |
| `lastStripeSessionId` | string \| `null` | ID de la última sesión de Stripe |
| `payments` | array | Historial de pagos (ver abajo) |
| `createdAt` | Timestamp | Fecha de registro en Firestore |
| `updatedAt` | Timestamp | Última modificación |

### Estructura de cada entrada en `payments[]`

| Campo | Tipo | Descripción |
|---|---|---|
| `stripeSessionId` | string | ID de la sesión de Stripe |
| `stripePaymentStatus` | string | Estado del pago (`paid`) |
| `stripeAmountTotal` | number | Monto en centavos (15000 = $150.00 MXN) |
| `stripeCurrency` | string | Moneda (`mxn`) |
| `source` | string | `webhook` o `confirm-session` |
| `grantedAt` | string ISO | Fecha en que se procesó el pago |
| `expiresAt` | string ISO | Fecha de expiración de ese pago |

---

## Lógica de acceso premium en la app

| Estado en Firestore | Resultado |
|---|---|
| `premium: false` | Sin acceso |
| `premium: true` + `premiumExpiresAt: null` | Acceso ilimitado |
| `premium: true` + `premiumExpiresAt` en el futuro | Acceso activo |
| `premium: true` + `premiumExpiresAt` en el pasado | Acceso expirado |
