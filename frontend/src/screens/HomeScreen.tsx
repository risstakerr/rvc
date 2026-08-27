import type { LocalMediaStatus } from "../hooks/useLocalMedia";
import { VideoPreview } from "../components/VideoPreview";
import { Icon } from "../components/Icon";

interface HomeScreenProps {
  mediaStatus: LocalMediaStatus;
  stream: MediaStream | null;
  micEnabled: boolean;
  camEnabled: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onCreateRoom: () => void;
  onRequestMedia: () => void;
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
  onRequestMedia,
  isCreatingRoom,
  createRoomError,
}: HomeScreenProps) {
  const isReady = mediaStatus === "ready";

  return (
    <div className="screen screen--center">
      <div className="brand-mark" aria-hidden="true"><Icon name="video" size={28} /></div>
      <div className="home-hero">
        <p className="eyebrow">Conexiones privadas</p>
        <h1 className="home-hero__title">Tu sala, en un solo enlace.</h1>
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
            <span className="call-stage__placeholder">
              {mediaStatus === "idle" ? "Cámara y micrófono inactivos" : "Solicitando acceso a tu cámara…"}
            </span>
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
              <Icon name={micEnabled ? "mic" : "mic-off"} />
            </button>
            <button
              type="button"
              className={`icon-btn${camEnabled ? "" : " icon-btn--off"}`}
              aria-pressed={!camEnabled}
              aria-label={camEnabled ? "Apagar cámara" : "Encender cámara"}
              onClick={onToggleCam}
            >
              <Icon name={camEnabled ? "camera" : "camera-off"} />
            </button>
          </div>
        )}
      </div>

      {mediaStatus === "idle" ? (
        <button type="button" className="btn btn--primary btn--lg" onClick={onRequestMedia}>
          Activar cámara y micrófono
        </button>
      ) : (
        <button
          type="button"
          className="btn btn--primary btn--lg"
          onClick={onCreateRoom}
          disabled={!isReady || isCreatingRoom}
        >
          {!isReady ? "Preparando cámara…" : isCreatingRoom ? "Creando sala…" : "Crear llamada"}
        </button>
      )}

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
