type SessionStatusPillProps = {
  state: string;
};

function SessionStatusPill({ state }: SessionStatusPillProps) {
  const normalizedState = state.toLowerCase();
  const active = normalizedState === "desktop siap";
  const error = /offline|terputus|tidak|gagal|belum aktif/.test(normalizedState);
  return (
    <div className="status" data-state={active ? "active" : error ? "error" : "idle"} role="status" aria-live="polite">
      <span className="status-dot" aria-hidden="true" />{active ? "Desktop siap" : state}
    </div>
  );
}

export default SessionStatusPill;
