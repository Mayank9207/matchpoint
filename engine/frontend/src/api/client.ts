import axios, { type AxiosInstance } from "axios";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** Shared axios instance for all API calls. */
export const client: AxiosInstance = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

export const TOKEN_STORAGE_KEY = "matchpoint_access_token";

// Attach the bearer token (if present) to every outgoing request.
client.interceptors.request.use((config) => {
  // TODO: implement (read token from localStorage and set Authorization header)
  return config;
});

// Clear the token and redirect to /login on 401 responses.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    // TODO: implement (handle 401 -> clear token, redirect to /login)
    return Promise.reject(error);
  },
);
