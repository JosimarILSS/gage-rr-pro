'use strict';

const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldPath, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getFirebaseApp, verifyFirebaseToken } = require('../_firebase.js');
const { normalizeToolFlags } = require('../_tools.js');
const { COMPANIES_COLLECTION, normalizeCompanyIdInput, normalizeEmailDomain } = require('../_companies.js');

const parseAllowedAdminEmails = (rawValue) =>
  (rawValue || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const ADMIN_ALLOWED_EMAILS = parseAllowedAdminEmails(
  process.env.ADMIN_ALLOWED_EMAILS || 'j.diaz@ilssg.org'
);

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

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getEmailDomain = (email) => {
  const atIndex = typeof email === 'string' ? email.lastIndexOf('@') : -1;
  if (atIndex < 0) return null;
  return normalizeEmailDomain(email.slice(atIndex + 1));
};

const findCompanyIdByEmailDomain = async (db, email) => {
  const emailDomain = getEmailDomain(email);
  if (!emailDomain) return null;

  const snap = await db
    .collection(COMPANIES_COLLECTION)
    .where('emailDomainLower', '==', emailDomain)
    .limit(5)
    .get();

  const match = snap.docs.find((docSnap) => {
    const data = docSnap.data() || {};
    return data.emailDomainEnabled === true && data.isActive !== false;
  });

  return match ? match.id : null;
};

const ensureAuthorizedAdmin = async (req, res) => {
  const decodedToken = await verifyFirebaseToken(req, res);
  if (!decodedToken) return null;

  const requesterEmail = (decodedToken.email || '').toLowerCase();
  const provider = decodedToken.firebase?.sign_in_provider || '';
  const isAllowedAdminEmail = ADMIN_ALLOWED_EMAILS.includes(requesterEmail);

  if (!isAllowedAdminEmail || provider !== 'google.com') {
    res.status(403).json({ error: 'Forbidden. Admin access requires Google sign-in with authorized email.' });
    return null;
  }

  return decodedToken;
};

const parsePageSize = (rawValue) => {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) return 30;
  return Math.min(parsed, 100);
};

const parseSearchField = (rawValue) => {
  const value = typeof rawValue === 'string' ? rawValue : 'all';
  return ['all', 'email', 'displayName'].includes(value) ? value : 'all';
};

const parsePremiumStatus = (rawValue) => {
  const value = typeof rawValue === 'string' ? rawValue : 'all';
  return ['all', 'active', 'expired', 'vip', 'noAccess'].includes(value) ? value : 'all';
};

const parseMonthAction = (rawValue) => {
  if (rawValue == null || rawValue === '') return 'add';
  const value = typeof rawValue === 'string' ? rawValue : '';
  return ['add', 'subtract', 'set'].includes(value) ? value : null;
};

const normalizeSearchQuery = (rawValue) => {
  if (typeof rawValue !== 'string') return '';
  return rawValue.trim().toLowerCase();
};

const encodePageToken = (cursorId) => {
  if (!cursorId) return null;
  return Buffer.from(JSON.stringify({ cursorId }), 'utf8').toString('base64url');
};

const decodePageToken = (rawToken) => {
  if (!rawToken || typeof rawToken !== 'string') return null;
  try {
    const parsed = JSON.parse(Buffer.from(rawToken, 'base64url').toString('utf8'));
    return typeof parsed?.cursorId === 'string' && parsed.cursorId ? parsed.cursorId : null;
  } catch {
    return null;
  }
};

const toIsoOrNull = (value) => {
  const parsed = toDateOrNull(value);
  return parsed ? parsed.toISOString() : null;
};

const mapUserFromProfileDoc = (docSnap, nowMs) => {
  const profile = docSnap.data() || {};
  const email = (profile.email || '').toLowerCase();
  const displayName = profile.displayName || null;
  const photoURL = profile.photoURL || null;

  const premium = typeof profile.premium === 'boolean' ? profile.premium : false;
  const premiumExpiresAtDate = toDateOrNull(profile.premiumExpiresAt);
  const premiumGrantedAtDate = toDateOrNull(profile.premiumGrantedAt);
  const premiumUnlimited = premium && !premiumExpiresAtDate;
  const premiumActive = premium && (premiumUnlimited || premiumExpiresAtDate.getTime() > nowMs);
  const toolAccess = normalizeToolFlags(profile.toolAccess, true);
  const premiumTools = normalizeToolFlags(profile.premiumTools, true);
  const companyId = normalizeCompanyIdInput(profile.companyId);

  return {
    uid: docSnap.id,
    email,
    displayName,
    photoURL,
    premium,
    premiumActive,
    premiumUnlimited,
    premiumGrantedAt: toIsoOrNull(premiumGrantedAtDate),
    premiumExpiresAt: toIsoOrNull(premiumExpiresAtDate),
    toolAccess,
    premiumTools,
    companyId,
    createdAt: toIsoOrNull(profile.createdAt),
    lastSignInAt: toIsoOrNull(profile.lastSignInAt),
  };
};

