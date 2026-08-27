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

export interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

export interface UseLocalMediaResult {
  status: LocalMediaStatus;
  stream: MediaStream | null;
  error: LocalMediaError | null;
  micEnabled: boolean;
  camEnabled: boolean;
  audioInputs: MediaDeviceOption[];
  videoInputs: MediaDeviceOption[];
  selectedAudioInputId: string;
  selectedVideoInputId: string;
  request: () => Promise<MediaStreamTrack[]>;
  restoreAfterBackground: () => Promise<MediaStreamTrack[]>;
  release: () => void;
  toggleMic: () => void;
  toggleCam: () => void;
  setMicEnabled: (enabled: boolean) => void;
  setCamEnabled: (enabled: boolean) => void;
  changeDevice: (kind: "audioinput" | "videoinput", deviceId: string) => Promise<MediaStreamTrack | null>;
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
  const [micEnabled, setMicEnabledState] = useState(true);
  const [camEnabled, setCamEnabledState] = useState(true);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceOption[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceOption[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState("");
  const [selectedVideoInputId, setSelectedVideoInputId] = useState("");
  const streamRef = useRef<MediaStream | null>(null);

  const stopCurrentStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const release = useCallback(() => {
    stopCurrentStream();
    setStream(null);
    setMicEnabledState(false);
    setCamEnabledState(false);
    setStatus("idle");
    setError(null);
  }, [stopCurrentStream]);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const toOption = (device: MediaDeviceInfo, index: number): MediaDeviceOption => ({
      deviceId: device.deviceId,
      label: device.label || `${device.kind === "audioinput" ? "Micrófono" : "Cámara"} ${index + 1}`,
    });
    setAudioInputs(devices.filter((device) => device.kind === "audioinput").map(toOption));
    setVideoInputs(devices.filter((device) => device.kind === "videoinput").map(toOption));
  }, []);

  const request = useCallback(async (): Promise<MediaStreamTrack[]> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError({
        type: "unsupported",
        message: "Este navegador no soporta acceso a cámara y micrófono.",
      });
      return [];
    }

    stopCurrentStream();
    setStatus("requesting");
    setError(null);

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: selectedVideoInputId ? { deviceId: { exact: selectedVideoInputId } } : true,
        audio: selectedAudioInputId ? { deviceId: { exact: selectedAudioInputId } } : true,
      });
      streamRef.current = nextStream;
      setStream(nextStream);
      setSelectedAudioInputId(nextStream.getAudioTracks()[0]?.getSettings().deviceId ?? "");
      setSelectedVideoInputId(nextStream.getVideoTracks()[0]?.getSettings().deviceId ?? "");
      await refreshDevices();
      setMicEnabledState(true);
      setCamEnabledState(true);
      setStatus("ready");
      return nextStream.getTracks();
    } catch (err) {
      setStream(null);
      setStatus("error");
      setError(mapError(err));
      return [];
    }
  }, [refreshDevices, selectedAudioInputId, selectedVideoInputId, stopCurrentStream]);

  /**
   * Algunos SO móviles finalizan los tracks al poner el navegador en segundo
   * plano. Al volver, se capturan tracks nuevos dentro del mismo MediaStream:
   * así la vista local no fuerza una reconexión de LiveKit y el llamador puede
   * reemplazar las publicaciones existentes.
   */
  const restoreAfterBackground = useCallback(async (): Promise<MediaStreamTrack[]> => {
    const currentStream = streamRef.current;
    if (!currentStream || !navigator.mediaDevices?.getUserMedia) return request();

    try {
      const replacementStream = await navigator.mediaDevices.getUserMedia({
        video: selectedVideoInputId ? { deviceId: { exact: selectedVideoInputId } } : true,
        audio: selectedAudioInputId ? { deviceId: { exact: selectedAudioInputId } } : true,
      });
      const replacements = replacementStream.getTracks();
      for (const replacement of replacements) {
        const enabled = replacement.kind === "audio" ? micEnabled : camEnabled;
        replacement.enabled = enabled;
        currentStream.getTracks().filter((track) => track.kind === replacement.kind).forEach((track) => {
          currentStream.removeTrack(track);
          track.stop();
        });
        currentStream.addTrack(replacement);
      }
      setSelectedAudioInputId(replacementStream.getAudioTracks()[0]?.getSettings().deviceId ?? selectedAudioInputId);
      setSelectedVideoInputId(replacementStream.getVideoTracks()[0]?.getSettings().deviceId ?? selectedVideoInputId);
      await refreshDevices();
      setError(null);
      setStatus("ready");
      return replacements;
    } catch (err) {
      setError(mapError(err));
      return [];
    }
  }, [camEnabled, micEnabled, refreshDevices, request, selectedAudioInputId, selectedVideoInputId]);

  useEffect(() => {
    return () => {
      stopCurrentStream();
    };
  }, [stopCurrentStream]);

  useEffect(() => {
    const onDeviceChange = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
  }, [refreshDevices]);

  const setMicEnabled = useCallback((enabled: boolean) => {
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
    setMicEnabledState(enabled);
  }, []);

  const setCamEnabled = useCallback((enabled: boolean) => {
    streamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
    setCamEnabledState(enabled);
  }, []);

  const toggleMic = useCallback(() => setMicEnabled(!micEnabled), [micEnabled, setMicEnabled]);

  const toggleCam = useCallback(() => setCamEnabled(!camEnabled), [camEnabled, setCamEnabled]);

  const changeDevice = useCallback(
    async (kind: "audioinput" | "videoinput", deviceId: string): Promise<MediaStreamTrack | null> => {
      const currentStream = streamRef.current;
      if (!currentStream || !navigator.mediaDevices?.getUserMedia) return null;

      const mediaKind = kind === "audioinput" ? "audio" : "video";
      const wasEnabled = mediaKind === "audio" ? micEnabled : camEnabled;

      try {
        const replacementStream = await navigator.mediaDevices.getUserMedia({
          audio: kind === "audioinput" ? { deviceId: { exact: deviceId } } : false,
          video: kind === "videoinput" ? { deviceId: { exact: deviceId } } : false,
        });
        const replacementTrack = replacementStream.getTracks()[0];
        if (!replacementTrack) throw new Error("No se pudo abrir el dispositivo seleccionado.");

        replacementTrack.enabled = wasEnabled;
        currentStream.getTracks().filter((track) => track.kind === mediaKind).forEach((track) => {
          currentStream.removeTrack(track);
          track.stop();
        });
        currentStream.addTrack(replacementTrack);

        if (kind === "audioinput") setSelectedAudioInputId(deviceId);
        else setSelectedVideoInputId(deviceId);
        setError(null);
        return replacementTrack;
      } catch (err) {
        setError(mapError(err));
        return null;
      }
    },
    [camEnabled, micEnabled],
  );

  return {
    status,
    stream,
    error,
    micEnabled,
    camEnabled,
    audioInputs,
    videoInputs,
    selectedAudioInputId,
    selectedVideoInputId,
    request,
    restoreAfterBackground,
    release,
    toggleMic,
    toggleCam,
    setMicEnabled,
    setCamEnabled,
    changeDevice,
  };
}
