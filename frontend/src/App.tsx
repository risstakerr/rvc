import { useCallback, useEffect, useRef, useState } from "react";
import { isValidRoomId } from "@pvc/shared";
import { API_BASE_URL } from "./config/env";
import type { View } from "./types/view";
import { useLocalMedia } from "./hooks/useLocalMedia";
import { useCallConnection } from "./hooks/useCallConnection";
import { checkRoomExists, createRoom } from "./api/rooms";
import { buildCallUrl, navigateHome, navigateToCall, parseRoomIdFromPath } from "./lib/router";
import { HomeScreen } from "./screens/HomeScreen";
import { RoomShareScreen } from "./screens/RoomShareScreen";
import { CheckingRoomScreen } from "./screens/CheckingRoomScreen";
import { RoomNotFoundScreen } from "./screens/RoomNotFoundScreen";
import { RoomFullScreen } from "./screens/RoomFullScreen";
import { VideoCallScreen } from "./screens/VideoCallScreen";
import { CameraErrorScreen } from "./screens/CameraErrorScreen";

type BackendStatus = "checking" | "online" | "offline";

function App() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [view, setView] = useState<View>("home");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [createRoomError, setCreateRoomError] = useState<string | null>(null);
  const media = useLocalMedia();

  // El signaling WebSocket + WebRTC (Fase 6) solo debe conectarse
  // mientras la vista activa es "call": ni antes (en "room-share",
  // esperando a que el usuario elija "Entrar") ni después de salir.
  // Pasar `null` cuando no corresponde hace que el hook limpie la
  // conexión anterior solo, por el cambio de dependencia.
  const activeCallRoomId = view === "call" ? roomId : null;
  const call = useCallConnection(activeCallRoomId, media.stream);

  // Recuerda en qué pantalla estábamos antes de un error de cámara,
  // para volver ahí (y no siempre a Home) cuando el permiso se recupera.
  const preErrorViewRef = useRef<View>("home");

  // Chequeo de salud del backend heredado de la Fase 1.
  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE_URL}/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(() => {
        if (!cancelled) setBackendStatus("online");
      })
      .catch(() => {
        if (!cancelled) setBackendStatus("offline");
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  // El WebSocket de signaling puede rechazar el join recién en ese
  // momento (la sala pudo llenarse o expirar entre el chequeo REST y
  // la conexión real). Reaccionar acá, no dentro del hook, porque
  // solo App.tsx controla las transiciones de vista.
  useEffect(() => {
    if (call.error === "room-full") {
      setView("room-full");
    } else if (call.error === "room-not-found") {
      setView("room-not-found");
    }
  }, [call.error]);

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

  return (
    <div className="app-shell">
      {backendStatus !== "online" && (
        <div className={`backend-banner backend-banner--${backendStatus}`} role="status">
          {backendStatus === "checking" ? "Conectando con el servidor…" : "Sin conexión con el servidor"}
        </div>
      )}

      {view === "home" && (
        <HomeScreen
          mediaStatus={media.status}
          stream={media.stream}
          micEnabled={media.micEnabled}
          camEnabled={media.camEnabled}
          onToggleMic={media.toggleMic}
          onToggleCam={media.toggleCam}
          onCreateRoom={() => void handleCreateRoom()}
          isCreatingRoom={isCreatingRoom}
          createRoomError={createRoomError}
        />
      )}

      {view === "room-share" && roomId && (
        <RoomShareScreen roomUrl={buildCallUrl(roomId)} onEnterCall={() => setView("call")} />
      )}

      {view === "checking-room" && <CheckingRoomScreen />}

      {view === "room-not-found" && <RoomNotFoundScreen onCreateNew={handleReturnHome} />}

      {view === "call" && (
        <VideoCallScreen
          stream={media.stream}
          remoteStream={call.remoteStream}
          connectionState={call.connectionState}
          micEnabled={media.micEnabled}
          camEnabled={media.camEnabled}
          onToggleMic={media.toggleMic}
          onToggleCam={media.toggleCam}
          onEnd={handleReturnHome}
        />
      )}

      {view === "room-full" && <RoomFullScreen onCreateNew={handleReturnHome} />}

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
