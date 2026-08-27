/**
 * Máquina de estados del cliente durante el ciclo de vida de una
 * videollamada privada 1 a 1 dentro de una sala. Se define en
 * `shared` porque tanto frontend como backend necesitan acordar los
 * mismos valores (signaling por WebSocket + estado de WebRTC).
 *
 * No incluye estados de matchmaking (no hay búsqueda de desconocidos
 * en este producto): la sala ya tiene a los dos participantes
 * definidos por quien entra al enlace.
 *
 * Las transiciones reales entre estados viven en
 * `frontend/src/hooks/useCallConnection.ts` (Fase 6): WAITING_FOR_PEER
 * mientras se espera al segundo participante, CONNECTING durante el
 * intercambio de offer/answer/ICE, CONNECTED cuando el
 * RTCPeerConnection lo confirma, y DISCONNECTED al cerrarse. La
 * reconexión automática (RECONNECTING) es la Fase 10.
 */
export const CONNECTION_STATES = [
  "IDLE",
  "WAITING_FOR_PEER",
  "CONNECTING",
  "CONNECTED",
  "RECONNECTING",
  "DISCONNECTED",
] as const;

export type ConnectionState = (typeof CONNECTION_STATES)[number];
