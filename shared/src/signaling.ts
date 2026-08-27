/**
 * Contrato de mensajes del protocolo de señalización WebSocket entre
 * cliente y backend, para coordinar a los dos participantes de una
 * sala antes de que WebRTC pueda establecer la conexión P2P (uso real
 * en `frontend/src/hooks/useCallConnection.ts`, Fase 6).
 *
 * Se define en `shared` porque frontend y backend deben acordar
 * exactamente la misma forma de estos mensajes. Los payloads de SDP
 * e ICE se declaran acá como estructuras mínimas propias (no los
 * tipos DOM `RTCSessionDescriptionInit`/`RTCIceCandidateInit`) porque
 * `backend/tsconfig.json` no incluye `lib: ["DOM"]` y no queremos
 * acoplar `shared` a las libs del navegador.
 */

export interface SessionDescriptionPayload {
  type: string;
  sdp: string;
}

export interface IceCandidatePayload {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

/** Mensajes que el cliente envía al servidor de signaling. */
export type ClientSignalMessage =
  | { type: "join"; roomId: string }
  | { type: "leave" }
  | { type: "offer"; sdp: SessionDescriptionPayload }
  | { type: "answer"; sdp: SessionDescriptionPayload }
  | { type: "ice-candidate"; candidate: IceCandidatePayload };

/** Mensajes que el servidor de signaling envía al cliente. */
export type ServerSignalMessage =
  | { type: "joined"; participantId: string; peerPresent: boolean }
  | { type: "peer-joined" }
  | { type: "peer-left" }
  | { type: "room-full" }
  | { type: "room-not-found" }
  | { type: "offer"; sdp: SessionDescriptionPayload }
  | { type: "answer"; sdp: SessionDescriptionPayload }
  | { type: "ice-candidate"; candidate: IceCandidatePayload }
  | { type: "error"; message: string };

/**
 * Máximo de participantes conectados por sala vía WebSocket. Es la
 * regla de negocio central del producto (videollamada 1 a 1, sin
 * matchmaking): la tercera conexión a una sala siempre se rechaza.
 */
export const MAX_PARTICIPANTS_PER_ROOM = 2;
