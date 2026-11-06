"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import AuthDialog from "@/components/auth/AuthDialog";
import useAuth from "@/components/auth/useAuth";
import Navigation, { type PanelId } from "@/components/timer/Navigation";
import SidePanel from "@/components/timer/SidePanel";
import useCountdownTimer from "@/components/timer/useCountdownTimer";
import useProfileData from "@/components/timer/useProfileData";
import useRoomParticipants from "@/components/timer/useRoomParticipants";
import useRoomPresence from "@/components/timer/useRoomPresence";
import useRooms from "@/components/timer/useRooms";
import useRoomTimer from "@/components/timer/useRoomTimer";

const INITIAL_SECONDS = 25 * 60;
type ClickParticle = { id: number; rotation: number; x: number; y: number };
type ClickEffect = { id: number; particles: ClickParticle[]; x: number; y: number };
type ClickParticleStyle = CSSProperties & {
  "--particle-angle": string;
  "--particle-x": string;
  "--particle-y": string;
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export default function TimerWorkspace() {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const { isLoading: isAuthLoading, supabase, user } = useAuth();
  const guestTimer = useCountdownTimer(INITIAL_SECONDS);
  const roomsState = useRooms(user, supabase);
  const sharedTimer = useRoomTimer(roomsState.currentRoomId, user?.id ?? null, supabase);
  const onlineUsers = useRoomPresence(roomsState.currentRoomId, user, supabase);
  const participantState = useRoomParticipants(roomsState.currentRoomId, onlineUsers, supabase);
  const profile = useProfileData(user, roomsState.currentRoomId, supabase);
  const [clickEffects, setClickEffects] = useState<ClickEffect[]>([]);
  const nextEffectId = useRef(0);

  const hasSharedTimer = Boolean(user && roomsState.currentRoom);
  const remaining = hasSharedTimer ? sharedTimer.remaining : guestTimer.remaining;
  const isRunning = hasSharedTimer ? sharedTimer.isRunning : guestTimer.isRunning;
  const displayName = profile.displayName
    || (typeof user?.user_metadata.display_name === "string" ? user.user_metadata.display_name : "")
    || user?.email?.split("@")[0]
    || "ログイン";
  const avatarText = user ? displayName.slice(0, 1).toUpperCase() : "·";
  const timerSegmentStartedAt = sharedTimer.timer?.status === "running" && sharedTimer.timer.ends_at
    ? new Date(
      new Date(sharedTimer.timer.ends_at).getTime()
      - sharedTimer.timer.remaining_seconds * 1000,
    ).toISOString()
    : null;

  function togglePanel(panel: PanelId) {
    setActivePanel((current) => current === panel ? null : panel);
  }

  function showClickEffect(event: PointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const particleCount = 3 + Math.floor(Math.random() * 3);
    const directionOffset = Math.random() * Math.PI * 2;
    const effect = {
      id: nextEffectId.current++,
      particles: Array.from({ length: particleCount }, (_, index) => {
        const direction = directionOffset
          + (Math.PI * 2 * index) / particleCount
          + (Math.random() - 0.5) * 0.6;
        const distance = 24 + Math.random() * 20;

        return {
          id: index,
          rotation: Math.random() * 360,
          x: Math.cos(direction) * distance,
          y: Math.sin(direction) * distance,
        };
      }),
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
    setClickEffects((effects) => [...effects.slice(-7), effect]);
  }

  function toggleTimer() {
    if (hasSharedTimer) void sharedTimer.toggle();
    else guestTimer.toggle();
  }

  function resetTimer() {
    if (hasSharedTimer) void sharedTimer.reset();
    else guestTimer.reset();
  }

  const timerIsBusy = hasSharedTimer
    && (sharedTimer.isLoading || sharedTimer.isMutating || !sharedTimer.timer);

  return (
    <main className="timer-app" onPointerDown={showClickEffect}>
      <div aria-hidden="true" className="click-effects">
        {clickEffects.map((effect) => (
          <span
            className="click-effect"
            key={effect.id}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget && event.animationName === "click-effect-life") {
                setClickEffects((effects) => effects.filter(({ id }) => id !== effect.id));
              }
            }}
            style={{ left: effect.x, top: effect.y }}
          >
            {effect.particles.map((particle) => (
              <span
                className="click-particle"
                key={particle.id}
                style={{
                  "--particle-angle": `${particle.rotation}deg`,
                  "--particle-x": `${particle.x}px`,
                  "--particle-y": `${particle.y}px`,
                } as ClickParticleStyle}
              />
            ))}
          </span>
        ))}
      </div>
      <header className="topbar">
        <a aria-label="EveryTick ホーム" className="wordmark" href="#">
          EveryTick
        </a>
        <button className="account-button" onClick={() => setIsAuthOpen(true)} type="button">
          <span className="mini-avatar">{avatarText}</span><span>{isAuthLoading ? "..." : displayName}</span>
        </button>
      </header>

      <div className="work-area">
        <section aria-label={hasSharedTimer ? "共有タイマー" : "単体タイマー"} className="timer-stage">
          <div aria-hidden="true" className="timer-ornaments">
            <div className="stage-rule" />
            <div className="ornament-pattern pattern-cross pattern-top-left">
              <span className="pattern-square square-one" />
              <span className="pattern-square square-two" />
              <span className="pattern-square square-three" />
            </div>
            <div className="ornament-pattern pattern-dots pattern-bottom-right">
              <span className="pattern-square square-one" />
              <span className="pattern-square square-two" />
              <span className="pattern-square square-three" />
            </div>
          </div>
          <div className="timer-core">
            <div className="timer-readout">
              <span aria-hidden="true" className="timer-circle" />
              <svg
                aria-label={formatTime(remaining)}
                className="timer-display"
                role="img"
                viewBox="0 0 700 200"
                xmlns="http://www.w3.org/2000/svg"
              >
                <text
                  dominantBaseline="middle"
                  fill="currentColor"
                  stroke="none"
                  textAnchor="middle"
                  x="350"
                  y="100"
                >
                  {formatTime(remaining)}
                </text>
              </svg>
            </div>
            <div className="timer-actions">
              <button aria-label={isRunning ? "停止" : "再生"} className="timer-action-button" disabled={remaining === 0 || timerIsBusy} onClick={toggleTimer} title={isRunning ? "停止" : "再生"} type="button">
                {isRunning ? (
                  <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" /></svg>
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5.8a1 1 0 0 1 1.5-.86l10 6.2a1 1 0 0 1 0 1.72l-10 6.2a1 1 0 0 1-1.5-.86z" /></svg>
                )}
              </button>
              <button aria-label="リスタート" className="timer-action-button" disabled={timerIsBusy} onClick={resetTimer} title="リスタート" type="button">
                <svg aria-hidden="true" className="restart-icon" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0 1 5" /><path d="M20 4v7h-7" /></svg>
              </button>
            </div>
            {hasSharedTimer && sharedTimer.error ? <p className="timer-error" role="status">{sharedTimer.error}</p> : null}
          </div>

        </section>

        <aside className="workspace-aside">
          <Navigation activePanel={activePanel} onSelect={togglePanel} />
          <SidePanel
            activePanel={activePanel}
            allRoomsSeconds={profile.allRoomsSeconds}
            bio={profile.bio}
            currentRoom={roomsState.currentRoom}
            currentRoomSeconds={profile.currentRoomSeconds}
            displayName={displayName}
            isBusy={roomsState.isLoading || roomsState.isMutating}
            isLoggedIn={Boolean(user)}
            isTimerRunning={isRunning}
            onCreateRoom={roomsState.createRoom}
            onJoinRoom={roomsState.joinRoom}
            onSelectRoom={roomsState.selectRoom}
            onUpdateProfile={profile.updateProfile}
            participantError={participantState.error}
            participants={participantState.participants}
            roomError={roomsState.error}
            rooms={roomsState.rooms}
            roomTotalSeconds={participantState.roomTotalSeconds}
            timerSegmentStartedAt={timerSegmentStartedAt}
          />
        </aside>
      </div>
      <AuthDialog
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        supabase={supabase}
        user={user}
      />
    </main>
  );
}
