import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { EgressClient, EncodedFileOutput, EncodedFileType, S3Upload } from "livekit-server-sdk";
import { env } from "../config/env.js";

const CONTROL_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

export interface RecordingStatus {
  egressId: string | null;
  status: "idle" | "starting" | "active" | "stopping" | "failed";
  fileName: string | null;
  error: string | null;
}

const recordings = new Map<string, RecordingStatus>();

function getEgressClient(): EgressClient | null {
  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) return null;
  return new EgressClient(env.LIVEKIT_URL.replace(/^ws/, "http"), env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
}

function storageIsConfigured(): boolean {
  return Boolean(
    env.RECORDING_S3_ACCESS_KEY &&
      env.RECORDING_S3_SECRET &&
      env.RECORDING_S3_BUCKET &&
      env.RECORDING_S3_REGION,
  );
}

export function isRecordingAvailable(): boolean {
  return Boolean(env.RECORDING_ENABLED && env.RECORDING_CONTROL_SECRET && getEgressClient() && storageIsConfigured());
}

function sign(value: string): string {
  return createHmac("sha256", env.RECORDING_CONTROL_SECRET!).update(value).digest("base64url");
}

/** Credencial opaca, limitada a una sala e identidad, que nunca incluye secretos del servidor. */
export function createRecordingControlToken(roomId: string, participantIdentity: string): string | null {
  if (!env.RECORDING_ENABLED || !env.RECORDING_CONTROL_SECRET) return null;
  const payload = Buffer.from(JSON.stringify({ roomId, participantIdentity, expiresAt: Date.now() + CONTROL_TOKEN_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyRecordingControlToken(token: string | undefined, roomId: string): boolean {
  if (!token || !env.RECORDING_CONTROL_SECRET) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      roomId?: unknown;
      expiresAt?: unknown;
    };
    return parsed.roomId === roomId && typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export function getRecordingStatus(roomId: string): RecordingStatus {
  return recordings.get(roomId) ?? { egressId: null, status: "idle", fileName: null, error: null };
}

export async function startRecording(roomId: string): Promise<RecordingStatus> {
  const current = getRecordingStatus(roomId);
  if (current.status === "starting" || current.status === "active" || current.status === "stopping") {
    throw new Error("Ya hay una grabación en curso para esta sala.");
  }
  const client = getEgressClient();
  if (!isRecordingAvailable() || !client) throw new Error("La grabación no está configurada en este servidor.");

  const fileName = `recordings/${roomId}/${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.mp4`;
  recordings.set(roomId, { egressId: null, status: "starting", fileName, error: null });
  try {
    const egress = await client.startRoomCompositeEgress(
      roomId,
      new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath: fileName,
        output: {
          case: "s3",
          value: new S3Upload({
            accessKey: env.RECORDING_S3_ACCESS_KEY!,
            secret: env.RECORDING_S3_SECRET!,
            bucket: env.RECORDING_S3_BUCKET!,
            region: env.RECORDING_S3_REGION!,
            endpoint: env.RECORDING_S3_ENDPOINT ?? "",
            forcePathStyle: Boolean(env.RECORDING_S3_ENDPOINT),
          }),
        },
      }),
      { layout: "grid" },
    );
    const status: RecordingStatus = { egressId: egress.egressId, status: "active", fileName, error: null };
    recordings.set(roomId, status);
    return status;
  } catch {
    const status: RecordingStatus = { egressId: null, status: "failed", fileName, error: "No se pudo iniciar la grabación." };
    recordings.set(roomId, status);
    throw new Error("No se pudo iniciar la grabación.");
  }
}

export async function stopRecording(roomId: string): Promise<RecordingStatus> {
  const current = getRecordingStatus(roomId);
  if (!current.egressId || current.status !== "active") throw new Error("No hay una grabación activa para detener.");
  const client = getEgressClient();
  if (!client) throw new Error("La grabación no está configurada en este servidor.");
  recordings.set(roomId, { ...current, status: "stopping" });
  try {
    await client.stopEgress(current.egressId);
    const status: RecordingStatus = { ...current, status: "idle" };
    recordings.set(roomId, status);
    return status;
  } catch {
    const status: RecordingStatus = { ...current, status: "failed", error: "No se pudo detener la grabación." };
    recordings.set(roomId, status);
    throw new Error("No se pudo detener la grabación.");
  }
}
