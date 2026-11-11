export const theme = {
  bg: "#fbf4f4",
  surface: "#ffffff",
  surfaceMuted: "#f6eced",
  border: "#ecdfe1",
  borderStrong: "#d9c5c9",
  text: "#2f2a2d",
  textMuted: "#6b6468",
  textFaint: "#726b6f",
  accent: "#b84a63", // 흰 글씨·연한 배경 위 글씨 모두 대비 4.5:1 이상 (연한 로즈는 pastel[0])
  accentHover: "#9d3d54",
  accentMuted: "#fbe6ea",
  success: "#5f7fb3",
  successBg: "#eaf0f9",
  danger: "#d9534f",
  dangerBg: "#fdeeee",
  // 제목 전용 손글씨 폰트
  fontTitle: "'Dongle', 'Gowun Dodum', system-ui, sans-serif",
  radiusSm: "12px",
  radiusMd: "16px",
  radiusLg: "20px",
  shadow: "0 2px 6px rgba(90, 60, 70, 0.06)",
  // 차트·강조용 파스텔
  pastel: ["#e8909f", "#7a93c0", "#b0c8b8", "#e8cc8c", "#b9a7d6", "#e6b3a0"],
} as const;
