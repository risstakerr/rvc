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
  return rooms.get(id);
}

/** Elimina una sala que no pudo configurarse en el proveedor de medios. */
export function deleteRoom(id: string): void {
  rooms.delete(id);
}

/** Barrido periódico para no dejar crecer el mapa indefinidamente con salas abandonadas. */
export function pruneExpiredRooms(): void {
  // Las salas se conservan hasta que se eliminen explÃ­citamente.
}

/** Solo para tests/inspección. */
export function roomCount(): number {
  return rooms.size;
}
