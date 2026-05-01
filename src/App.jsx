// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewBill from './pages/NewBill';
import AllBills from './pages/AllBills';
import PaymentHistory from './pages/PaymentHistory';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="new-bill" element={<NewBill />} />
          <Route path="all-bills" element={<AllBills />} />
          <Route path="payment-history" element={<PaymentHistory />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
