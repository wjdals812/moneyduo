import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Firestore } from 'firebase-admin/firestore'
import { getAdminDb, verifyToken } from './admin.js'
import { ApiError } from './coupleOps.js'

type Fn = (db: Firestore, uid: string, body: unknown) => Promise<unknown>

export function withAuth(fn: Fn) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      if (req.method !== 'POST') throw new ApiError(405, 'POST만 허용돼요.')
      const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')
      if (!m) throw new ApiError(401, '로그인이 필요해요.')
      const db = getAdminDb() // 서버 설정(서비스 계정) 오류는 인증 실패(401)가 아니라 500으로 드러나야 한다
      const uid = await verifyToken(m[1]).catch((e) => {
        console.error('verifyIdToken 실패:', e?.code ?? e?.message)
        throw new ApiError(401, '인증에 실패했어요. 다시 로그인해주세요.')
      })
      const result = await fn(db, uid, req.body)
      if (result === undefined) return res.status(204).end()
      return res.status(200).json(result)
    } catch (e) {
      if (e instanceof ApiError) return res.status(e.status).json({ error: e.message })
      console.error(e)
      return res.status(500).json({ error: '서버 오류가 발생했어요.' })
    }
  }
}
