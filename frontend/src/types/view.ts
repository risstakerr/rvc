/**
 * Pantallas de la app. La navegación es un simple switch de estado
 * local en App.tsx: con pocas pantallas y un flujo lineal, sumar
 * react-router sería una dependencia innecesaria (regla del prompt:
 * no introducir dependencias innecesarias). El ruteo real por URL
 * (`/call/:roomId`) se resuelve con la History API nativa
 * (ver lib/router.ts).
 *
 * - "home": landing, pide cámara/mic, botón "Crear llamada".
 * - "room-share": sala recién creada, muestra el enlace para copiar.
 * - "checking-room": validando contra el backend un roomId que llegó
 *   por URL (enlace compartido abierto directamente).
 * - "room-not-found": el roomId de la URL no existe o expiró.
 * - "call": videollamada con WebRTC P2P real (Fase 6).
 * - "room-full": la sala ya tenía 2 participantes cuando el
 *   WebSocket intentó unirse (Fase 6: solo se descubre en el momento
 *   del `join` de signaling, distinto de "room-not-found").
 * - "camera-error": fallo de permisos/dispositivo de cámara o mic.
 */
export const VIEWS = [
  "home",
  "room-share",
  "checking-room",
  "room-not-found",
  "call",
  "room-full",
  "camera-error",
] as const;

export type View = (typeof VIEWS)[number];
