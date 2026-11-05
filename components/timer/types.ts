export type RoomSummary = {
  id: string;
  roomCode: string;
  joinedAt: string;
};

export type SharedTimerStatus = "idle" | "running" | "paused" | "completed";

export type SharedTimer = {
  room_id: string;
  status: SharedTimerStatus;
  duration_seconds: number;
  remaining_seconds: number;
  ends_at: string | null;
  revision: number;
  updated_by: string | null;
  updated_at: string;
};

export type RoomParticipant = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  accumulatedSeconds: number;
  isOnline: boolean;
  onlineAt: string | null;
};

export type OnlinePresence = {
  userId: string;
  onlineAt: string;
};
