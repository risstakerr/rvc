import { useRef, useState } from "react";
import type { BoardItem } from "../livekit/types";

interface Props {
  items: BoardItem[];
  onAdd: (type: BoardItem["type"], content: string) => Promise<void>;
  onMove: (id: string, x: number, y: number) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
}

export function CollaborativeBoard({ items, onAdd, onMove, onUpload }: Props) {
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const moveRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const add = async (type: "text" | "link") => {
    const value = (type === "text" ? text : link).trim();
    if (!value) return;
    if (type === "link") try { new URL(value); } catch { setError("Ingresá un enlace completo y válido."); return; }
    await onAdd(type, value);
    type === "text" ? setText("") : setLink("");
    setError(null);
  };
  const startDrag = (event: React.PointerEvent, item: BoardItem) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    moveRef.current = { id: item.id, offsetX: event.clientX - rect.left - (item.x / 100) * rect.width, offsetY: event.clientY - rect.top - (item.y / 100) * rect.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const finishDrag = (event: React.PointerEvent) => {
    const moving = moveRef.current; const rect = boardRef.current?.getBoundingClientRect();
    if (!moving || !rect) return;
    moveRef.current = null;
    void onMove(moving.id, ((event.clientX - rect.left - moving.offsetX) / rect.width) * 100, ((event.clientY - rect.top - moving.offsetY) / rect.height) * 100);
  };
  return <section className="board" aria-label="Pizarrón colaborativo">
    <header className="board__toolbar">
      <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Nota" maxLength={500} />
      <button type="button" className="btn btn--ghost" onClick={() => void add("text")}>Agregar texto</button>
      <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https:// enlace" />
      <button type="button" className="btn btn--ghost" onClick={() => void add("link")}>Agregar enlace</button>
      <label className="btn btn--primary">Subir imagen<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload(file).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo subir la imagen.")); event.currentTarget.value = ""; }} /></label>
    </header>
    {error && <p className="board__error">{error}</p>}
    <div ref={boardRef} className="board__canvas" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void onUpload(file).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo subir la imagen.")); }}>
      {items.length === 0 && <p className="board__empty">Arrastrá una imagen, escribí una nota o pegá un enlace para empezar el plan.</p>}
      {items.map((item) => <article key={item.id} className={`board-card board-card--${item.type}`} style={{ left: `${item.x}%`, top: `${item.y}%` }} onPointerDown={(event) => startDrag(event, item)} onPointerUp={finishDrag}>
        {item.type === "image" ? <img src={item.content} alt="Imagen del pizarrón" draggable={false} /> : item.type === "link" ? <a href={item.content} target="_blank" rel="noreferrer"><strong>{new URL(item.content).hostname}</strong><span>{item.content}</span></a> : <p>{item.content}</p>}
      </article>)}
    </div>
  </section>;
}
