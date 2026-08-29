import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { isValidParticipantName, isValidRoomId, MAX_ROOM_PARTICIPANTS } from "@pvc/shared";
import { env } from "./config/env.js";
import { createChatSessionToken, deleteBoardItem, listBoardItems, listChatMessages, saveBoardImage, saveBoardItem, saveChatMessage, verifyChatSessionToken } from "./chat/chat-history.js";
import { createRoom, deleteRoom, getRoom, pruneExpiredRooms } from "./rooms/room-store.js";
import {
  createRecordingControlToken,
  getRecordingStatus,
  isRecordingAvailable,
  startRecording,
  stopRecording,
  verifyRecordingControlToken,
} from "./recording/recording-service.js";
import { rateLimit } from "./security/rate-limit.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY ? 1 : false);
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization", "Content-Type"],
    maxAge: 600,
  }),
);

const BOARD_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/ogg"]);

// Debe registrarse antes del parser JSON global para recibir archivos binarios.
app.post("/rooms/:roomId/board/assets", rateLimit(20, 60 * 1000), express.raw({ type: ["image/*", "video/*"], limit: "32mb" }), async (req, res) => {
  const roomId = req.params.roomId;
  if (!roomId || !isValidRoomId(roomId)) return res.status(400).json({ error: "ID de sala invÃ¡lido" });
  if (!verifyChatSessionToken(req.header("authorization")?.replace(/^Bearer /, ""), roomId)) {
    return res.status(403).json({ error: "No tenÃ©s permiso para subir archivos" });
  }
  const mimeType = req.header("content-type")?.split(";")[0]?.toLowerCase();
  if (!mimeType || !BOARD_IMAGE_TYPES.has(mimeType) || !Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: "Solo se admiten fotos JPG, PNG, WebP, GIF o videos MP4, WebM, OGG de hasta 32 MB" });
  }
  try {
    res.status(201).json({ url: await saveBoardImage(roomId, randomUUID(), mimeType, req.body) });
  } catch {
    res.status(503).json({ error: "No se pudo subir la imagen" });
  }
});
app.use(express.json({ limit: "16kb", strict: true }));

app.get("/rooms/:roomId/board", rateLimit(60, 60 * 1000), async (req, res) => {
  const roomId = req.params.roomId;
  if (!roomId || !isValidRoomId(roomId) || !getChatSession(req, roomId)) return res.status(403).json({ error: "No tenés permiso para acceder al pizarrón" });
  try { res.json({ items: await listBoardItems(roomId) }); } catch { res.status(503).json({ error: "No se pudo cargar el pizarrón" }); }
});

app.post("/rooms/:roomId/board", rateLimit(120, 60 * 1000), async (req, res) => {
  const roomId = req.params.roomId;
  const item = req.body?.item;
  if (!roomId || !isValidRoomId(roomId) || !getChatSession(req, roomId) || !item || typeof item !== "object" || typeof item.id !== "string") return res.status(400).json({ error: "Elemento de pizarrón inválido" });
  try { await saveBoardItem(roomId, item); res.status(204).end(); } catch { res.status(503).json({ error: "No se pudo guardar el pizarrón" }); }
});

app.delete("/rooms/:roomId/board/:itemId", rateLimit(120, 60 * 1000), async (req, res) => {
  const { roomId, itemId } = req.params;
  if (!roomId || !itemId || !isValidRoomId(roomId) || !getChatSession(req, roomId)) return res.status(403).json({ error: "No tenés permiso para editar el pizarrón" });
  try { await deleteBoardItem(roomId, itemId); res.status(204).end(); } catch { res.status(503).json({ error: "No se pudo eliminar el elemento" }); }
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", uptimeSeconds: process.uptime() });
});

