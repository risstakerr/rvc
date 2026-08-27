import { useEffect, useRef, useState } from "react";
import type {
  ClientSignalMessage,
  ConnectionState,
  IceCandidatePayload,
  ServerSignalMessage,
  SessionDescriptionPayload,
} from "@pvc/shared";
import { WS_BASE_URL } from "../config/env";
import { ICE_SERVERS } from "../webrtc/ice-servers";

export type CallConnectionError = "room-full" | "room-not-found" | "webrtc-failed";

interface UseCallConnectionResult {
  connectionState: ConnectionState;
  remoteStream: MediaStream | null;
  error: CallConnectionError | null;
}

/**
 * Conecta al signaling WebSocket de la Fase 5 y establece la
 * conexión WebRTC P2P real (Fase 6) entre los dos navegadores de una
 * sala.
 *
 * Reglas de quién ofrece y quién responde (para no pisarse ni dejar
 * a los dos esperando):
 * - El participante que se une y el servidor le confirma
 *   `peerPresent: true` (o sea, ya había alguien esperando) es quien
 *   crea la oferta.
 * - El participante que estaba esperando (`peerPresent: false`) nunca
 *   inicia: al recibir `peer-joined` solo actualiza el estado visual
 *   y espera la oferta entrante.
 *
 * No implementa todavía reconexión automática tras una caída de red
 * (eso es la Fase 10): una desconexión del WebSocket o del
 * RTCPeerConnection se refleja en `connectionState` pero no reintenta
 * sola.
 */
export function useCallConnection(
  roomId: string | null,
  localStream: MediaStream | null,
): UseCallConnectionResult {
  const [connectionState, setConnectionState] = useState<ConnectionState>("IDLE");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<CallConnectionError | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    setError(null);

    if (!roomId || !localStream) {
      setConnectionState("IDLE");
      return;
    }

    // Alias en un `const`: `localStream` es un parámetro (podría en
    // teoría reasignarse), así que TypeScript no deja que su chequeo
    // de null de arriba se propague a las funciones anidadas más
    // abajo. Con un `const` sí lo hace.
    const stream = localStream;
    let cancelled = false;
    const pendingCandidates: IceCandidatePayload[] = [];

    setConnectionState("CONNECTING");
    setRemoteStream(null);

    const socket = new WebSocket(`${WS_BASE_URL}/ws`);

    function send(message: ClientSignalMessage): void {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    }

    function ensurePeerConnection(): RTCPeerConnection {
      const existing = pcRef.current;
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        send({
          type: "ice-candidate",
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
        });
      };

      pc.ontrack = (event) => {
        if (cancelled) return;
        setRemoteStream(event.streams[0] ?? null);
      };

      pc.onconnectionstatechange = () => {
        if (cancelled) return;
        if (pc.connectionState === "connected") {
          setConnectionState("CONNECTED");
        } else if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          setConnectionState("DISCONNECTED");
        }
      };

      return pc;
    }

    async function flushPendingCandidates(pc: RTCPeerConnection): Promise<void> {
      const queued = pendingCandidates.splice(0, pendingCandidates.length);
      for (const candidate of queued) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // Candidato tardío/inválido: no es fatal para el resto de la llamada.
        }
      }
    }

    async function startAsOfferer(): Promise<void> {
      const pc = ensurePeerConnection();
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({ type: "offer", sdp: { type: offer.type, sdp: offer.sdp ?? "" } });
      } catch {
        if (!cancelled) setError("webrtc-failed");
      }
    }

    async function handleOffer(sdp: SessionDescriptionPayload): Promise<void> {
      const pc = ensurePeerConnection();
      try {
        await pc.setRemoteDescription({ type: sdp.type as RTCSdpType, sdp: sdp.sdp });
        await flushPendingCandidates(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ type: "answer", sdp: { type: answer.type, sdp: answer.sdp ?? "" } });
      } catch {
        if (!cancelled) setError("webrtc-failed");
      }
    }

    async function handleAnswer(sdp: SessionDescriptionPayload): Promise<void> {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription({ type: sdp.type as RTCSdpType, sdp: sdp.sdp });
        await flushPendingCandidates(pc);
      } catch {
        if (!cancelled) setError("webrtc-failed");
      }
    }

    async function handleIceCandidate(candidate: IceCandidatePayload): Promise<void> {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        pendingCandidates.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // ver nota en flushPendingCandidates
      }
    }

    socket.addEventListener("open", () => {
      if (cancelled) return;
      send({ type: "join", roomId });
    });

    socket.addEventListener("message", (event: MessageEvent<string>) => {
      if (cancelled) return;

      let message: ServerSignalMessage;
      try {
        message = JSON.parse(event.data) as ServerSignalMessage;
      } catch {
        return;
      }

      switch (message.type) {
        case "joined":
          if (message.peerPresent) {
            setConnectionState("CONNECTING");
            void startAsOfferer();
          } else {
            setConnectionState("WAITING_FOR_PEER");
          }
          return;
        case "peer-joined":
          setConnectionState("CONNECTING");
          return;
        case "peer-left":
          setRemoteStream(null);
          setConnectionState("DISCONNECTED");
          pcRef.current?.close();
          pcRef.current = null;
          pendingCandidates.length = 0;
          return;
        case "room-full":
          setError("room-full");
          return;
        case "room-not-found":
          setError("room-not-found");
          return;
        case "offer":
          void handleOffer(message.sdp);
          return;
        case "answer":
          void handleAnswer(message.sdp);
          return;
        case "ice-candidate":
          void handleIceCandidate(message.candidate);
          return;
        case "error":
          return;
      }
    });

    socket.addEventListener("close", () => {
      if (cancelled) return;
      setConnectionState((current) => (current === "IDLE" ? current : "DISCONNECTED"));
    });

    return () => {
      cancelled = true;
      socket.close();
      pcRef.current?.close();
      pcRef.current = null;
    };
    // `localStream` cambia de referencia solo cuando se pide un stream
    // nuevo de verdad (ver useLocalMedia); togglear mic/cam no crea un
    // stream nuevo, así que no reabre la conexión innecesariamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, localStream]);

  return { connectionState, remoteStream, error };
}
