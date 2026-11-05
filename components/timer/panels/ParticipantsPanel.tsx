"use client";

import { useEffect, useState } from "react";
import formatDuration from "@/components/timer/formatDuration";
import type { RoomParticipant, RoomSummary } from "@/components/timer/types";

type ParticipantsPanelProps = {
  currentRoom: RoomSummary | null;
  error: string;
  isTimerRunning: boolean;
  participants: RoomParticipant[];
  roomTotalSeconds: number;
  timerSegmentStartedAt: string | null;
};

export default function ParticipantsPanel({
  currentRoom,
  error,
  isTimerRunning,
  participants,
  roomTotalSeconds,
  timerSegmentStartedAt,
}: ParticipantsPanelProps) {
  const [now, setNow] = useState(() => Date.now());
  const onlineCount = participants.filter(({ isOnline }) => isOnline).length;

  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [isTimerRunning]);

  function displayedSeconds(person: RoomParticipant) {
    if (!isTimerRunning || !timerSegmentStartedAt || !person.onlineAt) {
      return person.accumulatedSeconds;
    }

    const activeSince = Math.max(
      new Date(timerSegmentStartedAt).getTime(),
      new Date(person.onlineAt).getTime(),
    );
    return person.accumulatedSeconds + Math.max(0, Math.floor((now - activeSince) / 1000));
  }

  const displayedRoomTotal = roomTotalSeconds + participants.reduce(
    (total, participant) => total + displayedSeconds(participant) - participant.accumulatedSeconds,
    0,
  );

  async function copyRoomCode() {
    if (currentRoom) await navigator.clipboard.writeText(currentRoom.roomCode);
  }

  return (
    <div className="participants-panel">
      <div className="participant-summary">
        <strong>{onlineCount.toString().padStart(2, "0")}</strong>
        <span>このルームに参加中</span>
        <span className="live-indicator"><span className="status-dot" /> 参加中</span>
      </div>
      <div className="participant-list">
        {participants.map((person, index) => (
          <article className="participant-row" key={person.userId}>
            <div className={`avatar avatar-${index + 1}`}>{person.displayName.slice(0, 1)}</div>
            <div className="participant-details">
              <strong>{person.displayName}</strong>
              <span>{person.isOnline ? "オンライン" : "オフライン"}</span>
            </div>
            <div className="participant-time">
              <strong>{formatDuration(displayedSeconds(person))}</strong>
              <span>{person.isOnline && isTimerRunning ? "作業中" : "休憩中"}</span>
            </div>
          </article>
        ))}
        {!currentRoom ? <p className="panel-empty">ルームが選択されていません</p> : null}
      </div>
      <div className="room-total">
        <span className="field-label">ルームの合計作業時間</span>
        <strong>{formatDuration(displayedRoomTotal)}</strong>
        <p>参加者それぞれの作業時間の合計</p>
      </div>
      {error ? <p className="panel-error" role="status">{error}</p> : null}
      <button className="text-action" disabled={!currentRoom} onClick={() => void copyRoomCode()} type="button">＋ ルーム番号をコピー</button>
    </div>
  );
}
