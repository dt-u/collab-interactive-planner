import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./providers/AuthProvider.js";
import { LoginPage } from "../features/auth/pages/LoginPage.js";
import { OAuthCallbackPage } from "../features/auth/pages/OAuthCallbackPage.js";
import { Spinner } from "../shared/ui/spinner/Spinner.js";
import { DashboardLayout } from "./layouts/DashboardLayout.js";
import { WorkspaceListPage } from "../features/workspaces/pages/WorkspaceListPage.js";
import { KanbanBoard } from "../features/planner-board/components/KanbanBoard.js";

// Layout import paths are mapped to correct files in later steps
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading-screen" style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#0c0c0e",
        color: "#ffffff",
        fontFamily: "sans-serif"
      }}>
        <Spinner size="large" />
        <p style={{ marginTop: 16, color: "rgba(255,255,255,0.6)" }}>Loading application state...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/google/callback" element={<OAuthCallbackPage />} />

          {/* Protected Application Routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* Dashboard Workspace list */}
            <Route index element={<WorkspaceListPage />} />
            <Route path="workspace/:workspaceId" element={<WorkspaceListPage />} />
            
            {/* Kanban Collaborative Board */}
            <Route path="plans/:planId" element={<KanbanBoard />} />
            
            {/* Fallback redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};
