# 커플 연결 API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 커플 생성·참여·해제를 클라이언트 직접 쓰기에서 Vercel 서버리스 API로 옮기고, 보안 규칙에서 해당 클라이언트 쓰기를 막는다.

**Architecture:** `api/couple/{create,join,leave}.ts`가 `withAuth`(토큰 검증 + 오류 변환)로 감싸진 얇은 핸들러이고, 실제 로직은 `api/_lib/coupleOps.ts`의 순수 함수(`create`/`join`/`leave`, Admin `Firestore`를 인자로 받음)에 둔다. 프론트의 `coupleService`는 세 함수 본문만 `fetch`로 교체한다.

**Tech Stack:** Vercel Node 서버리스(ESM TypeScript), firebase-admin, Vitest, Firebase Firestore 에뮬레이터

**Spec:** [docs/superpowers/specs/2026-10-06-couple-api-design.md](../specs/2026-10-06-couple-api-design.md)

## Global Constraints

- 비용 0원, 카드 등록 없음 (Vercel Hobby + Firebase Spark).
- uid는 **ID 토큰에서만** 읽는다. 요청 본문의 uid는 사용하지 않는다.
- 서비스 계정 JSON은 Vercel 환경변수 `FIREBASE_SERVICE_ACCOUNT`에만 둔다. 저장소·로그에 남기지 않는다.
- `coupleService`의 공개 함수 이름·반환값은 유지한다 (`leaveCouple`의 `known` 인자만 제거).
- 응답 코드: 401(토큰 없음/무효), 400(잘못된 입력), 404(없는 코드·커플), 405(POST 아님), 409(정원 초과), 500.
- 배포 순서: **API 배포·확인 → 규칙 배포.** 순서를 바꾸면 구버전 클라이언트가 깨진다.
- 사용자에게 보이는 문구는 한국어.
- `api/` 안의 상대 import는 ESM이므로 `.js` 확장자를 붙인다 (`package.json`이 `"type": "module"`).

## Review Focus

- 코드를 소문자·앞뒤 공백으로 입력 → 정규화되어 참여된다 (Task 1 테스트)
- 연타로 `join`을 두 번 호출 → 멤버가 중복되지 않는다(멱등) (Task 1 테스트)
- 이미 다른 커플인 사용자가 `join` → 옛 커플에서 같은 트랜잭션으로 빠진다 (Task 1 테스트)
- `users.coupleId`가 가리키는 커플 문서가 없는(오래된 값) 상태에서 `leave` → 오류 없이 `coupleId`만 비워진다 (Task 1 테스트)
- `Authorization` 헤더가 없거나 `Bearer ` 형식이 아님 → 401 (Task 2 테스트)

---

### Task 1: 서버 핵심 로직 (`coupleOps`)

**Files:**
- Create: `api/_lib/coupleOps.ts`
- Create: `tests/coupleOps.test.ts`
- Modify: `package.json` (의존성, `test` 스크립트)
- Modify: `README.md:123` (스크립트 이름)

**Interfaces:**
- Produces:
  - `class ApiError extends Error { status: number }` — `new ApiError(status, message)`
  - `generateCode(length?: number): string`
  - `create(db: Firestore, uid: string, genCode?: () => string): Promise<{ coupleId: string; inviteCode: string }>`
  - `join(db: Firestore, uid: string, rawCode: unknown): Promise<{ coupleId: string }>`
  - `leave(db: Firestore, uid: string): Promise<void>`
  - `Firestore`는 `firebase-admin/firestore`의 타입

- [ ] **Step 1: 의존성 설치와 스크립트 이름 변경**

Run:
```bash
npm i firebase-admin
npm i -D @vercel/node
```

`package.json`의 스크립트에서 `test:rules`를 `test`로 바꾼다.

```json
"test": "firebase emulators:exec --only firestore --project demo-moneyduo \"vitest run\"",
```

`README.md`의 `npm run test:rules # Firestore 보안 규칙 테스트 (Java 필요, 에뮬레이터 자동 실행)` 줄을 아래로 바꾼다.

```
npm test           # 보안 규칙·서버 로직 테스트 (Java 필요, 에뮬레이터 자동 실행)
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/coupleOps.test.ts`:

```ts
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
```

- [ ] **Step 3: 실패 확인**

