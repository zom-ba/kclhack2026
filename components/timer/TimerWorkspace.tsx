"use client";

import { useRef, useState, type PointerEvent } from "react";
import Navigation, { type PanelId } from "@/components/timer/Navigation";
import SidePanel from "@/components/timer/SidePanel";
import useCountdownTimer from "@/components/timer/useCountdownTimer";

const INITIAL_SECONDS = 25 * 60;
type ClickEffect = { id: number; x: number; y: number };

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export default function TimerWorkspace() {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const { remaining, isRunning, toggle, reset } = useCountdownTimer(INITIAL_SECONDS);
  const [clickEffects, setClickEffects] = useState<ClickEffect[]>([]);
  const nextEffectId = useRef(0);

  function togglePanel(panel: PanelId) {
    setActivePanel((current) => current === panel ? null : panel);
  }

  function showClickEffect(event: PointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const effect = {
      id: nextEffectId.current++,
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
    setClickEffects((effects) => [...effects.slice(-7), effect]);
  }

  return (
    <main className={`timer-app${activePanel ? " panel-is-open" : ""}`} onPointerDown={showClickEffect}>
      <div aria-hidden="true" className="click-effects">
        {clickEffects.map((effect) => (
          <span
            className="click-effect"
            key={effect.id}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget && event.animationName === "click-fade") {
                setClickEffects((effects) => effects.filter(({ id }) => id !== effect.id));
              }
            }}
            style={{ left: effect.x, top: effect.y }}
          >
            <svg viewBox="0 0 64 64">
              <defs>
                <mask id={`click-mask-${effect.id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
                  <rect width="64" height="64" fill="white" />
                  <circle className="click-hole" cx="32" cy="32" r="20" fill="black" />
                </mask>
              </defs>
              <circle className="click-disk" cx="32" cy="32" r="20" fill="currentColor" mask={`url(#click-mask-${effect.id})`} />
            </svg>
          </span>
        ))}
      </div>
      <header className="topbar">
        <a aria-label="EveryTick ホーム" className="wordmark" href="#">
          EveryTick
        </a>
        <button className="account-button" type="button">
          <span className="mini-avatar">K</span><span>堂城 奏羽</span>
        </button>
      </header>

      <div className="work-area">
        <section aria-label="共有タイマー" className="timer-stage">
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
              <button aria-label={isRunning ? "停止" : "再生"} className="timer-action-button" disabled={remaining === 0} onClick={toggle} title={isRunning ? "停止" : "再生"} type="button">
                {isRunning ? (
                  <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" /></svg>
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5.8a1 1 0 0 1 1.5-.86l10 6.2a1 1 0 0 1 0 1.72l-10 6.2a1 1 0 0 1-1.5-.86z" /></svg>
                )}
              </button>
              <button aria-label="リスタート" className="timer-action-button" onClick={reset} title="リスタート" type="button">
                <svg aria-hidden="true" className="restart-icon" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0 1 5" /><path d="M20 4v7h-7" /></svg>
              </button>
            </div>
          </div>

        </section>

        <aside className="workspace-aside">
          <Navigation activePanel={activePanel} onSelect={togglePanel} />
          <SidePanel activePanel={activePanel} />
        </aside>
      </div>
    </main>
  );
}
