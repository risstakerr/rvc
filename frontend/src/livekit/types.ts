/**
 * Tipos públicos de la capa de abstracción de LiveKit.
 */

/**
 * Respuesta del endpoint backend que emite el token de acceso a una
 * sala LiveKit.
 */
export interface LiveKitTokenResponse {
  token: string;
  url: string;
  roomName: string;
  participantIdentity: string;
  maxParticipants: number;
  recordingControlToken: string | null;
}

export type LiveKitTokenErrorCode = "ROOM_FULL" | null;

/**
 * Subconjunto de los estados de conexión que expone `Room.state` del
 * SDK de LiveKit, reexpuesto acá para que el resto de la app no
 * dependa directamente de los tipos internos del paquete
 * `livekit-client`.
 */
export type LiveKitConnectionState =
  | "idle"
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "reconnected"
  | "failed"
  | "unsupported";

export type ParticipantConnectionState = "connected" | "reconnecting" | "disconnected";

/** Adaptador de una pista de video remota para adjuntarla al elemento visible. */
export interface LiveKitVideoAttachment {
  attach: (element: HTMLVideoElement) => void;
  detach: (element: HTMLVideoElement) => void;
}

/** Estado de medios de un participante remoto, identificado por LiveKit. */
export interface LiveKitParticipant {
  identity: string;
  name: string | null;
  videoStream: MediaStream | null;
  videoAttachment: LiveKitVideoAttachment | null;
  screenShareStream: MediaStream | null;
  screenShareAttachment: LiveKitVideoAttachment | null;
  audioStream: MediaStream | null;
  isVideoMuted: boolean;
  isScreenShareMuted: boolean;
  isAudioMuted: boolean;
  connectionState: ParticipantConnectionState;
}

export interface ChatMessage {
  id: string;
  type: "message" | "system";
  senderIdentity: string | null;
  senderName: string | null;
  text: string;
  timestamp: number;
}

export interface RecordingStatus {
  egressId: string | null;
  status: "idle" | "starting" | "active" | "stopping" | "failed";
  fileName: string | null;
  error: string | null;
}
