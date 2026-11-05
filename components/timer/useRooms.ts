"use client";

import { useCallback, useEffect, useState } from "react";
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

    const memberships = (membershipData ?? []) as MembershipRow[];
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
    if (!user || isMutating) return;
    setIsMutating(true);
    setError("");

    const { data, error: rpcError } = await supabase.rpc("create_room");
    if (rpcError) {
      setError(rpcError.message);
      setIsMutating(false);
      return;
    }

    const createdRoom = firstRpcRow(data);
    await loadRooms();
    if (createdRoom) selectRoom(createdRoom.room_id);
    setIsMutating(false);
  }

  async function joinRoom(roomCode: string) {
    if (!user || isMutating) return false;
    if (!/^\d{4}$/.test(roomCode)) {
      setError("ルーム番号は4桁の数字で入力してください");
      return false;
    }

    setIsMutating(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("join_room", {
      target_room_code: roomCode,
    });

    if (rpcError) {
      setError(rpcError.message);
      setIsMutating(false);
      return false;
    }

    const joinedRoom = firstRpcRow(data);
    await loadRooms();
    if (joinedRoom) selectRoom(joinedRoom.room_id);
    setIsMutating(false);
    return true;
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
