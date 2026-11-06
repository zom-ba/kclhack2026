"use client";

import { useEffect, useState, type FormEvent } from "react";
import formatDuration from "@/components/timer/formatDuration";
import UserAvatar from "@/components/timer/UserAvatar";

type ProfilePanelProps = {
  activeWorkStartedAt: string | null;
  allRoomsSeconds: number;
  avatarSeed: string;
  bio: string | null;
  currentRoomCode: string | null;
  currentRoomSeconds: number;
  displayName: string;
  error: string;
  isLoggedIn: boolean;
  onUpdate: (displayName: string, bio: string) => Promise<boolean>;
};

export default function ProfilePanel({
  activeWorkStartedAt,
  allRoomsSeconds,
  avatarSeed,
  bio,
  currentRoomCode,
  currentRoomSeconds,
  displayName,
  error,
  isLoggedIn,
  onUpdate,
}: ProfilePanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const [bioInput, setBioInput] = useState(bio ?? "");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const activeSeconds = activeWorkStartedAt
    ? Math.max(0, Math.floor((now - new Date(activeWorkStartedAt).getTime()) / 1000))
    : 0;

  useEffect(() => {
    setNameInput(displayName);
    setBioInput(bio ?? "");
  }, [bio, displayName]);

  useEffect(() => {
    if (!activeWorkStartedAt) return;

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeWorkStartedAt]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nameInput.trim()) return;
    const updated = await onUpdate(nameInput, bioInput);
    setMessage(updated ? "更新しました" : "更新できませんでした");
    if (updated) setIsEditing(false);
  }

  return (
    <div className="profile-panel">
      <UserAvatar className="profile-portrait" seed={avatarSeed} />
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
          <strong>{formatDuration(allRoomsSeconds + activeSeconds)}</strong>
          <small>すべてのルーム</small>
        </div>
        <div>
          <span className="field-label">このルームの合計</span>
          <strong>{formatDuration(currentRoomSeconds + activeSeconds)}</strong>
          <small>{currentRoomCode ? `ルーム ${currentRoomCode}` : "ルーム未選択"}</small>
        </div>
      </div>
      {isLoggedIn ? <button className="text-action" onClick={() => setIsEditing((current) => !current)} type="button">＋ プロフィールを編集</button> : null}
      {message ? <p className="panel-error" role="status">{message}</p> : null}
      {error ? <p className="panel-error" role="status">{error}</p> : null}
    </div>
  );
}
