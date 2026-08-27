import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { isValidParticipantName, isValidRoomId, MAX_ROOM_PARTICIPANTS } from "@pvc/shared";
import { env } from "./config/env.js";
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
app.use(express.json({ limit: "16kb", strict: true }));

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

  const room = createRoom();
  try {
    await liveKitRoomService.createRoom({ name: room.id, maxParticipants: MAX_ROOM_PARTICIPANTS });
    res.status(201).json({ roomId: room.id, maxParticipants: MAX_ROOM_PARTICIPANTS });
  } catch {
    deleteRoom(room.id);
    res.status(502).json({ error: "No se pudo configurar la sala en LiveKit" });
  }
});

app.get("/rooms/:roomId", (req: Request, res: Response) => {
  const { roomId } = req.params;

  if (!roomId || !isValidRoomId(roomId)) {
    res.status(400).json({ exists: false, error: "ID de sala inválido" });
    return;
  }

  const room = getRoom(roomId);
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
  if (!getRoom(roomId)) {
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
  });
});

function canControlRecording(req: Request, roomId: string): boolean {
  const authorization = req.header("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined;
  return verifyRecordingControlToken(token, roomId);
}

function validateRecordingRequest(req: Request, res: Response): string | null {
  const roomId = req.params.roomId;
  if (!roomId || !isValidRoomId(roomId) || !getRoom(roomId)) {
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

app.get("/rooms/:roomId/recording", rateLimit(30, 60 * 1000), (req: Request, res: Response) => {
  const roomId = validateRecordingRequest(req, res);
  if (!roomId) return;
  res.json(getRecordingStatus(roomId));
});

app.post("/rooms/:roomId/recording/start", rateLimit(10, 60 * 1000), async (req: Request, res: Response) => {
  const roomId = validateRecordingRequest(req, res);
  if (!roomId) return;
  try {
    res.status(201).json(await startRecording(roomId));
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "No se pudo iniciar la grabación" });
  }
});

app.post("/rooms/:roomId/recording/stop", rateLimit(10, 60 * 1000), async (req: Request, res: Response) => {
  const roomId = validateRecordingRequest(req, res);
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
