import React from "react";
import { useAuth } from "../../../app/providers/AuthProvider.js";
import { LogIn } from "lucide-react";

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, loading } = useAuth();

  return (
    <div className="login-view-wrapper">
      <div className="login-glass-card">
        <div className="login-brand">
          <span className="brand-icon">ICP</span>
          <span className="brand-name">Interactive Planner</span>
        </div>
        <h1 className="login-title">Welcome Back</h1>
        <p className="login-subtitle">Real-time collaborative planning boards</p>

        <button
          className="google-signin-btn"
          onClick={loginWithGoogle}
          disabled={loading}
        >
          <LogIn size={20} />
          <span>{loading ? "Connecting to Google..." : "Sign in with Google"}</span>
        </button>
      </div>
    </div>
  );
};
