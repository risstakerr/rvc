/**
 * Configuración de entorno del frontend. Vite expone únicamente las
 * variables prefijadas con VITE_ en import.meta.env.
 */
export const API_BASE_URL: string =
  import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:8787";

/**
 * URL base del WebSocket de signaling (Fase 5/6). Se deriva de
 * `API_BASE_URL` en vez de pedir una variable de entorno aparte: el
 * signaling comparte proceso y puerto con la API REST (ver
 * `backend/src/index.ts`), así que siempre es el mismo host con
 * protocolo `ws`/`wss` en vez de `http`/`https`.
 */
export const WS_BASE_URL: string = API_BASE_URL.replace(/^http/, "ws");