function getLiveKitRoomService(): RoomServiceClient | null {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return null;
  return new RoomServiceClient(LIVEKIT_URL.replace(/^ws/, "http"), LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
}

app.post("/rooms", rateLimit(10, 60 * 60 * 1000), async (_req: Request, res: Response) => {
  const liveKitRoomService = getLiveKitRoomService();
  if (!liveKitRoomService) {
    res.status(503).json({ error: "LiveKit no esta configurado en el servidor" });
    return;
  }

  let room;
  try {
    room = await createRoom();
  } catch {
    res.status(503).json({ error: "No se pudo guardar la sala" });
    return;
  }
  try {
    await liveKitRoomService.createRoom({ name: room.id, maxParticipants: MAX_ROOM_PARTICIPANTS });
    res.status(201).json({ roomId: room.id, maxParticipants: MAX_ROOM_PARTICIPANTS });
  } catch {
    await deleteRoom(room.id);
    res.status(502).json({ error: "No se pudo configurar la sala en LiveKit" });
  }
});

app.get("/rooms/:roomId", async (req: Request, res: Response) => {
  const { roomId } = req.params;

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ exists: false, error: "ID de sala inválido" });
    return;
  }

  const room = await getRoom(roomId);
  if (!room) {
    res.status(404).json({ exists: false });
    return;
  }

  res.json({ exists: true, roomId: room.id });
});

function getTokenRequest(body: unknown): { roomId: string; participantName: string } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { roomId, participantName } = body as Record<string, unknown>;
  if (
    Object.keys(body).length !== 2 ||
    typeof roomId !== "string" ||
    typeof participantName !== "string" ||
    !isValidParticipantName(participantName)
  ) return null;
  return { roomId, participantName };
}

app.post("/livekit/token", rateLimit(30, 10 * 60 * 1000), async (req: Request, res: Response) => {
  const tokenRequest = getTokenRequest(req.body);
  const roomId = tokenRequest?.roomId;

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ error: "Sala o nombre inválido" });
    return;
  }
  if (!await getRoom(roomId)) {
    res.status(404).json({ error: "Sala no encontrada" });
    return;
  }

  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = env;
  const liveKitRoomService = getLiveKitRoomService();
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !liveKitRoomService) {
    res.status(503).json({ error: "LiveKit no esta configurado en el servidor" });
    return;
  }

  try {
    const participants = await liveKitRoomService.listParticipants(roomId);
    if (participants.length >= MAX_ROOM_PARTICIPANTS) {
      res.status(403).json({
        code: "ROOM_FULL",
        error: `La sala alcanzó el límite de ${MAX_ROOM_PARTICIPANTS} participantes`,
        maxParticipants: MAX_ROOM_PARTICIPANTS,
      });
      return;
    }
  } catch {
    res.status(502).json({ error: "No se pudo verificar la capacidad de la sala" });
    return;
  }

  const participantIdentity = `participant-${randomUUID()}`;
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: participantIdentity,
    name: tokenRequest.participantName,
    ttl: env.LIVEKIT_TOKEN_TTL_SECONDS,
  });
  token.addGrant({ roomJoin: true, room: roomId, canPublish: true, canSubscribe: true });

  res.json({
    token: await token.toJwt(),
    url: LIVEKIT_URL,
    roomName: roomId,
    participantIdentity,
    maxParticipants: MAX_ROOM_PARTICIPANTS,
    recordingControlToken: createRecordingControlToken(roomId, participantIdentity),
    chatHistoryToken: createChatSessionToken(roomId, participantIdentity, tokenRequest.participantName),
  });
});

function getBearerToken(req: Request): string | undefined {
  const authorization = req.header("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined;
}

function getChatSession(req: Request, roomId: string) {
  return verifyChatSessionToken(getBearerToken(req), roomId);
}

app.get("/rooms/:roomId/messages", rateLimit(60, 60 * 1000), async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ error: "ID de sala invÃ¡lido" });
    return;
  }
  if (!getChatSession(req, roomId)) {
    res.status(403).json({ error: "No tenÃ©s permiso para consultar el historial" });
    return;
  }
  try {
    res.json({ messages: await listChatMessages(roomId) });
  } catch {
    res.status(503).json({ error: "El historial de chat no estÃ¡ disponible" });
  }
});

