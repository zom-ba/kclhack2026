export default function RoomInfoPanel() {
  return (
    <div className="room-panel">
      <div className="current-room">
        <span className="field-label">現在のルーム</span>
        <strong>3446</strong>
        <span className="room-state"><span className="status-dot" /> 利用中</span>
      </div>

      <label className="field-label" htmlFor="room-code">ルーム番号</label>
      <div className="room-entry">
        <input id="room-code" inputMode="numeric" placeholder="番号を入力" />
        <button type="button">参加 <span aria-hidden="true">↗</span></button>
      </div>

      <div className="list-heading">
        <span className="field-label">最近のルーム</span>
        <span className="muted-label">02</span>
      </div>
      <button className="room-list-item is-current" type="button">
        <span className="room-list-mark">/</span>
        <span><strong>ルーム 3446</strong><small>現在のルーム</small></span>
        <span className="room-arrow">↗</span>
      </button>
      <button className="room-list-item" type="button">
        <span className="room-list-mark">/</span>
        <span><strong>ルーム 1211</strong><small>昨日 · 18:40</small></span>
        <span className="room-arrow">↗</span>
      </button>
      <button className="room-list-item" type="button">
        <span className="room-list-mark">/</span>
        <span><strong>ルーム 3501</strong><small>月曜日 · 21:12</small></span>
        <span className="room-arrow">↗</span>
      </button>
      <button className="text-action" type="button">＋ 新しいルームを作成</button>
    </div>
  );
}
