import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// 서비스 계정 JSON은 환경변수로만 받는다. 첫 호출 때 초기화하고 이후 재사용(콜드스타트 때만 초기화).
const app = () =>
  getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}')) })

export const getAdminDb = () => getFirestore(app())
export const verifyToken = async (token: string) => (await getAuth(app()).verifyIdToken(token)).uid
