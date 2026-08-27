/**
 * Abstracción sobre el SDK `livekit-client`.
 *
 * Este archivo es, a propósito, el ÚNICO lugar del frontend que
 * importa `livekit-client` directamente. El resto de la app (fases
 * futuras incluidas) debe pasar por acá en vez de importar el
 * paquete de forma dispersa, para tener un solo punto de cambio si
 * el SDK se actualiza o se reemplaza.
 *
 * El modelo de participantes y el grid multipersona se implementan
 * en fases posteriores sobre esta misma capa.
 */
import {
  Room,
  RoomEvent,
  ConnectionState,
  isBrowserSupported,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type Participant,
  type TrackPublication,
  Track,
} from "livekit-client";
import type { LiveKitConnectionState } from "./types";

const CHAT_TOPIC = "pvc-chat-v1";

export interface LiveKitChatPayload {
  id: string;
  text: string;
  timestamp: number;
}

/**
 * Mapea el enum interno `ConnectionState` del SDK al tipo propio
 * `LiveKitConnectionState`, para que el resto de la app nunca
 * necesite importar el enum del paquete directamente.
 */
export function mapConnectionState(state: ConnectionState): LiveKitConnectionState {
  switch (state) {
    case ConnectionState.Connected:
      return "connected";
    case ConnectionState.Connecting:
      return "connecting";
    case ConnectionState.Reconnecting:
      return "reconnecting";
    case ConnectionState.SignalReconnecting:
      return "reconnecting";
    case ConnectionState.Disconnected:
    default:
      return "disconnected";
  }
}

/**
 * Indica si el navegador actual soporta lo mínimo que necesita
 * LiveKit (WebRTC + APIs asociadas). Debe consultarse antes de crear
 * o conectar una `Room`.
 */
export function isLiveKitSupported(): boolean {
  return isBrowserSupported();
}

/**
 * Crea una instancia de `Room` de LiveKit con opciones por defecto
 * razonables para esta app (adaptiveStream y dynacast reducen ancho
 * de banda en salas con varios participantes, que es hacia donde va
 * el proyecto). Esta función no conecta a ningún servidor.
 */
export function createLiveKitRoom(): Room {
  return new Room({
    adaptiveStream: true,
    dynacast: true,
  });
}

/** Conecta una sala creada por esta capa sin dispersar acceso al SDK. */
export async function connectLiveKitRoom(room: Room, url: string, token: string): Promise<void> {
  await room.connect(url, token);
}

/** Publica los tracks locales existentes sin volver a pedir permisos al navegador. */
export async function publishLiveKitTracks(room: Room, stream: MediaStream): Promise<MediaStreamTrack[]> {
  const tracks = stream.getTracks().filter((track) => track.readyState === "live");
  const hasAudio = tracks.some((track) => track.kind === "audio");
  const hasVideo = tracks.some((track) => track.kind === "video");
  if (!hasAudio || !hasVideo) {
    throw new Error("No hay una cámara y un micrófono disponibles para publicar.");
  }
  await Promise.all(tracks.map((track) => room.localParticipant.publishTrack(track)));
  return tracks;
}

/** Retira las publicaciones sin detener los tracks que todavía usa el preview local. */
export async function unpublishLiveKitTracks(room: Room, tracks: MediaStreamTrack[]): Promise<void> {
  await Promise.all(tracks.map((track) => room.localParticipant.unpublishTrack(track, false)));
}

/** Silencia o reactiva una publicación existente y comunica el cambio a la sala. */
export async function setLiveKitTrackEnabled(
  room: Room,
  kind: "audio" | "video",
  enabled: boolean,
): Promise<void> {
  const source = kind === "audio" ? Track.Source.Microphone : Track.Source.Camera;
  const publication = room.localParticipant.getTrackPublication(source);
  if (!publication) return;
  if (enabled) await publication.unmute();
  else await publication.mute();
}

/** Sustituye el track de una publicación sin desconectar al participante de la sala. */
export async function replaceLiveKitTrack(
  room: Room,
  kind: "audio" | "video",
  track: MediaStreamTrack,
): Promise<void> {
  const source = kind === "audio" ? Track.Source.Microphone : Track.Source.Camera;
  const publication = room.localParticipant.getTrackPublication(source);
  // Mientras la conexión termina, el stream local ya contiene el nuevo
  // track y será el que se publique al completar el join.
  if (!publication?.track) return;
  await publication.track.replaceTrack(track, true);
}

/** Inicia o detiene la captura de pantalla con la API nativa administrada por LiveKit. */
export async function setLiveKitScreenShareEnabled(room: Room, enabled: boolean): Promise<MediaStream | null> {
  const publication = await room.localParticipant.setScreenShareEnabled(enabled);
  const track = publication?.videoTrack?.mediaStreamTrack;
  return track ? new MediaStream([track]) : null;
}

/** Cierra la sala sin detener los tracks de getUserMedia administrados por la app. */
export async function disconnectLiveKitRoom(room: Room): Promise<void> {
  await room.disconnect(false);
}

/** Envía chat confiable a todos los participantes mediante el data channel de LiveKit. */
export async function publishLiveKitChat(room: Room, message: LiveKitChatPayload): Promise<void> {
  await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(message)), {
    reliable: true,
    topic: CHAT_TOPIC,
  });
}

