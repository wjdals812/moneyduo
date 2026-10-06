import { describe, expect, it } from 'vitest'
import { withAuth } from '../api/_lib/handler.js'

const mockRes = () => {
  const r = {
    code: 0,
    body: undefined as unknown,
    status(c: number) { r.code = c; return r },
    json(b: unknown) { r.body = b; return r },
    end() { return r },
  }
  return r
}
const call = async (req: object) => {
  const res = mockRes()
  await withAuth(async () => ({ ok: true }))(req as never, res as never)
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
