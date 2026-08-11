# 홈페이지 월 이동 기능 설계

## 배경
현재 HomePage는 월과 무관하게 최신 거래 내역 20건만 보여준다. ChartPage(통계 페이지)에는 이미 월 이동 UI(◄ 연/월 ► + 탭하면 연/월 선택 팝업)와 선택한 달 전체 내역을 조회하는 로직이 구현되어 있다. 홈페이지에도 같은 방식의 월 이동 기능을 추가한다.

## 목표
- 홈페이지에서 이전/다음 달로 이동하며 그 달의 전체 내역과 수입/지출/순액을 볼 수 있게 한다.
- ChartPage와 동일한 월 이동 UI를 재사용한다(중복 구현 방지).

## 변경 사항

### 1. `MonthNavigator` 컴포넌트 추출
- 위치: `src/components/MonthNavigator.tsx`
- ChartPage.tsx에 있는 월 이동 UI(◄ "YYYY년 M월" ► 버튼 + 탭하면 열리는 연도/월 선택 팝업)를 그대로 옮긴다.
- Props: `month: Date`, `onChange: (date: Date) => void`
- 내부적으로 이전/다음 달 이동, 연도 선택, 월 선택, 팝업 열림/닫힘 상태(`showMonthPicker`)를 자체적으로 관리한다.
- ChartPage.tsx와 HomePage.tsx는 이 컴포넌트를 import해서 사용한다.

### 2. ChartPage.tsx
- 기존 월 이동 UI 마크업(약 150줄, `handlePrevMonth`/`handleNextMonth`/`handleSelectMonth`/`handleSelectYear`/`toggleMonthPicker`/`showMonthPicker`/`yearOptions` 관련 코드 포함)을 제거하고 `<MonthNavigator month={month} onChange={setMonth} />` 호출로 대체한다.
- 데이터 로딩 로직(`loadChartData`, `formatMonthKey`)은 그대로 유지한다.

### 3. HomePage.tsx
- `month` state 추가 (기본값 `new Date()`).
- 기존 인증 상태 감지 `useEffect` 안의 거래 내역 조회 로직을 `loadTransactions(userId, monthKey)` 함수로 분리한다.
- 조회 쿼리를 `limit(20)` → `limit(300)` + 클라이언트 사이드 `date.startsWith(monthKey)` 필터로 변경한다(ChartPage와 동일한 패턴). 커플/솔로 두 쿼리 모두 동일하게 적용.
- `useEffect` 의존성 배열에 `month`를 추가해서, 인증 상태가 바뀔 때뿐 아니라 월이 바뀔 때도 재조회되게 한다.
- 수입/지출/순액 요약 카드는 코드 변경 없이 필터링된 `txData` 기준으로 자동 반영된다.
- "최근 내역" 라벨을 제거하고 그 자리에 `<MonthNavigator month={month} onChange={setMonth} />`를 배치한다(헤더-요약카드 사이 겹침 레이아웃을 건드리지 않기 위해).
- 내역이 없을 때 문구를 "아직 내역이 없어요" → "이 달은 아직 내역이 없어요"로 변경한다.

## 범위 밖
- 월별 데이터 캐싱/프리페치는 하지 않는다. 월 이동 시마다 새로 조회한다.
- 연/월 선택 팝업의 디자인 자체는 바꾸지 않고 그대로 재사용한다.

## 테스트
- 수동 확인: 홈페이지에서 이전/다음 달 이동, 연/월 팝업으로 임의 월 선택, 데이터 있는 달과 없는 달 모두 확인. 통계 페이지도 동일하게 동작하는지 회귀 확인.
