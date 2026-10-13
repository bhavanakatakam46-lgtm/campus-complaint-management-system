import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { useAuth } from "./auth/useAuth.js";
import LoginPage from "./pages/LoginPage.jsx";

const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage.jsx"));

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="route-loading">Checking your campus account...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.isDemo && role && user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  }
  return children;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="route-loading">Checking your campus account...</div>;
  return user ? <Navigate to={user.isDemo && user.role === "admin" ? "/admin" : "/dashboard"} replace /> : <LoginPage />;
}

function AppRoutes() {
  return <Routes>
    <Route path="/login" element={<LoginRoute />} />
    <Route path="/dashboard" element={<ProtectedRoute role="student"><Suspense fallback={<div className="route-loading">Opening your dashboard...</div>}><DashboardPage /></Suspense></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute role="admin"><Suspense fallback={<div className="route-loading">Opening admin workspace...</div>}><AdminDashboardPage /></Suspense></ProtectedRoute>} />
    <Route path="/admin/complaints" element={<ProtectedRoute role="admin"><Suspense fallback={<div className="route-loading">Opening complaints...</div>}><AdminDashboardPage view="complaints" /></Suspense></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>;
}

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}
