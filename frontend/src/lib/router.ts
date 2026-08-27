/**
 * Ruteo mínimo con la History API nativa. Con un puñado de pantallas
 * y un flujo lineal, sumar react-router sería una dependencia
 * innecesaria (regla del prompt).
 */
const CALL_PATH_PATTERN = /^\/call\/([^/]+)\/?$/;

export function parseRoomIdFromPath(pathname: string): string | null {
  const match = CALL_PATH_PATTERN.exec(pathname);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function buildCallPath(roomId: string): string {
  return `/call/${encodeURIComponent(roomId)}`;
}

/** URL completa y absoluta de la sala, lista para compartir. */
export function buildCallUrl(roomId: string): string {
  return `${window.location.origin}${buildCallPath(roomId)}`;
}

export function navigateToCall(roomId: string): void {
  window.history.pushState({}, "", buildCallPath(roomId));
}

export function navigateHome(): void {
  window.history.pushState({}, "", "/");
}
