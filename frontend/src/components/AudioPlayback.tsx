import { useEffect, useRef } from "react";

interface AudioPlaybackProps {
  stream: MediaStream | null;
}

/** Reproduce un stream remoto en un elemento de audio dedicado y sin video. */
export function AudioPlayback({ stream }: AudioPlaybackProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.srcObject = stream;
    if (stream) void audio.play().catch(() => undefined);

    return () => {
      audio.pause();
      audio.srcObject = null;
    };
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline />;
}
