type HomePanelProps = {
  pairingCode: string;
  onPairingCodeChange: (value: string) => void;
  onConnect: () => void;
};

function HomePanel({ pairingCode, onPairingCodeChange, onConnect }: HomePanelProps) {
  return (
    <section className="panel">
      <label className="label" htmlFor="pairing-code">
        Pairing Code
      </label>
      <input
        id="pairing-code"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="one-time-code"
        placeholder="123 456"
        value={pairingCode}
        onChange={(event) => onPairingCodeChange(event.target.value)}
      />
      <button className="primary" onClick={onConnect} type="button">
        Connect
      </button>
    </section>
  );
}

export default HomePanel;
