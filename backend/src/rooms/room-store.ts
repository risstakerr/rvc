import { env } from "../config/env.js";
import { generateRoomId } from "./room-id.js";

export interface Room { id: string; createdAt: number; }

const rooms = new Map<string, Room>();

function configured(): boolean { return Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY); }
function url(path: string): string { return `${env.SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/${path}`; }
function headers(prefer?: string): Record<string, string> {
  return { apikey: env.SUPABASE_SECRET_KEY!, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY!}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) };
}

export async function createRoom(): Promise<Room> {
  let id = generateRoomId();
  while (rooms.has(id)) id = generateRoomId();
  const room = { id, createdAt: Date.now() };
  if (configured()) {
    const response = await fetch(url("rooms"), { method: "POST", headers: headers("return=minimal"), body: JSON.stringify({ id, created_at: new Date(room.createdAt).toISOString() }) });
    if (!response.ok) throw new Error("No se pudo guardar la sala.");
  }
  rooms.set(id, room);
  return room;
}

export async function getRoom(id: string): Promise<Room | undefined> {
  if (!configured()) return rooms.get(id);
  const response = await fetch(url(`rooms?select=id,created_at&id=eq.${encodeURIComponent(id)}&limit=1`), { headers: headers() });
  if (!response.ok) throw new Error("No se pudo consultar la sala.");
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || !rows[0] || typeof rows[0] !== "object") return undefined;
  const row = rows[0] as Record<string, unknown>;
  return typeof row.id === "string" ? { id: row.id, createdAt: typeof row.created_at === "string" ? Date.parse(row.created_at) : Date.now() } : undefined;
}

export async function deleteRoom(id: string): Promise<void> {
  rooms.delete(id);
  if (configured()) await fetch(url(`rooms?id=eq.${encodeURIComponent(id)}`), { method: "DELETE", headers: headers("return=minimal") });
}

export function pruneExpiredRooms(): void { /* Las salas no expiran por inactividad. */ }
export function roomCount(): number { return rooms.size; }
