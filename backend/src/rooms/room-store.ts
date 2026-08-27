import { generateRoomId } from "./room-id.js";

export interface Room {
  id: string;
  createdAt: number;
}

/**
 * Almacén en memoria. Es intencionalmente simple para el MVP (regla
 * del prompt: "no crear una arquitectura excesivamente compleja").
 * No hay base de datos: si el proceso reinicia, las salas activas se
 * pierden, lo cual es aceptable porque no se necesita persistencia
 * (no se guardan videollamadas ni mensajes).
 *
 * NOTA: todavía no hay tracking de participantes (eso es la Fase 5,
 * WebSocket signaling). Por ahora una sala "existe" simplemente si
 * fue creada y no expiró por inactividad.
 */
const rooms = new Map<string, Room>();

/** Tiempo máximo que una sala vive sin que nadie confirme participación por WebSocket (Fase 5). */
const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

export function createRoom(): Room {
  let id = generateRoomId();
  // Colisión extremadamente improbable (~58 bits de entropía), pero se cubre igual.
  while (rooms.has(id)) {
    id = generateRoomId();
  }
  const room: Room = { id, createdAt: Date.now() };
  rooms.set(id, room);
  return room;
}

export function getRoom(id: string): Room | undefined {
  const room = rooms.get(id);
  if (room && isExpired(room)) {
    rooms.delete(room.id);
    return undefined;
  }
  return room;
}

function isExpired(room: Room): boolean {
  return Date.now() - room.createdAt > ROOM_TTL_MS;
}

/** Barrido periódico para no dejar crecer el mapa indefinidamente con salas abandonadas. */
export function pruneExpiredRooms(): void {
  for (const room of rooms.values()) {
    if (isExpired(room)) {
      rooms.delete(room.id);
    }
  }
}

/** Solo para tests/inspección. */
export function roomCount(): number {
  return rooms.size;
}
