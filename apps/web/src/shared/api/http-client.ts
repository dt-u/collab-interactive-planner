import axios from "axios";

// Base HTTP client pointing to the Nginx Edge API gateway
export const httpClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// Request interceptor to attach Bearer Token dynamically
httpClient.interceptors.request.use((config) => {
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (err: any) => void;
}> = [];

function processQueue(error: any, token: string | null = null): void {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

// Response interceptor to intercept 401s and execute Silent Token Rotation
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (
      error.response?.status === 401 && 
      !originalRequest._retry && 
      !originalRequest.url?.includes("/auth/refresh") &&
      !originalRequest.url?.includes("/auth/google")
    ) {
      if (isRefreshing) {
        return new Promise<string | null>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return httpClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        console.log("🔄 Access token expired. Attempting silent token rotation...");
        const refreshRes = await axios.post(
          "/api/auth/refresh",
          {},
          { withCredentials: true }
        );
        
        const newAccessToken = refreshRes.data?.data?.accessToken;
        if (!newAccessToken) {
          throw new Error("No access token returned from refresh endpoint");
        }

        setAccessToken(newAccessToken);
        window.dispatchEvent(
          new CustomEvent("auth:token-refreshed", {
            detail: { accessToken: newAccessToken },
          }),
        );
        processQueue(null, newAccessToken);
        
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return httpClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setAccessToken(null);
        // Dispatch event so the AuthContext can log user out
        window.dispatchEvent(new Event("auth:unauthorized"));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);
