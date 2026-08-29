import { useCallback, useEffect, useRef, useState } from "react";
import { isValidRoomId } from "@pvc/shared";
import { API_BASE_URL } from "./config/env";
import type { View } from "./types/view";
import { useLocalMedia } from "./hooks/useLocalMedia";
import { useLiveKitConnection } from "./hooks/useLiveKitConnection";
import { checkRoomExists, createRoom } from "./api/rooms";
import { buildCallUrl, navigateHome, navigateToCall, parseRoomIdFromPath } from "./lib/router";
import { HomeScreen } from "./screens/HomeScreen";
import { RoomShareScreen } from "./screens/RoomShareScreen";
import { CheckingRoomScreen } from "./screens/CheckingRoomScreen";
import { RoomNotFoundScreen } from "./screens/RoomNotFoundScreen";
import { RoomFullScreen } from "./screens/RoomFullScreen";
import { VideoCallScreen } from "./screens/VideoCallScreen";
import { CameraErrorScreen } from "./screens/CameraErrorScreen";

type BackendStatus = "checking" | "online" | "reconnecting" | "offline";

function App() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [view, setView] = useState<View>("home");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [createRoomError, setCreateRoomError] = useState<string | null>(null);
  const media = useLocalMedia();

  // LiveKit solo se conecta mientras la vista activa es "call": ni
  // antes (en "room-share",
  // esperando a que el usuario elija "Entrar") ni después de salir.
  // Pasar `null` cuando no corresponde hace que el hook limpie la
  // conexión anterior solo, por el cambio de dependencia.
  const activeCallRoomId = view === "call" ? roomId : null;
  const liveKit = useLiveKitConnection(activeCallRoomId, media.stream);

  const connectionState = (() => {
    switch (liveKit.state) {
      case "connecting":
        return "CONNECTING" as const;
      case "connected":
      case "reconnected":
        return "CONNECTED" as const;
      case "reconnecting":
        return "RECONNECTING" as const;
      case "disconnected":
      case "failed":
      case "unsupported":
        return "DISCONNECTED" as const;
      case "idle":
        return "IDLE" as const;
    }
  })();

  const localMediaStatus =
    liveKit.publishedTrackKinds.includes("audio") && liveKit.publishedTrackKinds.includes("video")
      ? "Cámara y micrófono publicados"
      : liveKit.error?.message ?? null;

  // Recuerda en qué pantalla estábamos antes de un error de cámara,
  // para volver ahí (y no siempre a Home) cuando el permiso se recupera.
  const preErrorViewRef = useRef<View>("home");

  // Render puede tardar unos segundos al reiniciar o despertar una instancia.
  // No mostramos un falso "sin conexión" por un único fallo transitorio y
  // seguimos intentando recuperar el servicio si realmente estuvo caído.
  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    let attempts = 0;

    const checkBackend = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await response.json();
        if (!cancelled) setBackendStatus("online");
      } catch {
        if (cancelled) return;
        attempts += 1;
        setBackendStatus(attempts >= 3 ? "offline" : "reconnecting");
        retryTimer = window.setTimeout(checkBackend, Math.min(15_000, attempts * 3_000));
      }
    };

    void checkBackend();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => {
    if (liveKit.errorCode === "ROOM_FULL") {
      setView("room-full");
    }
  }, [liveKit.errorCode]);

  // Al volver de otra app, Android/iOS pueden haber suspendido o terminado
  // getUserMedia. Se recuperan tracks nuevos y se sustituyen en LiveKit sin
  // salir de la sala. Mientras la app sigue en segundo plano, el navegador o
  // sistema operativo conserva la última palabra sobre la captura.
  useEffect(() => {
    let wasHidden = false;
    let recovering = false;
    let disposed = false;

    const restoreMedia = async () => {
      if (recovering || view !== "call") return;
      recovering = true;
      try {
        const tracks = await media.restoreAfterBackground();
        if (disposed) {
          tracks.forEach((track) => track.stop());
          return;
        }
        await Promise.all(
          tracks.map((track) => {
            if (track.kind !== "audio" && track.kind !== "video") return Promise.resolve();
            return liveKit.replaceTrack(track.kind, track);
          }),
        );
      } finally {
        recovering = false;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        wasHidden = true;
      } else if (wasHidden) {
        wasHidden = false;
        void restoreMedia();
      }
    };
    const onPageShow = () => void restoreMedia();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [liveKit.replaceTrack, media.restoreAfterBackground, view]);

  // Pedir cámara/mic apenas entra a la app, tanto si viene a crear
  // una sala como si abrió un enlace /call/:roomId compartido.
  useEffect(() => {
    void media.request();
    // Solo al montar: `media.request` es estable (useCallback con una
    // única dependencia también estable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si el permiso falla en cualquier momento, mostrar la pantalla de
  // error. Si se recupera después de un reintento, volver a la
  // pantalla en la que el usuario estaba antes del error.
  useEffect(() => {
    if (media.status === "error") {
      setView((current) => {
        if (current !== "camera-error") preErrorViewRef.current = current;
        return "camera-error";
      });
    } else if (media.status === "ready" && view === "camera-error") {
      setView(preErrorViewRef.current);
    }
  }, [media.status, view]);

  // Al montar: si la URL ya apunta a /call/:roomId (alguien abrió un
  // enlace compartido), saltear Home y validar la sala contra el
  // backend en vez de ofrecer "Crear llamada".
  useEffect(() => {
    const idFromPath = parseRoomIdFromPath(window.location.pathname);
    if (!idFromPath) return;

    if (!isValidRoomId(idFromPath)) {
      setView("room-not-found");
      return;
    }

    setRoomId(idFromPath);
    setView("checking-room");

    let cancelled = false;
    checkRoomExists(idFromPath)
      .then((exists) => {
        if (cancelled) return;
        setView(exists ? "call" : "room-not-found");
      })
      .catch(() => {
        if (!cancelled) setView("room-not-found");
      });

    return () => {
      cancelled = true;
    };
    // Solo al montar: la validación de la sala de la URL ocurre una
    // única vez al cargar la app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateRoom = useCallback(async () => {
    setIsCreatingRoom(true);
    setCreateRoomError(null);
    try {
      const result = await createRoom();
      setRoomId(result.roomId);
      navigateToCall(result.roomId);
      setView("room-share");
    } catch {
      setCreateRoomError("No pudimos crear la sala. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setIsCreatingRoom(false);
    }
  }, []);

  const handleReturnHome = useCallback(() => {
    navigateHome();
    setRoomId(null);
    setView("home");
  }, []);

  const handleEndCall = useCallback(() => {
    media.release();
    handleReturnHome();
  }, [handleReturnHome, media]);

  const handleToggleMic = useCallback(() => {
    const enabled = !media.micEnabled;
    media.setMicEnabled(enabled);
    void liveKit.setTrackEnabled("audio", enabled).catch(() => media.setMicEnabled(!enabled));
  }, [liveKit, media]);

  const handleToggleCam = useCallback(() => {
    const enabled = !media.camEnabled;
    media.setCamEnabled(enabled);
    void liveKit.setTrackEnabled("video", enabled).catch(() => media.setCamEnabled(!enabled));
  }, [liveKit, media]);

  const handleChangeDevice = useCallback(
    (kind: "audioinput" | "videoinput", deviceId: string) => {
      void (async () => {
        const replacementTrack = await media.changeDevice(kind, deviceId);
        if (!replacementTrack) return;
        await liveKit.replaceTrack(kind === "audioinput" ? "audio" : "video", replacementTrack);
      })();
    },
    [liveKit, media],
  );

  const handleToggleScreenShare = useCallback(() => {
    void liveKit.setScreenShareEnabled(!liveKit.screenShareStream);
  }, [liveKit]);

  return (
    <div className="app-shell">
      {backendStatus !== "online" && (
        <div className={`backend-banner backend-banner--${backendStatus}`} role="status">
          {backendStatus === "offline"
            ? "Sin conexión con el servidor. Reintentando automáticamente…"
            : "Conectando con el servidor…"}
        </div>
      )}

      {view === "home" && (
        <HomeScreen
          mediaStatus={media.status}
          stream={media.stream}
          micEnabled={media.micEnabled}
          camEnabled={media.camEnabled}
          onToggleMic={handleToggleMic}
          onToggleCam={handleToggleCam}
          onCreateRoom={() => void handleCreateRoom()}
          onRequestMedia={() => void media.request()}
          isCreatingRoom={isCreatingRoom}
          createRoomError={createRoomError}
        />
      )}

      {view === "room-share" && roomId && (
        <RoomShareScreen roomUrl={buildCallUrl(roomId)} onEnterCall={() => setView("call")} />
      )}

      {view === "checking-room" && <CheckingRoomScreen />}

      {view === "room-not-found" && <RoomNotFoundScreen onCreateNew={handleReturnHome} />}

      {view === "room-full" && <RoomFullScreen onCreateNew={handleReturnHome} />}

      {view === "call" && (
        <VideoCallScreen
          stream={media.stream}
          participants={liveKit.participants}
          connectionState={connectionState}
          localMediaStatus={localMediaStatus}
          micEnabled={media.micEnabled}
          camEnabled={media.camEnabled}
          onToggleMic={handleToggleMic}
          onToggleCam={handleToggleCam}
          audioInputs={media.audioInputs}
          videoInputs={media.videoInputs}
          selectedAudioInputId={media.selectedAudioInputId}
          selectedVideoInputId={media.selectedVideoInputId}
          onChangeDevice={handleChangeDevice}
          deviceError={media.error?.message ?? null}
          screenShareStream={liveKit.screenShareStream}
          screenShareError={liveKit.screenShareError}
          onToggleScreenShare={handleToggleScreenShare}
          recordingStatus={liveKit.recordingStatus}
          recordingError={liveKit.recordingError}
          onToggleRecording={liveKit.toggleRecording}
          chatMessages={liveKit.chatMessages}
          chatError={liveKit.chatError}
          onSendChatMessage={liveKit.sendChatMessage}
          boardItems={liveKit.boardItems}
          onAddBoardItem={liveKit.addBoardItem}
          onMoveBoardItem={liveKit.moveBoardItem}
          onResizeBoardItem={liveKit.resizeBoardItem}
          onRemoveBoardItem={liveKit.removeBoardItem}
          onUploadBoardImage={liveKit.uploadBoardImage}
          boardVisible={liveKit.boardVisible}
          onOpenBoard={liveKit.openBoard}
          onHideBoard={liveKit.hideBoard}
          onEnd={handleEndCall}
        />
      )}

      {view === "camera-error" && (
        <CameraErrorScreen
          message={media.error?.message ?? "No pudimos acceder a tu cámara o micrófono."}
          onRetry={() => void media.request()}
        />
      )}
    </div>
  );
}

export default App;
