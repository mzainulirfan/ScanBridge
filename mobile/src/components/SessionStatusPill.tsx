type SessionStatusPillProps = {
  state: string;
};

function SessionStatusPill({ state }: SessionStatusPillProps) {
  const normalizedState = state.toLowerCase();
  const active = normalizedState === "connected to relay" || normalizedState === "desktop ready";
  return <div className={active ? "status active" : "status"}>{active ? "[x]" : "[ ]"} {state}</div>;
}

export default SessionStatusPill;
