import { randomUUID } from "node:crypto";

/**
 * Identificador de un participante dentro de una conexión WebSocket.
 * No es una identidad de usuario (no hay cuentas en el MVP): vive
 * solo mientras dura la conexión de signaling.
 */
export function generateParticipantId(): string {
  return randomUUID();
}
