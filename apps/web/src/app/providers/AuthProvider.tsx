import React, { createContext, useContext, useState, useEffect } from "react";
import { UserDto } from "@collab-planner/shared";
import { httpClient, setAccessToken, getAccessToken } from "../../shared/api/http-client.js";

interface AuthContextType {
  user: UserDto | null;
  accessToken: string | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setSession: (token: string, user: UserDto) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessTokenState, setAccessTokenState] = useState<string | null>(null);

  // Synchronize token state with http-client
  const updateAccessToken = (token: string | null) => {
    setAccessToken(token);
    setAccessTokenState(token);
  };

  const setSession = (token: string, userData: UserDto) => {
    updateAccessToken(token);
    setUser(userData);
    setLoading(false);
  };

  const checkSession = async () => {
    try {
      // 1. Try to fetch /auth/refresh to rotate credentials on app startup
      const refreshRes = await httpClient.post("/auth/refresh");
      const newAccessToken = refreshRes.data?.data?.accessToken;
      
      if (newAccessToken) {
        updateAccessToken(newAccessToken);
        // 2. Load user details
        const meRes = await httpClient.get("/users/me");
        setUser(meRes.data?.data);
      }
    } catch (err) {
      console.warn("⚠️ No active session found on boot.");
      if (!getAccessToken()) {
        updateAccessToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      // Fetch redirection URL from plan-service
      const res = await httpClient.get("/auth/google/url");
      const url = res.data?.data?.url;
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("OAuth redirect URL is missing in server response");
      }
    } catch (err) {
      console.error("❌ Failed to initiate Google login redirection:", err);
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await httpClient.post("/auth/logout");
    } catch (err) {
      console.error("❌ Logout request failed:", err);
    } finally {
      updateAccessToken(null);
      setUser(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (window.location.pathname === "/auth/google/callback") {
      setLoading(false);
    } else {
      checkSession();
    }

    // Listen to http-client unauthorized events
    const handleUnauthorized = () => {
      updateAccessToken(null);
      setUser(null);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken: accessTokenState,
        loading,
        loginWithGoogle,
        logout,
        setSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
