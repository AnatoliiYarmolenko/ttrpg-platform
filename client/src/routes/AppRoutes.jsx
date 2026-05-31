import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";
import AdminRoute from "./AdminRoute";
import FullPageLoader from "../components/shared/FullPageLoader";

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
const VttPage = lazy(() => import("../features/vtt/pages/VttPage"));
const AdminPage = lazy(() => import("../features/admin/pages/AdminPage"));

const AppRoutes = () => {
  return (
    <Suspense fallback={<FullPageLoader text="Завантаження..." />}>
      <Routes>
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

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route path="/campaign/share/:shareToken" element={<CampaignPage />} />
        <Route path="/session/share/:shareToken" element={<SessionPage />} />

        <Route
          path="/campaign/:id"
          element={
            <ProtectedRoute>
              <CampaignPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/session/:id/vtt"
          element={
            <ProtectedRoute>
              <VttPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/session/:id"
          element={
            <ProtectedRoute>
              <SessionPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          }
        />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/verify-email-notice" element={<VerifyEmailNoticePage />} />
        <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />
        <Route path="/user/:username" element={<PublicProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
