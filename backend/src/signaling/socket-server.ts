import type { Server as HttpServer } from "node:http";
import type { IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { isValidRoomId, type ClientSignalMessage, type ServerSignalMessage } from "@pvc/shared";
import { getRoom } from "../rooms/room-store.js";
import { generateParticipantId } from "./participant-id.js";
import { getPeer, joinRoom, leaveRoom } from "./room-sockets.js";

/**
 * Backend de signaling de la Fase 5. Maneja join/leave, reenvío de
 * offer/answer/ICE candidates entre los dos participantes de una
 * sala, y limpieza en desconexiones. NO transporta audio/video: eso
 * es WebRTC P2P directo entre los navegadores (Fase 6).
 *
 * Protocolo (JSON sobre un único endpoint `/ws`, sin roomId en la
 * URL): el cliente se conecta y como primer mensaje debe enviar
 * `{ type: "join", roomId }`. Recién después de un `joined` puede
 * mandar offer/answer/ice-candidate, que el servidor reenvía tal
 * cual al otro participante de la sala (no los interpreta).
 */

// Suficiente para SDP/ICE candidates; protege contra payloads abusivos (regla de seguridad del prompt).
const MAX_MESSAGE_BYTES = 16 * 1024;

// Rate limiting básico por conexión (protección contra abuso/flood). La auditoría
// de seguridad completa del protocolo de signaling es la Fase 11.
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_MESSAGES = 30;

interface ConnectionState {
  participantId: string;
  roomId: string | null;
  messageTimestamps: number[];
}

export function attachSignalingServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: MAX_MESSAGE_BYTES });

  wss.on("connection", (socket: WebSocket, _req: IncomingMessage) => {
    const state: ConnectionState = {
      participantId: generateParticipantId(),
      roomId: null,
      messageTimestamps: [],
    };

    socket.on("message", (raw: RawData) => {
      if (isRateLimited(state)) {
        send(socket, { type: "error", message: "Demasiados mensajes: conexión cerrada." });
        socket.close(1008, "rate-limit");
        return;
      }

      const message = parseMessage(raw);
      if (!message) {
        send(socket, { type: "error", message: "Mensaje de signaling inválido." });
        return;
      }

      handleMessage(socket, state, message);
    });

    socket.on("close", () => handleDisconnect(state));
    socket.on("error", () => handleDisconnect(state));
  });

  return wss;
}

function parseMessage(raw: RawData): ClientSignalMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw.toString());
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { type?: unknown }).type !== "string"
    ) {
      return null;
    }
    return parsed as ClientSignalMessage;
  } catch {
    return null;
  }
}

function isRateLimited(state: ConnectionState): boolean {
  const now = Date.now();
  state.messageTimestamps.push(now);
  state.messageTimestamps = state.messageTimestamps.filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );
  return state.messageTimestamps.length > RATE_LIMIT_MAX_MESSAGES;
}

function handleMessage(socket: WebSocket, state: ConnectionState, message: ClientSignalMessage): void {
  switch (message.type) {
    case "join":
      handleJoin(socket, state, message.roomId);
      return;
    case "leave":
      handleDisconnect(state);
      socket.close(1000, "leave");
      return;
    case "offer":
    case "answer":
    case "ice-candidate":
      forwardToPeer(socket, state, message);
      return;
    default:
      send(socket, { type: "error", message: "Tipo de mensaje de signaling desconocido." });
  }
}

function handleJoin(socket: WebSocket, state: ConnectionState, roomId: unknown): void {
  if (state.roomId) {
    send(socket, { type: "error", message: "Ya estás unido a una sala en esta conexión." });
    return;
  }

  if (typeof roomId !== "string" || !isValidRoomId(roomId) || !getRoom(roomId)) {
    send(socket, { type: "room-not-found" });
    socket.close(1008, "room-not-found");
    return;
  }

  const result = joinRoom(roomId, state.participantId, socket);
  if (!result.ok) {
    send(socket, { type: "room-full" });
    socket.close(1008, "room-full");
    return;
  }

  state.roomId = roomId;
  send(socket, { type: "joined", participantId: state.participantId, peerPresent: result.peer !== null });

  if (result.peer) {
    send(result.peer.socket, { type: "peer-joined" });
  }
}

function forwardToPeer(
  socket: WebSocket,
  state: ConnectionState,
  message: Extract<ClientSignalMessage, { type: "offer" | "answer" | "ice-candidate" }>,
): void {
  if (!state.roomId) {
    send(socket, { type: "error", message: "Tenés que unirte a una sala antes de enviar signaling." });
    return;
  }

  const peer = getPeer(state.roomId, state.participantId);
  if (!peer) {
    send(socket, { type: "error", message: "Todavía no hay otro participante en la sala." });
    return;
  }

  send(peer.socket, message);
}

function handleDisconnect(state: ConnectionState): void {
  if (!state.roomId) return;
  const peer = leaveRoom(state.roomId, state.participantId);
  state.roomId = null;
  if (peer) {
    send(peer.socket, { type: "peer-left" });
  }
}

function send(socket: WebSocket, message: ServerSignalMessage): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(message));
}
