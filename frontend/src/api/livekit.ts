import { API_BASE_URL } from "../config/env";
import type { LiveKitTokenErrorCode, LiveKitTokenResponse } from "../livekit/types";

export class LiveKitTokenError extends Error {
  readonly code: LiveKitTokenErrorCode;

  constructor(message: string, code: LiveKitTokenErrorCode) {
    super(message);
    this.name = "LiveKitTokenError";
    this.code = code;
  }
}

export async function requestLiveKitToken(roomId: string, participantName: string): Promise<LiveKitTokenResponse> {
  const response = await fetch(`${API_BASE_URL}/livekit/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, participantName }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: unknown; code?: unknown } | null;
    const message = typeof body?.error === "string" ? body.error : `No se pudo obtener el token de LiveKit (HTTP ${response.status})`;
    const code: LiveKitTokenErrorCode = body?.code === "ROOM_FULL" ? "ROOM_FULL" : null;
    throw new LiveKitTokenError(message, code);
  }

  return (await response.json()) as LiveKitTokenResponse;
}
