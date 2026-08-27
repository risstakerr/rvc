import type { ConnectionState } from "@pvc/shared";
import { ConnectionStatusBadge } from "../components/ConnectionStatusBadge";
import { VideoPreview } from "../components/VideoPreview";

interface VideoCallScreenProps {
  stream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: ConnectionState;
  micEnabled: boolean;
  camEnabled: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onEnd: () => void;
}

const REMOTE_PLACEHOLDER_TEXT: Partial<Record<ConnectionState, string>> = {
  IDLE: "Preparando la llamada…",
  WAITING_FOR_PEER: "Esperando a la otra persona…",
  CONNECTING: "Conectando…",
  RECONNECTING: "Reconectando…",
  DISCONNECTED: "La otra persona se desconectó.",
};

/**
 * Pantalla de videollamada. Layout de cámaras lado a lado (local |
 * remota), no picture-in-picture — así lo pide el diseño del
 * producto (inspirado visualmente en Omegle, pero sin sus conceptos
 * de matchmaking). No hay botón "Siguiente": esto es una videollamada
 * privada 1 a 1, no hay a quién "saltar".
 *
 * El preview local usa el stream real (obtenido en Home). El video
 * remoto (Fase 6) ahora es la conexión WebRTC P2P real: mientras no
 * llega ningún track remoto se muestra un placeholder según el
 * estado de `connectionState`; apenas `ontrack` entrega el
 * MediaStream del otro participante, se reemplaza por video real. El
 * rediseño visual definitivo de esta pantalla es la Fase 7; acá solo
 * se conecta el dato real. El chat lateral se agrega en la Fase 8.
 */
export function VideoCallScreen({
  stream,
  remoteStream,
  connectionState,
  micEnabled,
  camEnabled,
  onToggleMic,
  onToggleCam,
  onEnd,
}: VideoCallScreenProps) {
  return (
    <div className="screen call-screen">
      <div className="call-screen__topbar">
        <ConnectionStatusBadge state={connectionState} />
      </div>

      <div className="call-stage">
        <div className="call-stage__pane" aria-label="Tu video">
          {camEnabled ? (
            <VideoPreview stream={stream} className="call-stage__video" />
          ) : (
            <span className="call-stage__placeholder">Cámara apagada</span>
          )}
          <span className="call-stage__pane-label">Vos</span>
        </div>

        <div className="call-stage__pane" aria-label="Video de la otra persona">
          {remoteStream ? (
            <VideoPreview
              stream={remoteStream}
              mirrored={false}
              muted={false}
              className="call-stage__video"
            />
          ) : (
            <span className="call-stage__placeholder">
              {REMOTE_PLACEHOLDER_TEXT[connectionState] ?? "Esperando a la otra persona…"}
            </span>
          )}
          <span className="call-stage__pane-label">Invitado</span>
        </div>
      </div>

      <div className="call-controls">
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

        <button type="button" className="icon-btn icon-btn--danger" aria-label="Finalizar llamada" onClick={onEnd}>
          ✕
        </button>
      </div>
    </div>
  );
}
