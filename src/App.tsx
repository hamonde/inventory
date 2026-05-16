import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/lib/authContext';
import { ToastProvider } from '@/components/ui/toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import LoginPage from '@/pages/LoginPage';
import HomePage from '@/pages/HomePage';
import InventoryQueryPage from '@/pages/InventoryQueryPage';
import InventoryTransactionPage from '@/pages/InventoryTransactionPage';
import BeansQueryPage from '@/pages/BeansQueryPage';
import BeanCreatePage from '@/pages/BeanCreatePage';
import BeanEditPage from '@/pages/BeanEditPage';
import HistoryPage from '@/pages/HistoryPage';
import ReportsPage from '@/pages/ReportsPage';
import InventoryCheckPage from '@/pages/InventoryCheckPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/inventory" element={<InventoryQueryPage />} />
              <Route path="/transaction" element={<InventoryTransactionPage />} />
              <Route path="/beans" element={<BeansQueryPage />} />
              <Route path="/beans/new" element={<BeanCreatePage />} />
              <Route path="/beans/:id/edit" element={<BeanEditPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/inventory-check" element={<InventoryCheckPage />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
