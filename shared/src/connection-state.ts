/**
 * Máquina de estados del cliente durante el ciclo de vida de una
 * videollamada dentro de una sala. Se define en `shared` para que la
 * UI use un contrato propio, independiente de los tipos del SDK.
 *
 * No incluye estados de matchmaking (no hay búsqueda de desconocidos
 * en este producto): la sala ya tiene a los dos participantes
 * definidos por quien entra al enlace.
 *
 * Las transiciones reales se derivan de la conexión LiveKit. El
 * modelo completo de participantes se incorpora en la Fase 6.
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
