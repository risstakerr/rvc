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
 * El conteo y el ciclo de vida de participantes se obtienen de
 * LiveKit; el backend solo conserva la autorización de la sala.
 */
const rooms = new Map<string, Room>();

/** Tiempo máximo que una sala creada vive sin actividad. */
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

/** Elimina una sala que no pudo configurarse en el proveedor de medios. */
export function deleteRoom(id: string): void {
  rooms.delete(id);
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