const matchesSearch = (user, searchQuery, searchField) => {
  if (!searchQuery) return true;

  const email = (user.email || '').toLowerCase();
  const displayName = (user.displayName || '').toLowerCase();

  if (searchField === 'email') return email.includes(searchQuery);
  if (searchField === 'displayName') return displayName.includes(searchQuery);
  return email.includes(searchQuery) || displayName.includes(searchQuery);
};

const matchesPremiumStatus = (user, premiumStatus) => {
  if (premiumStatus === 'all') return true;
  if (premiumStatus === 'vip') return user.premiumActive && user.premiumUnlimited;
  if (premiumStatus === 'active') return user.premiumActive;
  if (premiumStatus === 'expired') {
    return user.premium && !user.premiumActive && !!user.premiumExpiresAt;
  }
  return !user.premiumActive;
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const decodedToken = await ensureAuthorizedAdmin(req, res);
  if (!decodedToken) return;

  const app = getFirebaseApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  if (req.method === 'GET') {
    const pageSize = parsePageSize(req.query?.pageSize);
    const pageToken = decodePageToken(req.query?.pageToken);
    const searchField = parseSearchField(req.query?.searchField);
    const premiumStatus = parsePremiumStatus(req.query?.premiumStatus);
    const searchQuery = normalizeSearchQuery(req.query?.q);

    try {
      const usersRef = db.collection('usuarios');
      const batchSize = Math.max(pageSize, 100);
      const nowMs = Date.now();
      let cursorId = pageToken;
      let hasMore = false;
      const users = [];

      while (users.length < pageSize) {
        let query = usersRef.orderBy(FieldPath.documentId()).limit(batchSize);
        if (cursorId) {
          query = query.startAfter(cursorId);
        }

        const snap = await query.get();
        if (snap.empty) {
          hasMore = false;
          break;
        }

        for (const docSnap of snap.docs) {
          cursorId = docSnap.id;
          const user = mapUserFromProfileDoc(docSnap, nowMs);
          if (!matchesSearch(user, searchQuery, searchField)) continue;
          if (!matchesPremiumStatus(user, premiumStatus)) continue;

          users.push(user);
          if (users.length >= pageSize) {
            hasMore = true;
            break;
          }
        }

        if (users.length >= pageSize) break;
        if (snap.size < batchSize) {
          hasMore = false;
          break;
        }
      }

      res.status(200).json({
        ok: true,
        users,
        nextPageToken: hasMore ? encodePageToken(cursorId) : null,
      });
    } catch (error) {
      console.error('[admin-user-access:list] Failed:', error.message);
      res.status(500).json({ error: 'Could not list users.' });
    }
    return;
  }

  const uidRaw = req.body?.uid;
  const emailRaw = req.body?.email;
  const displayNameRaw = req.body?.displayName;
  const premiumRaw = req.body?.premium;
  const unlimitedRaw = req.body?.unlimited;
  const monthsRaw = req.body?.months;
  const monthAction = parseMonthAction(req.body?.monthAction);
  const hasPremiumChange = typeof premiumRaw === 'boolean';
  const hasToolAccessInput = req.body && typeof req.body.toolAccess === 'object' && req.body.toolAccess !== null;
  const hasPremiumToolsInput = req.body && typeof req.body.premiumTools === 'object' && req.body.premiumTools !== null;
  const hasCompanyInput = req.body && Object.prototype.hasOwnProperty.call(req.body, 'companyId');
  const createOnly = req.body?.createOnly === true;

  const uidInput = typeof uidRaw === 'string' ? uidRaw.trim() : '';
  const hasUidInput = uidInput.length > 0;
  const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';
  const displayName = typeof displayNameRaw === 'string' ? displayNameRaw.trim() : '';
  const hasDisplayNameInput = req.body && Object.prototype.hasOwnProperty.call(req.body, 'displayName');
  const premium = hasPremiumChange ? premiumRaw : null;
  const unlimited = unlimitedRaw === true;
  const months = monthsRaw == null || monthsRaw === '' ? 6 : Number(monthsRaw);
  const toolAccessInput = normalizeToolFlags(req.body?.toolAccess, true);
  const premiumToolsInput = normalizeToolFlags(req.body?.premiumTools, true);
  const companyIdInput = hasCompanyInput ? normalizeCompanyIdInput(req.body?.companyId) : null;

  if (!email || !isValidEmail(email)) {
    res.status(400).json({ error: 'Invalid email.' });
    return;
  }

  if (displayName.length > 120) {
    res.status(400).json({ error: 'displayName must be 120 characters or less.' });
    return;
  }

  if (!hasPremiumChange && !hasToolAccessInput && !hasPremiumToolsInput && !hasDisplayNameInput && !hasCompanyInput && !hasUidInput) {
    res.status(400).json({ error: 'No changes were provided.' });
    return;
  }

  if (premium === false && unlimited) {
    res.status(400).json({ error: 'unlimited only applies when premium is true.' });
    return;
  }

  if (!monthAction) {
    res.status(400).json({ error: 'monthAction must be add, subtract, or set.' });
    return;
  }

  if (premium === true && !unlimited && (!Number.isInteger(months) || months <= 0)) {
    res.status(400).json({ error: 'months must be a positive integer.' });
    return;
  }

  if (companyIdInput) {
    try {
      const companySnap = await db.collection(COMPANIES_COLLECTION).doc(companyIdInput).get();
      if (!companySnap.exists) {
        res.status(400).json({ error: 'Selected company does not exist.' });
        return;
      }
    } catch (error) {
      console.error('[admin-user-access] Company validation failed:', error.message);
      res.status(500).json({ error: 'Could not validate selected company.' });
      return;
    }
  }

  try {
    let userRecord;
    let created = false;
    try {
      userRecord = hasUidInput ? await auth.getUser(uidInput) : await auth.getUserByEmail(email);
    } catch (err) {
      if (!hasUidInput && err?.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email,
          ...(hasDisplayNameInput && displayName ? { displayName } : {}),
        });
        created = true;
      } else {
        throw err;
      }
    }

    if (!hasUidInput && createOnly && !created) {
      res.status(409).json({ error: 'User already exists. Use edit user instead.' });
      return;
    }

    const uid = userRecord.uid;
    const authUpdate = {};
    if (userRecord.email?.toLowerCase() !== email) {
      authUpdate.email = email;
    }
    if (hasDisplayNameInput && (userRecord.displayName || '') !== displayName) {
      authUpdate.displayName = displayName || null;
    }
    if (Object.keys(authUpdate).length > 0) {
      userRecord = await auth.updateUser(uid, authUpdate);
    }

    const userRef = db.collection('usuarios').doc(uid);
    const snap = await userRef.get();
    const existingData = snap.exists ? snap.data() : {};
    const now = new Date();
    const currentPremium = typeof existingData.premium === 'boolean' ? existingData.premium : false;
    const currentPremiumExpiresAt = snap.exists ? toDateOrNull(existingData.premiumExpiresAt) : null;
    const currentPremiumUnlimited = currentPremium && !currentPremiumExpiresAt;
    const nextPremium = hasPremiumChange ? premium : currentPremium;
    const nextUnlimited = hasPremiumChange ? unlimited : currentPremiumUnlimited;
    const nextToolAccess = hasToolAccessInput
      ? toolAccessInput
      : normalizeToolFlags(existingData.toolAccess, true);
    const nextPremiumTools = hasPremiumToolsInput
      ? premiumToolsInput
      : normalizeToolFlags(existingData.premiumTools, true);
    const existingCompanyId = normalizeCompanyIdInput(existingData.companyId);
    const domainCompanyId =
      !hasCompanyInput && !existingCompanyId
        ? await findCompanyIdByEmailDomain(db, userRecord.email || email)
        : null;
    const nextCompanyId = hasCompanyInput ? companyIdInput : existingCompanyId || domainCompanyId;

    let premiumExpiresAt = null;
    let premiumExpiresAtTimestamp = null;
    let premiumGrantedAtForResponse = null;

    if (nextPremium) {
      if (nextUnlimited) {
        premiumExpiresAt = null;
        premiumExpiresAtTimestamp = null;
        premiumGrantedAtForResponse = hasPremiumChange ? now : toDateOrNull(existingData.premiumGrantedAt);
      } else if (hasPremiumChange) {
        const currentExpiration = currentPremiumExpiresAt;
        if (monthAction === 'subtract') {
          if (!currentExpiration) {
            res.status(400).json({ error: 'Cannot subtract months without an existing premium expiration date.' });
            return;
          }
          premiumExpiresAt = addMonths(currentExpiration, -months);
        } else {
          const baseDate =
            monthAction === 'add' && currentExpiration && currentExpiration.getTime() > now.getTime()
              ? currentExpiration
              : now;
          premiumExpiresAt = addMonths(baseDate, months);
        }
        premiumExpiresAtTimestamp = Timestamp.fromDate(premiumExpiresAt);
        premiumGrantedAtForResponse = now;
      } else {
        premiumExpiresAt = currentPremiumExpiresAt;
        premiumExpiresAtTimestamp = premiumExpiresAt ? Timestamp.fromDate(premiumExpiresAt) : null;
        premiumGrantedAtForResponse = toDateOrNull(existingData.premiumGrantedAt);
      }
    }

    const existingClaims = userRecord.customClaims || {};
    await auth.setCustomUserClaims(uid, {
      ...existingClaims,
      premium: nextPremium,
      premiumSource: nextPremium ? 'manual' : null,
      premiumUpdatedAt: Date.now(),
      premiumExpiresAt: premiumExpiresAtTimestamp ? premiumExpiresAtTimestamp.toMillis() : null,
      toolAccess: nextToolAccess,
      premiumTools: nextPremiumTools,
      companyId: nextCompanyId,
    });

    const serverNow = FieldValue.serverTimestamp();
    if (!snap.exists) {
      await userRef.set({
        uid,
        email: userRecord.email || null,
        displayName: hasDisplayNameInput ? displayName || null : userRecord.displayName || null,
        photoURL: userRecord.photoURL || null,
        premium: nextPremium,
        premiumExpiresAt: premiumExpiresAtTimestamp,
        premiumGrantedAt: nextPremium ? serverNow : null,
        premiumSource: nextPremium ? 'manual' : null,
        companyId: nextCompanyId,
        companyAssignedByDomain: !hasCompanyInput && !!domainCompanyId,
        toolAccess: nextToolAccess,
        premiumTools: nextPremiumTools,
        lastStripeSessionId: null,
        payments: [],
        createdAt: serverNow,
        updatedAt: serverNow,
      });
    } else {
      const update = {
        premium: nextPremium,
        premiumExpiresAt: premiumExpiresAtTimestamp,
        premiumSource: nextPremium ? (existingData.premiumSource || 'manual') : null,
        companyId: nextCompanyId,
        companyAssignedByDomain: hasCompanyInput
          ? false
          : !hasCompanyInput && !!domainCompanyId
            ? true
            : existingData.companyAssignedByDomain === true,
        toolAccess: nextToolAccess,
        premiumTools: nextPremiumTools,
        updatedAt: serverNow,
      };
      update.email = userRecord.email || email;
      if (hasDisplayNameInput) update.displayName = displayName || null;
      if (nextPremium && (hasPremiumChange || !existingData.premiumGrantedAt)) {
        update.premiumGrantedAt = serverNow;
      }
      if (!nextPremium) {
        update.premiumGrantedAt = null;
      }
      await userRef.update(update);
    }

    res.status(200).json({
      ok: true,
      uid,
      email: userRecord.email || email,
      displayName: hasDisplayNameInput ? displayName || null : userRecord.displayName || null,
      created,
      premium: nextPremium,
      unlimited: nextPremium ? nextUnlimited : false,
      monthsApplied: hasPremiumChange && nextPremium && !nextUnlimited ? months : null,
      monthActionApplied: hasPremiumChange && nextPremium && !nextUnlimited ? monthAction : null,
      expiresAt: premiumExpiresAt ? premiumExpiresAt.toISOString() : null,
      premiumGrantedAt: nextPremium
        ? (premiumGrantedAtForResponse ? premiumGrantedAtForResponse.toISOString() : now.toISOString())
        : null,
      toolAccess: nextToolAccess,
      premiumTools: nextPremiumTools,
      companyId: nextCompanyId,
    });
  } catch (error) {
    console.error('[admin-user-access] Failed:', error.message);
    res.status(500).json({ error: 'Could not manage user access.' });
  }
};
