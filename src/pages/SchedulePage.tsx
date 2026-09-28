import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import BottomNav from "../components/BottomNav";
import { theme } from "../theme";

interface Schedule {
  id: string;
  title: string;
  date: string;
  memo?: string;
  type: "schedule" | "anniversary";
  createdBy: string;
}

const calcDday = (dateStr: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "D-Day";
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
};

const toDateStr = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const SchedulePage = () => {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [type, setType] = useState<"schedule" | "anniversary">("schedule");
  const [title, setTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [memo, setMemo] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [focusedDate, setFocusedDate] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) await loadData(user.uid);
      else navigate("/");
    });
    return () => unsubscribe();
  }, [navigate]);

  const loadData = async (uid: string) => {
    const q = query(collection(db, "schedules"), where("createdBy", "==", uid));
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Schedule[];
    setSchedules(data.sort((a, b) => a.date.localeCompare(b.date)));
  };

  const handleAdd = async () => {
    if (!title || !selectedDate) return alert("제목과 날짜를 입력해주세요.");
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await addDoc(collection(db, "schedules"), {
      title, date: selectedDate, memo, type,
      createdBy: uid,
      createdAt: new Date(),
    });
    setTitle(""); setMemo("");
    setShowModal(false);
    await loadData(uid);
  };

  const handleDelete = async (id: string) => {
    const ok = confirm("삭제하시겠어요?");
    if (!ok) return;
    await deleteDoc(doc(db, "schedules", id));
    const uid = auth.currentUser?.uid;
    if (uid) await loadData(uid);
  };

  // 달력 계산
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const scheduleDates = new Set(schedules.filter((s) => s.type === "schedule").map((s) => s.date));
  const anniversaryDates = new Set(schedules.filter((s) => s.type === "anniversary").map((s) => s.date));

  const focusedSchedules = focusedDate
    ? schedules.filter((s) => s.date === focusedDate)
    : [];

  const days = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div style={{
      minHeight: "100svh",
      background: theme.bg,
      maxWidth: "400px",
      margin: "0 auto",
      paddingBottom: "120px",
    }}>
      <style>{`
        .day-cell:hover { background: ${theme.surfaceMuted} !important; }
      `}</style>

      {/* 헤더 */}
      <div style={{
        background: theme.surface,
        padding: "20px",
        borderBottom: `1px solid ${theme.border}`,
      }}>
        <div style={{ fontSize: "18px", fontWeight: 700, color: theme.text }}>일정 & 기념일</div>
        <div style={{ fontSize: "12px", fontWeight: 500, color: theme.textMuted, marginTop: 2 }}>우리 둘의 소중한 날들</div>

        {/* 월 네비게이션 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: "16px",
        }}>
          <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} style={{
            all: "unset", cursor: "pointer",
            width: "32px", height: "32px", borderRadius: theme.radiusSm,
            background: theme.surfaceMuted, color: theme.textMuted,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px",
          }}>‹</button>
          <div style={{ fontSize: "15px", fontWeight: 700, color: theme.text }}>
            {year}년 {month + 1}월
          </div>
          <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} style={{
            all: "unset", cursor: "pointer",
            width: "32px", height: "32px", borderRadius: theme.radiusSm,
            background: theme.surfaceMuted, color: theme.textMuted,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px",
          }}>›</button>
        </div>

        {/* 요일 헤더 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginTop: "14px" }}>
          {days.map((d, i) => (
            <div key={d} style={{
              textAlign: "center", fontSize: "11px", fontWeight: 600, paddingBottom: "8px",
              color: i === 0 ? theme.danger : theme.textMuted,
            }}>{d}</div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const dateStr = toDateStr(year, month, d);
            const isToday = dateStr === today;
            const isFocused = dateStr === focusedDate;
            const hasSchedule = scheduleDates.has(dateStr);
            const hasAnniversary = anniversaryDates.has(dateStr);
            const isSun = (firstDay + i) % 7 === 0;

            return (
              <div
                key={d}
                className="day-cell"
                onClick={() => {
                  setFocusedDate(dateStr);
                  setSelectedDate(dateStr);
                }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  padding: "6px 2px", borderRadius: theme.radiusSm, cursor: "pointer",
                  background: isFocused ? theme.accent : isToday ? theme.surfaceMuted : "transparent",
                }}
              >
                <span style={{
                  fontSize: "13px", fontWeight: isToday || isFocused ? 700 : 500,
                  color: isFocused ? "white"
                    : isToday ? theme.accent
                    : isSun ? theme.danger
                    : theme.text,
                }}>{d}</span>
                <div style={{ display: "flex", gap: "2px", marginTop: "3px", height: "6px" }}>
                  {hasSchedule && (
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: isFocused ? "white" : theme.accent }} />
                  )}
                  {hasAnniversary && (
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: isFocused ? "white" : theme.danger }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 선택된 날짜 일정 */}
      <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: "12px" }}>
        {focusedDate && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: theme.text }}>
              {formatDate(focusedDate)}
            </div>
            <button
              onClick={() => { setSelectedDate(focusedDate); setShowModal(true); }}
              style={{
                padding: "6px 12px", borderRadius: theme.radiusSm,
                background: theme.accent,
                color: "white", border: "none", cursor: "pointer",
                fontSize: "12px", fontWeight: 600,
              }}
            >+ 추가</button>
          </div>
        )}

        {focusedDate && focusedSchedules.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: "13px", color: theme.textMuted, fontWeight: 600 }}>이 날의 일정이 없어요</div>
          </div>
        )}

        {!focusedDate && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: "13px", color: theme.textMuted, fontWeight: 600 }}>날짜를 선택해보세요</div>
          </div>
        )}

        {focusedSchedules.map((item) => (
          <div key={item.id} style={{
            background: theme.surface,
            borderRadius: theme.radiusMd,
            border: `1px solid ${theme.border}`,
            padding: "14px",
            display: "flex", alignItems: "center", gap: "12px",
          }}>
            <div style={{
              minWidth: "52px",
              background: theme.surfaceMuted,
              borderRadius: theme.radiusSm,
              padding: "8px 4px",
              textAlign: "center",
              color: item.type === "anniversary" ? theme.danger : theme.accent,
              fontSize: "12px", fontWeight: 700,
            }}>
              {item.type === "anniversary" ? "기념일" : calcDday(item.date)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: theme.text }}>{item.title}</div>
              {item.memo && <div style={{ fontSize: "12px", color: theme.textMuted, marginTop: 4 }}>{item.memo}</div>}
            </div>
            <button onClick={() => handleDelete(item.id)} style={{
              fontSize: "12px", color: theme.textMuted,
              background: theme.surfaceMuted, border: `1px solid ${theme.border}`,
              borderRadius: theme.radiusSm, padding: "6px 10px", cursor: "pointer", fontWeight: 600,
            }}>삭제</button>
          </div>
        ))}
      </div>

      {/* 추가 모달 */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40 }}>
          <div onClick={() => setShowModal(false)} style={{ position: "absolute", inset: 0, background: "rgba(15, 23, 42, 0.4)" }} />
          <div style={{
            background: theme.surface, width: "92%", maxWidth: "380px",
            borderRadius: theme.radiusMd, border: `1px solid ${theme.border}`, padding: "20px", zIndex: 41,
            display: "flex", flexDirection: "column", gap: "14px",
          }}>
            <div style={{ fontWeight: 700, fontSize: "15px", color: theme.text }}>
              {formatDate(selectedDate)}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {(["schedule", "anniversary"] as const).map((t) => (
                <button key={t} onClick={() => setType(t)} style={{
                  flex: 1, padding: "10px", borderRadius: theme.radiusSm,
                  fontSize: "13px", fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${type === t ? theme.accent : theme.border}`,
                  background: type === t ? theme.accentMuted : theme.surface,
                  color: type === t ? theme.accent : theme.textMuted,
                }}>
                  {t === "schedule" ? "일정" : "기념일"}
                </button>
              ))}
            </div>

            <div>
              <div style={{ fontSize: "12px", color: theme.textMuted, fontWeight: 600, marginBottom: 6 }}>제목</div>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력하세요" autoFocus
                style={{
                  width: "100%", padding: "10px 12px", boxSizing: "border-box",
                  borderRadius: theme.radiusSm, border: `1px solid ${theme.border}`,
                  fontSize: "14px", outline: "none",
                }} />
            </div>

            <div>
              <div style={{ fontSize: "12px", color: theme.textMuted, fontWeight: 600, marginBottom: 6 }}>메모 (선택)</div>
              <input value={memo} onChange={(e) => setMemo(e.target.value)}
                placeholder="메모를 입력하세요"
                style={{
                  width: "100%", padding: "10px 12px", boxSizing: "border-box",
                  borderRadius: theme.radiusSm, border: `1px solid ${theme.border}`,
                  fontSize: "14px", outline: "none",
                }} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowModal(false)} style={{
                flex: 1, padding: "10px", borderRadius: theme.radiusSm,
                background: theme.surfaceMuted, color: theme.textMuted,
                border: `1px solid ${theme.border}`, cursor: "pointer", fontWeight: 600, fontSize: "13px",
              }}>취소</button>
              <button onClick={handleAdd} style={{
                flex: 2, padding: "10px", borderRadius: theme.radiusSm,
                background: theme.accent,
                color: "white", border: "none", cursor: "pointer",
                fontWeight: 600, fontSize: "13px",
              }}>추가하기</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default SchedulePage;
