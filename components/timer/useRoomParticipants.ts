"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnlinePresence, RoomParticipant } from "@/components/timer/types";

type MembershipRow = { user_id: string };
type ProfileRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};
type RecordRow = {
  user_id: string;
  accumulated_seconds: number;
};

export default function useRoomParticipants(
  roomId: string | null,
  onlineUsers: OnlinePresence[],
  supabase: SupabaseClient,
) {
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [error, setError] = useState("");
  const selectedRoomIdRef = useRef(roomId);
  selectedRoomIdRef.current = roomId;

  const loadParticipants = useCallback(async () => {
    if (!roomId) {
      setParticipants([]);
      return;
    }

    const { data: membershipData, error: membershipError } = await supabase
      .from("room_memberships")
      .select("user_id")
      .eq("room_id", roomId);

    if (selectedRoomIdRef.current !== roomId) return;

    if (membershipError) {
      setError(membershipError.message);
      return;
    }

    const userIds = ((membershipData ?? []) as MembershipRow[]).map(({ user_id }) => user_id);
    if (userIds.length === 0) {
      setParticipants([]);
      return;
    }

    const [profilesResult, recordsResult] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds),
      supabase.from("user_records").select("user_id, accumulated_seconds").eq("room_id", roomId),
    ]);

    if (selectedRoomIdRef.current !== roomId) return;

    if (profilesResult.error || recordsResult.error) {
      setError(profilesResult.error?.message ?? recordsResult.error?.message ?? "参加者を取得できませんでした");
      return;
    }

    const profiles = new Map(
      ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.user_id, profile]),
    );
    const records = new Map(
      ((recordsResult.data ?? []) as RecordRow[]).map((record) => [record.user_id, record]),
    );

    setParticipants(userIds.map((userId) => ({
      userId,
      displayName: profiles.get(userId)?.display_name ?? "ユーザー",
      avatarUrl: profiles.get(userId)?.avatar_url ?? null,
      accumulatedSeconds: records.get(userId)?.accumulated_seconds ?? 0,
      isOnline: false,
      onlineAt: null,
    })));
    setError("");
  }, [roomId, supabase]);

  useEffect(() => {
    setParticipants([]);
    setError("");
    void loadParticipants();
    if (!roomId) return;

    const channel = supabase
      .channel(`records:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_records",
          filter: `room_id=eq.${roomId}`,
        },
        () => void loadParticipants(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadParticipants, roomId, supabase]);

  const onlineByUserId = useMemo(
    () => new Map(onlineUsers.map((presence) => [presence.userId, presence])),
    [onlineUsers],
  );
  const participantsWithPresence = participants.map((participant) => ({
    ...participant,
    isOnline: onlineByUserId.has(participant.userId),
    onlineAt: onlineByUserId.get(participant.userId)?.onlineAt ?? null,
  }));

  return {
    error,
    loadParticipants,
    participants: participantsWithPresence,
    roomTotalSeconds: participants.reduce(
      (total, participant) => total + participant.accumulatedSeconds,
      0,
    ),
  };
}
