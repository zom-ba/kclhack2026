"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { OnlinePresence } from "@/components/timer/types";

type PresencePayload = {
  user_id?: unknown;
  online_at?: unknown;
};

export default function useRoomPresence(
  roomId: string | null,
  user: User | null,
  supabase: SupabaseClient,
) {
  const [onlineUsers, setOnlineUsers] = useState<OnlinePresence[]>([]);

  useEffect(() => {
    if (!roomId || !user) {
      setOnlineUsers([]);
      return;
    }

    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        private: true,
        presence: { key: user.id },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresencePayload>();
        const users = new Map<string, OnlinePresence>();

        Object.values(state).flat().forEach((presence) => {
          if (typeof presence.user_id !== "string" || typeof presence.online_at !== "string") return;
          const current = users.get(presence.user_id);
          if (!current || presence.online_at < current.onlineAt) {
            users.set(presence.user_id, {
              userId: presence.user_id,
              onlineAt: presence.online_at,
            });
          }
        });

        setOnlineUsers([...users.values()]);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [roomId, supabase, user]);

  return onlineUsers;
}
