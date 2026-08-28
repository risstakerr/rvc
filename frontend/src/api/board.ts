import { API_BASE_URL } from "../config/env";

export async function uploadBoardImage(roomId: string, token: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) throw new Error("Elegí una imagen de hasta 8 MB.");
  const response = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomId)}/board/assets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) throw new Error("No se pudo subir la imagen.");
  return ((await response.json()) as { url: string }).url;
}
