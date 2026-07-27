type SessionStatusPillProps = {
  state: string;
};

function SessionStatusPill({ state }: SessionStatusPillProps) {
  return <div className="status">{state}</div>;
}

export default SessionStatusPill;
