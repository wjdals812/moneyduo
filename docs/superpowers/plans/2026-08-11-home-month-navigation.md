# 홈페이지 월 이동 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈페이지(HomePage)에 통계 페이지(ChartPage)와 동일한 월 이동 UI를 추가하고, 선택한 달의 전체 내역/수입/지출/순액을 조회하도록 만든다.

**Architecture:** ChartPage.tsx에 이미 구현된 월 이동 UI(◄ "YYYY년 M월" ► + 연/월 선택 팝업)를 `MonthNavigator` 컴포넌트로 추출해 ChartPage와 HomePage 양쪽에서 재사용한다. HomePage는 `month` state를 추가하고, 거래 내역 조회 쿼리를 `limit(20)` → `limit(300)` + 클라이언트 사이드 월 필터로 바꿔서 선택한 달의 전체 내역을 보여준다.

**Tech Stack:** React 19 + TypeScript, Firebase Firestore, Vite. 이 프로젝트에는 테스트 프레임워크가 설치되어 있지 않으므로(package.json에 vitest/jest 없음), 각 태스크의 검증은 `npm run build`(타입 체크)와 개발 서버에서의 수동 브라우저 확인으로 한다.

## Global Constraints

- 기존 ChartPage의 연/월 선택 팝업 디자인(스타일, 색상, 레이아웃)은 그대로 유지한다 — 픽셀 단위로 동일해야 한다.
- HomePage의 헤더-요약카드 겹침 레이아웃(margin: -18px 오버랩 효과)은 건드리지 않는다.
- Firestore 쿼리 패턴은 ChartPage의 기존 방식(`limit(300)` + `date.startsWith(monthKey)` 클라이언트 필터)을 그대로 따른다.

---

### Task 1: `MonthNavigator` 컴포넌트 추출 및 ChartPage 적용

**Files:**
- Create: `src/components/MonthNavigator.tsx`
- Modify: `src/pages/ChartPage.tsx`

**Interfaces:**
- Produces: `MonthNavigator` — `{ month: Date; onChange: (date: Date) => void }` props를 받는 default export 컴포넌트. 내부적으로 이전/다음 달 이동 버튼, "YYYY년 M월" 라벨 버튼(탭하면 연/월 선택 팝업 토글), 연도(현재 -4 ~ +4) 그리드, 월(1~12) 그리드를 렌더링한다. 팝업 열림/닫힘 상태는 컴포넌트 내부 `useState`로 관리한다.

- [ ] **Step 1: `MonthNavigator.tsx` 작성**

`src/pages/ChartPage.tsx`의 142~165행(state/handler)과 213~335행(JSX 마크업)을 그대로 옮겨서 다음 파일을 작성한다:

```tsx
import { useState } from "react";

interface MonthNavigatorProps {
  month: Date;
  onChange: (date: Date) => void;
}

const MonthNavigator = ({ month, onChange }: MonthNavigatorProps) => {
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 9 }, (_, i) => currentYear - 4 + i);

  const handlePrevMonth = () => {
    onChange(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    onChange(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  };

  const handleSelectMonth = (selectedMonth: number) => {
    onChange(new Date(month.getFullYear(), selectedMonth - 1, 1));
    setShowMonthPicker(false);
  };

  const handleSelectYear = (selectedYear: number) => {
    onChange(new Date(selectedYear, month.getMonth(), 1));
  };

  const toggleMonthPicker = () => {
    setShowMonthPicker((prev) => !prev);
  };

  return (
    <div style={{
      position: "relative",
      display: "grid",
      gridTemplateColumns: "48px minmax(0, 1fr) 48px",
      alignItems: "center",
      background: "#ffffff",
      borderRadius: "16px",
      border: "1px solid rgba(148, 163, 184, 0.16)",
      padding: "12px 16px",
      gap: "12px",
      minWidth: 0,
    }}>
      <button onClick={handlePrevMonth} style={{
        all: "unset",
        cursor: "pointer",
        width: "40px",
        height: "40px",
        borderRadius: "12px",
        background: "#f4f6f8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#4b5563",
        fontSize: "18px",
        boxShadow: "0 2px 8px rgba(71, 85, 105, 0.08)",
      }}>‹</button>
      <button onClick={toggleMonthPicker} style={{
        all: "unset",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minWidth: 0,
        padding: "10px 12px",
        borderRadius: "14px",
        background: "#f8fafc",
        color: "#334155",
        fontSize: "15px",
        fontWeight: 700,
        cursor: "pointer",
        border: "1px solid rgba(127, 119, 221, 0.3)",
        textAlign: "center",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        {month.getFullYear()}년 {month.getMonth() + 1}월
        <span style={{ marginLeft: "8px", color: "#475569" }}>▾</span>
      </button>
      <button onClick={handleNextMonth} style={{
        all: "unset",
        cursor: "pointer",
        width: "40px",
        height: "40px",
        borderRadius: "12px",
        background: "#f4f6f8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#4b5563",
        fontSize: "18px",
        boxShadow: "0 2px 8px rgba(71, 85, 105, 0.08)",
      }}>›</button>
      {showMonthPicker && (
        <div style={{
          position: "absolute",
          left: "50%",
          top: "110%",
          transform: "translateX(-50%)",
          width: "calc(100% - 16px)",
          background: "#ffffff",
          borderRadius: "20px",
          border: "1px solid rgba(148, 163, 184, 0.16)",
          boxShadow: "0 18px 50px rgba(71, 85, 105, 0.08)",
          padding: "18px",
          zIndex: 10,
        }}>
          <div style={{ marginBottom: "12px", fontSize: "13px", color: "#6b6b6b", fontWeight: 700 }}>
            연도 선택
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
            {yearOptions.map((year) => (
              <button key={year} onClick={() => handleSelectYear(year)} style={{
                all: "unset",
                cursor: "pointer",
                padding: "10px 14px",
                borderRadius: "14px",
                background: year === month.getFullYear() ? "#7A6FA8" : "#f8fafc",
                color: year === month.getFullYear() ? "white" : "#475569",
                fontWeight: 700,
                fontSize: "13px",
              }}>
                {year}년
              </button>
            ))}
          </div>
          <div style={{ marginBottom: "12px", fontSize: "13px", color: "#6b6b6b", fontWeight: 700 }}>
            월 선택
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button key={m} onClick={() => handleSelectMonth(m)} style={{
                all: "unset",
                cursor: "pointer",
                padding: "10px 0",
                borderRadius: "12px",
                background: m === month.getMonth() + 1 ? "#7A6FA8" : "#f8fafc",
                border: "1px solid rgba(155, 142, 196, 0.3)",
                color: m === month.getMonth() + 1 ? "white" : "#475569",
                fontSize: "13px",
                textAlign: "center",
              }}>
                {m}월
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthNavigator;
```

