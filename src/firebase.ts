import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const readFirebaseEnv = (key: keyof ImportMetaEnv): string => {
  const value = import.meta.env[key];
  if (!value || !value.trim()) {
    throw new Error(
      `[Firebase config] Missing ${key}. Add it to your .env file (see .env.example).`
    );
  }
  return value.trim();
};

const firebaseConfig = {
  apiKey: readFirebaseEnv('VITE_FIREBASE_API_KEY'),
  authDomain: readFirebaseEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: readFirebaseEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: readFirebaseEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: readFirebaseEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: readFirebaseEnv('VITE_FIREBASE_APP_ID'),
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
