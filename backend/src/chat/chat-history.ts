import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

const CHAT_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_HISTORY_MESSAGES = 200;

export interface ChatHistoryMessage {
  id: string;
  roomId: string;
  senderIdentity: string;
  senderName: string;
  text: string;
  sentAt: number;
}

export interface PersistedBoardItem {
  id: string;
  type: "text" | "link" | "image" | "video" | "arrow";
  content: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  targetId?: string;
  sourceId?: string;
  targetX?: number;
  targetY?: number;
}

interface ChatSession {
  roomId: string;
  participantIdentity: string;
  participantName: string;
  expiresAt: number;
}

function isConfigured(): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY);
}

function sign(value: string): string {
  return createHmac("sha256", env.SUPABASE_SECRET_KEY!).update(value).digest("base64url");
}

function apiUrl(path: string): string {
  return `${env.SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/${path}`;
}

function headers(prefer?: string): Record<string, string> {
  return {
    apikey: env.SUPABASE_SECRET_KEY!,
    Authorization: `Bearer ${env.SUPABASE_SECRET_KEY!}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

/** Token opaco para que solo participantes habilitados de una sala accedan a su historial. */
export function createChatSessionToken(roomId: string, participantIdentity: string, participantName: string): string | null {
  if (!isConfigured()) return null;
  const payload = Buffer.from(
    JSON.stringify({ roomId, participantIdentity, participantName, expiresAt: Date.now() + CHAT_SESSION_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyChatSessionToken(token: string | undefined, roomId: string): ChatSession | null {
  if (!token || !isConfigured()) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const session = parsed as Partial<ChatSession>;
    if (
      session.roomId !== roomId ||
      typeof session.participantIdentity !== "string" ||
      typeof session.participantName !== "string" ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Date.now()
    ) return null;
    return session as ChatSession;
  } catch {
    return null;
  }
}

export async function listChatMessages(roomId: string): Promise<ChatHistoryMessage[]> {
  if (!isConfigured()) throw new Error("El historial de chat no estÃ¡ configurado.");
  const query = new URLSearchParams({
    select: "id,room_id,sender_identity,sender_name,body,sent_at",
    room_id: `eq.${roomId}`,
    order: "sent_at.asc",
    limit: String(MAX_HISTORY_MESSAGES),
  });
  const response = await fetch(apiUrl(`chat_messages?${query.toString()}`), { headers: headers() });
  if (!response.ok) throw new Error("No se pudo obtener el historial de chat.");
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row): ChatHistoryMessage[] => {
    if (!row || typeof row !== "object") return [];
    const value = row as Record<string, unknown>;
    const sentAt = typeof value["sent_at"] === "string" ? Date.parse(value["sent_at"]) : NaN;
    if (
      typeof value["id"] !== "string" || typeof value["room_id"] !== "string" ||
      typeof value["sender_identity"] !== "string" || typeof value["sender_name"] !== "string" ||
      typeof value["body"] !== "string" || !Number.isFinite(sentAt)
    ) return [];
    return [{ id: value["id"], roomId: value["room_id"], senderIdentity: value["sender_identity"], senderName: value["sender_name"], text: value["body"], sentAt }];
  });
}

export async function saveChatMessage(message: ChatHistoryMessage): Promise<void> {
  if (!isConfigured()) throw new Error("El historial de chat no estÃ¡ configurado.");
  const response = await fetch(apiUrl("chat_messages"), {
    method: "POST",
    headers: headers("return=minimal"),
    body: JSON.stringify({
      id: message.id,
      room_id: message.roomId,
      sender_identity: message.senderIdentity,
      sender_name: message.senderName,
      body: message.text,
      sent_at: new Date(message.sentAt).toISOString(),
    }),
  });
  if (!response.ok && response.status !== 409) throw new Error("No se pudo guardar el mensaje.");
}

export async function saveBoardImage(roomId: string, id: string, mimeType: string, bytes: Buffer): Promise<string> {
  if (!isConfigured()) throw new Error("El pizarrÃ³n no estÃ¡ configurado.");
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : mimeType === "image/gif" ? "gif" : mimeType === "video/webm" ? "webm" : mimeType === "video/ogg" ? "ogv" : mimeType === "video/mp4" ? "mp4" : "jpg";
  const objectPath = `${roomId}/${id}.${extension}`;
  const response = await fetch(`${env.SUPABASE_URL!.replace(/\/$/, "")}/storage/v1/object/board-assets/${objectPath}`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_SECRET_KEY!, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY!}`, "Content-Type": mimeType, "x-upsert": "false" },
    body: bytes,
  });
  if (!response.ok) throw new Error("No se pudo subir la imagen.");
  return `${env.SUPABASE_URL!.replace(/\/$/, "")}/storage/v1/object/public/board-assets/${objectPath}`;
}

export async function listBoardItems(roomId: string): Promise<PersistedBoardItem[]> {
  if (!isConfigured()) throw new Error("El pizarrón no está configurado.");
  const response = await fetch(apiUrl(`board_items?select=item&room_id=eq.${encodeURIComponent(roomId)}&order=updated_at.asc`), { headers: headers() });
  if (!response.ok) throw new Error("No se pudo cargar el pizarrón.");
  const rows: unknown = await response.json();
  return Array.isArray(rows) ? rows.flatMap((row) => row && typeof row === "object" && "item" in row ? [(row as { item: PersistedBoardItem }).item] : []) : [];
}

export async function saveBoardItem(roomId: string, item: PersistedBoardItem): Promise<void> {
  if (!isConfigured()) throw new Error("El pizarrón no está configurado.");
  const response = await fetch(apiUrl("board_items?on_conflict=id"), {
    method: "POST", headers: headers("resolution=merge-duplicates,return=minimal"),
    body: JSON.stringify({ id: item.id, room_id: roomId, item, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error("No se pudo guardar el pizarrón.");
}

export async function deleteBoardItem(roomId: string, id: string): Promise<void> {
  if (!isConfigured()) throw new Error("El pizarrón no está configurado.");
  const response = await fetch(apiUrl(`board_items?id=eq.${encodeURIComponent(id)}&room_id=eq.${encodeURIComponent(roomId)}`), { method: "DELETE", headers: headers("return=minimal") });
  if (!response.ok) throw new Error("No se pudo eliminar el elemento.");
}
