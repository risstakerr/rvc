/**
 * Contrato del identificador de sala. Se define en `shared` porque
 * tanto el backend (genera el ID) como el frontend (lo valida antes
 * de pedirle al backend que verifique si la sala existe) necesitan
 * acordar exactamente el mismo formato.
 *
 * Alfabeto sin caracteres ambiguos (sin 0/O, 1/l/I) para que un
 * enlace copiado o leído en voz alta sea legible. Longitud fija de
 * 10 caracteres: con este alfabeto de 57 símbolos da ~58 bits de
 * entropía, suficiente para que adivinar un ID por fuerza bruta no
 * sea viable, sin necesitar un ID largo y feo en la URL.
 */
export const ROOM_ID_ALPHABET =
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export const ROOM_ID_LENGTH = 10;

const ROOM_ID_PATTERN = new RegExp(`^[${ROOM_ID_ALPHABET}]{${ROOM_ID_LENGTH}}$`);

export function isValidRoomId(value: string): boolean {
  return ROOM_ID_PATTERN.test(value);
}
