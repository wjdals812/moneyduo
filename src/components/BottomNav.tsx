import { useNavigate, useLocation } from "react-router-dom";

// 홈 아이콘
const HomeIcon = ({ active }: { active: boolean }) =>
  active ? (
    // filled
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.707 2.293a1 1 0 0 1 1.414 0l9 9A1 1 0 0 1 20 13h-1v8a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-5h-2v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8H4a1 1 0 0 1-.707-1.707l9-9Z" />
    </svg>
  ) : (
    // outline
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 12L12 3l9 9" />
      <path d="M9 21V12h6v9" />
      <path d="M5 10v11h4v-6h6v6h4V10" />
    </svg>
  );

// 내역 아이콘
// const TransactionsIcon = ({ active }: { active: boolean }) =>
//   active ? (
//     // filled
//     <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
//       <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm-9 13H7v-2h3v2Zm0-4H7v-2h3v2Zm0-4H7V6h3v2Zm6 8h-4v-2h4v2Zm0-4h-4v-2h4v2Zm0-4h-4V6h4v2Z" />
//     </svg>
//   ) : (
//     // outline
//     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
//       <rect x="3" y="3" width="18" height="18" rx="2" />
//       <path d="M7 8h3M7 12h3M7 16h3M14 8h3M14 12h3M14 16h3" />
//     </svg>
//   );

// 캘린더 아이콘 추가
const CalendarIcon = ({ active }: { active: boolean }) =>
  active ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V9h14v11ZM7 11h2v2H7Zm4 0h2v2h-2Zm4 0h2v2h-2Zm-8 4h2v2H7Zm4 0h2v2h-2Zm4 0h2v2h-2Z" />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
    </svg>
  );

// 차트 아이콘
const ChartIcon = ({ active }: { active: boolean }) =>
  active ? (
    // filled
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 21H2v-2h20v2ZM5 17H3V9h2v8Zm6 0H9V5h2v12Zm6 0h-2v-6h2v6Z" />
    </svg>
  ) : (
    // outline
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 19h18" />
      <path d="M4 19V9h2v10" />
      <path d="M10 19V5h2v14" />
      <path d="M16 19v-6h2v6" />
    </svg>
  );

// 내 정보 아이콘
const MypageIcon = ({ active }: { active: boolean }) =>
  active ? (
    // filled
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4Z" />
    </svg>
  ) : (
    // outline
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  );

const menus = [
  { path: "/home", label: "홈", Icon: HomeIcon },
  // { path: "/transactions", label: "내역", Icon: TransactionsIcon },
  { path: "/chart", label: "차트", Icon: ChartIcon },
  { path: "/calendar", label: "캘린더", Icon: CalendarIcon },
  { path: "/mypage", label: "내 정보", Icon: MypageIcon },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[400px] bg-white border-t-2 border-[#c9c2f5] flex justify-around py-2 pb-4 z-30">
      {menus.map(({ path, label, Icon }) => {
        const active = location.pathname === path;
        return (
          <div
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center gap-1 cursor-pointer"
          >
            <span className={active ? "text-[#7f77dd]" : "text-[#c9c2f5]"}>
              <Icon active={active} />
            </span>
            <span className={`text-[10px] font-bold ${active ? "text-[#7f77dd]" : "text-[#c9c2f5]"}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default BottomNav;