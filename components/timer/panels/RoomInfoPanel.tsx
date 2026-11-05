"use client";

import { useState, type FormEvent } from "react";
import type { RoomSummary } from "@/components/timer/types";

type RoomInfoPanelProps = {
  currentRoom: RoomSummary | null;
  error: string;
  isBusy: boolean;
  isLoggedIn: boolean;
  onCreate: () => Promise<void>;
  onJoin: (roomCode: string) => Promise<boolean>;
  onSelect: (roomId: string) => void;
  rooms: RoomSummary[];
};

export default function RoomInfoPanel({
  currentRoom,
  error,
  isBusy,
  isLoggedIn,
  onCreate,
  onJoin,
  onSelect,
  rooms,
}: RoomInfoPanelProps) {
  const [roomCode, setRoomCode] = useState("");

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const joined = await onJoin(roomCode);
    if (joined) setRoomCode("");
  }

  return (
    <div className="room-panel">
      <div className="current-room">
        <span className="field-label">現在のルーム</span>
        <strong>{currentRoom?.roomCode ?? "----"}</strong>
        <span className="room-state">{currentRoom ? <><span className="status-dot" /> 利用中</> : "未選択"}</span>
      </div>

      <label className="field-label" htmlFor="room-code">ルーム番号</label>
      <form className="room-entry" onSubmit={handleJoin}>
        <input
          disabled={!isLoggedIn || isBusy}
          id="room-code"
          inputMode="numeric"
          maxLength={4}
          onChange={(event) => setRoomCode(event.target.value.replace(/\D/g, ""))}
          placeholder="4桁の番号"
          value={roomCode}
        />
        <button disabled={!isLoggedIn || isBusy || roomCode.length !== 4} type="submit">参加 <span aria-hidden="true">↗</span></button>
      </form>

      <div className="list-heading">
        <span className="field-label">最近のルーム</span>
        <span className="muted-label">{rooms.length.toString().padStart(2, "0")}</span>
      </div>
      {rooms.map((room) => (
        <button
          className={`room-list-item${room.id === currentRoom?.id ? " is-current" : ""}`}
          key={room.id}
          onClick={() => onSelect(room.id)}
          type="button"
        >
          <span className="room-list-mark">/</span>
          <span><strong>ルーム {room.roomCode}</strong><small>{room.id === currentRoom?.id ? "現在のルーム" : "所属中"}</small></span>
          <span className="room-arrow">↗</span>
        </button>
      ))}
      {rooms.length === 0 ? <p className="panel-empty">{isLoggedIn ? "所属ルームはありません" : "ログインが必要です"}</p> : null}
      {error ? <p className="panel-error" role="status">{error}</p> : null}
      <button className="text-action" disabled={!isLoggedIn || isBusy} onClick={() => void onCreate()} type="button">＋ 新しいルームを作成</button>
    </div>
  );
}
