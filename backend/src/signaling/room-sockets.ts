import type { WebSocket } from "ws";
import { MAX_PARTICIPANTS_PER_ROOM } from "@pvc/shared";

/**
 * Tracking en memoria de qué sockets WebSocket están unidos a cada
 * sala de signaling. Separado a propósito de `rooms/room-store.ts`:
 * ese módulo solo sabe si una sala HTTP existe o expiró; este módulo
 * es el que impone el límite real de participantes *conectados* y
 * permite ubicar al "peer" para reenviarle mensajes de signaling.
 *
 * Nota (Fase 11): esto limita a 2 conexiones por sala, pero no
 * identifica si dos conexiones pertenecen a la misma persona
 * reconectando dos veces. Ese refinamiento (protección contra
 * múltiples conexiones del mismo participante) se audita en la Fase
 * 11 de seguridad; por ahora el límite numérico ya cumple la regla
 * de negocio de "máximo 2 participantes por sala".
 */

interface Participant {
  id: string;
  socket: WebSocket;
}

const roomSockets = new Map<string, Participant[]>();

export type JoinRoomResult =
  | { ok: true; peer: Participant | null }
  | { ok: false; reason: "room-full" };

export function joinRoom(roomId: string, participantId: string, socket: WebSocket): JoinRoomResult {
  const participants = roomSockets.get(roomId) ?? [];

  if (participants.length >= MAX_PARTICIPANTS_PER_ROOM) {
    return { ok: false, reason: "room-full" };
  }

  const peer = participants[0] ?? null;
  participants.push({ id: participantId, socket });
  roomSockets.set(roomId, participants);
  return { ok: true, peer };
}

/** Quita al participante de la sala y devuelve el peer restante (si hay uno), para poder avisarle. */
export function leaveRoom(roomId: string, participantId: string): Participant | null {
  const participants = roomSockets.get(roomId);
  if (!participants) return null;

  const index = participants.findIndex((p) => p.id === participantId);
  if (index === -1) return null;

  participants.splice(index, 1);

  if (participants.length === 0) {
    roomSockets.delete(roomId);
    return null;
  }

  roomSockets.set(roomId, participants);
  return participants[0] ?? null;
}

export function getPeer(roomId: string, participantId: string): Participant | null {
  const participants = roomSockets.get(roomId);
  if (!participants) return null;
  return participants.find((p) => p.id !== participantId) ?? null;
}

/** Solo para tests/inspección. */
export function participantCount(roomId: string): number {
  return roomSockets.get(roomId)?.length ?? 0;
}
