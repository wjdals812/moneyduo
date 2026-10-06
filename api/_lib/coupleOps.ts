import { FieldValue, type DocumentSnapshot, type Firestore, type Transaction } from 'firebase-admin/firestore'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 헷갈리는 문자(0/O, 1/I) 제외

export const generateCode = (length = 6) =>
  Array.from({ length }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')

const membersOf = (couple: DocumentSnapshot): string[] =>
  couple.exists ? (couple.data()?.members ?? []) : []

// 트랜잭션 안에서 uid를 커플에서 뺀다 (마지막 멤버면 커플 삭제). 모든 읽기가 끝난 뒤에 호출해야 한다.
function queueLeave(t: Transaction, uid: string, couple: DocumentSnapshot) {
  const members = membersOf(couple)
  if (!members.includes(uid)) return
  if (members.length === 1) t.delete(couple.ref)
  else t.update(couple.ref, { members: FieldValue.arrayRemove(uid) })
}

const isAlreadyExists = (e: unknown) => {
  const code = (e as { code?: unknown })?.code
  return code === 6 || code === 'already-exists'
}

// 연결 전에 쓴 내역(coupleId가 null)을 커플 공유로 바꾼다. 이전 커플 내역은 그대로 둔다.
// 이미 바뀐 건 다시 조회되지 않아 몇 번 호출해도 안전하다 (실패해도 다음 join 때 이어서 처리).
async function shareExistingTransactions(db: Firestore, uids: string[], coupleId: string) {
  for (const uid of uids) {
    const { docs } = await db.collection('transactions').where('createdBy', '==', uid).where('coupleId', '==', null).get()
    for (let i = 0; i < docs.length; i += 400) { // 배치 한도(500) 아래로 나눠 쓴다
      const batch = db.batch()
      for (const d of docs.slice(i, i + 400)) batch.update(d.ref, { coupleId })
      await batch.commit()
    }
  }
}

export async function leave(db: Firestore, uid: string): Promise<void> {
  await db.runTransaction(async (t) => {
    const userRef = db.doc(`users/${uid}`)
    const coupleId = (await t.get(userRef)).data()?.coupleId
    if (!coupleId) return
    queueLeave(t, uid, await t.get(db.doc(`couples/${coupleId}`)))
    t.set(userRef, { coupleId: null }, { merge: true })
  })
}

export async function create(db: Firestore, uid: string, genCode: () => string = generateCode) {
  for (let i = 0; i < 6; i++) {
    const inviteCode = genCode()
    const coupleRef = db.collection('couples').doc()
    try {
      // 기존 커플 정리와 새 커플 생성을 한 트랜잭션으로 묶어, 동시에 두 번 호출돼도 커플이 하나만 남게 한다
      await db.runTransaction(async (t) => {
        const userRef = db.doc(`users/${uid}`)
        const oldId = (await t.get(userRef)).data()?.coupleId
        if (oldId) queueLeave(t, uid, await t.get(db.doc(`couples/${oldId}`)))
        t.create(db.doc(`inviteCodes/${inviteCode}`), { coupleId: coupleRef.id }) // 이미 있으면 실패
        t.set(coupleRef, { members: [uid], inviteCode, createdAt: FieldValue.serverTimestamp() })
        t.set(db.doc(`users/${uid}`), { coupleId: coupleRef.id }, { merge: true })
      })
      return { coupleId: coupleRef.id, inviteCode }
    } catch (e) {
      if (!isAlreadyExists(e)) throw e // 코드 중복이면 새 코드로 재시도
    }
  }
  throw new ApiError(500, '초대 코드 생성에 실패했어요. 다시 시도해주세요.')
}

export async function join(db: Firestore, uid: string, rawCode: unknown) {
  if (typeof rawCode !== 'string' || !rawCode.trim()) throw new ApiError(400, '코드를 입력하세요.')
  const code = rawCode.trim().toUpperCase()
  if (!/^[A-Z0-9]{1,20}$/.test(code)) throw new ApiError(404, '유효하지 않은 코드입니다.') // 문서 경로로 쓸 수 없는 입력 차단
  const { coupleId, members } = await db.runTransaction(async (t) => {
    const userRef = db.doc(`users/${uid}`)
    const [invite, user] = await Promise.all([t.get(db.doc(`inviteCodes/${code}`)), t.get(userRef)])
    if (!invite.exists) throw new ApiError(404, '유효하지 않은 코드입니다.')
    const coupleId: string = invite.data()!.coupleId
    const couple = await t.get(db.doc(`couples/${coupleId}`))
    if (!couple.exists) throw new ApiError(404, '커플 정보를 찾을 수 없습니다.')
    const oldId = user.data()?.coupleId
    const old = oldId && oldId !== coupleId ? await t.get(db.doc(`couples/${oldId}`)) : null

    const members = membersOf(couple)
    if (!members.includes(uid)) {
      if (members.length >= 2) throw new ApiError(409, '이미 두 명이 연결된 커플이에요.')
      t.update(couple.ref, { members: FieldValue.arrayUnion(uid) })
    }
    if (old) queueLeave(t, uid, old)
    t.set(userRef, { coupleId }, { merge: true })
    return { coupleId, members: [...new Set([...members, uid])] }
  })
  // 연결은 이미 끝났으므로 공유 전환이 실패해도 참여는 성공으로 돌려준다 (다음 join 호출 때 이어서 처리됨)
  await shareExistingTransactions(db, members, coupleId).catch((e) => console.error('내역 공유 전환 실패:', e?.message))
  return { coupleId }
}
