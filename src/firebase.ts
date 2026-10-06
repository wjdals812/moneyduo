import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

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
// 일부 모바일 네트워크/브라우저에서 스트리밍 연결이 막혀 요청이 수십 초 걸리는 문제를 막기 위해,
// 스트리밍이 안 되면 자동으로 long-polling으로 전환한다
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });