import "dotenv/config";

/**
 * Carga y valida las variables de entorno del backend.
 * Se mantiene deliberadamente simple en la Fase 1: solo lo
 * indispensable para levantar el servidor HTTP base.
 */

interface Env {
  PORT: number;
  NODE_ENV: "development" | "production" | "test";
  CORS_ORIGINS: readonly string[];
  TRUST_PROXY: boolean;
  LIVEKIT_URL: string | undefined;
  LIVEKIT_API_KEY: string | undefined;
  LIVEKIT_API_SECRET: string | undefined;
  LIVEKIT_TOKEN_TTL_SECONDS: number;
  RECORDING_ENABLED: boolean;
  RECORDING_CONTROL_SECRET: string | undefined;
  RECORDING_S3_ACCESS_KEY: string | undefined;
  RECORDING_S3_SECRET: string | undefined;
  RECORDING_S3_BUCKET: string | undefined;
  RECORDING_S3_REGION: string | undefined;
  RECORDING_S3_ENDPOINT: string | undefined;
}

function parsePort(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new Error(`PORT inválido en variables de entorno: "${raw}"`);
  }
  return parsed;
}

function parseNodeEnv(raw: string | undefined): Env["NODE_ENV"] {
  if (!raw || raw === "development") return "development";
  if (raw === "production" || raw === "test") return raw;
  throw new Error('NODE_ENV debe ser "development", "production" o "test".');
}

function parseBoolean(raw: string | undefined, name: string): boolean {
  if (!raw || raw === "false") return false;
  if (raw === "true") return true;
  throw new Error(`${name} debe ser "true" o "false".`);
}

function parsePositiveInteger(raw: string | undefined, fallback: number, name: string): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} debe ser un entero positivo.`);
  return parsed;
}

function parseCorsOrigins(raw: string | undefined): readonly string[] {
  const origins = (raw ?? "http://localhost:5173").split(",").map((origin) => origin.trim()).filter(Boolean);
  if (origins.length === 0 || origins.some((origin) => origin === "*")) {
    throw new Error("CORS_ORIGIN debe contener orígenes explícitos; '*' no está permitido.");
  }
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (url.origin !== origin || !["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      throw new Error(`CORS_ORIGIN contiene un origen inválido: "${origin}".`);
    }
  }
  return origins;
}

function parseLiveKitUrl(raw: string | undefined, nodeEnv: Env["NODE_ENV"]): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!["ws:", "wss:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    if (nodeEnv === "production" && url.protocol !== "wss:") throw new Error();
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error("LIVEKIT_URL debe ser una URL ws:// o wss:// válida; en producción debe usar wss://.");
  }
}

const nodeEnv = parseNodeEnv(process.env["NODE_ENV"]);

export const env: Env = {
  PORT: parsePort(process.env["PORT"], 8787),
  NODE_ENV: nodeEnv,
  CORS_ORIGINS: parseCorsOrigins(process.env["CORS_ORIGIN"]),
  TRUST_PROXY: parseBoolean(process.env["TRUST_PROXY"], "TRUST_PROXY"),
  LIVEKIT_URL: parseLiveKitUrl(process.env["LIVEKIT_URL"], nodeEnv),
  LIVEKIT_API_KEY: process.env["LIVEKIT_API_KEY"],
  LIVEKIT_API_SECRET: process.env["LIVEKIT_API_SECRET"],
  LIVEKIT_TOKEN_TTL_SECONDS: parsePositiveInteger(process.env["LIVEKIT_TOKEN_TTL_SECONDS"], 15 * 60, "LIVEKIT_TOKEN_TTL_SECONDS"),
  RECORDING_ENABLED: parseBoolean(process.env["RECORDING_ENABLED"], "RECORDING_ENABLED"),
  RECORDING_CONTROL_SECRET: process.env["RECORDING_CONTROL_SECRET"],
  RECORDING_S3_ACCESS_KEY: process.env["RECORDING_S3_ACCESS_KEY"],
  RECORDING_S3_SECRET: process.env["RECORDING_S3_SECRET"],
  RECORDING_S3_BUCKET: process.env["RECORDING_S3_BUCKET"],
  RECORDING_S3_REGION: process.env["RECORDING_S3_REGION"],
  RECORDING_S3_ENDPOINT: process.env["RECORDING_S3_ENDPOINT"],
};

if (env.NODE_ENV === "production") {
  if (env.CORS_ORIGINS.some((origin) => new URL(origin).protocol !== "https:")) {
    throw new Error("CORS_ORIGIN debe usar únicamente https:// en producción.");
  }
  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    throw new Error("LIVEKIT_URL, LIVEKIT_API_KEY y LIVEKIT_API_SECRET son obligatorios en producción.");
  }
}