Run: `npm test`
Expected: `tests/coupleOps.test.ts`가 "Failed to resolve import ../api/_lib/coupleOps.js"로 실패. 기존 규칙 테스트 24개는 통과.

- [ ] **Step 4: 구현**

`api/_lib/coupleOps.ts`:

```ts
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
  await leave(db, uid)
  for (let i = 0; i < 6; i++) {
    const inviteCode = genCode()
    const coupleRef = db.collection('couples').doc()
    try {
      await db.runTransaction(async (t) => {
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
  return db.runTransaction(async (t) => {
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
    return { coupleId }
  })
}
```

- [ ] **Step 5: 통과 확인**

Run: `npm test`
Expected: 두 파일 모두 통과 (규칙 24개 + coupleOps 16개).

"코드가 겹치면 새 코드로 재시도한다"만 실패하고 오류의 `code`가 6/`'already-exists'`가 아니라면, `isAlreadyExists`에서 `console.log(e)`로 실제 코드를 확인해 그 값으로 고친다.

- [ ] **Step 6: 커밋**

```bash
git add api/_lib/coupleOps.ts tests/coupleOps.test.ts package.json package-lock.json README.md
git commit -m "feat: 커플 생성·참여·해제 서버 로직(coupleOps)과 에뮬레이터 테스트 추가"
```

---

### Task 2: HTTP 래퍼와 API 엔드포인트

**Files:**
- Create: `api/_lib/admin.ts`
- Create: `api/_lib/handler.ts`
- Create: `api/couple/create.ts`, `api/couple/join.ts`, `api/couple/leave.ts`
- Create: `tests/handler.test.ts`
- Create: `tsconfig.api.json`
- Modify: `vercel.json`
- Modify: `package.json` (`typecheck:api` 스크립트)

**Interfaces:**
- Consumes: Task 1의 `ApiError`, `create`, `join`, `leave`
- Produces:
  - `getAdminDb(): Firestore`, `verifyToken(token: string): Promise<string>` (uid 반환) — `api/_lib/admin.ts`
  - `withAuth(fn: (db: Firestore, uid: string, body: unknown) => Promise<unknown>)` → Vercel 핸들러. `fn`이 `undefined`를 반환하면 204, 아니면 200 + JSON.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/handler.test.ts`:

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: `tests/handler.test.ts`가 "Failed to resolve import ../api/_lib/handler.js"로 실패.

- [ ] **Step 3: 구현**

`api/_lib/admin.ts`:

```ts
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// 서비스 계정 JSON은 환경변수로만 받는다. 첫 호출 때 초기화하고 이후 재사용(콜드스타트 때만 초기화).
const app = () =>
  getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}')) })

export const getAdminDb = () => getFirestore(app())
export const verifyToken = async (token: string) => (await getAuth(app()).verifyIdToken(token)).uid
```

`api/_lib/handler.ts`:

```ts
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
      const uid = await verifyToken(m[1]).catch(() => {
        throw new ApiError(401, '인증에 실패했어요. 다시 로그인해주세요.')
      })
      const result = await fn(getAdminDb(), uid, req.body)
      if (result === undefined) return res.status(204).end()
      return res.status(200).json(result)
    } catch (e) {
      if (e instanceof ApiError) return res.status(e.status).json({ error: e.message })
      console.error(e)
      return res.status(500).json({ error: '서버 오류가 발생했어요.' })
    }
  }
}
```

`api/couple/create.ts`:

```ts
import { create } from '../_lib/coupleOps.js'
import { withAuth } from '../_lib/handler.js'

export default withAuth((db, uid) => create(db, uid))
```

`api/couple/join.ts`:

```ts
import { join } from '../_lib/coupleOps.js'
import { withAuth } from '../_lib/handler.js'

export default withAuth((db, uid, body) => join(db, uid, (body as { code?: unknown } | undefined)?.code))
```

`api/couple/leave.ts`:

```ts
import { leave } from '../_lib/coupleOps.js'
import { withAuth } from '../_lib/handler.js'

