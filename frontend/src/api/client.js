import axios from "axios";

// 1. Fixed the variable name to match Vercel (VITE_API_URL)
// 2. Added '/api' so it correctly routes to your backend endpoints
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api` || "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

//this is auth interceptor
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
