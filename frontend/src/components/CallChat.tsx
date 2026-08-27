import { useState, type FormEvent } from "react";
import type { ChatMessage } from "../livekit/types";
import { Icon } from "./Icon";

interface CallChatProps {
  messages: ChatMessage[];
  error: string | null;
  onSend: (text: string) => Promise<void>;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

/** Historial efímero de mensajes de la sala, transportados por LiveKit Data Packets. */
export function CallChat({ messages, error, onSend }: CallChatProps) {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim() || isSending) return;
    setIsSending(true);
    await onSend(draft);
    setDraft("");
    setIsSending(false);
  };

  return (
    <aside className="call-chat" aria-label="Chat de la llamada">
      <h2>Chat</h2>
      <div className="call-chat__messages" aria-live="polite">
        {messages.length === 0 ? (
          <p className="call-chat__empty">Todavía no hay mensajes.</p>
        ) : (
          messages.map((message) =>
            message.type === "system" ? (
              <p className="call-chat__system" key={message.id}>{message.text}</p>
            ) : (
              <article className={`call-chat__message${message.senderName === "Vos" ? " call-chat__message--own" : ""}`} key={message.id}>
                <span>{message.senderName}</span>
                <p>{message.text}</p>
                <time dateTime={new Date(message.timestamp).toISOString()}>{formatTime(message.timestamp)}</time>
              </article>
            ),
          )
        )}
      </div>
      <form className="call-chat__form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="sr-only" htmlFor="chat-message">Mensaje</label>
        <input
          id="chat-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={1000}
          placeholder="Escribí un mensaje"
          disabled={isSending}
        />
        <button type="submit" className="btn btn--primary btn--send" disabled={!draft.trim() || isSending} aria-label="Enviar mensaje">
          <Icon name="send" size={18} />
          <span>Enviar</span>
        </button>
      </form>
      {error && <p className="call-chat__error" role="alert">{error}</p>}
    </aside>
  );
}
