type SessionStatusPillProps = {
  state: string;
};

function SessionStatusPill({ state }: SessionStatusPillProps) {
  const normalizedState = state.toLowerCase();
  const active = normalizedState === "terhubung ke relay" || normalizedState === "desktop siap";
  return (
    <div className={active ? "status active" : "status"} role="status" aria-live="polite">
      {active ? "[x]" : "[ ]"} {state}
    </div>
  );
}

export default SessionStatusPill;
