'use strict';

const { verifyFirebaseToken, registerUserIfNew } = require('../_firebase.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const decodedToken = await verifyFirebaseToken(req, res);
  if (!decodedToken) return;

  try {
    await registerUserIfNew(decodedToken.uid);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[register] Failed:', err.message);
    res.status(500).json({ error: 'Could not register user.' });
  }
};
