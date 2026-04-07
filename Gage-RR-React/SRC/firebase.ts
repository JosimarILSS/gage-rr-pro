import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDMY2EsPxTGlWvQ4cAgCE5ZbhpA2SE5pSI',
  authDomain: 'gage-rr-pro.firebaseapp.com',
  projectId: 'gage-rr-pro',
  storageBucket: 'gage-rr-pro.firebasestorage.app',
  messagingSenderId: '782327403990',
  appId: '1:782327403990:web:2289c0ecfe2091c9688077'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
