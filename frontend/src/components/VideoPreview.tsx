import { useEffect, useRef } from "react";
import type { LiveKitVideoAttachment } from "../livekit/types";

interface VideoPreviewProps {
  stream: MediaStream | null;
  mirrored?: boolean;
  muted?: boolean;
  className?: string;
  attachment?: LiveKitVideoAttachment | null;
}

/**
 * Enlaza un MediaStream real a un <video>.
 *
 * `muted` por defecto es `true` porque el uso original de este
 * componente es el preview de la propia cámara (evita el eco del
 * propio audio). El video remoto (Fase 6) pasa `muted={false}` para
 * escuchar al otro participante.
 *
 * `mirrored` refleja horizontalmente, como espera la mayoría de la
 * gente al verse a sí misma en una cámara frontal; el video remoto no
 * debe espejarse.
 */
export function VideoPreview({ stream, mirrored = true, muted = true, className, attachment = null }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (attachment) {
      attachment.attach(video);
      return () => attachment.detach(video);
    }
    video.srcObject = stream;
    return () => {
      video.srcObject = null;
    };
  }, [attachment, stream]);

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay
      playsInline
      muted={muted}
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
    />
  );
}
