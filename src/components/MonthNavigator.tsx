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
