import { API_BASE_URL } from "../config/env";

export interface CreateRoomResult {
  roomId: string;
}

export async function createRoom(): Promise<CreateRoomResult> {
  const res = await fetch(`${API_BASE_URL}/rooms`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`No se pudo crear la sala (HTTP ${res.status})`);
  }
  return (await res.json()) as CreateRoomResult;
}

/**
 * Devuelve `true` si la sala existe y sigue disponible. `false` si no
 * existe, expiró o el ID tiene un formato inválido (400/404 del
 * backend se tratan igual desde la perspectiva del frontend: no hay
 * llamada a la que entrar).
 */
export async function checkRoomExists(roomId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomId)}`);
  if (res.status === 404 || res.status === 400) return false;
  if (!res.ok) {
    throw new Error(`No se pudo verificar la sala (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { exists: boolean };
  return data.exists;
}