/** Escucha únicamente los paquetes de chat de esta aplicación y descarta payloads inválidos. */
export function bindLiveKitChat(
  room: Room,
  onMessage: (message: LiveKitChatPayload, participant: LiveKitRemoteParticipant) => void,
): () => void {
  const onDataReceived = (payload: Uint8Array, participant?: Participant, _kind?: unknown, topic?: string) => {
    if (topic !== CHAT_TOPIC || !participant || !room.remoteParticipants.has(participant.identity)) return;
    try {
      const parsed: unknown = JSON.parse(new TextDecoder().decode(payload));
      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof (parsed as LiveKitChatPayload).id !== "string" ||
        typeof (parsed as LiveKitChatPayload).text !== "string" ||
        typeof (parsed as LiveKitChatPayload).timestamp !== "number"
      ) {
        return;
      }
      const message = parsed as LiveKitChatPayload;
      if (!message.text.trim() || message.text.length > 1_000) return;
      onMessage(message, { identity: participant.identity, name: participant.name || null });
    } catch {
      // Un paquete ajeno o malformado no debe romper la llamada.
    }
  };

  room.on(RoomEvent.DataReceived, onDataReceived);
  return () => room.off(RoomEvent.DataReceived, onDataReceived);
}

export interface LiveKitRemoteTrack {
  participantIdentity: string;
  kind: MediaStreamTrack["kind"];
  stream: MediaStream;
  isMuted: boolean;
  source: "camera" | "screen_share" | "other";
}

export interface LiveKitRemoteParticipant {
  identity: string;
  name: string | null;
}

interface LiveKitRemoteTrackHandlers {
  onParticipantConnected: (participant: LiveKitRemoteParticipant) => void;
  onTrackSubscribed: (track: LiveKitRemoteTrack) => void;
  onTrackUnsubscribed: (track: LiveKitRemoteTrack) => void;
  onTrackMuted: (participantIdentity: string, kind: MediaStreamTrack["kind"], source: LiveKitRemoteTrack["source"]) => void;
  onTrackUnmuted: (participantIdentity: string, kind: MediaStreamTrack["kind"], source: LiveKitRemoteTrack["source"]) => void;
  onParticipantDisconnected: (participantIdentity: string) => void;
}

function toRemoteParticipant(participant: RemoteParticipant): LiveKitRemoteParticipant {
  return {
    identity: participant.identity,
    name: participant.name || null,
  };
}

function toRemoteTrack(
  track: RemoteTrack,
  publication: RemoteTrackPublication,
  participant: RemoteParticipant,
): LiveKitRemoteTrack {
  return {
    participantIdentity: participant.identity,
    kind: track.mediaStreamTrack.kind,
    stream: new MediaStream([track.mediaStreamTrack]),
    isMuted: publication.isMuted,
    source:
      publication.source === Track.Source.ScreenShare
        ? "screen_share"
        : publication.source === Track.Source.Camera
          ? "camera"
          : "other",
  };
}

function toRemoteTrackSource(source: Track.Source): LiveKitRemoteTrack["source"] {
  if (source === Track.Source.ScreenShare) return "screen_share";
  if (source === Track.Source.Camera) return "camera";
  return "other";
}

/** Registra eventos de medios remotos sin exponer tipos del SDK fuera de esta capa. */
export function bindLiveKitRemoteTracks(room: Room, handlers: LiveKitRemoteTrackHandlers): () => void {
  const onParticipantConnected = (participant: RemoteParticipant) =>
    handlers.onParticipantConnected(toRemoteParticipant(participant));
  const onTrackSubscribed = (
    track: RemoteTrack,
    _publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) => handlers.onTrackSubscribed(toRemoteTrack(track, _publication, participant));
  const onTrackUnsubscribed = (
    track: RemoteTrack,
    _publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) => handlers.onTrackUnsubscribed(toRemoteTrack(track, _publication, participant));
  const onTrackMuted = (publication: TrackPublication, participant: Participant) => {
    if (room.remoteParticipants.has(participant.identity) && publication.kind !== "unknown") {
      handlers.onTrackMuted(participant.identity, publication.kind, toRemoteTrackSource(publication.source));
    }
  };
  const onTrackUnmuted = (publication: TrackPublication, participant: Participant) => {
    if (room.remoteParticipants.has(participant.identity) && publication.kind !== "unknown") {
      handlers.onTrackUnmuted(participant.identity, publication.kind, toRemoteTrackSource(publication.source));
    }
  };
  const onParticipantDisconnected = (participant: RemoteParticipant) =>
    handlers.onParticipantDisconnected(participant.identity);

  room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
  room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
  room.on(RoomEvent.TrackMuted, onTrackMuted);
  room.on(RoomEvent.TrackUnmuted, onTrackUnmuted);
  room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
  room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);

  return () => {
    room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.off(RoomEvent.TrackMuted, onTrackMuted);
    room.off(RoomEvent.TrackUnmuted, onTrackUnmuted);
    room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
  };
}

/** Devuelve el snapshot de participantes remotos ya presentes en la sala. */
export function getLiveKitRemoteParticipants(room: Room): LiveKitRemoteParticipant[] {
  return [...room.remoteParticipants.values()].map(toRemoteParticipant);
}

// Reexportado para mantener todos los accesos al SDK en esta capa.
export { RoomEvent };
export type { Room };
