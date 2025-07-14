// src/services/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBxYjBKXcZiCvvUAIgiFkxqjX8UcfmGxOg",
  authDomain: "game-dd61b.firebaseapp.com",
  projectId: "game-dd61b",
  storageBucket: "game-dd61b.firebasestorage.app",
  messagingSenderId: "173995855484",
  appId: "1:173995855484:web:2a63e6055f96bbf519c3f9",
  measurementId: "G-D6Z28RBPBW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;