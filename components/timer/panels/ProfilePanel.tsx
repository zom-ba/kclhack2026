export default function ProfilePanel() {
  return (
    <div className="profile-panel">
      <div className="profile-portrait" aria-hidden="true"><span>AK</span></div>
      <div className="profile-name">
        <h3>青木 健</h3>
      </div>
      <div className="profile-stats">
        <div>
          <span className="field-label">全ルームの合計</span>
          <strong>128<span>時間</span> 36<span>分</span></strong>
          <small>すべてのルーム</small>
        </div>
        <div>
          <span className="field-label">このルームの合計</span>
          <strong>12<span>時間</span> 08<span>分</span></strong>
          <small>ルーム 3446</small>
        </div>
      </div>
    </div>
  );
}
