import { useNavigate, useLocation } from "react-router-dom";

const menus = [
  { path: "/home", icon: "🏠", label: "홈" },
  { path: "/transactions", icon: "📋", label: "내역" },
  { path: "/chart", icon: "📊", label: "차트" },
  { path: "/mypage", icon: "👤", label: "내 정보" },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[400px] bg-white border-t-2 border-[#c9c2f5] flex justify-around py-2 pb-4">
      {menus.map((menu) => (
        <div
          key={menu.path}
          onClick={() => navigate(menu.path)}
          className="flex flex-col items-center gap-1 cursor-pointer"
        >
          <span className="text-xl">{menu.icon}</span>
          <span className={`text-[10px] font-bold ${location.pathname === menu.path ? "text-[#7f77dd]" : "text-[#c9c2f5]"}`}>
            {menu.label}
          </span>
        </div>
      ))}
    </div>
  );
};

export default BottomNav;