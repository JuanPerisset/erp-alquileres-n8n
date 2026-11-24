import axios from "axios";

export const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
  withCredentials: true,
});

let refreshing = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const cfg = error.config || {};
    if (error.response?.status === 401 && !cfg._retry && !String(cfg.url).startsWith("/auth/")) {
      cfg._retry = true;
      refreshing = refreshing || api.post("/auth/refresh").finally(() => { refreshing = null; });
      try {
        await refreshing;
        return api(cfg);
      } catch {
        window.dispatchEvent(new Event("auth:expired"));
      }
    }
    return Promise.reject(error);
  }
);

export function apiError(e, fallback = "Algo salió mal. Probá de nuevo.") {
  const detail = e?.response?.data?.detail;
  if (detail == null) return e?.response ? fallback : "No se pudo conectar con el servidor.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join(" ");
  return detail.msg || String(detail);
}
