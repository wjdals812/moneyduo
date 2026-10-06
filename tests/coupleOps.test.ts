import { beforeEach, describe, expect, it } from 'vitest'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { create, join, leave } from '../api/_lib/coupleOps.js'

// rules 테스트와 같은 에뮬레이터를 쓰지만 프로젝트 ID가 달라 데이터가 섞이지 않는다
const projectId = 'demo-moneyduo-ops'
const db = getFirestore(initializeApp({ projectId }, 'ops'))

const data = async (path: string) => (await db.doc(path).get()).data()

beforeEach(async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
})

const seedCouple = async (id: string, members: string[], code = id.toUpperCase()) => {
  await db.doc(`couples/${id}`).set({ members, inviteCode: code })
  await db.doc(`inviteCodes/${code}`).set({ coupleId: id })
  for (const uid of members) await db.doc(`users/${uid}`).set({ coupleId: id })
}

describe('create', () => {
  it('커플·초대코드·내 coupleId를 만든다', async () => {
    const r = await create(db, 'A')
    expect(r.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    expect((await data(`couples/${r.coupleId}`))?.members).toEqual(['A'])
    expect((await data(`inviteCodes/${r.inviteCode}`))?.coupleId).toBe(r.coupleId)
    expect((await data('users/A'))?.coupleId).toBe(r.coupleId)
  })

  it('코드가 겹치면 새 코드로 재시도한다', async () => {
    await db.doc('inviteCodes/AAAAAA').set({ coupleId: 'old' })
    const codes = ['AAAAAA', 'BBBBBB']
    const r = await create(db, 'A', () => codes.shift()!)
    expect(r.inviteCode).toBe('BBBBBB')
    expect((await data('inviteCodes/AAAAAA'))?.coupleId).toBe('old')
  })

  it('이미 커플이면 기존 커플에서 먼저 나간다', async () => {
    await seedCouple('couple1', ['A', 'B'])
    const r = await create(db, 'A')
    expect((await data('couples/couple1'))?.members).toEqual(['B'])
    expect((await data('users/A'))?.coupleId).toBe(r.coupleId)
  })
})

describe('create 원자성', () => {
  it('코드 생성이 끝내 실패하면 기존 커플에서 나가지 않은 채로 남는다', async () => {
    await seedCouple('couple1', ['A', 'B'])
    await db.doc('inviteCodes/AAAAAA').set({ coupleId: 'old' })
    await expect(create(db, 'A', () => 'AAAAAA')).rejects.toMatchObject({ status: 500 })
    expect((await data('couples/couple1'))?.members).toEqual(['A', 'B'])
    expect((await data('users/A'))?.coupleId).toBe('couple1')
  })
})

describe('join', () => {
  it('초대 코드로 멤버에 추가되고 내 coupleId가 설정된다', async () => {
    await seedCouple('couple1', ['A'], 'XXXXXX')
    expect(await join(db, 'B', 'XXXXXX')).toEqual({ coupleId: 'couple1' })
    expect((await data('couples/couple1'))?.members).toEqual(['A', 'B'])
    expect((await data('users/B'))?.coupleId).toBe('couple1')
  })

  it('소문자·앞뒤 공백 코드도 정규화해서 처리한다', async () => {
    await seedCouple('couple1', ['A'], 'XXXXXX')
    await join(db, 'B', ' xxxxxx ')
    expect((await data('couples/couple1'))?.members).toEqual(['A', 'B'])
  })

  it('없는 코드는 404', async () => {
    await expect(join(db, 'B', 'ZZZZZZ')).rejects.toMatchObject({ status: 404 })
  })

  it('코드는 있는데 커플 문서가 없으면 404', async () => {
    await db.doc('inviteCodes/GHOST1').set({ coupleId: 'ghost' })
    await expect(join(db, 'B', 'GHOST1')).rejects.toMatchObject({ status: 404 })
  })

  it('이미 두 명이면 409이고 아무것도 바뀌지 않는다', async () => {
    await seedCouple('couple1', ['A', 'B'], 'XXXXXX')
    await db.doc('users/C').set({ displayName: 'C' })
    await expect(join(db, 'C', 'XXXXXX')).rejects.toMatchObject({ status: 409 })
    expect((await data('couples/couple1'))?.members).toEqual(['A', 'B'])
    expect((await data('users/C'))?.coupleId).toBeUndefined()
  })

  it('두 번 호출해도 멤버가 중복되지 않는다', async () => {
    await seedCouple('couple1', ['A'], 'XXXXXX')
    await join(db, 'B', 'XXXXXX')
    await join(db, 'B', 'XXXXXX')
    expect((await data('couples/couple1'))?.members).toEqual(['A', 'B'])
  })

  it('다른 커플이었다면 옛 커플에서 빠진다', async () => {
    await seedCouple('old', ['B', 'Z'])
    await seedCouple('couple1', ['A'], 'XXXXXX')
    await join(db, 'B', 'XXXXXX')
    expect((await data('couples/old'))?.members).toEqual(['Z'])
    expect((await data('users/B'))?.coupleId).toBe('couple1')
  })

  it('경로로 쓸 수 없는 코드(슬래시, 점, 아주 긴 문자열)는 서버 오류가 아니라 404', async () => {
    for (const bad of ['AB/CD', '..', 'A'.repeat(2000)]) {
      await expect(join(db, 'B', bad)).rejects.toMatchObject({ status: 404 })
    }
  })

  it('코드가 비었거나 문자열이 아니면 400', async () => {
    await expect(join(db, 'B', '')).rejects.toMatchObject({ status: 400 })
    await expect(join(db, 'B', 123)).rejects.toMatchObject({ status: 400 })
  })
})

describe('leave', () => {
  it('두 명 중 한 명이 나가면 멤버만 줄고 coupleId가 비워진다', async () => {
    await seedCouple('couple1', ['A', 'B'])
    await leave(db, 'B')
    expect((await data('couples/couple1'))?.members).toEqual(['A'])
    expect((await data('users/B'))?.coupleId).toBeNull()
  })

  it('마지막 멤버가 나가면 커플 문서가 삭제된다', async () => {
    await seedCouple('couple1', ['A'])
    await leave(db, 'A')
    expect((await db.doc('couples/couple1').get()).exists).toBe(false)
  })

  it('커플이 없으면 아무 일도 하지 않는다', async () => {
    await db.doc('users/A').set({ displayName: 'A' })
    await expect(leave(db, 'A')).resolves.toBeUndefined()
  })

  it('가리키는 커플 문서가 없어도 오류 없이 coupleId만 비운다', async () => {
    await db.doc('users/A').set({ coupleId: 'ghost' })
    await leave(db, 'A')
    expect((await data('users/A'))?.coupleId).toBeNull()
  })

  it('이미 멤버가 아니면 커플은 건드리지 않고 coupleId만 비운다', async () => {
    await db.doc('couples/couple1').set({ members: ['A'], inviteCode: 'X' })
    await db.doc('users/B').set({ coupleId: 'couple1' })
    await leave(db, 'B')
    expect((await data('couples/couple1'))?.members).toEqual(['A'])
    expect((await data('users/B'))?.coupleId).toBeNull()
  })
})
