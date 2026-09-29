import ListManagePage from "../components/ListManagePage";

const defaultPaymentMethods = ["현금", "카드"];

const PaymentMethodsPage = () => (
  <ListManagePage
    title="결제수단 관리"
    fieldName="paymentMethods"
    defaultItems={defaultPaymentMethods}
    placeholder="예: 국민카드"
    addLabel="+ 결제수단 추가"
  />
);

export default PaymentMethodsPage;
