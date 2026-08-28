import type { ConnectionState } from "@pvc/shared";
import { Fragment } from "react";
import { AudioPlayback } from "../components/AudioPlayback";
import { CallChat } from "../components/CallChat";
import { ConnectionStatusBadge } from "../components/ConnectionStatusBadge";
import { ParticipantTile } from "../components/ParticipantTile";
import { Icon } from "../components/Icon";
import { CollaborativeBoard } from "../components/CollaborativeBoard";
import type { MediaDeviceOption } from "../hooks/useLocalMedia";
import type { BoardItem, ChatMessage, LiveKitParticipant, ParticipantConnectionState, RecordingStatus } from "../livekit/types";

interface VideoCallScreenProps {
  stream: MediaStream | null;
  participants: LiveKitParticipant[];
  connectionState: ConnectionState;
  localMediaStatus: string | null;
  micEnabled: boolean;
  camEnabled: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  audioInputs: MediaDeviceOption[];
  videoInputs: MediaDeviceOption[];
  selectedAudioInputId: string;
  selectedVideoInputId: string;
  onChangeDevice: (kind: "audioinput" | "videoinput", deviceId: string) => void;
  deviceError: string | null;
  screenShareStream: MediaStream | null;
  screenShareError: string | null;
  onToggleScreenShare: () => void;
  recordingStatus: RecordingStatus | null;
  recordingError: string | null;
  onToggleRecording: () => void;
  chatMessages: ChatMessage[];
  chatError: string | null;
  onSendChatMessage: (text: string) => Promise<void>;
  boardItems: BoardItem[];
  onAddBoardItem: (type: BoardItem["type"], content: string) => Promise<void>;
  onMoveBoardItem: (id: string, x: number, y: number) => Promise<void>;
  onUploadBoardImage: (file: File) => Promise<void>;
  onEnd: () => void;
}

type RemoteTile = {
  participant: LiveKitParticipant;
  kind: "camera" | "screen";
};

function toParticipantConnectionState(state: ConnectionState): ParticipantConnectionState {
  if (state === "RECONNECTING") return "reconnecting";
  if (state === "DISCONNECTED") return "disconnected";
  return "connected";
}

