const participants = [
  { initials: "C", name: "カナハ", role: "ホスト", time: "02:14:08", active: true },
  { initials: "D", name: "レク", role: "参加者", time: "01:42:36", active: true },
  { initials: "E", name: "シズト", role: "参加者", time: "00:56:12", active: false },
];

export default function ParticipantsPanel() {
  return (
    <div className="participants-panel">
      <div className="participant-summary">
        <strong>03</strong>
        <span>このルームに参加中</span>
        <span className="live-indicator"><span className="status-dot" /> 参加中</span>
      </div>
      <div className="participant-list">
        {participants.map((person, index) => (
          <article className="participant-row" key={person.initials}>
            <div className={`avatar avatar-${index + 1}`}>{person.initials}</div>
            <div className="participant-details">
              <strong>{person.name}</strong>
              <span>{person.role}</span>
            </div>
            <div className="participant-time">
              <strong>{person.time}</strong>
              <span>{person.active ? "作業中" : "休憩中"}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="room-total">
        <span className="field-label">ルームの合計作業時間</span>
        <strong>04<span>:</span>52<span>:</span>56</strong>
        <p>参加者それぞれの作業時間の合計</p>
      </div>
      <button className="text-action" type="button">＋ 招待リンクをコピー</button>
    </div>
  );
}
