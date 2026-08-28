import { useCallback, useEffect, useRef, useState } from "react";
import { LiveKitTokenError, requestLiveKitToken } from "../api/livekit";
import {
  getRecordingStatus as requestRecordingStatus,
  startRecording as requestStartRecording,
  stopRecording as requestStopRecording,
} from "../api/recording";
import {
  bindLiveKitRemoteTracks,
  bindLiveKitChat,
  connectLiveKitRoom,
  createLiveKitRoom,
  disconnectLiveKitRoom,
  getLiveKitRemoteParticipants,
  isLiveKitSupported,
  publishLiveKitTracks,
  publishLiveKitChat,
  replaceLiveKitTrack,
  RoomEvent,
  setLiveKitScreenShareEnabled,
  setLiveKitTrackEnabled,
  unpublishLiveKitTracks,
} from "../livekit/livekit-client";
import type { ChatMessage, LiveKitConnectionState, LiveKitParticipant, LiveKitTokenErrorCode, RecordingStatus } from "../livekit/types";

interface UseLiveKitConnectionResult {
  state: LiveKitConnectionState;
  error: Error | null;
  errorCode: LiveKitTokenErrorCode;
  publishedTrackKinds: MediaStreamTrack["kind"][];
  participants: LiveKitParticipant[];
  screenShareStream: MediaStream | null;
  screenShareError: string | null;
  setScreenShareEnabled: (enabled: boolean) => Promise<void>;
  recordingStatus: RecordingStatus | null;
  recordingError: string | null;
  toggleRecording: () => Promise<void>;
  chatMessages: ChatMessage[];
  chatError: string | null;
  sendChatMessage: (text: string) => Promise<void>;
  setTrackEnabled: (kind: "audio" | "video", enabled: boolean) => Promise<void>;
  replaceTrack: (kind: "audio" | "video", track: MediaStreamTrack) => Promise<void>;
}

