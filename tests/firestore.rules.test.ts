import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

// 시나리오: A·B는 같은 커플(couple1), C는 다른 커플(couple2), D는 가입 직후라 coupleId가 없음
let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-moneyduo',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(() => env.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'couples/couple1'), { members: ['A', 'B'], inviteCode: 'AAAAAA' })
    await setDoc(doc(db, 'couples/couple2'), { members: ['C'], inviteCode: 'CCCCCC' })
    await setDoc(doc(db, 'users/A'), { displayName: 'A', coupleId: 'couple1' })
    await setDoc(doc(db, 'users/B'), { displayName: 'B', coupleId: 'couple1' })
    await setDoc(doc(db, 'users/C'), { displayName: 'C', coupleId: 'couple2' })
    await setDoc(doc(db, 'users/D'), { displayName: 'D' }) // coupleId 필드 없음
    await setDoc(doc(db, 'transactions/tx1'), { createdBy: 'A', coupleId: 'couple1', amount: 1000 })
  })
})

const as = (uid: string) => env.authenticatedContext(uid).firestore()

describe('transactions', () => {
  it('같은 커플의 짝꿍은 내 거래를 읽을 수 있다', async () => {
    await assertSucceeds(getDoc(doc(as('B'), 'transactions/tx1')))
  })

  it('다른 커플 사용자는 거래를 읽을 수 없다', async () => {
    await assertFails(getDoc(doc(as('C'), 'transactions/tx1')))
  })

  it('coupleId가 없는 사용자도 오류 없이 거부된다', async () => {
    await assertFails(getDoc(doc(as('D'), 'transactions/tx1')))
  })

  it('비로그인 사용자는 읽을 수 없다', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'transactions/tx1')))
  })

  it('같은 커플이어도 작성자가 아니면 수정·삭제할 수 없다', async () => {
    await assertFails(updateDoc(doc(as('B'), 'transactions/tx1'), { amount: 1 }))
    await assertFails(deleteDoc(doc(as('B'), 'transactions/tx1')))
  })

  it('작성자는 수정·삭제할 수 있다', async () => {
    await assertSucceeds(updateDoc(doc(as('A'), 'transactions/tx1'), { amount: 2000 }))
    await assertSucceeds(deleteDoc(doc(as('A'), 'transactions/tx1')))
  })

  it('createdBy를 남의 uid로 위조해 생성할 수 없다', async () => {
    await assertFails(setDoc(doc(as('C'), 'transactions/tx2'), { createdBy: 'A', coupleId: 'couple1' }))
    await assertSucceeds(setDoc(doc(as('C'), 'transactions/tx3'), { createdBy: 'C', coupleId: 'couple2' }))
  })
})

describe('users', () => {
  it('같은 커플의 짝꿍 프로필은 읽을 수 있다', async () => {
    await assertSucceeds(getDoc(doc(as('A'), 'users/B')))
  })

  it('다른 커플의 프로필은 읽을 수 없다', async () => {
    await assertFails(getDoc(doc(as('C'), 'users/A')))
  })

  it('coupleId 없는 신규 가입자 문서도 본인은 읽을 수 있다', async () => {
    await assertSucceeds(getDoc(doc(as('D'), 'users/D')))
  })

  it('coupleId가 없는 사용자가 남의 프로필을 읽으면 오류 없이 거부된다', async () => {
    await assertFails(getDoc(doc(as('D'), 'users/A')))
  })

  it('남의 프로필은 수정할 수 없다', async () => {
    await assertFails(updateDoc(doc(as('C'), 'users/A'), { displayName: 'hacked' }))
  })

  it('멤버가 아닌 커플로 coupleId를 바꿀 수 없다', async () => {
    await assertFails(updateDoc(doc(as('D'), 'users/D'), { coupleId: 'couple1' }))
  })

  it('클라이언트가 coupleId를 직접 바꿀 수 없다 (서버 API만 가능)', async () => {
    await assertFails(updateDoc(doc(as('A'), 'users/A'), { coupleId: null }))
    await assertFails(updateDoc(doc(as('A'), 'users/A'), { coupleId: 'couple2' }))
  })

  it('coupleId 없이 다른 필드는 수정할 수 있다', async () => {
    await assertSucceeds(updateDoc(doc(as('A'), 'users/A'), { displayName: 'A2' }))
  })

  it('가입 시 coupleId를 넣어 문서를 만들 수 없다', async () => {
    await assertFails(setDoc(doc(as('X'), 'users/X'), { displayName: 'X', coupleId: 'couple1' }))
    await assertSucceeds(setDoc(doc(as('X'), 'users/X'), { displayName: 'X' }))
  })
})

describe('couples', () => {
  it('멤버는 커플 문서를 읽을 수 있다', async () => {
    await assertSucceeds(getDoc(doc(as('A'), 'couples/couple1')))
  })

  it('클라이언트는 커플을 만들거나 수정·삭제할 수 없다 (서버 API만 가능)', async () => {
    await assertFails(setDoc(doc(as('D'), 'couples/new'), { members: ['D'], inviteCode: 'DDDDDD' }))
    await assertFails(updateDoc(doc(as('D'), 'couples/couple2'), { members: ['C', 'D'] })) // 참여
    await assertFails(updateDoc(doc(as('B'), 'couples/couple1'), { members: ['A'] })) // 탈퇴
    await assertFails(updateDoc(doc(as('A'), 'couples/couple1'), { inviteCode: 'ZZZZZZ' }))
    await assertFails(deleteDoc(doc(as('C'), 'couples/couple2')))
  })
})

describe('inviteCodes', () => {
  it('코드로 단건 조회는 가능하다', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'inviteCodes/NEW123'), { coupleId: 'couple1' }))
    await assertSucceeds(getDoc(doc(as('D'), 'inviteCodes/NEW123')))
  })

  it('클라이언트는 코드를 만들거나 수정·삭제할 수 없다 (서버 API만 가능)', async () => {
    await assertFails(setDoc(doc(as('A'), 'inviteCodes/NEW123'), { coupleId: 'couple1' }))
    await assertFails(setDoc(doc(as('A'), 'inviteCodes/AAAAAA'), { coupleId: 'couple1' }))
    await assertFails(deleteDoc(doc(as('A'), 'inviteCodes/AAAAAA')))
  })
})

describe('userSettings / schedules', () => {
  it('설정은 본인만 읽고 쓸 수 있다', async () => {
    await assertSucceeds(setDoc(doc(as('A'), 'userSettings/A'), { budget: 1 }))
    await assertFails(getDoc(doc(as('B'), 'userSettings/A')))
  })

  it('일정은 작성자만 읽을 수 있다', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'schedules/s1'), { createdBy: 'A' }))
    await assertSucceeds(getDoc(doc(as('A'), 'schedules/s1')))
    await assertFails(getDoc(doc(as('B'), 'schedules/s1')))
  })
})
