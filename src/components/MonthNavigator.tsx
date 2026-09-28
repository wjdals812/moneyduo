import { useState } from "react";
import { theme } from "../theme";

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
      gridTemplateColumns: "36px minmax(0, 1fr) 36px",
      alignItems: "center",
      background: theme.surface,
      borderRadius: theme.radiusMd,
      border: `1px solid ${theme.border}`,
      padding: "10px 12px",
      gap: "10px",
      minWidth: 0,
    }}>
      <button onClick={handlePrevMonth} style={{
        all: "unset",
        cursor: "pointer",
        width: "32px",
        height: "32px",
        borderRadius: theme.radiusSm,
        background: theme.surfaceMuted,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: theme.textMuted,
        fontSize: "16px",
      }}>‹</button>
      <button onClick={toggleMonthPicker} style={{
        all: "unset",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minWidth: 0,
        padding: "8px 12px",
        borderRadius: theme.radiusSm,
        background: theme.surfaceMuted,
        color: theme.text,
        fontSize: "14px",
        fontWeight: 600,
        cursor: "pointer",
        border: `1px solid ${theme.border}`,
        textAlign: "center",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        {month.getFullYear()}년 {month.getMonth() + 1}월
        <span style={{ marginLeft: "8px", color: theme.textMuted }}>▾</span>
      </button>
      <button onClick={handleNextMonth} style={{
        all: "unset",
        cursor: "pointer",
        width: "32px",
        height: "32px",
        borderRadius: theme.radiusSm,
        background: theme.surfaceMuted,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: theme.textMuted,
        fontSize: "16px",
      }}>›</button>
      {showMonthPicker && (
        <div style={{
          position: "absolute",
          left: "50%",
          top: "110%",
          transform: "translateX(-50%)",
          width: "calc(100% - 16px)",
          background: theme.surface,
          borderRadius: theme.radiusMd,
          border: `1px solid ${theme.border}`,
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
          padding: "16px",
          zIndex: 10,
        }}>
          <div style={{ marginBottom: "10px", fontSize: "12px", color: theme.textMuted, fontWeight: 600 }}>
            연도 선택
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
            {yearOptions.map((year) => (
              <button key={year} onClick={() => handleSelectYear(year)} style={{
                all: "unset",
                cursor: "pointer",
                padding: "8px 12px",
                borderRadius: theme.radiusSm,
                background: year === month.getFullYear() ? theme.accent : theme.surfaceMuted,
                color: year === month.getFullYear() ? "white" : theme.textMuted,
                fontWeight: 600,
                fontSize: "12px",
              }}>
                {year}년
              </button>
            ))}
          </div>
          <div style={{ marginBottom: "10px", fontSize: "12px", color: theme.textMuted, fontWeight: 600 }}>
            월 선택
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px" }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button key={m} onClick={() => handleSelectMonth(m)} style={{
                all: "unset",
                cursor: "pointer",
                padding: "8px 0",
                borderRadius: theme.radiusSm,
                background: m === month.getMonth() + 1 ? theme.accent : theme.surfaceMuted,
                border: `1px solid ${theme.border}`,
                color: m === month.getMonth() + 1 ? "white" : theme.textMuted,
                fontSize: "12px",
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