/** Conecta la Room y publica el stream local obtenido por useLocalMedia. */
export function useLiveKitConnection(
  roomId: string | null,
  localStream: MediaStream | null,
  participantName = "Invitado",
): UseLiveKitConnectionResult {
  const [state, setState] = useState<LiveKitConnectionState>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [errorCode, setErrorCode] = useState<LiveKitTokenErrorCode>(null);
  const [publishedTrackKinds, setPublishedTrackKinds] = useState<MediaStreamTrack["kind"][]>([]);
  const [participants, setParticipants] = useState<LiveKitParticipant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const roomRef = useRef<ReturnType<typeof createLiveKitRoom> | null>(null);
  const publishedTracksRef = useRef<MediaStreamTrack[]>([]);
  const recordingControlTokenRef = useRef<string | null>(null);
  const supported = isLiveKitSupported();

  useEffect(() => {
    if (!roomId) {
      return;
    }

    if (!supported) {
      return;
    }

    let disposed = false;
    let publishedTracks: MediaStreamTrack[] = [];
    const room = createLiveKitRoom();
    roomRef.current = room;
    const addSystemMessage = (text: string) => {
      setChatMessages((current) => [
        ...current,
        { id: `system-${crypto.randomUUID()}`, type: "system", senderIdentity: null, senderName: null, text, timestamp: Date.now() },
      ]);
    };
    const syncParticipants = () => {
      const remoteParticipants = getLiveKitRemoteParticipants(room);
      setParticipants((current) =>
        remoteParticipants.map((participant) => {
          const existing = current.find(({ identity }) => identity === participant.identity);
          return {
            ...participant,
            videoStream: existing?.videoStream ?? null,
            videoAttachment: existing?.videoAttachment ?? null,
            screenShareStream: existing?.screenShareStream ?? null,
            screenShareAttachment: existing?.screenShareAttachment ?? null,
            audioStream: existing?.audioStream ?? null,
            isVideoMuted: existing?.isVideoMuted ?? true,
            isScreenShareMuted: existing?.isScreenShareMuted ?? true,
            isAudioMuted: existing?.isAudioMuted ?? true,
            connectionState: "connected",
          };
        }),
      );
    };
    const unbindRemoteTracks = bindLiveKitRemoteTracks(room, {
      onParticipantConnected: (participant) => {
        addSystemMessage(`${participant.name || "Un participante"} se unió a la llamada.`);
        setParticipants((current) => {
          const existing = current.find(({ identity }) => identity === participant.identity);
          if (existing) {
            return current.map((item) => (item.identity === participant.identity ? { ...item, ...participant } : item));
          }
          return [
            ...current,
            {
              ...participant,
              videoStream: null,
              videoAttachment: null,
              screenShareStream: null,
              screenShareAttachment: null,
              audioStream: null,
              isVideoMuted: true,
              isScreenShareMuted: true,
              isAudioMuted: true,
              connectionState: "connected",
            },
          ];
        });
      },
      onTrackSubscribed: (track) => {
        setParticipants((current) => {
          const existing = current.find(({ identity }) => identity === track.participantIdentity);
          const participant: LiveKitParticipant = existing ?? {
            identity: track.participantIdentity,
            name: null,
            videoStream: null,
            videoAttachment: null,
            screenShareStream: null,
            screenShareAttachment: null,
            audioStream: null,
            isVideoMuted: true,
            isScreenShareMuted: true,
            isAudioMuted: true,
            connectionState: "connected",
          };
          const updated = {
            ...participant,
            videoStream: track.source === "camera" ? track.stream : participant.videoStream,
            videoAttachment: track.source === "camera" ? track.videoAttachment : participant.videoAttachment,
            screenShareStream: track.source === "screen_share" ? track.stream : participant.screenShareStream,
            screenShareAttachment: track.source === "screen_share" ? track.videoAttachment : participant.screenShareAttachment,
            audioStream: track.kind === "audio" ? track.stream : participant.audioStream,
            isVideoMuted: track.source === "camera" ? track.isMuted : participant.isVideoMuted,
            isScreenShareMuted: track.source === "screen_share" ? track.isMuted : participant.isScreenShareMuted,
            isAudioMuted: track.kind === "audio" ? track.isMuted : participant.isAudioMuted,
          };
          return existing
            ? current.map((item) => (item.identity === track.participantIdentity ? updated : item))
            : [...current, updated];
        });
      },
      onTrackUnsubscribed: (track) => {
        setParticipants((current) =>
          current.map((participant) =>
            participant.identity !== track.participantIdentity
              ? participant
              : {
                  ...participant,
                  videoStream: track.source === "camera" ? null : participant.videoStream,
                  videoAttachment: track.source === "camera" ? null : participant.videoAttachment,
                  screenShareStream: track.source === "screen_share" ? null : participant.screenShareStream,
                  screenShareAttachment: track.source === "screen_share" ? null : participant.screenShareAttachment,
                  audioStream: track.kind === "audio" ? null : participant.audioStream,
                  isVideoMuted: track.source === "camera" ? true : participant.isVideoMuted,
                  isScreenShareMuted: track.source === "screen_share" ? true : participant.isScreenShareMuted,
                  isAudioMuted: track.kind === "audio" ? true : participant.isAudioMuted,
                },
          ),
        );
      },
      onTrackMuted: (identity, kind, source) => {
        setParticipants((current) =>
          current.map((participant) =>
            participant.identity !== identity
              ? participant
              : {
                  ...participant,
                  isVideoMuted: source === "camera" ? true : participant.isVideoMuted,
                  isScreenShareMuted: source === "screen_share" ? true : participant.isScreenShareMuted,
                  isAudioMuted: kind === "audio" ? true : participant.isAudioMuted,
                },
          ),
        );
      },
      onTrackUnmuted: (identity, kind, source) => {
        setParticipants((current) =>
          current.map((participant) =>
            participant.identity !== identity
              ? participant
              : {
                  ...participant,
                  isVideoMuted: source === "camera" ? false : participant.isVideoMuted,
                  isScreenShareMuted: source === "screen_share" ? false : participant.isScreenShareMuted,
                  isAudioMuted: kind === "audio" ? false : participant.isAudioMuted,
                },
          ),
        );
      },
      onParticipantDisconnected: (identity) => {
        addSystemMessage("Un participante salió de la llamada.");
        setParticipants((current) => current.filter((participant) => participant.identity !== identity));
      },
    });
    const unbindChat = bindLiveKitChat(room, (message, participant) => {
      setChatMessages((current) => {
        if (current.some((item) => item.id === message.id)) return current;
        return [
          ...current,
          {
            ...message,
            type: "message",
            senderIdentity: participant.identity,
            senderName: participant.name || `Invitado ${participant.identity.slice(-4)}`,
            text: message.text.trim(),
          },
        ];
      });
    });
    const onReconnecting = () => {
      setParticipants((current) => current.map((participant) => ({ ...participant, connectionState: "reconnecting" })));
      setState("reconnecting");
    };
    const onReconnected = () => {
      syncParticipants();
      setState("reconnected");
    };
    const onDisconnected = () => {
      setParticipants((current) => current.map((participant) => ({ ...participant, connectionState: "disconnected" })));
      setState("disconnected");
    };

    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);

    void (async () => {
      try {
        setState("connecting");
        setError(null);
        setErrorCode(null);
        setPublishedTrackKinds([]);
        setParticipants([]);
        setChatMessages([]);
        setChatError(null);
        setScreenShareStream(null);
        setScreenShareError(null);
        setRecordingStatus(null);
        setRecordingError(null);
        const credentials = await requestLiveKitToken(roomId, participantName);
        recordingControlTokenRef.current = credentials.recordingControlToken;
        if (credentials.recordingControlToken) {
          void requestRecordingStatus(roomId, credentials.recordingControlToken)
            .then(setRecordingStatus)
            .catch(() => setRecordingStatus(null));
        }
        if (disposed) return;
        await connectLiveKitRoom(room, credentials.url, credentials.token);
        if (disposed) {
          await disconnectLiveKitRoom(room);
          return;
        }
        syncParticipants();
        addSystemMessage("Te uniste a la llamada.");
        if (!localStream) throw new Error("La cámara y el micrófono aún no están disponibles.");
        publishedTracks = await publishLiveKitTracks(room, localStream);
        publishedTracksRef.current = publishedTracks;
        if (disposed) {
          await unpublishLiveKitTracks(room, publishedTracksRef.current).catch(() => undefined);
          await disconnectLiveKitRoom(room);
          return;
        }
        setPublishedTrackKinds(publishedTracks.map((track) => track.kind));
        if (!disposed) setState("connected");
      } catch (reason) {
        if (disposed) return;
        setState("failed");
        setError(reason instanceof Error ? reason : new Error("No se pudo conectar a LiveKit."));
        setErrorCode(reason instanceof LiveKitTokenError ? reason.code : null);
      }
    })();

    return () => {
      disposed = true;
      if (roomRef.current === room) roomRef.current = null;
      recordingControlTokenRef.current = null;
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      unbindRemoteTracks();
      unbindChat();
      void (async () => {
        await unpublishLiveKitTracks(room, publishedTracksRef.current).catch(() => undefined);
        publishedTracksRef.current = [];
        await disconnectLiveKitRoom(room).catch(() => undefined);
      })();
    };
  }, [roomId, localStream, participantName, supported]);

  const setTrackEnabled = useCallback(async (kind: "audio" | "video", enabled: boolean) => {
    const room = roomRef.current;
    if (!room) return;
    await setLiveKitTrackEnabled(room, kind, enabled);
  }, []);

  const replaceTrack = useCallback(async (kind: "audio" | "video", track: MediaStreamTrack) => {
    const room = roomRef.current;
    if (!room) return;
    await replaceLiveKitTrack(room, kind, track);
    publishedTracksRef.current = publishedTracksRef.current.map((publishedTrack) =>
      publishedTrack.kind === kind ? track : publishedTrack,
    );
  }, []);

  const setScreenShareEnabled = useCallback(async (enabled: boolean) => {
    const room = roomRef.current;
    if (!room) {
      setScreenShareError("Todavía no estás conectado a la sala.");
      return;
    }
    try {
      const stream = await setLiveKitScreenShareEnabled(room, enabled);
      if (stream) {
        stream.getVideoTracks()[0]?.addEventListener("ended", () => setScreenShareStream(null), { once: true });
      }
      setScreenShareStream(stream);
      setScreenShareError(null);
    } catch (reason) {
      if (enabled && reason instanceof Error && reason.name === "NotAllowedError") {
        setScreenShareError("Cancelaste la selección de pantalla.");
      } else {
        setScreenShareError("No se pudo compartir la pantalla en este dispositivo.");
      }
    }
  }, []);

  const toggleRecording = useCallback(async () => {
    const token = recordingControlTokenRef.current;
    if (!roomId || !token) {
      setRecordingError("La grabación no está habilitada en esta sala.");
      return;
    }
    try {
      const nextStatus = recordingStatus?.status === "active"
        ? await requestStopRecording(roomId, token)
        : await requestStartRecording(roomId, token);
      setRecordingStatus(nextStatus);
      setRecordingError(null);
    } catch (reason) {
      setRecordingError(reason instanceof Error ? reason.message : "No se pudo actualizar la grabación.");
    }
  }, [recordingStatus?.status, roomId]);

  const sendChatMessage = useCallback(async (text: string) => {
    const messageText = text.trim();
    if (!messageText) return;
    if (messageText.length > 1_000) {
      setChatError("El mensaje no puede superar los 1000 caracteres.");
      return;
    }
    const room = roomRef.current;
    if (!room) {
      setChatError("Todavía no estás conectado a la sala.");
      return;
    }
    const message = { id: crypto.randomUUID(), text: messageText, timestamp: Date.now() };
    try {
      await publishLiveKitChat(room, message);
      setChatMessages((current) => [
        ...current,
        { ...message, type: "message", senderIdentity: room.localParticipant.identity, senderName: "Vos" },
      ]);
      setChatError(null);
    } catch {
      setChatError("No se pudo enviar el mensaje. Intentá nuevamente.");
    }
  }, []);

  if (!roomId) {
    return {
      state: "idle",
      error: null,
      errorCode: null,
      publishedTrackKinds: [],
      participants: [],
      screenShareStream: null,
      screenShareError: null,
      setScreenShareEnabled,
      recordingStatus: null,
      recordingError: null,
      toggleRecording,
      chatMessages: [],
      chatError: null,
      sendChatMessage,
      setTrackEnabled,
      replaceTrack,
    };
  }
  if (!supported) {
    return {
      state: "unsupported",
      error: new Error("Este navegador no soporta LiveKit."),
      errorCode: null,
      publishedTrackKinds: [],
      participants: [],
      screenShareStream: null,
      screenShareError: "Este navegador no soporta compartir pantalla.",
      setScreenShareEnabled,
      recordingStatus: null,
      recordingError: "La grabación no está disponible en este navegador.",
      toggleRecording,
      chatMessages: [],
      chatError: "Este navegador no soporta LiveKit.",
      sendChatMessage,
      setTrackEnabled,
      replaceTrack,
    };
  }
  return {
    state,
    error,
    errorCode,
    publishedTrackKinds,
    participants,
    screenShareStream,
    screenShareError,
    setScreenShareEnabled,
    recordingStatus,
    recordingError,
    toggleRecording,
    chatMessages,
    chatError,
    sendChatMessage,
    setTrackEnabled,
    replaceTrack,
  };
}
