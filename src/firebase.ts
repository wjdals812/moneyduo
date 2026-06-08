import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAT0QoZqp6UKA29_ja6-TA6cnHXEpG4t5c",
  authDomain: "moneyduo-b4af3.firebaseapp.com",
  projectId: "moneyduo-b4af3",
  storageBucket: "moneyduo-b4af3.firebasestorage.app",
  messagingSenderId: "818393880616",
  appId: "1:818393880616:web:290ac09049815e8e567d1d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);