/** Pantalla de llamada con un grid que se adapta a 1–10 participantes. */
export function VideoCallScreen({
  stream,
  participants,
  connectionState,
  localMediaStatus,
  micEnabled,
  camEnabled,
  onToggleMic,
  onToggleCam,
  audioInputs,
  videoInputs,
  selectedAudioInputId,
  selectedVideoInputId,
  onChangeDevice,
  deviceError,
  screenShareStream,
  screenShareError,
  onToggleScreenShare,
  recordingStatus,
  recordingError,
  onToggleRecording,
  chatMessages,
  chatError,
  onSendChatMessage,
  boardItems, onAddBoardItem, onMoveBoardItem, onUploadBoardImage,
  onEnd,
}: VideoCallScreenProps) {
  const localConnectionState = toParticipantConnectionState(connectionState);
  const remoteTileLimit = 10 - (screenShareStream ? 2 : 1);
  const remoteTiles: RemoteTile[] = participants
    .flatMap((participant) => {
      const tiles: RemoteTile[] = [{ participant, kind: "camera" }];
      if (participant.screenShareStream) tiles.push({ participant, kind: "screen" });
      return tiles;
    })
    .slice(0, remoteTileLimit);
  const participantCount = 1 + (screenShareStream ? 1 : 0) + remoteTiles.length;

  return (
    <div className="screen call-screen">
      <div className="call-screen__topbar">
        <div className="call-brand"><Icon name="video" size={17} /> Sala privada</div>
        <ConnectionStatusBadge state={connectionState} />
        {localMediaStatus && <span role="status">{localMediaStatus}</span>}
      </div>

      <div className="call-screen__content">
        <div className="call-main">
      <div className="call-stage">
        <div className="call-audio" aria-hidden="true">
          {participants.map((participant) => (
            <AudioPlayback key={participant.identity} stream={participant.isAudioMuted ? null : participant.audioStream} />
          ))}
        </div>
        <div className={`call-grid call-grid--${participantCount}`}>
          <ParticipantTile
            stream={stream}
            name="Vos"
            isLocal
            isVideoMuted={!camEnabled}
            isAudioMuted={!micEnabled}
            connectionState={localConnectionState}
          />
          {screenShareStream && (
            <ParticipantTile
              stream={screenShareStream}
              name="Tu pantalla"
              isLocal
              mirrored={false}
              mediaLabel="Pantalla"
              isVideoMuted={false}
              isAudioMuted={!micEnabled}
              connectionState={localConnectionState}
            />
          )}
          {remoteTiles.map(({ participant, kind }) => (
            <Fragment key={`${participant.identity}-${kind}`}>
              <ParticipantTile
                stream={kind === "camera" ? participant.videoStream : participant.screenShareStream}
                videoAttachment={kind === "camera" ? participant.videoAttachment : participant.screenShareAttachment}
                name={kind === "camera" ? participant.name || "Invitado" : `${participant.name || "Invitado"} — pantalla`}
                isLocal={false}
                mirrored={kind === "camera"}
                mediaLabel={kind === "screen" ? "Pantalla" : undefined}
                isVideoMuted={kind === "camera" ? participant.isVideoMuted : participant.isScreenShareMuted}
                isAudioMuted={participant.isAudioMuted}
                connectionState={participant.connectionState}
              />
            </Fragment>
          ))}
        </div>
      </div>

      <CollaborativeBoard items={boardItems} onAdd={onAddBoardItem} onMove={onMoveBoardItem} onUpload={onUploadBoardImage} />

      <div className="call-controls">
        <button
          type="button"
          className={`icon-btn${micEnabled ? "" : " icon-btn--off"}`}
          aria-pressed={!micEnabled}
          aria-label={micEnabled ? "Silenciar micrófono" : "Activar micrófono"}
          onClick={onToggleMic}
        >
          <Icon name={micEnabled ? "mic" : "mic-off"} />
        </button>

        {recordingStatus && (
          <button
            type="button"
            className={`icon-btn${recordingStatus.status === "active" ? " icon-btn--danger" : ""}`}
            aria-label={recordingStatus.status === "active" ? "Detener grabación" : "Iniciar grabación"}
            onClick={onToggleRecording}
            disabled={recordingStatus.status === "starting" || recordingStatus.status === "stopping"}
          >
            <Icon name={recordingStatus.status === "active" ? "stop" : "record"} />
          </button>
        )}

        <button
          type="button"
          className={`icon-btn${screenShareStream ? " icon-btn--active" : ""}`}
          aria-pressed={Boolean(screenShareStream)}
          aria-label={screenShareStream ? "Dejar de compartir pantalla" : "Compartir pantalla"}
          onClick={onToggleScreenShare}
        >
          <Icon name="screen" />
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

        <button type="button" className="icon-btn icon-btn--danger" aria-label="Finalizar llamada" onClick={onEnd}>
          <Icon name="phone-off" />
        </button>
      </div>

      <div className="device-controls" aria-label="Dispositivos de llamada">
        <label>
          Micrófono
          <select
            value={selectedAudioInputId}
            onChange={(event) => onChangeDevice("audioinput", event.target.value)}
            disabled={audioInputs.length < 2}
          >
            {audioInputs.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cámara
          <select
            value={selectedVideoInputId}
            onChange={(event) => onChangeDevice("videoinput", event.target.value)}
            disabled={videoInputs.length < 2}
          >
            {videoInputs.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {deviceError && <p className="device-controls__error" role="alert">{deviceError}</p>}
      {screenShareError && <p className="device-controls__error" role="alert">{screenShareError}</p>}
      {recordingStatus && <p className="recording-status" role="status">Grabación: {recordingStatus.status}</p>}
      {recordingError && <p className="device-controls__error" role="alert">{recordingError}</p>}
        </div>
        <CallChat messages={chatMessages} error={chatError} onSend={onSendChatMessage} />
      </div>
    </div>
  );
}
