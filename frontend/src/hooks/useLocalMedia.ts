import { useCallback, useEffect, useRef, useState } from "react";

export type LocalMediaStatus = "idle" | "requesting" | "ready" | "error";

export type LocalMediaErrorType =
  | "permission-denied"
  | "not-found"
  | "in-use"
  | "unsupported"
  | "unknown";

export interface LocalMediaError {
  type: LocalMediaErrorType;
  message: string;
}

interface UseLocalMediaResult {
  status: LocalMediaStatus;
  stream: MediaStream | null;
  error: LocalMediaError | null;
  micEnabled: boolean;
  camEnabled: boolean;
  request: () => Promise<void>;
  toggleMic: () => void;
  toggleCam: () => void;
}

/**
 * Traduce los errores de getUserMedia (nombres estándar del spec de
 * MediaDevices) a categorías propias de la app, para poder mostrar un
 * mensaje útil en la pantalla de error en vez de un mensaje genérico.
 */
function mapError(err: unknown): LocalMediaError {
  if (!(err instanceof Error)) {
    return { type: "unknown", message: "No pudimos acceder a la cámara o al micrófono." };
  }

  switch (err.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return {
        type: "permission-denied",
        message: "Denegaste el acceso a la cámara o al micrófono.",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return {
        type: "not-found",
        message: "No encontramos una cámara o un micrófono conectados.",
      };
    case "NotReadableError":
    case "TrackStartError":
      return {
        type: "in-use",
        message: "La cámara o el micrófono ya están siendo usados por otra aplicación.",
      };
    case "OverconstrainedError":
      return {
        type: "not-found",
        message: "Ningún dispositivo disponible cumple los requisitos necesarios.",
      };
    default:
      return {
        type: "unknown",
        message: err.message || "No pudimos acceder a la cámara o al micrófono.",
      };
  }
}

/**
 * Pide (y administra) el stream local de cámara/micrófono.
 *
 * - `request()` dispara (o reintenta) el permiso.
 * - `toggleMic`/`toggleCam` alternan `track.enabled` sobre el stream
 *   real (no un mock): apagar la cámara detiene el envío de video sin
 *   soltar el dispositivo, que es el comportamiento esperado antes de
 *   tener a alguien del otro lado (Fase 6+).
 * - Libera todos los tracks al desmontar o al pedir un nuevo stream,
 *   para no dejar la cámara "prendida" de fondo.
 */
export function useLocalMedia(): UseLocalMediaResult {
  const [status, setStatus] = useState<LocalMediaStatus>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<LocalMediaError | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCurrentStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const request = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError({
        type: "unsupported",
        message: "Este navegador no soporta acceso a cámara y micrófono.",
      });
      return;
    }

    stopCurrentStream();
    setStatus("requesting");
    setError(null);

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = nextStream;
      setStream(nextStream);
      setMicEnabled(true);
      setCamEnabled(true);
      setStatus("ready");
    } catch (err) {
      setStream(null);
      setStatus("error");
      setError(mapError(err));
    }
  }, [stopCurrentStream]);

  useEffect(() => {
    return () => {
      stopCurrentStream();
    };
  }, [stopCurrentStream]);

  const toggleMic = useCallback(() => {
    setMicEnabled((prev) => {
      const next = !prev;
      streamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = next;
      });
      return next;
    });
  }, []);

  const toggleCam = useCallback(() => {
    setCamEnabled((prev) => {
      const next = !prev;
      streamRef.current?.getVideoTracks().forEach((track) => {
        track.enabled = next;
      });
      return next;
    });
  }, []);

  return { status, stream, error, micEnabled, camEnabled, request, toggleMic, toggleCam };
}
