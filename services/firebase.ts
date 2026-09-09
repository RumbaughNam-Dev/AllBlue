import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA61QBaGk0XLxufWzdHC-tVOpofvQV33NY",
  authDomain: "allblue-63054.firebaseapp.com",
  projectId: "allblue-63054",
  storageBucket: "allblue-63054.firebasestorage.app",
  messagingSenderId: "197834399330",
  appId: "1:197834399330:web:ff1bf4ca7daf416cda3b3b",
  measurementId: "G-ZKSRG7EF0L",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
