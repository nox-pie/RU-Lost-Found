import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCsNlStF-_EVbIRRYDlOKG8YWPhVuvPUFQ",
  authDomain: "lost-found-acaff.firebaseapp.com",
  projectId: "lost-found-acaff",
  storageBucket: "lost-found-acaff.firebasestorage.app",
  messagingSenderId: "249087546835",
  appId: "1:249087546835:web:9e32393bb5200cf8df0b26",
  measurementId: "G-9C78QSPE2W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);

// Set auth persistence
setPersistence(auth, browserLocalPersistence);

// Enable offline persistence for Firestore
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser doesn\'t support persistence.');
    }
  });

export { auth, db };
export default app;