- [ ] **Step 2: `ChartPage.tsx`를 `MonthNavigator` 사용으로 교체**

`src/pages/ChartPage.tsx`에서:
1. import 추가: `import MonthNavigator from "../components/MonthNavigator";`
2. 142~165행 삭제 (`showMonthPicker` state, `currentYear`, `yearOptions`, `handlePrevMonth`, `handleNextMonth`, `handleSelectMonth`, `handleSelectYear`, `toggleMonthPicker` — 이제 `MonthNavigator` 내부로 옮겨졌으므로 ChartPage에는 필요 없음)
3. 216~334행의 월 이동 UI 마크업 전체를 다음으로 교체:

```tsx
<MonthNavigator month={month} onChange={setMonth} />
```

(바깥의 `<div style={{ marginBottom: "30px" }}>...</div>` 래퍼는 그대로 유지하고, 그 안의 내용만 위 한 줄로 교체한다.)

- [ ] **Step 3: 타입 체크로 검증**

Run: `npm run build`
Expected: 에러 없이 빌드 성공 (사용하지 않는 변수/미사용 import로 인한 TS 에러가 없어야 함)

- [ ] **Step 4: 개발 서버에서 회귀 확인**

Run: `npm run dev`
브라우저에서 통계 페이지로 이동해 다음을 확인한다:
- ◄ ► 버튼으로 이전/다음 달 이동이 이전과 동일하게 동작하는지
- "YYYY년 M월" 라벨을 탭하면 연/월 선택 팝업이 열리는지, 연도/월 선택 시 반영되는지
- 팝업 스타일이 이전과 동일하게 보이는지 (레이아웃 깨짐 없는지)

- [ ] **Step 5: 커밋**

```bash
git add src/components/MonthNavigator.tsx src/pages/ChartPage.tsx
git commit -m "refactor: extract MonthNavigator component from ChartPage"
```

---

### Task 2: HomePage에 월 이동 기능 추가

**Files:**
- Modify: `src/pages/HomePage.tsx`

**Interfaces:**
- Consumes: `MonthNavigator` (Task 1에서 생성) — `import MonthNavigator from "../components/MonthNavigator";`, props `{ month: Date; onChange: (date: Date) => void }`

- [ ] **Step 1: `month` state와 `formatMonthKey` 헬퍼 추가**

`src/pages/HomePage.tsx`의 state 선언부(현재 50~51행 `partnerEmoji`/`myEmoji` 아래)에 추가:

```tsx
const [month, setMonth] = useState<Date>(new Date());
```

`groupByDate`/`formatDate` 헬퍼 함수들 근처(34행 이전)에 추가:

```tsx
const formatMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
```

- [ ] **Step 2: 거래 내역 조회 로직을 `loadTransactions` 함수로 분리하고 월 필터 적용**

현재 `useEffect` 안에서 106~189행에 걸쳐 인라인으로 처리되는 "커플/솔로 내역 조회 + 합계 계산" 블록을 컴포넌트 내부의 별도 함수로 뽑아낸다. `attachCoupleListener` 함수 바로 아래(101행 이후)에 추가:

