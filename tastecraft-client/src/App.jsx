import { useEffect } from 'react';

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import SiteHeader from './components/SiteHeader.jsx';
import HomePage from './pages/HomePage.jsx';
import MenuPage from './pages/MenuPage.jsx';
import SignInPage from './pages/SignInPage.jsx';
import CartPage from './pages/CartPage.jsx';
import MyOrdersPage from './pages/MyOrdersPage.jsx';
import ReviewsPage from './pages/ReviewsPage.jsx';

import RequireRole from './components/RequireRole.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx';
import AdminMenuPage from './pages/admin/AdminMenuPage.jsx';
import AdminEmployeesPage from './pages/admin/AdminEmployeesPage.jsx';
import AdminOrdersPage from './pages/admin/AdminOrdersPage.jsx';

import { CartProvider } from './context/CartContext.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

import './site.css';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <ScrollToTop />
        <SiteHeader />

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/orders" element={<MyOrdersPage />} />

          <Route
            path="/admin"
            element={
              <RequireRole access="staff">
                <AdminLayout />
              </RequireRole>
            }
          >
            <Route index element={<AdminDashboardPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="menu" element={<AdminMenuPage />} />
            <Route path="team" element={<AdminEmployeesPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );
}