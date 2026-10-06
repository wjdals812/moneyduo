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
// 일부 모바일 네트워크/브라우저가 스트리밍 응답을 모아뒀다가 30초 뒤에 내려줘서 조회가 30초씩 걸리는 문제가 있어,
// 스트리밍 대신 long-polling으로 고정한다 (자동 감지는 연결 시작 시점에만 판단해 이 경우를 못 잡음)
export const db = initializeFirestore(app, { experimentalForceLongPolling: true });