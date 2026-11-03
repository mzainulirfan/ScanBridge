import { useEffect, useRef, type ReactNode } from "react";
import Icon from "./Icon";

export default function Modal({ title, eyebrow, id, onClose, children }: {
  title: string; eyebrow: string; id: string; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return (
    <dialog ref={ref} className="modal" aria-labelledby={id} onClose={event => {
      // Strict Mode can queue a close event before immediately reopening the dialog.
      if (!event.currentTarget.open) onClose();
    }} onClick={event => {
      if (event.target === event.currentTarget) event.currentTarget.close();
    }}>
      <div className="modal-content">
        <div className="modal-heading"><div><p className="eyebrow">{eyebrow}</p><h2 id={id}>{title}</h2></div><button className="icon-button" onClick={() => ref.current?.close()} aria-label="Tutup panel" type="button"><Icon name="close" /></button></div>
        {children}
      </div>
    </dialog>
  );
}
