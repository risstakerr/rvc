import { useState } from "react";

interface RoomShareScreenProps {
  roomUrl: string;
  onEnterCall: () => void;
}

/**
 * Sala creada. Muestra el enlace único (Fase 3) para compartir con
 * una sola persona. El input queda de solo lectura y se selecciona
 * al enfocar, como respaldo manual (Ctrl+C) si `navigator.clipboard`
 * no está disponible (contexto no seguro, navegador viejo, etc.).
 */
export function RoomShareScreen({ roomUrl, onEnterCall }: RoomShareScreenProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin Clipboard API disponible: el input de abajo sigue siendo
      // seleccionable y copiable a mano.
    }
  }

  return (
    <div className="screen screen--center">
      <h2 className="camera-error__title">Sala creada</h2>
      <p className="home-hint">Compartí este enlace con la persona con la que querés hablar.</p>

      <div className="room-link">
        <input
          type="text"
          className="room-link__input"
          readOnly
          value={roomUrl}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Enlace de la sala"
        />
        <button type="button" className="btn btn--ghost" onClick={handleCopy}>
          {copied ? "Copiado ✓" : "Copiar enlace"}
        </button>
      </div>

      <button type="button" className="btn btn--primary btn--lg" onClick={onEnterCall}>
        Entrar a la llamada
      </button>
    </div>
  );
}
