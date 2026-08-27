import { createServer } from "node:http";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { isValidRoomId } from "@pvc/shared";
import { env } from "./config/env.js";
import { createRoom, getRoom, pruneExpiredRooms } from "./rooms/room-store.js";
import { attachSignalingServer } from "./signaling/socket-server.js";

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", uptimeSeconds: process.uptime() });
});

app.post("/rooms", (_req: Request, res: Response) => {
  const room = createRoom();
  res.status(201).json({ roomId: room.id });
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

// Barrido de salas expiradas cada 10 minutos, para no acumular
// memoria con salas creadas y nunca usadas.
setInterval(pruneExpiredRooms, 10 * 60 * 1000).unref();

// El signaling WebSocket (Fase 5) comparte el mismo servidor HTTP y
// puerto que la API REST, en vez de levantar un segundo puerto: un
// solo proceso, más simple de desplegar en un free tier.
const server = createServer(app);
attachSignalingServer(server);

server.listen(env.PORT, () => {
  console.log(`[backend] escuchando en http://localhost:${env.PORT} (HTTP + WS /ws)`);
});
