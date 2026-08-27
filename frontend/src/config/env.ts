/**
 * Configuración de entorno del frontend. Vite expone únicamente las
 * variables prefijadas con VITE_ en import.meta.env.
 */
function getApiBaseUrl(): string {
  const raw = import.meta.env["VITE_API_BASE_URL"];
  if (!raw) {
    if (import.meta.env.PROD) throw new Error("VITE_API_BASE_URL es obligatoria en producción.");
    return "http://localhost:8787";
  }
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    if (import.meta.env.PROD && url.protocol !== "https:") throw new Error();
    return url.origin;
  } catch {
    throw new Error("VITE_API_BASE_URL debe ser una URL HTTP(S) válida; en producción debe usar HTTPS.");
  }
}

export const API_BASE_URL = getApiBaseUrl();