function getChatMessageRequest(body: unknown): { id: string; text: string } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { id, text } = body as Record<string, unknown>;
  if (
    Object.keys(body).length !== 2 || typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
    typeof text !== "string" || text !== text.trim() || !text || text.length > 1_000 || hasControlCharacters(text)
  ) return null;
  return { id, text };
}

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0)!;
    return codePoint <= 31 || codePoint === 127;
  });
}

app.post("/rooms/:roomId/messages", rateLimit(60, 60 * 1000), async (req: Request, res: Response) => {
  const roomId = req.params.roomId;
  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ error: "ID de sala invÃ¡lido" });
    return;
  }
  const session = getChatSession(req, roomId);
  if (!session) {
    res.status(403).json({ error: "No tenÃ©s permiso para guardar mensajes" });
    return;
  }
  const input = getChatMessageRequest(req.body);
  if (!input) {
    res.status(400).json({ error: "Mensaje invÃ¡lido" });
    return;
  }
  const message = {
    id: input.id,
    roomId,
    senderIdentity: session.participantIdentity,
    senderName: session.participantName,
    text: input.text,
    sentAt: Date.now(),
  };
  try {
    await saveChatMessage(message);
    res.status(201).json(message);
  } catch {
    res.status(503).json({ error: "No se pudo guardar el mensaje" });
  }
});

function canControlRecording(req: Request, roomId: string): boolean {
  return verifyRecordingControlToken(getBearerToken(req), roomId);
}

async function validateRecordingRequest(req: Request, res: Response): Promise<string | null> {
  const roomId = req.params.roomId;
  if (!roomId || !isValidRoomId(roomId) || !await getRoom(roomId)) {
    res.status(404).json({ error: "Sala no encontrada" });
    return null;
  }
  if (!isRecordingAvailable()) {
    res.status(503).json({ error: "La grabación no está habilitada en este servidor" });
    return null;
  }
  if (!canControlRecording(req, roomId)) {
    res.status(403).json({ error: "No tenés permiso para controlar la grabación" });
    return null;
  }
  return roomId;
}

app.get("/rooms/:roomId/recording", rateLimit(30, 60 * 1000), async (req: Request, res: Response) => {
  const roomId = await validateRecordingRequest(req, res);
  if (!roomId) return;
  res.json(getRecordingStatus(roomId));
});

app.post("/rooms/:roomId/recording/start", rateLimit(10, 60 * 1000), async (req: Request, res: Response) => {
  const roomId = await validateRecordingRequest(req, res);
  if (!roomId) return;
  try {
    res.status(201).json(await startRecording(roomId));
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "No se pudo iniciar la grabación" });
  }
});

app.post("/rooms/:roomId/recording/stop", rateLimit(10, 60 * 1000), async (req: Request, res: Response) => {
  const roomId = await validateRecordingRequest(req, res);
  if (!roomId) return;
  try {
    res.json(await stopRecording(roomId));
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "No se pudo detener la grabación" });
  }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Recurso no encontrado" });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ error: "JSON inválido" });
    return;
  }
  if (typeof error === "object" && error !== null && "status" in error && error.status === 413) {
    res.status(413).json({ error: "El cuerpo de la solicitud es demasiado grande" });
    return;
  }
  // Nunca se devuelven detalles internos ni secretos al cliente.
  res.status(500).json({ error: "Error interno del servidor" });
});

// Barrido de salas expiradas cada 10 minutos, para no acumular
// memoria con salas creadas y nunca usadas.
setInterval(pruneExpiredRooms, 10 * 60 * 1000).unref();

const server = app.listen(env.PORT, () => {
  console.log(`[backend] escuchando en el puerto ${env.PORT}`);
});

function shutdown(signal: string): void {
  console.log(`[backend] recibida señal ${signal}; cerrando servidor HTTP`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 25_000).unref();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
