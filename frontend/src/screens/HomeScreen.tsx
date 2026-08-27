import type { LocalMediaStatus } from "../hooks/useLocalMedia";
import { VideoPreview } from "../components/VideoPreview";

interface HomeScreenProps {
  mediaStatus: LocalMediaStatus;
  stream: MediaStream | null;
  micEnabled: boolean;
  camEnabled: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onCreateRoom: () => void;
  isCreatingRoom: boolean;
  createRoomError: string | null;
}

/**
 * Pantalla inicial: "Crear una videollamada". Incluye la comprobación
 * real de cámara/mic: mientras `mediaStatus` no sea "ready" no se
 * puede crear la sala. Si falla, App.tsx cambia a la pantalla de
 * error — acá solo se muestra el estado de "solicitando acceso".
 *
 * Al pulsar "Crear llamada" se crea una sala real en el backend
 * (Fase 3) y App.tsx pasa a la pantalla de compartir enlace.
 */
export function HomeScreen({
  mediaStatus,
  stream,
  micEnabled,
  camEnabled,
  onToggleMic,
  onToggleCam,
  onCreateRoom,
  isCreatingRoom,
  createRoomError,
}: HomeScreenProps) {
  const isReady = mediaStatus === "ready";

  return (
    <div className="screen screen--center">
      <div className="home-hero">
        <h1 className="home-hero__title">Crear una videollamada</h1>
        <p className="home-hero__subtitle">
          Video llamadas 1 a 1, privadas, sin registro. Creá una sala y compartí el enlace.
        </p>
      </div>

      <div className="camera-check">
        <div className="camera-check__preview">
          {isReady ? (
            camEnabled ? (
              <VideoPreview stream={stream} className="camera-check__video" />
            ) : (
              <span className="call-stage__placeholder">Cámara apagada</span>
            )
          ) : (
            <span className="call-stage__placeholder">Solicitando acceso a tu cámara…</span>
          )}
        </div>

        {isReady && (
          <div className="camera-check__controls">
            <button
              type="button"
              className={`icon-btn${micEnabled ? "" : " icon-btn--off"}`}
              aria-pressed={!micEnabled}
              aria-label={micEnabled ? "Silenciar micrófono" : "Activar micrófono"}
              onClick={onToggleMic}
            >
              {micEnabled ? "🎙️" : "🔇"}
            </button>
            <button
              type="button"
              className={`icon-btn${camEnabled ? "" : " icon-btn--off"}`}
              aria-pressed={!camEnabled}
              aria-label={camEnabled ? "Apagar cámara" : "Encender cámara"}
              onClick={onToggleCam}
            >
              {camEnabled ? "📷" : "🚫"}
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn btn--primary btn--lg"
        onClick={onCreateRoom}
        disabled={!isReady || isCreatingRoom}
      >
        {!isReady ? "Preparando cámara…" : isCreatingRoom ? "Creando sala…" : "Crear llamada"}
      </button>

      {createRoomError ? (
        <p className="home-hint home-hint--error" role="alert">
          {createRoomError}
        </p>
      ) : (
        <p className="home-hint">
          {isReady
            ? "Vas a obtener un enlace único para compartir con una sola persona."
            : "Vas a necesitar permitir el acceso a tu cámara y micrófono."}
        </p>
      )}
    </div>
  );
}
