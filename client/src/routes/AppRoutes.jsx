import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Утиліти та оболонки
import ProtectedRoute from "./ProtectedRoute";
import AdminRoute from "./AdminRoute";
import FullPageLoader from "../components/shared/FullPageLoader";

// Ліниві імпорти сторінок з FEATURES
const LoginPage = lazy(() => import("../features/auth/pages/LoginPage"));
const RegisterPage = lazy(() => import("../features/auth/pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("../features/auth/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("../features/auth/pages/ResetPasswordPage"));
const VerifyEmailPage = lazy(() => import("../features/auth/pages/VerifyEmailPage"));
const VerifyEmailNoticePage = lazy(() => import("../features/auth/pages/VerifyEmailNoticePage"));

const DashboardPage = lazy(() => import("../features/dashboard/pages/DashboardPage")); 
const PublicProfilePage = lazy(() => import("../features/profile/pages/PublicProfilePage"));
const ConfirmEmailChangePage = lazy(() => import("../features/security/pages/ConfirmEmailChangePage"));

const CampaignPage = lazy(() => import("../features/campaigns/pages/CampaignPage"));
const SessionPage = lazy(() => import("../features/sessions/pages/SessionPage"));
const AdminPage = lazy(() => import("../features/admin/pages/AdminPage"));

const AppRoutes = () => {
  return (
    <Suspense fallback={<FullPageLoader text="Завантаження маршруту..." />}>
      <Routes>
        {/* === ADMIN ROUTES === */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            </ProtectedRoute>
          } 
        />

        {/* === PRIVATE ROUTES === */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />

        {/* Деталі кампанії */}
        <Route 
          path="/campaign/:id" 
          element={
            <ProtectedRoute>
              <CampaignPage />
            </ProtectedRoute>
          } 
        />

        {/* Деталі сесії */}
        <Route 
          path="/session/:id" 
          element={
            <ProtectedRoute>
              <SessionPage />
            </ProtectedRoute>
          } 
        />

        {/* === PUBLIC ROUTES === */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Відновлення пароля */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        
        {/* Верифікація пошти */}
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/verify-email-notice" element={<VerifyEmailNoticePage />} />

        {/* Підтвердження зміни email */}
        <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />

        {/* Публічний профіль користувача */}
        <Route path="/user/:username" element={<PublicProfilePage />} />

        {/* 404 - Перенаправлення на головну */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;   