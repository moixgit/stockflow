import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import Layout from './components/common/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import POSPage from './pages/POSPage.jsx';
import PurchasesPage from './pages/PurchasesPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import WarehousesPage from './pages/WarehousesPage.jsx';
import VendorsPage from './pages/VendorsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import BarcodePage from './pages/BarcodePage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import CategoriesPage from './pages/CategoriesPage.jsx';
import ProductDetailPage from './pages/ProductDetailPage.jsx';
import BrandsPage from './pages/BrandsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import BreakagePage from './pages/BreakagePage.jsx';
import InspectionPage from './pages/InspectionPage.jsx';
import SalesPage from './pages/SalesPage.jsx';
import VendorDetailPage from './pages/VendorDetailPage.jsx';

function PrivateRoute({ children, roles }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="pos" element={<POSPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="purchases" element={<PrivateRoute roles={['admin','inventory_manager']}><PurchasesPage /></PrivateRoute>} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="breakages" element={<PrivateRoute roles={['admin','inventory_manager']}><BreakagePage /></PrivateRoute>} />
          <Route path="inspections" element={<PrivateRoute roles={['admin','inventory_manager']}><InspectionPage /></PrivateRoute>} />
          <Route path="warehouses" element={<PrivateRoute roles={['admin','inventory_manager']}><WarehousesPage /></PrivateRoute>} />
          <Route path="vendors" element={<PrivateRoute roles={['admin','inventory_manager']}><VendorsPage /></PrivateRoute>} />
          <Route path="vendors/:id" element={<PrivateRoute roles={['admin','inventory_manager']}><VendorDetailPage /></PrivateRoute>} />
          <Route path="categories" element={<PrivateRoute roles={['admin','inventory_manager']}><CategoriesPage /></PrivateRoute>} />
          <Route path="brands" element={<PrivateRoute roles={['admin','inventory_manager']}><BrandsPage /></PrivateRoute>} />
          <Route path="barcode" element={<BarcodePage />} />
          <Route path="reports" element={<PrivateRoute roles={['admin','inventory_manager']}><ReportsPage /></PrivateRoute>} />
          <Route path="users" element={<PrivateRoute roles={['admin']}><UsersPage /></PrivateRoute>} />
          <Route path="settings" element={<PrivateRoute roles={['admin']}><SettingsPage /></PrivateRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
