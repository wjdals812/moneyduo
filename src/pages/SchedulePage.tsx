import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import BottomNav from "../components/BottomNav";

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
      background: "#f5f3ff",
      maxWidth: "400px",
      margin: "0 auto",
      paddingBottom: "120px",
    }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .day-cell:hover { background: #ede9fe !important; }
      `}</style>

      {/* 헤더 */}
      <div style={{
        background: "#ffffff",
        padding: "28px 20px 20px",
        borderRadius: "0 0 32px 32px",
        boxShadow: "0 12px 36px rgba(0,0,0,0.08)",
        borderBottom: "2px dashed rgba(196,196,196,0.28)",
      }}>
        <div style={{ fontSize: "20px", fontWeight: 800, color: "#3C3489" }}>일정 & 기념일</div>
        <div style={{ fontSize: "13px", fontWeight: 800, color: "#b0a8e8", marginTop: 2 }}>우리 둘의 소중한 날들 💕</div>

        {/* 월 네비게이션 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: "20px",
        }}>
          <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} style={{
            all: "unset", cursor: "pointer",
            width: "36px", height: "36px", borderRadius: "12px",
            background: "#f0eeff", color: "#7f77dd",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px", fontWeight: 800,
          }}>‹</button>
          <div style={{ fontSize: "17px", fontWeight: 800, color: "#3C3489" }}>
            {year}년 {month + 1}월
          </div>
          <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} style={{
            all: "unset", cursor: "pointer",
            width: "36px", height: "36px", borderRadius: "12px",
            background: "#f0eeff", color: "#7f77dd",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px", fontWeight: 800,
          }}>›</button>
        </div>

        {/* 요일 헤더 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginTop: "16px" }}>
          {days.map((d, i) => (
            <div key={d} style={{
              textAlign: "center", fontSize: "12px", fontWeight: 800, paddingBottom: "8px",
              color: i === 0 ? "#d4537e" : i === 6 ? "#7f77dd" : "#9e99cc",
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
            const isSat = (firstDay + i) % 7 === 6;

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
                  padding: "6px 2px", borderRadius: "12px", cursor: "pointer",
                  background: isFocused
                    ? "linear-gradient(135deg, #7f77dd, #a78bfa)"
                    : isToday ? "#f0eeff" : "transparent",
                  transition: "background 0.15s",
                }}
              >
                <span style={{
                  fontSize: "14px", fontWeight: isToday || isFocused ? 900 : 600,
                  color: isFocused ? "white"
                    : isToday ? "#7f77dd"
                    : isSun ? "#d4537e"
                    : isSat ? "#7f77dd"
                    : "#3C3489",
                }}>{d}</span>
                <div style={{ display: "flex", gap: "2px", marginTop: "3px", height: "6px" }}>
                  {hasSchedule && (
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: isFocused ? "white" : "#7f77dd" }} />
                  )}
                  {hasAnniversary && (
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: isFocused ? "white" : "#d4537e" }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 선택된 날짜 일정 */}
      <div style={{ padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: "12px" }}>
        {focusedDate && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            animation: "fadeUp 0.3s ease both",
          }}>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "#3C3489" }}>
              {formatDate(focusedDate)}
            </div>
            <button
              onClick={() => { setSelectedDate(focusedDate); setShowModal(true); }}
              style={{
                padding: "8px 14px", borderRadius: "12px",
                background: "linear-gradient(135deg, #7f77dd, #a78bfa)",
                color: "white", border: "none", cursor: "pointer",
                fontSize: "13px", fontWeight: 800,
              }}
            >+ 추가</button>
          </div>
        )}

        {focusedDate && focusedSchedules.length === 0 && (
          <div style={{
            textAlign: "center", padding: "32px 0",
            animation: "fadeUp 0.3s ease both",
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
            <div style={{ fontSize: "14px", color: "#b0a8e8", fontWeight: 700 }}>이 날의 일정이 없어요</div>
          </div>
        )}

        {!focusedDate && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👆</div>
            <div style={{ fontSize: "14px", color: "#b0a8e8", fontWeight: 700 }}>날짜를 선택해보세요</div>
          </div>
        )}

        {focusedSchedules.map((item, i) => (
          <div key={item.id} style={{
            background: "rgba(255,255,255,0.85)",
            borderRadius: "20px",
            border: `1.5px solid ${item.type === "anniversary" ? "rgba(212,83,126,0.25)" : "rgba(184,174,222,0.35)"}`,
            padding: "16px",
            display: "flex", alignItems: "center", gap: "14px",
            animation: `fadeUp 0.3s ${i * 0.07}s ease both`,
            opacity: 0, animationFillMode: "forwards",
          }}>
            <div style={{
              minWidth: "56px",
              background: item.type === "anniversary"
                ? "linear-gradient(135deg, #fce7f3, #fad0e4)"
                : "linear-gradient(135deg, #ede9fe, #ddd6fe)",
              borderRadius: "14px",
              padding: "8px 4px",
              textAlign: "center",
              color: item.type === "anniversary" ? "#d4537e" : "#7f77dd",
              fontSize: "13px", fontWeight: 900,
            }}>
              {item.type === "anniversary" ? "💕" : calcDday(item.date)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#3C3489" }}>{item.title}</div>
              {item.memo && <div style={{ fontSize: "12px", color: "#9e99cc", marginTop: 4 }}>{item.memo}</div>}
            </div>
            <button onClick={() => handleDelete(item.id)} style={{
              fontSize: "12px", color: "#d4537e",
              background: "#fff0f6", border: "1.5px solid #f9c0d4",
              borderRadius: "10px", padding: "6px 10px", cursor: "pointer", fontWeight: 800,
            }}>삭제</button>
          </div>
        ))}
      </div>

      {/* 추가 모달 */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40 }}>
          <div onClick={() => setShowModal(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
          <div style={{
            background: "white", width: "92%", maxWidth: "380px",
            borderRadius: "24px", padding: "24px", zIndex: 41,
            display: "flex", flexDirection: "column", gap: "14px",
          }}>
            <div style={{ fontWeight: 800, fontSize: "16px", color: "#3C3489" }}>
              {formatDate(selectedDate)}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {(["schedule", "anniversary"] as const).map((t) => (
                <button key={t} onClick={() => setType(t)} style={{
                  flex: 1, padding: "10px", borderRadius: "12px",
                  fontSize: "13px", fontWeight: 800, cursor: "pointer",
                  border: "2px solid",
                  borderColor: type === t ? "#7f77dd" : "#c9c2f5",
                  background: type === t ? "#eeedfe" : "white",
                  color: type === t ? "#534AB7" : "#afa9ec",
                }}>
                  {t === "schedule" ? "📅 일정" : "💕 기념일"}
                </button>
              ))}
            </div>

            <div>
              <div style={{ fontSize: "12px", color: "#8882cc", fontWeight: 800, marginBottom: 6 }}>제목</div>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력하세요" autoFocus
                style={{
                  width: "100%", padding: "12px", boxSizing: "border-box",
                  borderRadius: "12px", border: "2px solid #c9c2f5",
                  fontSize: "14px", outline: "none",
                }} />
            </div>

            <div>
              <div style={{ fontSize: "12px", color: "#8882cc", fontWeight: 800, marginBottom: 6 }}>메모 (선택)</div>
              <input value={memo} onChange={(e) => setMemo(e.target.value)}
                placeholder="메모를 입력하세요"
                style={{
                  width: "100%", padding: "12px", boxSizing: "border-box",
                  borderRadius: "12px", border: "2px solid #c9c2f5",
                  fontSize: "14px", outline: "none",
                }} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowModal(false)} style={{
                flex: 1, padding: "12px", borderRadius: "14px",
                background: "#f0eeff", color: "#9e99cc",
                border: "none", cursor: "pointer", fontWeight: 800, fontSize: "14px",
              }}>취소</button>
              <button onClick={handleAdd} style={{
                flex: 2, padding: "12px", borderRadius: "14px",
                background: "linear-gradient(135deg, #7f77dd, #a78bfa)",
                color: "white", border: "none", cursor: "pointer",
                fontWeight: 800, fontSize: "14px",
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