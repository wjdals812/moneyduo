import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
// 첫 화면(로그인/홈) 외 페이지는 필요할 때 로드해 초기 번들 축소 (차트 라이브러리 등)
const ChartPage = lazy(() => import("./pages/ChartPage"));
const AddTransactionPage = lazy(() => import("./pages/AddTransactionPage"));
const EditTransactionPage = lazy(() => import("./pages/EditTransactionPage"));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage"));
const PaymentMethodsPage = lazy(() => import("./pages/PaymentMethodsPage"));
const MyPage = lazy(() => import("./pages/MyPage"));
const SchedulePage = lazy(() => import("./pages/SchedulePage"));

const App = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/chart" element={<ChartPage />} />
          <Route path="/add" element={<AddTransactionPage />} />
          <Route path="/edit/:id" element={<EditTransactionPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/paymentmethods" element={<PaymentMethodsPage />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/calendar" element={<SchedulePage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
