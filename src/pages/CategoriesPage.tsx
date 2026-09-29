import ListManagePage from "../components/ListManagePage";

const defaultCategories = ["🍜 식비", "☕ 카페", "🎬 문화", "🚌 교통", "🛍️ 쇼핑", "💊 의료", "🏠 생활", "💑 데이트", "기타"];

const CategoriesPage = () => (
  <ListManagePage
    title="카테고리 관리"
    fieldName="categories"
    defaultItems={defaultCategories}
    placeholder="예: 🎮 게임"
    addLabel="+ 카테고리 추가"
  />
);

export default CategoriesPage;
