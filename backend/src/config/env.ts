/**
 * Carga y valida las variables de entorno del backend.
 * Se mantiene deliberadamente simple en la Fase 1: solo lo
 * indispensable para levantar el servidor HTTP base.
 */

interface Env {
  PORT: number;
  NODE_ENV: "development" | "production" | "test";
  CORS_ORIGIN: string;
}

function parsePort(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`PORT inválido en variables de entorno: "${raw}"`);
  }
  return parsed;
}

function parseNodeEnv(raw: string | undefined): Env["NODE_ENV"] {
  if (raw === "production" || raw === "test") return raw;
  return "development";
}

export const env: Env = {
  PORT: parsePort(process.env["PORT"], 8787),
  NODE_ENV: parseNodeEnv(process.env["NODE_ENV"]),
  CORS_ORIGIN: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
};
