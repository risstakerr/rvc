import { randomInt } from "node:crypto";
import { ROOM_ID_ALPHABET, ROOM_ID_LENGTH } from "@pvc/shared";

/**
 * Genera un ID de sala aleatorio criptográficamente seguro
 * (`crypto.randomInt`, no `Math.random`) usando el alfabeto acordado
 * en `shared`. No depende de ninguna librería externa (nanoid, uuid,
 * etc.) para mantener el backend liviano.
 */
export function generateRoomId(): string {
  let id = "";
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    id += ROOM_ID_ALPHABET[randomInt(ROOM_ID_ALPHABET.length)];
  }
  return id;
}
