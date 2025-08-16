/**
 * Firebase Configuration
 * Drive Nest Firebase Project Configuration
 */

// Import Firebase modules from CDN
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBiRv1--plBHpprEvuZN4dWvP6PegAeVCY",
  authDomain: "drive-nest-53174.firebaseapp.com",
  projectId: "drive-nest-53174",
  storageBucket: "drive-nest-53174.firebasestorage.app",
  messagingSenderId: "774176098607",
  appId: "1:774176098607:web:e2a8aa8bb13238c40939da",
  measurementId: "G-E532PGPJD7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export everything
export { firebaseConfig, app, auth, db };
