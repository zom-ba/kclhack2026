"use client";

import { useEffect, useRef, useState } from "react";

export type TimerStatus = "idle" | "running" | "paused" | "completed";

const UPDATE_INTERVAL_MS = 250;

export default function useCountdownTimer(initialSeconds: number) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const [status, setStatus] = useState<TimerStatus>("idle");
  const endAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (status !== "running") return;

    function updateRemaining() {
      const endAt = endAtRef.current;
      if (endAt === null) return;

      const nextRemaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemaining((current) => current === nextRemaining ? current : nextRemaining);

      if (nextRemaining === 0) {
        endAtRef.current = null;
        setStatus("completed");
      }
    }

    updateRemaining();
    const interval = window.setInterval(updateRemaining, UPDATE_INTERVAL_MS);
    document.addEventListener("visibilitychange", updateRemaining);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", updateRemaining);
    };
  }, [status]);

  function start() {
    if (status === "running" || remaining <= 0) return;

    endAtRef.current = Date.now() + remaining * 1000;
    setStatus("running");
  }

  function pause() {
    if (status !== "running") return;

    const endAt = endAtRef.current;
    const nextRemaining = endAt === null
      ? remaining
      : Math.max(0, Math.ceil((endAt - Date.now()) / 1000));

    endAtRef.current = null;
    setRemaining(nextRemaining);
    setStatus(nextRemaining === 0 ? "completed" : "paused");
  }

  function toggle() {
    if (status === "running") {
      pause();
      return;
    }

    start();
  }

  function reset() {
    endAtRef.current = null;
    setRemaining(initialSeconds);
    setStatus("idle");
  }

  return {
    remaining,
    status,
    isRunning: status === "running",
    toggle,
    reset,
  };
}
