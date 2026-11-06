"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { RoomSummary } from "@/components/timer/types";

type MembershipRow = {
  room_id: string;
  joined_at: string;
};

type RoomRow = {
  id: string;
  room_code: string;
};

type RoomRpcRow = {
  room_id: string;
  room_code: string;
};

function firstRpcRow(data: unknown): RoomRpcRow | null {
  if (Array.isArray(data)) return (data[0] as RoomRpcRow | undefined) ?? null;
  return (data as RoomRpcRow | null) ?? null;
}

export default function useRooms(user: User | null, supabase: SupabaseClient) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState("");
  const mutationInFlightRef = useRef(false);

  const selectRoom = useCallback((roomId: string | null) => {
    setCurrentRoomId(roomId);
    if (user) {
      const storageKey = `everytick:current-room:${user.id}`;
      if (roomId) localStorage.setItem(storageKey, roomId);
      else localStorage.removeItem(storageKey);
    }
  }, [user]);

  const loadRooms = useCallback(async () => {
    if (!user) {
      setRooms([]);
      setCurrentRoomId(null);
      return;
    }

    setIsLoading(true);
    setError("");

    const { data: membershipData, error: membershipError } = await supabase
      .from("room_memberships")
      .select("room_id, joined_at")
      .order("joined_at", { ascending: false });

    if (membershipError) {
      setError(membershipError.message);
      setIsLoading(false);
      return;
    }

    const membershipByRoom = new Map<string, MembershipRow>();
    for (const membership of (membershipData ?? []) as MembershipRow[]) {
      if (!membershipByRoom.has(membership.room_id)) {
        membershipByRoom.set(membership.room_id, membership);
      }
    }
    const memberships = [...membershipByRoom.values()];
    if (memberships.length === 0) {
      setRooms([]);
      setCurrentRoomId(null);
      setIsLoading(false);
      return;
    }

    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("id, room_code")
      .in("id", memberships.map(({ room_id }) => room_id));

    if (roomError) {
      setError(roomError.message);
      setIsLoading(false);
      return;
    }

    const roomById = new Map(
      ((roomData ?? []) as RoomRow[]).map((room) => [room.id, room]),
    );
    const nextRooms = memberships.flatMap((membership) => {
      const room = roomById.get(membership.room_id);
      return room ? [{
        id: room.id,
        roomCode: room.room_code,
        joinedAt: membership.joined_at,
      }] : [];
    });

    setRooms(nextRooms);

    const storedRoomId = localStorage.getItem(`everytick:current-room:${user.id}`);
    setCurrentRoomId((current) => {
      const candidate = current ?? storedRoomId;
      return nextRooms.some(({ id }) => id === candidate) ? candidate : null;
    });
    setIsLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  async function createRoom() {
    if (!user || mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    setIsMutating(true);
    setError("");

    try {
      const { data, error: rpcError } = await supabase.rpc("create_room");
      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      const createdRoom = firstRpcRow(data);
      await loadRooms();
      if (createdRoom) selectRoom(createdRoom.room_id);
    } finally {
      mutationInFlightRef.current = false;
      setIsMutating(false);
    }
  }

  async function joinRoom(roomCode: string) {
    if (!user || mutationInFlightRef.current) return false;
    if (!/^\d{4}$/.test(roomCode)) {
      setError("ルーム番号は4桁の数字で入力してください");
      return false;
    }

    mutationInFlightRef.current = true;
    setIsMutating(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("join_room", {
        target_room_code: roomCode,
      });

      if (rpcError) {
        setError(rpcError.message);
        return false;
      }

      const joinedRoom = firstRpcRow(data);
      if (!joinedRoom) {
        setError("参加したルームの情報を取得できませんでした");
        return false;
      }

      await loadRooms();
      selectRoom(joinedRoom.room_id);
      return true;
    } finally {
      mutationInFlightRef.current = false;
      setIsMutating(false);
    }
  }

  return {
    createRoom,
    currentRoom: rooms.find(({ id }) => id === currentRoomId) ?? null,
    currentRoomId,
    error,
    isLoading,
    isMutating,
    joinRoom,
    loadRooms,
    rooms,
    selectRoom,
  };
}