export default withAuth((db, uid) => leave(db, uid))
```

`vercel.json` (SPA 리라이트가 `/api/*`를 삼키지 않도록 제외):

```json
{
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```

`tsconfig.api.json` (Vercel 빌드 전에 타입 오류를 잡기 위한 검사용):

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["api"]
}
```

`package.json` scripts에 추가:

```json
"typecheck:api": "tsc -p tsconfig.api.json",
```

- [ ] **Step 4: 통과·타입 확인**

Run: `npm test && npm run typecheck:api`
Expected: 테스트 전부 통과, `tsc` 출력 없음(오류 0). `npm run build`도 기존대로 통과(`api/`는 build 대상이 아님).

- [ ] **Step 5: 커밋**

```bash
git add api tests/handler.test.ts tsconfig.api.json vercel.json package.json
git commit -m "feat: 커플 생성·참여·해제 API 엔드포인트와 토큰 검증 래퍼 추가"
```

---

### Task 3: 프론트엔드를 API 호출로 전환

**Files:**
- Modify: `src/services/coupleService.ts` (1~134행 교체, 135행 이후 유지)
- Modify: `src/pages/HomePage.tsx:5, 266-268, 278-283, 568 부근, 600-610`

**Interfaces:**
- Consumes: `POST /api/couple/create` → `{ coupleId, inviteCode }`, `POST /api/couple/join {code}` → `{ coupleId }`, `POST /api/couple/leave` → 204
- Produces: `createCouple(currentUid)`, `joinByCode(currentUid, code)`, `leaveCouple(currentUid)` — 반환값은 기존과 동일, `leaveCouple`은 `known` 인자 없음

- [ ] **Step 1: `coupleService.ts` 앞부분 교체**

파일 맨 위부터 `leaveCouple` 함수가 끝나는 `}` (현재 129행)까지를 아래로 바꾼다. `listenToCouple`부터 아래는 그대로 둔다.

```ts
import { auth, db } from "../firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

const COUPLES_COL = "couples";
const USERS_COL = "users";

// 내 coupleId 캐시 (화면 이동마다 users 문서를 다시 읽지 않기 위함). 생성/참여/탈퇴 시 갱신.
const coupleIdCache = new Map<string, string | null>(); // null = 커플 없음이 확정된 상태 (해제 직후 재조회 방지)

// 커플 쓰기는 서버 API가 처리한다 (보안 규칙상 클라이언트는 직접 쓸 수 없음)
async function callApi<T>(path: "create" | "join" | "leave", body?: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("로그인 필요");
  const res = await fetch(`/api/couple/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(body ?? {}),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "요청에 실패했어요. 다시 시도해주세요.");
  return data as T;
}

export async function createCouple(currentUid: string) {
  coupleIdCache.delete(currentUid);
  const res = await callApi<{ coupleId: string; inviteCode: string }>("create");
  coupleIdCache.set(currentUid, res.coupleId);
  return res;
}

export async function joinByCode(currentUid: string, code: string) {
  coupleIdCache.delete(currentUid);
  const res = await callApi<{ coupleId: string }>("join", { code });
  coupleIdCache.set(currentUid, res.coupleId); // 이후 내역 조회가 내 문서를 다시 읽지 않도록
  return res;
}

export async function leaveCouple(currentUid: string) {
  coupleIdCache.delete(currentUid);
  await callApi<void>("leave");
  coupleIdCache.set(currentUid, null);
}
```

- [ ] **Step 2: `HomePage.tsx` 정리**

(아래 줄 번호는 편집 전 기준이다. 위에서 아래로 줄이 삭제되므로 내용으로 찾아 고친다.)

1. 5행: `import coupleService, { perfLog } from "../services/coupleService";` → `import coupleService from "../services/coupleService";`
2. 266~268행(`const known = ... : undefined; // 리스너가 ...`) 3줄 삭제.
3. 278행 `const t0 = performance.now(); // [perf] 임시 측정` 삭제.
4. 281행 `await coupleService.leaveCouple(myUid, known);` → `await coupleService.leaveCouple(myUid);`
5. 283행 `alert(\`연결 해제되었습니다. (${Math.round(performance.now() - t0)}ms)\`);` → `alert("연결 해제되었습니다.");`
6. 600~601행 (`const t0 = ...`, `perfLog.length = 0;`) 삭제.
7. 604행 `perfLog.push(...)` 삭제.
8. 610행 알럿 → `alert("참여되었습니다.");`
9. 568행 부근 `createCouple` 호출부는 그대로 둔다 (`res.inviteCode`/`res.coupleId` 사용 방식 동일).

- [ ] **Step 3: 빌드·린트 확인**

Run: `npm run build && npm run lint`
Expected: 오류 없음 (`perfLog`, `known` 미사용 오류가 없어야 함).

Run: `grep -rn "perfLog\|timed(" src`
Expected: 출력 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/services/coupleService.ts src/pages/HomePage.tsx
git commit -m "refactor: 커플 생성·참여·해제를 서버 API 호출로 전환, 임시 성능 측정 코드 제거"
```

---

### Task 4: 문서 정리, API 배포와 실서비스 검증 (규칙 변경 전 게이트)

**Files:**
- Modify: `README.md` (기술 구성·아키텍처·폴더 구조·실행 방법)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Task 1~3의 결과
- Produces: 배포된 `/api/couple/*`가 실제로 동작함이 확인된 상태 (Task 5의 전제)

- [ ] **Step 1: `.gitignore`에 서비스 계정 키 패턴 추가**

```
# Firebase 서비스 계정 키 (절대 커밋 금지)
*-firebase-adminsdk-*.json
serviceAccount*.json
```

- [ ] **Step 2: README 갱신**

- "기술 구성" 표에 행 추가: `| 서버 | Vercel 서버리스 함수 + Firebase Admin SDK | 커플 연결 로직과 권한 검증을 서버로 이전 |`
- "폴더 구조" 코드 블록에 추가:
  ```
  api/
  ├─ couple/       커플 생성·참여·해제 API (create, join, leave)
  └─ _lib/         서버 공용 (coupleOps 로직, 토큰 검증 admin/handler)
  ```
- "아키텍처" 다이어그램의 `A[React 앱]` 아래에 서버 경로를 추가한다.
  ```
  A -->|커플 생성·참여·해제| S[Vercel API<br/>토큰 검증 + 트랜잭션]
  S -->|Admin SDK| C
  ```
- "실행 방법"에 아래를 추가한다.
  ```
  `/api`는 `vite dev`에서 동작하지 않습니다. 커플 연결까지 로컬에서 확인하려면 `npx vercel dev`를 쓰고, 서버에는 환경변수 `FIREBASE_SERVICE_ACCOUNT`(서비스 계정 JSON 한 줄)가 필요합니다.
  ```

- [ ] **Step 3: 커밋 (규칙 변경 없음 확인 후 push)**

Run: `git status --short` — `firestore.rules`가 변경 목록에 **없어야** 한다.

```bash
git add .gitignore README.md
git commit -m "docs: 커플 API 구조·실행 방법 반영, 서비스 계정 키 gitignore"
```

이 단계에서는 push하지 않는다. 환경변수를 먼저 설정해야 한다.

- [ ] **Step 4: 서비스 계정 키 발급과 Vercel 환경변수 설정 (사용자 작업)**

1. Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → **새 비공개 키 생성** → JSON 다운로드 (프로젝트 폴더 밖에 저장).
2. JSON 내용을 한 줄로 만든다: `node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))))" <키파일경로>`
3. Vercel 대시보드 → moneyduo 프로젝트 → Settings → Environment Variables → 이름 `FIREBASE_SERVICE_ACCOUNT`, 값 위 한 줄, Production·Preview 체크 → Save.
4. 키 파일은 사용 후 안전한 곳에 보관하거나 삭제한다.

- [ ] **Step 5: push (규칙은 배포하지 않음)**

`firestore.rules`가 변경되지 않았으므로 `/deploy-moneyduo`가 규칙을 배포하지 않는다. push하면 Vercel이 자동 배포한다. 배포 완료(Vercel 대시보드의 Ready)를 기다린다.

- [ ] **Step 6: 실서비스 검증**

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST https://moneyduo.vercel.app/api/couple/leave`
Expected: `401` (함수가 배포되어 토큰 없는 요청을 거부함. `404`/`200`(HTML)이면 라우팅 문제).

앱에서 직접 확인 (데모 로그인 두 계정을 시크릿 창 2개로):
| 동작 | 기대 결과 |
|---|---|
| 계정 A: 커플 생성 | 초대 코드 표시 |
| 계정 B: 코드 입력 | "참여되었습니다." 후 서로의 이름·내역 표시 |
| 계정 C: 같은 코드 입력 | "이미 두 명이 연결된 커플이에요." |
| 계정 B: 연결 해제 | "연결 해제되었습니다." 후 A 화면에서 해제 반영 |

모두 통과하면 Task 5로 진행한다. 하나라도 실패하면 Vercel 함수 로그로 원인을 확인하고, **규칙은 건드리지 않는다.**

---

### Task 5: 보안 규칙 조이기와 배포

**Files:**
- Modify: `firestore.rules` (users 생성·수정, couples, inviteCodes)
- Modify: `tests/firestore.rules.test.ts` (users·couples·inviteCodes 블록)
- Modify: `README.md` (보안 설계 문구, 테스트 개수)

**Interfaces:**
- Consumes: Task 4에서 실서비스 검증 완료
- Produces: 클라이언트의 `couples` 쓰기, `inviteCodes` 생성, `users.coupleId` 변경이 거부되는 규칙

- [ ] **Step 1: 실패하는 테스트로 교체**

`tests/firestore.rules.test.ts`에서:

1. import 줄을 `import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'`로 바꾼다 (`writeBatch`, `arrayUnion` 제거).
2. `describe('users', ...)` 맨 끝(마지막 `it` 뒤)에 아래 3개를 추가한다.

```ts
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
```

3. `describe('couples', ...)` 블록 전체를 아래로 교체한다.

```ts
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
```

4. `describe('inviteCodes', ...)` 블록 전체를 아래로 교체한다.

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: 방금 바꾼 규칙 테스트들이 FAIL (현재 규칙이 클라이언트 쓰기를 허용하므로). `coupleOps`/`handler` 테스트는 통과.

- [ ] **Step 3: 규칙 수정**

`firestore.rules`의 `users` 블록에서 `allow create`부터 `allow update ... );`(현재 41~72행 부근)까지를 아래로 바꾼다. `allow read`와 `allow delete: if false;`는 유지한다.

```
      // 생성은 본인 UID로만 가능. coupleId는 서버(/api/couple/*)만 정하므로 넣을 수 없다
      allow create: if isSignedIn()
        && request.auth.uid == userId
        && request.resource.data.get('coupleId', null) == null;

      // 업데이트는 본인만 가능하며 coupleId는 바꿀 수 없다 (서버 Admin SDK만 변경)
      allow update: if isSignedIn()
        && request.auth.uid == userId
        && request.resource.data.get('coupleId', null) == resource.data.get('coupleId', null);
```

`inviteCodes` 블록을 아래로 바꾼다.

```
    // inviteCodes: 초대 코드 → coupleId 조회용. 코드를 아는 사람만 get 가능(목록 불가).
    // 생성은 서버(Admin SDK)만 하므로 클라이언트 쓰기는 모두 금지
    match /inviteCodes/{code} {
      allow get: if isSignedIn();
    }
```

`couples` 블록에서 `allow create`, `allow update`, `allow delete` 세 개를 모두 삭제한다 (읽기 `get`/`list`와 그 주석은 유지). 블록 위 주석에 한 줄을 추가한다.

```
      // 쓰기(생성·참여·탈퇴·삭제)는 서버(/api/couple/*)가 Admin SDK로만 처리하므로 클라이언트 쓰기는 모두 금지
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: 전부 통과 (실패 시 규칙을 의도대로 바꿨는지 diff 확인).

- [ ] **Step 5: README 보안 설계 갱신**

"보안 설계 (Firestore Rules)" 목록의 마지막 줄을 아래로 바꾸고, "24개 시나리오"를 현재 규칙 테스트 개수로 고친다 (`npm test` 출력의 `firestore.rules.test.ts` 개수).

```
- 커플 생성·참여·해제는 서버 API(Admin SDK)만 수행하고, 규칙은 클라이언트의 `couples` 쓰기와 `users.coupleId` 변경을 모두 거부
```

- [ ] **Step 6: 커밋하고 규칙 배포**

```bash
git add firestore.rules tests/firestore.rules.test.ts README.md
git commit -m "feat: 보안 규칙에서 커플 관련 클라이언트 쓰기 차단 (서버 API 전용)"
```

`/deploy-moneyduo`로 push하면 규칙 변경이 감지되어 `npm run deploy:rules`가 먼저 실행된다. Task 4 검증이 끝났으므로 안전하다.

- [ ] **Step 7: 배포 후 최종 확인**

앱에서 Task 4 Step 6의 표를 다시 수행한다. 추가로 브라우저 콘솔에서 클라이언트가 직접 `couples` 쓰기를 시도하면 `permission-denied`가 나는지 확인한다.
