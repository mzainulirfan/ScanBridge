type ConnectPanelProps = {
  sessionId: string;
  onSessionChange: (value: string) => void;
  onConnect: () => void;
};

function ConnectPanel({ sessionId, onSessionChange, onConnect }: ConnectPanelProps) {
  return (
    <section className="panel">
      <label className="label">Session</label>
      <input value={sessionId} onChange={(event) => onSessionChange(event.target.value)} />
      <button className="primary" onClick={onConnect} type="button">
        Connect
      </button>
    </section>
  );
}

export default ConnectPanel;
