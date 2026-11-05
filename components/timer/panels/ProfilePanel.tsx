"use client";

import { useEffect, useState, type FormEvent } from "react";
import formatDuration from "@/components/timer/formatDuration";

type ProfilePanelProps = {
  allRoomsSeconds: number;
  bio: string | null;
  currentRoomCode: string | null;
  currentRoomSeconds: number;
  displayName: string;
  isLoggedIn: boolean;
  onUpdate: (displayName: string, bio: string) => Promise<boolean>;
};

export default function ProfilePanel({
  allRoomsSeconds,
  bio,
  currentRoomCode,
  currentRoomSeconds,
  displayName,
  isLoggedIn,
  onUpdate,
}: ProfilePanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const [bioInput, setBioInput] = useState(bio ?? "");
  const [message, setMessage] = useState("");
  const initials = displayName.slice(0, 2).toUpperCase();

  useEffect(() => {
    setNameInput(displayName);
    setBioInput(bio ?? "");
  }, [bio, displayName]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nameInput.trim()) return;
    const updated = await onUpdate(nameInput, bioInput);
    setMessage(updated ? "更新しました" : "更新できませんでした");
    if (updated) setIsEditing(false);
  }

  return (
    <div className="profile-panel">
      <div className="profile-portrait" aria-hidden="true"><span>{initials || "--"}</span></div>
      <div className="profile-name">
        <h3>{isLoggedIn ? displayName || "ユーザー" : "未ログイン"}</h3>
        {bio ? <span>{bio}</span> : null}
      </div>
      {isEditing ? (
        <form className="profile-edit" onSubmit={saveProfile}>
          <input aria-label="表示名" maxLength={50} onChange={(event) => setNameInput(event.target.value)} required value={nameInput} />
          <textarea aria-label="ひとこと" maxLength={160} onChange={(event) => setBioInput(event.target.value)} value={bioInput} />
          <button type="submit">保存</button>
        </form>
      ) : null}
      <div className="profile-stats">
        <div>
          <span className="field-label">全ルームの合計</span>
          <strong>{formatDuration(allRoomsSeconds)}</strong>
          <small>すべてのルーム</small>
        </div>
        <div>
          <span className="field-label">このルームの合計</span>
          <strong>{formatDuration(currentRoomSeconds)}</strong>
          <small>{currentRoomCode ? `ルーム ${currentRoomCode}` : "ルーム未選択"}</small>
        </div>
      </div>
      {isLoggedIn ? <button className="text-action" onClick={() => setIsEditing((current) => !current)} type="button">＋ プロフィールを編集</button> : null}
      {message ? <p className="panel-error" role="status">{message}</p> : null}
    </div>
  );
}
