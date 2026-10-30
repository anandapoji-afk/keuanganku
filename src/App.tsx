import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import DashboardLayout from './layouts/DashboardLayout';
import Transaksi from './pages/Transaksi';
import Anggaran from './pages/Anggaran';
import HutangPiutang from './pages/HutangPiutang';
import Ringkasan from './pages/Ringkasan';

export default function App() {
  return (
    <BrowserRouter>
      <AnimatePresence mode="wait">
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Ringkasan />} />
            <Route path="/transaksi" element={<Transaksi />} />
            <Route path="/anggaran" element={<Anggaran />} />
            <Route path="/hutang-piutang" element={<HutangPiutang />} />
          </Route>
        </Routes>
      </AnimatePresence>
    </BrowserRouter>
  );
}
