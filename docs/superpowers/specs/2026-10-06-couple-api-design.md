# 커플 연결 API 설계 (Vercel 서버리스 함수)

## 목표

- 커플 생성·참여·해제를 클라이언트 직접 쓰기에서 **서버 API**로 옮긴다.
- 이직 포트폴리오에서 풀스택 역량(서버 코드, 토큰 검증, 트랜잭션)을 보여준다.
- 비용 0원, 카드 등록 없음 (Vercel Hobby 서버리스 함수 + Firebase Admin SDK).
- 기존 화면 동작과 `coupleService` 함수 시그니처는 바뀌지 않는다.

## 현재 문제

`createCouple`, `joinByCode`, `leaveCouple`([src/services/coupleService.ts](../../../src/services/coupleService.ts))이 클라이언트에서 Firestore에 직접 쓰고, 권한 검증은 보안 규칙이 맡는다. 그 결과 규칙이 복잡하고(`existsAfter`/`getAfter`), 커플 정원(2명) 같은 비즈니스 규칙은 검증되지 않는다.

## 구조

```
api/
├─ _lib/
│  ├─ admin.ts      Firebase Admin 초기화 (환경변수 FIREBASE_SERVICE_ACCOUNT)
│  └─ auth.ts       Authorization 헤더 → verifyIdToken → uid
└─ couple/
   ├─ create.ts     POST /api/couple/create
   ├─ join.ts       POST /api/couple/join   { code }
   └─ leave.ts      POST /api/couple/leave
```

- 모든 함수는 POST만 허용하고, uid는 **토큰에서만** 읽는다 (본문의 uid는 신뢰하지 않는다).
- 응답: 성공 시 기존 반환값과 동일(`create` → `{ coupleId, inviteCode }`, `join` → `{ coupleId }`, `leave` → 빈 본문 204).
- 오류: 401(토큰 없음/무효), 400(잘못된 입력), 404(없는 코드), 409(이미 가득 참), 500.

## 동작

| API | 처리 |
|---|---|
| create | 내가 이미 커플이면 먼저 해제 → 코드 생성 → `inviteCodes`/`couples`/`users.coupleId`를 한 번에 쓴다. 코드 충돌(문서 존재)이면 새 코드로 재시도(최대 6회). |
| join | 트랜잭션: 코드 → coupleId 조회, 커플 존재 확인, **멤버가 2명 이상이면 409**, 이미 멤버면 멱등 처리, 아니면 `members`에 추가 + `users.coupleId` 설정. 내가 다른 커플이면 먼저 해제. |
| leave | 트랜잭션: 내 `users.coupleId` 조회 → 멤버 1명이면 커플 삭제, 아니면 본인 제거 → `users.coupleId = null`. 커플이 없거나 이미 멤버가 아니면 `coupleId`만 비운다. |

## 프론트엔드 변경

- [src/services/coupleService.ts](../../../src/services/coupleService.ts)의 세 함수 본문을 `fetch('/api/couple/...')`로 교체한다. 요청마다 `auth.currentUser.getIdToken()`을 `Authorization: Bearer`로 보낸다.
- `coupleIdCache` 갱신은 유지한다. `leaveCouple`의 `known` 인자는 서버가 직접 조회하므로 제거한다 (호출부 [HomePage.tsx](../../../src/pages/HomePage.tsx) 수정).
- 임시 성능 측정 코드(`perfLog`, `timed`, 참여 알럿의 단계별 시간 표시)는 함께 정리한다.
- 읽기 함수(`listenToCouple`, `getCoupleById`, `getMyCouple`, `getMyCoupleId`)는 그대로 클라이언트에서 Firestore를 읽는다.

## 보안 규칙 변경

API 배포를 확인한 **뒤에** 조인다.

| 컬렉션 | 변경 |
|---|---|
| `couples` | `create`, `update`, `delete` 전부 `false`. 읽기 규칙은 유지 |
| `inviteCodes` | `create` `false`. `get` 유지 |
| `users` | `coupleId` 변경 금지 (본인이 다른 필드는 수정 가능). `existsAfter`/`getAfter` 분기 삭제 |

Admin SDK는 규칙을 우회하므로 서버 쓰기에는 영향이 없다.

## 시크릿·배포

- 서비스 계정 JSON은 Vercel 환경변수 `FIREBASE_SERVICE_ACCOUNT`에만 저장한다. 저장소와 로그에는 남기지 않는다.
- 배포 순서: ① API와 프론트 배포 → ② 동작 확인 → ③ 규칙 배포(`npm run deploy:rules`). 순서를 바꾸면 구버전 클라이언트가 깨진다.
- 로컬 실행은 `vercel dev` (Vercel CLI, 무료). `vite dev`는 `/api`를 실행하지 못한다.

## 테스트

- 규칙 테스트([tests/firestore.rules.test.ts](../../../tests/firestore.rules.test.ts)): 클라이언트의 `couples` 생성·수정, `inviteCodes` 생성, `users.coupleId` 변경이 **거부**되는 시나리오로 갱신한다.
- 함수 로직 테스트: Firestore 에뮬레이터와 Admin SDK로 create/join/leave의 핵심 시나리오(정원 초과 409, 멱등 참여, 마지막 멤버 해제 시 커플 삭제, 코드 충돌 재시도)를 검증한다.
- 토큰 검증은 인증 에뮬레이터 또는 `verifyIdToken` 모킹으로 401 경로를 검증한다.

## 범위 밖 (YAGNI)

- 예산 초과 알림, 거래 검색 (별도 작업)
- 요청 속도 제한, 로깅 인프라
- Express 등 라우터 프레임워크

## 위험과 확인 사항

| 항목 | 대응 |
|---|---|
| 서버리스 콜드스타트로 연결·해제가 느려질 수 있음 | 구현 후 실제 응답 시간을 측정하고, 느리면 README에 한계로 기록한다. |
| 서비스 계정 키 유출 | 환경변수만 사용, `.gitignore` 확인, 커밋 전 키 포함 여부 점검 |
| 배포 순서 오류 | 규칙 배포는 API 동작 확인 후에만 진행 |
