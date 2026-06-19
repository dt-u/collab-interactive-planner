import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider.js";
import { httpClient } from "../../../shared/api/http-client.js";
import { Spinner } from "../../../shared/ui/spinner/Spinner.js";

export const OAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // We access the context indirectly to set the token upon success
  const auth = useAuth();

  useEffect(() => {
    const code = searchParams.get("code");
    
    if (!code) {
      setError("No authorization code provided from Google.");
      return;
    }

    const exchangeCode = async () => {
      try {
        const res = await httpClient.post("/auth/google/callback", { code });
        const data = res.data?.data;
        
        if (data?.accessToken && data?.user) {
          auth.setSession(data.accessToken, data.user);
          navigate("/", { replace: true });
        } else {
          throw new Error("Invalid callback payload from authentication server");
        }
      } catch (err: any) {
        console.error("❌ Google OAuth code exchange failed:", err);
        setError(err.response?.data?.error?.message || "Failed to authenticate with Google. Please try again.");
      }
    };

    exchangeCode();
  }, [searchParams, navigate, auth]);

  return (
    <div className="callback-container">
      <div className="callback-card">
        {error ? (
          <div className="error-state">
            <h2>Authentication Failed</h2>
            <p>{error}</p>
            <button className="back-btn" onClick={() => navigate("/login")}>
              Back to Login
            </button>
          </div>
        ) : (
          <div className="loading-state">
            <Spinner size="large" />
            <p>Finalizing authentication secure exchange...</p>
          </div>
        )}
      </div>
    </div>
  );
};
