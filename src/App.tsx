import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import TransactionPage from "./pages/TransactionPage";
import ChartPage from "./pages/ChartPage";
import AddTransactionPage from "./pages/AddTransactionPage";
import EditTransactionPage from "./pages/EditTransactionPage";
import CategoriesPage from "./pages/CategoriesPage";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/transactions" element={<TransactionPage />} />
        <Route path="/chart" element={<ChartPage />} />
        <Route path="/add" element={<AddTransactionPage />} />
        <Route path="/edit/:id" element={<EditTransactionPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;