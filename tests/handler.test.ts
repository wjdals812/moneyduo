import { describe, expect, it } from 'vitest'
import { withAuth } from '../api/_lib/handler.js'

const mockRes = () => {
  const r: any = { code: 0, body: undefined }
  r.status = (c: number) => ((r.code = c), r)
  r.json = (b: unknown) => ((r.body = b), r)
  r.end = () => r
  return r
}
const call = async (req: object) => {
  const res = mockRes()
  await withAuth(async () => ({ ok: true }))(req as any, res)
  return res
}

describe('withAuth', () => {
  it('POST가 아니면 405', async () => {
    expect((await call({ method: 'GET', headers: {} })).code).toBe(405)
  })

  it('Authorization 헤더가 없으면 401', async () => {
    expect((await call({ method: 'POST', headers: {} })).code).toBe(401)
  })

  it('Bearer 형식이 아니면 401', async () => {
    expect((await call({ method: 'POST', headers: { authorization: 'Basic abc' } })).code).toBe(401)
    expect((await call({ method: 'POST', headers: { authorization: 'Bearer ' } })).code).toBe(401)
  })
})
