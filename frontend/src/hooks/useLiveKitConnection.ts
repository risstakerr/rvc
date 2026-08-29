import { useCallback, useEffect, useRef, useState } from "react";
import { LiveKitTokenError, requestLiveKitToken } from "../api/livekit";
import { getChatHistory, saveChatMessage as persistChatMessage } from "../api/chat";
import { deleteBoardItem as persistDeletedBoardItem, getBoardItems, saveBoardItem as persistBoardItem, uploadBoardImage } from "../api/board";
import {
  getRecordingStatus as requestRecordingStatus,
  startRecording as requestStartRecording,
  stopRecording as requestStopRecording,
} from "../api/recording";
import {
  bindLiveKitRemoteTracks,
  bindLiveKitChat,
  bindLiveKitBoard,
  connectLiveKitRoom,
  createLiveKitRoom,
  disconnectLiveKitRoom,
  getLiveKitRemoteParticipants,
  isLiveKitSupported,
  publishLiveKitTracks,
  publishLiveKitChat,
  publishLiveKitBoard,
  replaceLiveKitTrack,
  RoomEvent,
  setLiveKitScreenShareEnabled,
  setLiveKitTrackEnabled,
  unpublishLiveKitTracks,
} from "../livekit/livekit-client";
import type { BoardItem, ChatMessage, LiveKitConnectionState, LiveKitParticipant, LiveKitTokenErrorCode, RecordingStatus } from "../livekit/types";

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
  boardItems: BoardItem[];
  addBoardItem: (type: BoardItem["type"], content: string, position?: Pick<BoardItem, "x" | "y"> & Partial<Pick<BoardItem, "sourceId" | "targetId" | "targetX" | "targetY" | "width" | "height">>) => Promise<void>;
  moveBoardItem: (id: string, x: number, y: number) => Promise<void>;
  resizeBoardItem: (id: string, width: number, height: number) => Promise<void>;
  removeBoardItem: (id: string) => Promise<void>;
  uploadBoardImage: (file: File, position?: Pick<BoardItem, "x" | "y">) => Promise<void>;
  boardVisible: boolean;
  openBoard: () => Promise<void>;
  hideBoard: () => void;
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
  const [boardItems, setBoardItems] = useState<BoardItem[]>([]);
  const [boardVisible, setBoardVisible] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const roomRef = useRef<ReturnType<typeof createLiveKitRoom> | null>(null);
  const publishedTracksRef = useRef<MediaStreamTrack[]>([]);
  const recordingControlTokenRef = useRef<string | null>(null);
  const chatHistoryTokenRef = useRef<string | null>(null);
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
    const unbindBoard = bindLiveKitBoard(room, (event) => {
      if (event.action === "activate") {
        setBoardVisible(true);
        return;
      }
      setBoardVisible(true);
      setBoardItems((current) => event.action === "add"
        ? (current.some((item) => item.id === event.item.id) ? current : [...current, event.item])
        : event.action === "move"
          ? current.map((item) => item.id === event.item.id ? event.item : item)
          : current.filter((item) => item.id !== event.item.id));
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
        setBoardItems([]);
        setBoardVisible(false);
        setScreenShareStream(null);
        setScreenShareError(null);
        setRecordingStatus(null);
        setRecordingError(null);
        const credentials = await requestLiveKitToken(roomId, participantName);
        recordingControlTokenRef.current = credentials.recordingControlToken;
        chatHistoryTokenRef.current = credentials.chatHistoryToken;
        if (credentials.chatHistoryToken) {
          void getBoardItems(roomId, credentials.chatHistoryToken)
            .then((items) => { if (!disposed) { setBoardItems(items); setBoardVisible(items.length > 0); } })
            .catch(() => undefined);
          void getChatHistory(roomId, credentials.chatHistoryToken)
            .then((messages) => {
              if (!disposed) {
                setChatMessages((current) => [
                  ...messages,
                  ...current.filter((message) => !messages.some((historyMessage) => historyMessage.id === message.id)),
                ]);
              }
            })
            .catch(() => {
              if (!disposed) setChatError("No se pudo cargar el historial del chat.");
            });
        }
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
      chatHistoryTokenRef.current = null;
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      unbindRemoteTracks();
      unbindChat();
      unbindBoard();
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
    const localMessage: ChatMessage = {
      ...message,
      type: "message",
      senderIdentity: room.localParticipant.identity,
      senderName: "Vos",
    };
    setChatMessages((current) => [...current, localMessage]);
    try {
      const historyToken = chatHistoryTokenRef.current;
      if (historyToken && roomId) {
        await persistChatMessage(roomId, historyToken, message.id, message.text);
      }
      await publishLiveKitChat(room, message);
      setChatError(null);
    } catch {
      setChatMessages((current) => current.filter((item) => item.id !== message.id));
      setChatError("No se pudo enviar el mensaje. Intentá nuevamente.");
    }
  }, [roomId]);

  const addBoardItem = useCallback(async (type: BoardItem["type"], content: string, position?: Pick<BoardItem, "x" | "y"> & Partial<Pick<BoardItem, "sourceId" | "targetId" | "targetX" | "targetY" | "width" | "height">>) => {
    const room = roomRef.current;
    const value = content.trim();
    if (!room || !value) return;
    const item: BoardItem = {
      id: crypto.randomUUID(),
      type,
      content: value,
      x: position ? Math.max(0, Math.min(88, position.x)) : 12 + (Math.random() * 45),
      y: position ? Math.max(0, Math.min(84, position.y)) : 12 + (Math.random() * 40),
      ...(position?.width ? { width: position.width } : {}),
      ...(position?.height ? { height: position.height } : {}),
      ...(position?.targetId ? { targetId: position.targetId } : {}),
      ...(position?.sourceId ? { sourceId: position.sourceId } : {}),
      ...(typeof position?.targetX === "number" ? { targetX: position.targetX } : {}),
      ...(typeof position?.targetY === "number" ? { targetY: position.targetY } : {}),
    };
    setBoardVisible(true);
    if (roomId && chatHistoryTokenRef.current) await persistBoardItem(roomId, chatHistoryTokenRef.current, item);
    await publishLiveKitBoard(room, { action: "add", item });
    setBoardItems((current) => [...current, item]);
  }, []);

  const moveBoardItem = useCallback(async (id: string, x: number, y: number) => {
    const room = roomRef.current;
    const item = boardItems.find((candidate) => candidate.id === id);
    if (!room || !item) return;
    const moved = { ...item, x: Math.max(0, Math.min(88, x)), y: Math.max(0, Math.min(84, y)) };
    setBoardVisible(true);
    setBoardItems((current) => current.map((candidate) => candidate.id === id ? moved : candidate));
    if (roomId && chatHistoryTokenRef.current) await persistBoardItem(roomId, chatHistoryTokenRef.current, moved);
    await publishLiveKitBoard(room, { action: "move", item: moved });
  }, [boardItems]);

  const resizeBoardItem = useCallback(async (id: string, width: number, height: number) => {
    const room = roomRef.current;
    const item = boardItems.find((candidate) => candidate.id === id);
    if (!room || !item) return;
    const resized = { ...item, width, height };
    setBoardItems((current) => current.map((candidate) => candidate.id === id ? resized : candidate));
    if (roomId && chatHistoryTokenRef.current) await persistBoardItem(roomId, chatHistoryTokenRef.current, resized);
    await publishLiveKitBoard(room, { action: "move", item: resized });
  }, [boardItems]);

  const removeBoardItem = useCallback(async (id: string) => {
    const room = roomRef.current;
    const item = boardItems.find((candidate) => candidate.id === id);
    if (!room || !item) return;
    setBoardItems((current) => current.filter((candidate) => candidate.id !== id));
    try {
      if (roomId && chatHistoryTokenRef.current) await persistDeletedBoardItem(roomId, chatHistoryTokenRef.current, id);
      await publishLiveKitBoard(room, { action: "remove", item });
    } catch {
      setBoardItems((current) => current.some((candidate) => candidate.id === id) ? current : [...current, item]);
    }
  }, [boardItems]);

  const uploadBoardImageFile = useCallback(async (file: File, position?: Pick<BoardItem, "x" | "y">) => {
    if (!roomId || !chatHistoryTokenRef.current) throw new Error("El pizarrÃ³n todavÃ­a no estÃ¡ disponible.");
    const url = await uploadBoardImage(roomId, chatHistoryTokenRef.current, file);
    await addBoardItem(file.type.startsWith("video/") ? "video" : "image", url, position);
  }, [addBoardItem, roomId]);

  const openBoard = useCallback(async () => {
    const room = roomRef.current;
    setBoardVisible(true);
    if (room) await publishLiveKitBoard(room, { action: "activate" });
  }, []);

  const hideBoard = useCallback(() => setBoardVisible(false), []);

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
      boardItems: [],
      addBoardItem,
      moveBoardItem,
      resizeBoardItem,
      removeBoardItem,
      uploadBoardImage: uploadBoardImageFile,
      boardVisible: false,
      openBoard,
      hideBoard,
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
      boardItems: [],
      addBoardItem,
      moveBoardItem,
      resizeBoardItem,
      removeBoardItem,
      uploadBoardImage: uploadBoardImageFile,
      boardVisible: false,
      openBoard,
      hideBoard,
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
    boardItems,
    addBoardItem,
    moveBoardItem,
    resizeBoardItem,
    removeBoardItem,
    uploadBoardImage: uploadBoardImageFile,
    boardVisible,
    openBoard,
    hideBoard,
    setTrackEnabled,
    replaceTrack,
  };
}
