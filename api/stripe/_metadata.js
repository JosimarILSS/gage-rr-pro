'use strict';

const STRIPE_APP_METADATA_APP = 'ilsslabs';
const STRIPE_LEGACY_APP_METADATA_APPS = new Set(['gage-rr-pro']);
const STRIPE_APP_METADATA_SOURCE = 'app-checkout';

const buildAppCheckoutMetadata = (firebaseUid) => ({
  app: STRIPE_APP_METADATA_APP,
  source: STRIPE_APP_METADATA_SOURCE,
  firebaseUid,
});

const isAppCheckoutSession = (session) =>
  (session?.metadata?.app === STRIPE_APP_METADATA_APP ||
    STRIPE_LEGACY_APP_METADATA_APPS.has(session?.metadata?.app)) &&
  session?.metadata?.source === STRIPE_APP_METADATA_SOURCE;

module.exports = {
  STRIPE_APP_METADATA_APP,
  STRIPE_APP_METADATA_SOURCE,
  buildAppCheckoutMetadata,
  isAppCheckoutSession,
};
