"use client";

import ParticipantsPanel from "@/components/timer/panels/ParticipantsPanel";
import ProfilePanel from "@/components/timer/panels/ProfilePanel";
import RoomInfoPanel from "@/components/timer/panels/RoomInfoPanel";
import type { PanelId } from "@/components/timer/Navigation";
import type { RoomParticipant, RoomSummary } from "@/components/timer/types";

type SidePanelProps = {
  activePanel: PanelId | null;
  activeWorkStartedAt: string | null;
  allRoomsSeconds: number;
  bio: string | null;
  currentRoom: RoomSummary | null;
  currentRoomSeconds: number;
  displayName: string;
  isBusy: boolean;
  isLoggedIn: boolean;
  isTimerRunning: boolean;
  onCreateRoom: () => Promise<void>;
  onJoinRoom: (roomCode: string) => Promise<boolean>;
  onSelectRoom: (roomId: string) => void;
  onUpdateProfile: (displayName: string, bio: string) => Promise<boolean>;
  participantError: string;
  participants: RoomParticipant[];
  profileError: string;
  roomError: string;
  rooms: RoomSummary[];
  roomTotalSeconds: number;
  timerSegmentStartedAt: string | null;
};

const panelTitles: Record<PanelId, string> = {
  room: "ルーム情報",
  participants: "参加者",
  profile: "プロフィール",
};

export default function SidePanel({
  activePanel,
  activeWorkStartedAt,
  allRoomsSeconds,
  bio,
  currentRoom,
  currentRoomSeconds,
  displayName,
  isBusy,
  isLoggedIn,
  isTimerRunning,
  onCreateRoom,
  onJoinRoom,
  onSelectRoom,
  onUpdateProfile,
  participantError,
  participants,
  profileError,
  roomError,
  rooms,
  roomTotalSeconds,
  timerSegmentStartedAt,
}: SidePanelProps) {
  if (!activePanel) return null;

  const panelContent = {
    room: (
      <RoomInfoPanel
        currentRoom={currentRoom}
        error={roomError}
        isBusy={isBusy}
        isLoggedIn={isLoggedIn}
        onCreate={onCreateRoom}
        onJoin={onJoinRoom}
        onSelect={onSelectRoom}
        rooms={rooms}
      />
    ),
    participants: (
      <ParticipantsPanel
        currentRoom={currentRoom}
        error={participantError}
        isTimerRunning={isTimerRunning}
        participants={participants}
        roomTotalSeconds={roomTotalSeconds}
        timerSegmentStartedAt={timerSegmentStartedAt}
      />
    ),
    profile: (
      <ProfilePanel
        activeWorkStartedAt={activeWorkStartedAt}
        allRoomsSeconds={allRoomsSeconds}
        bio={bio}
        currentRoomCode={currentRoom?.roomCode ?? null}
        currentRoomSeconds={currentRoomSeconds}
        displayName={displayName}
        error={profileError}
        isLoggedIn={isLoggedIn}
        onUpdate={onUpdateProfile}
      />
    ),
  };

  return (
    <section aria-label={panelTitles[activePanel]} className="side-panel">
      <div className="panel-heading">
        <h2>{panelTitles[activePanel]}</h2>
      </div>
      <div className="panel-content">{panelContent[activePanel]}</div>
    </section>
  );
}