```tsx
const loadTransactions = async (userId: string, monthKey: string) => {
  try {
    const myCouple = await coupleService.getMyCouple(userId);

    let txData: Transaction[] = [];

    if (myCouple && myCouple.members.length >= 2) {
      setCoupleInfo(myCouple);
      setInviteCode(myCouple.inviteCode ?? "");
      attachCoupleListener(myCouple.id, userId);

      const [coupleSnap, soloSnap] = await Promise.all([
        getDocs(query(
          collection(db, "transactions"),
          where("coupleId", "==", myCouple.id),
          orderBy("date", "desc"), limit(300)
        )),
        getDocs(query(
          collection(db, "transactions"),
          where("createdBy", "==", userId),
          orderBy("date", "desc"), limit(300)
        )),
      ]);

      const allDocs = [...coupleSnap.docs, ...soloSnap.docs];
      const seen = new Set();
      txData = allDocs
        .filter(d => {
          if (seen.has(d.id)) return false;
          seen.add(d.id);
          return true;
        })
        .map(d => ({ id: d.id, ...d.data() })) as Transaction[];

      txData.sort((a, b) => b.date.localeCompare(a.date));

    } else {
      const soloQ = query(
        collection(db, "transactions"),
        where("createdBy", "==", userId),
        orderBy("date", "desc"),
        limit(300)
      );
      const soloSnap = await getDocs(soloQ);
      txData = soloSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Transaction[];
    }

    // 선택한 달의 내역만 필터링
    txData = txData.filter((t) => t.date.startsWith(monthKey));

    setTransactions(txData);
    setTotalExpense(txData.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0));
    setTotalIncome(txData.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0));
  } catch (e) {
    console.error(e);
  }
};
```

- [ ] **Step 3: `useEffect`에서 새 함수 호출 + `month`를 의존성에 추가**

기존 `useEffect`(105~207행) 안의 try 블록(124~189행, "내 커플 문서 조회"부터 합계 계산까지)을 삭제하고 한 줄로 교체:

```tsx
await loadTransactions(user.uid, formatMonthKey(month));
```

`useEffect`의 의존성 배열을 `[navigate]` → `[navigate, month]`로 변경한다.

변경 후 `useEffect` 전체는 다음과 같은 모양이어야 한다:

```tsx
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      setUserName(user.displayName || "");

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          setMyEmoji(userSnap.data().emoji || "🐰");
        }
      } catch (e) {
        console.error(e);
      }

      await loadTransactions(user.uid, formatMonthKey(month));

    } else {
      navigate("/");
    }

    setLoading(false);
  });

  return () => {
    if (coupleUnsubRef.current) coupleUnsubRef.current();
    unsubscribe();
  };
}, [navigate, month]);
```

- [ ] **Step 4: "최근 내역" 라벨을 `MonthNavigator`로 교체**

import 추가: `import MonthNavigator from "../components/MonthNavigator";`

현재 다음 블록(약 404~411행):

```tsx
<div style={{
  display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px",
  animation: "fadeUp 0.5s 0.2s ease both", opacity: 0, animationFillMode: "forwards",
}}>
  <span style={{ fontSize: "16px", fontWeight: 700, color: "#7A6FA8" }}>최근 내역</span>
  <div style={{ flex: 1, height: "1.5px", background: "linear-gradient(to right, #e8e4f5, transparent)" }} />
  <span style={{ fontSize: "13px" }}>📋</span>
</div>
```

를 다음으로 교체:

```tsx
<div style={{
  marginBottom: "16px",
  animation: "fadeUp 0.5s 0.2s ease both", opacity: 0, animationFillMode: "forwards",
}}>
  <MonthNavigator month={month} onChange={setMonth} />
</div>
```

- [ ] **Step 5: 빈 상태 문구 변경**

"아직 내역이 없어요" 문구가 있는 블록(약 420행)에서:

```tsx
<div style={{ fontSize: "13px", color: "#9e99cc", fontWeight: 700 }}>아직 내역이 없어요</div>
```

를 다음으로 교체:

```tsx
<div style={{ fontSize: "13px", color: "#9e99cc", fontWeight: 700 }}>이 달은 아직 내역이 없어요</div>
```

- [ ] **Step 6: 타입 체크로 검증**

Run: `npm run build`
Expected: 에러 없이 빌드 성공

- [ ] **Step 7: 개발 서버에서 수동 확인**

Run: `npm run dev`
브라우저에서 홈페이지로 이동해 다음을 확인한다:
- "최근 내역" 자리에 월 이동 바(◄ 현재 연/월 ►)가 보이는지
- ◄ ► 버튼으로 월 이동 시 해당 월의 전체 내역과 수입/지출/순액이 갱신되는지
- 내역이 없는 달로 이동하면 "이 달은 아직 내역이 없어요" 문구가 보이는지
- 연/월 선택 팝업으로 임의의 달로 이동해도 정상 동작하는지
- 헤더-요약카드 겹침 레이아웃이 이전과 동일하게 보이는지 (깨지지 않았는지)
- 커플 연결 상태(파트너 이름 표시, 연결/해제)가 이전과 동일하게 동작하는지

- [ ] **Step 8: 커밋**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat: add month navigation to home page"
```
