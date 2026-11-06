"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SharedTimer } from "@/components/timer/types";

type TimerAction = "start" | "pause" | "reset" | "finalize";
type TimerResponse = { timer: SharedTimer; server_now: string };
type ClientWorkSession = { revision: number; roomId: string; startedAt: string };

function isTimerResponse(value: unknown): value is TimerResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<TimerResponse>;
  return Boolean(response.timer && response.server_now);
}

export default function useRoomTimer(
  roomId: string | null,
  userId: string | null,
  supabase: SupabaseClient,
) {
  const [timer, setTimer] = useState<SharedTimer | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState("");
  const [workSession, setWorkSession] = useState<ClientWorkSession | null>(null);
  const [accountingVersion, setAccountingVersion] = useState(0);
  const serverOffsetRef = useRef(0);
  const finalizedRevisionRef = useRef<number | null>(null);
  const controlRequestRef = useRef(0);
  const workSessionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const selectedRoomIdRef = useRef(roomId);
  const activeTimer = timer?.room_id === roomId ? timer : null;
  const workSessionStartedAt = activeTimer?.status === "running"
    && workSession?.roomId === roomId
    && workSession.revision === activeTimer.revision
    ? workSession.startedAt
    : null;

  useEffect(() => {
    selectedRoomIdRef.current = roomId;

    return () => {
      if (selectedRoomIdRef.current === roomId) selectedRoomIdRef.current = null;
    };
  }, [roomId]);

  const applyResponse = useCallback((response: TimerResponse) => {
    if (response.timer.room_id !== selectedRoomIdRef.current) return;

    serverOffsetRef.current = new Date(response.server_now).getTime() - Date.now();
    setTimer((current) => {
      if (
        current?.room_id === response.timer.room_id
        && current.revision > response.timer.revision
      ) {
        return current;
      }
      return response.timer;
    });
  }, []);

  const control = useCallback(async (action: TimerAction) => {
    if (!roomId) return;
    const requestId = ++controlRequestRef.current;
    setIsMutating(true);
    setError("");

    const { data, error: rpcError } = await supabase.rpc("control_room_timer", {
      requested_action: action,
      target_room_id: roomId,
    });

    if (selectedRoomIdRef.current !== roomId) return;

    if (rpcError) {
      setError(rpcError.message);
    } else if (isTimerResponse(data) && data.timer.room_id === roomId) {
      applyResponse(data);
    }

    if (controlRequestRef.current === requestId) setIsMutating(false);
  }, [applyResponse, roomId, supabase]);

  useEffect(() => {
    if (!roomId || !userId) {
      setTimer(null);
      setRemaining(0);
      setIsLoading(false);
      setError("");
      return;
    }

    let isMounted = true;
    controlRequestRef.current += 1;
    setTimer(null);
    setRemaining(0);
    setIsLoading(true);
    setIsMutating(false);
    setError("");
    serverOffsetRef.current = 0;
    finalizedRevisionRef.current = null;

    supabase.rpc("get_room_timer", { target_room_id: roomId }).then(({ data, error: rpcError }) => {
      if (!isMounted) return;
      if (rpcError) setError(rpcError.message);
      else if (isTimerResponse(data) && data.timer.room_id === roomId) applyResponse(data);
      else setError("ルームのタイマー情報を取得できませんでした");
      setIsLoading(false);
    });

    const channel = supabase
      .channel(`timer:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "timers",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const nextTimer = payload.new as SharedTimer;
          if (nextTimer.room_id !== selectedRoomIdRef.current) return;
          setTimer((current) => {
            if (
              current?.room_id === nextTimer.room_id
              && current.revision >= nextTimer.revision
            ) {
              return current;
            }
            return nextTimer;
          });
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [applyResponse, roomId, supabase, userId]);

  useEffect(() => {
    if (!activeTimer) return;

    if (activeTimer.status !== "running" || !activeTimer.ends_at) {
      setRemaining(activeTimer.remaining_seconds);
      return;
    }

    function updateRemaining() {
      const serverNow = Date.now() + serverOffsetRef.current;
      const nextRemaining = Math.max(
        0,
        Math.ceil((new Date(activeTimer!.ends_at!).getTime() - serverNow) / 1000),
      );
      setRemaining(nextRemaining);

      if (nextRemaining === 0 && finalizedRevisionRef.current !== activeTimer!.revision) {
        finalizedRevisionRef.current = activeTimer!.revision;
        void control("finalize");
      }
    }

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 250);
    document.addEventListener("visibilitychange", updateRemaining);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", updateRemaining);
    };
  }, [activeTimer, control]);

  useEffect(() => {
    if (!roomId || !userId || activeTimer?.status !== "running") return;

    let isCurrent = true;
    const sessionRoomId = roomId;
    const timerRevision = activeTimer.revision;

    const startTask = workSessionQueueRef.current.then(async () => {
      if (!isCurrent || selectedRoomIdRef.current !== sessionRoomId) return;

      const { data: sessionId, error: sessionError } = await supabase.rpc("start_work_session", {
        target_room_id: sessionRoomId,
      });

      if (!isCurrent || selectedRoomIdRef.current !== sessionRoomId) return;

      if (sessionError) {
        setError(`作業時間の計測を開始できませんでした: ${sessionError.message}`);
      } else if (typeof sessionId === "string") {
        setWorkSession({
          revision: timerRevision,
          roomId: sessionRoomId,
          startedAt: new Date().toISOString(),
        });
      } else {
        setError("作業時間の計測セッションを開始できませんでした");
      }
    });

    workSessionQueueRef.current = startTask.catch(() => undefined);
    const heartbeat = window.setInterval(() => {
      void supabase
        .rpc("heartbeat_work_session", { target_room_id: sessionRoomId })
        .then(({ error: heartbeatError }) => {
          if (isCurrent && selectedRoomIdRef.current === sessionRoomId && heartbeatError) {
            setError(`作業時間の計測を継続できませんでした: ${heartbeatError.message}`);
          }
        });
    }, 10_000);

    return () => {
      isCurrent = false;
      window.clearInterval(heartbeat);
      setWorkSession((current) => current?.roomId === sessionRoomId ? null : current);

      const closeTask = workSessionQueueRef.current.then(async () => {
        if (selectedRoomIdRef.current === sessionRoomId) return;

        const { error: closeError } = await supabase.rpc("close_work_session", {
          target_reason: "room_switch",
          target_room_id: sessionRoomId,
        });

        if (closeError) {
          setError(`切替前のルームの作業時間を確定できませんでした: ${closeError.message}`);
          return;
        }

        setAccountingVersion((current) => current + 1);
      });
      workSessionQueueRef.current = closeTask.catch(() => undefined);
    };
  }, [activeTimer?.revision, activeTimer?.status, roomId, supabase, userId]);

  return {
    accountingVersion,
    control,
    error,
    isLoading: isLoading || Boolean(roomId && userId && !activeTimer),
    isMutating,
    isRunning: activeTimer?.status === "running",
    remaining: activeTimer ? remaining : 0,
    reset: () => control("reset"),
    status: activeTimer?.status ?? null,
    timer: activeTimer,
    toggle: () => control(activeTimer?.status === "running" ? "pause" : "start"),
    workSessionStartedAt,
  };
}
