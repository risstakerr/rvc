import { API_BASE_URL } from "../config/env";
import type { BoardItem } from "../livekit/types";

export async function getBoardItems(roomId: string, token: string): Promise<BoardItem[]> {
  const response = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomId)}/board`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("No se pudo cargar el pizarrón.");
  return ((await response.json()) as { items: BoardItem[] }).items;
}

export async function saveBoardItem(roomId: string, token: string, item: BoardItem): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomId)}/board`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ item }) });
  if (!response.ok) throw new Error("No se pudo guardar el pizarrón.");
}

export async function deleteBoardItem(roomId: string, token: string, id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomId)}/board/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("No se pudo eliminar el elemento.");
}

export async function uploadBoardImage(roomId: string, token: string, file: File): Promise<string> {
  if ((!file.type.startsWith("image/") && !file.type.startsWith("video/")) || file.size > 32 * 1024 * 1024) throw new Error("Elegí una foto o video de hasta 32 MB.");
  const response = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomId)}/board/assets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) throw new Error("No se pudo subir la imagen.");
  return ((await response.json()) as { url: string }).url;
}
