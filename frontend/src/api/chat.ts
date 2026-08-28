import { API_BASE_URL } from "../config/env";
import type { ChatMessage } from "../livekit/types";

interface ChatHistoryResponse {
  messages: Array<{
    id: string;
    roomId: string;
    senderIdentity: string;
    senderName: string;
    text: string;
    sentAt: number;
  }>;
}

function headers(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function getChatHistory(roomId: string, token: string): Promise<ChatMessage[]> {
  const response = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomId)}/messages`, { headers: headers(token) });
  if (!response.ok) throw new Error("No se pudo cargar el historial del chat.");
  const data = (await response.json()) as ChatHistoryResponse;
  return data.messages.map((message) => ({
    id: message.id,
    type: "message",
    senderIdentity: message.senderIdentity,
    senderName: message.senderName,
    text: message.text,
    timestamp: message.sentAt,
  }));
}

export async function saveChatMessage(roomId: string, token: string, id: string, text: string): Promise<ChatMessage> {
  const response = await fetch(`${API_BASE_URL}/rooms/${encodeURIComponent(roomId)}/messages`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ id, text }),
  });
  if (!response.ok) throw new Error("No se pudo guardar el mensaje.");
  const message = (await response.json()) as ChatHistoryResponse["messages"][number];
  return {
    id: message.id,
    type: "message",
    senderIdentity: message.senderIdentity,
    senderName: message.senderName,
    text: message.text,
    timestamp: message.sentAt,
  };
}
