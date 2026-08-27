import { API_BASE_URL } from "../config/env";
import type { RecordingStatus } from "../livekit/types";

async function recordingRequest(roomId: string, token: string, path: string, method: "GET" | "POST"): Promise<RecordingStatus> {
  const response = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomId)}/recording${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    throw new Error(typeof body?.error === "string" ? body.error : "No se pudo actualizar la grabación.");
  }
  return (await response.json()) as RecordingStatus;
}

export const getRecordingStatus = (roomId: string, token: string) => recordingRequest(roomId, token, "", "GET");
export const startRecording = (roomId: string, token: string) => recordingRequest(roomId, token, "/start", "POST");
export const stopRecording = (roomId: string, token: string) => recordingRequest(roomId, token, "/stop", "POST");
