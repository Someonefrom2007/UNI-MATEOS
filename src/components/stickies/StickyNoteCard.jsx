import { useState } from "react";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { COLOR_KEYS, STICKY_BG, STICKY_DOT } from "./stickyColors";

export default function StickyNoteCard({ note, onSave, onColor, onTogglePin, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.content);

  const commit = () => {
    const t = text.trim();
    if (t && t !== note.content) onSave(note, t);
    setEditing(false);
  };

  return (
    <div
      className={`mb-4 break-inside-avoid rounded-lg p-4 pt-3 shadow-lg shadow-black/20 ${STICKY_BG[note.color] || STICKY_BG.amber}`}
      style={{ transform: `rotate(${note.rotation || 0}deg)` }}
    >
      <div className="flex items-center justify-between mb-1.5 opacity-50 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1.5">
          {COLOR_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => onColor(note, k)}
              title={`${k} sticky`}
              className={`w-3 h-3 rounded-full transition-transform hover:scale-125 ${STICKY_DOT[k]} ${note.color === k ? "ring-1 ring-black/40" : ""}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onTogglePin(note)} title={note.pinned ? "Unpin" : "Pin"} className="hover:opacity-100">
            {note.pinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => onDelete(note.id)} title="Throw away" className="hover:opacity-100">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {editing ? (
        <textarea
          autoFocus
          aria-label="Edit note"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setText(note.content); setEditing(false); }
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
          }}
          rows={Math.max(3, text.split("\n").length)}
          className="w-full bg-transparent resize-none outline-none font-sticky text-xl leading-snug"
        />
      ) : (
        <p
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(true); }
          }}
          title="Click to edit"
          className="font-sticky text-xl leading-snug whitespace-pre-wrap cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30 rounded"
        >
          {note.content}
        </p>
      )}
    </div>
  );
}