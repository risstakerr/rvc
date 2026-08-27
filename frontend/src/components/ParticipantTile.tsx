import { VideoPreview } from "./VideoPreview";
import type { ParticipantConnectionState } from "../livekit/types";
import { Icon } from "./Icon";

interface ParticipantTileProps {
  stream: MediaStream | null;
  name: string;
  isLocal: boolean;
  isVideoMuted: boolean;
  isAudioMuted: boolean;
  connectionState: ParticipantConnectionState;
  mirrored?: boolean;
  mediaLabel?: string;
}

const CONNECTION_LABEL: Record<ParticipantConnectionState, string> = {
  connected: "Conectado",
  reconnecting: "Reconectando",
  disconnected: "Desconectado",
};

/** Tile reutilizable para un participante local o remoto de la llamada. */
export function ParticipantTile({
  stream,
  name,
  isLocal,
  isVideoMuted,
  isAudioMuted,
  connectionState,
  mirrored = isLocal,
  mediaLabel,
}: ParticipantTileProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const hasVideo = Boolean(stream && !isVideoMuted);

  return (
    <article className="participant-tile" aria-label={`${name}, ${CONNECTION_LABEL[connectionState]}`}>
      {hasVideo ? (
        <VideoPreview stream={stream} mirrored={mirrored} muted className="participant-tile__video" />
      ) : (
        <div className="participant-tile__avatar" aria-label="Cámara apagada">
          {initial}
        </div>
      )}

      <div className="participant-tile__meta">
        <span className="participant-tile__name">{isLocal ? `${name} (vos)` : name}</span>
        {mediaLabel && <span className="participant-tile__media-label">{mediaLabel}</span>}
        <span className="participant-tile__audio" aria-label={isAudioMuted ? "Micrófono silenciado" : "Micrófono activo"}>
          <Icon name={isAudioMuted ? "mic-off" : "mic"} size={14} />
        </span>
      </div>
      <span className={`participant-tile__connection participant-tile__connection--${connectionState}`}>
        {CONNECTION_LABEL[connectionState]}
      </span>
    </article>
  );
}
