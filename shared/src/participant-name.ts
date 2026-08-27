export const MIN_PARTICIPANT_NAME_LENGTH = 2;
export const MAX_PARTICIPANT_NAME_LENGTH = 32;

/** Normaliza espacios sin modificar el nombre elegido por la persona. */
export function normalizeParticipantName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function isValidParticipantName(value: string): boolean {
  const normalized = normalizeParticipantName(value);
  return (
    value === normalized &&
    Array.from(normalized).length >= MIN_PARTICIPANT_NAME_LENGTH &&
    Array.from(normalized).length <= MAX_PARTICIPANT_NAME_LENGTH &&
    !/[\u0000-\u001f\u007f]/.test(normalized)
  );
}
